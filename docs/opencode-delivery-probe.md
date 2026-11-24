# OpenCode V2：投递与已读验证

本文记录传输探针。探针中「合批投递原文」属于备选方案；当前 MVP 已改为[不带正文的未读概览提醒](design.md#提醒只带未读概览)。每轮结束后继续提醒、发言前检查、发送尾窗已读和引用展开均尚未实现。

在本机使用真实 **OpenCode v2.3.2**、独立的 loopback 服务、内存数据库，以及可控的本地 OpenAI-compatible 模拟模型。没有使用外部模型或当前聊天会话。完整探针连续通过三次。

## 实测结果

| 问题 | 结果 |
| --- | --- |
| 空闲时 `queue` 能唤醒吗？ | 可以。初始 prompt 以 `queue` 提交后，模型收到请求。另一个以 `resume: false` 提交的 prompt 只进入待处理 inbox，没有发起模型请求。 |
| 忙碌时 `steer` 和 `queue` 有区别吗？ | 有。模型首个请求仍挂起时，先提交 Q（`queue`）再提交 S（`steer`），两条先进入 inbox。释放首请求并执行工具后，第二个请求包含 S、不含 Q；第三个请求才出现 Q。S 可以越过先入队的 Q；未中断首个请求。 |
| HTTP 成功、`session.inbox.delivered` 或 `context` hook 能直接算已读吗？ | 都不能。把 `context` hook 在 S 对应的调用上挂住时，已经收到 `delivered`，hook 也已看到正文，但模型端尚未收到。在另一条输入上故意让 `context` hook 抛错，同样发出 `delivered`，却从未请求模型，也没有产生该次请求的 `session.step.first-token`。 |
| `context` hook 能关联哪些房间消息？ | 可以读到组装后的正文和 `session.prompt.metadata` 中的结构化房间消息 ID。正常请求在 SSE 上出现 `session.step.first-token`，带 `assistantMessageID`；`context` hook 不直接提供此 ID。这次没有证明仅靠公开事件能在重试、取消、并发等场景中可靠关联两者。 |
| 相同 ID 可以安全重试吗？ | 待处理时，同 ID 返回原入队项。投递后用同 ID 和 `resume: true` 重试，正文及 metadata 保留，未发生新入队、新投递或额外模型调用。不过投递后的重试响应重新给了 `time.created`，并回显重试请求的 `delivery`（原 `steer` 重试为 `queue` 时返回 `queue`）。因此不要用这两个字段回填原始投递记录。 |

实际模型请求顺序：

```text
1. 初始输入                         ← 提交时会话空闲
2. 初始输入 + S                     ← 工具边界，S 先进入
3. 初始输入 + S + Q                 ← 前一处理结束，Q 才进入
```

## 对 MVP 的影响

1. 向 OpenCode 交付时保留本项目决定的批次 ID、最初模式、入队时间及帖子 IDs。使用同一输入 ID 重试；利用 `metadata` 将一批输入关联到多条群帖。不要从重试响应反推历史。
2. 会话接纳成功显示「已接纳」，`session.inbox.delivered` 显示「已投递」。`context` hook 只提供潜在的已读候选。能可靠关联同一次真实模型请求及响应时再计自动已读；无法关联时保留「已投递」，不猜测。主动读取历史正文的模型呈现路径还需另测。
3. 本次仅验证 HTTP 模拟 provider 上的正常请求与 pre-dispatch 失败。没有验证真实 provider 的协议差异、断线或服务重启后的投递与去重、原生表单或权限等待。不能从内存数据库结果推断跨重启行为。

## OpenChamber 无界面集成验证

用 **OpenChamber 2.7.3 + OpenCode 2.3.2** 在隔离的本机实例跑了两个真实会话，模型仍用本地模拟：

1. OpenChamber 安装并批准临时扩展，登记扩展附带的 OpenCode 插件。扩展声明 `keepRunning`，不打开浏览器或面板，后台服务也启动。
2. 会话 A 调用两次插件工具，分别发普通帖和点名帖。插件使用调用方真实会话 ID 将帖子送到本地后台。第一条到达时，会话 B 正忙，普通帖留在房间队列，OpenCode inbox 仍为空。
3. 点名帖到达后，后台将两帖按序号合为一次 `steer`，不等固定合并窗。插件用 `ctx.session.prompt` 提交，B 的下一个模型请求同时包含两条正文，较早的普通帖在前。两个帖子 ID 都在批次 metadata 中。

OpenChamber 2.7.3 的 OpenCode 代理用于读 `/api/session/active` 和会话消息，不能用它提交 `queue` / `steer`；写入在服务端插件内完成。探针的地址和凭据只用于临时同机实例，不作为正式配置协议。探针用临时 JSON 日志保留待投递、已领取与确认，只验证单服务、单分发器的路径，不是产品队列。面板从未打开也能正常投递；没有测试实际 UI。

## 两种忙碌投递策略的对照

- **房间缓冲，空闲后投递**（`--openchamber-idle`）：普通帖在忙碌期间只留在房间，不发送点名，不需要人为唤醒。释放被模拟模型挂起的请求后，工具和当前轮继续执行，后台观察到目标不在 `/api/session/active` 后自动提交帖子。两组各三次本机测试，从释放请求到下一次模型收到帖子共 **56–105 ms**，包含旧轮剩余步骤和探针的 40 ms 扫描间隔，不是线上延迟保证。第二组同时监听 OpenCode SSE：三次都观察到 `session.execution.succeeded`，没有观察到 `session.idle`。快速路径应以 `session.execution.*` 的终态触发状态复核，定期扫描补偿漏事件。
- **提前入 OpenCode inbox，再转 `steer`**（`--promotion`）：只把较新的 Q2 改成 `steer` 会让 Q2 和紧急帖越过 Q1。当 Q1、Q2 和紧急帖的更新都赶在同一个模型边界前完成，三条确实按 Q1 → Q2 → 紧急帖一起进入下一次模型调用。但当运行时在多次请求之间继续前进，旧帖可以先分开进入两个模型请求，下一次更新已送达条目返回 **HTTP 409**；最后紧急帖单独进入下一次请求。接口只改一个待投递条目的模式，不能原地追加正文或原子合并多个条目。
- **原备选**：房间缓冲后按序发送原文；单条升级只作竞态补救。现行 MVP 只送未读提醒，复用事件唤醒和输入 ID 去重，不复用逐帖投递队列。

## 补齐端到端验证

| 场景 | 如何验证 | 结果 |
| --- | --- | --- |
| 结束事件快速路径（`--openchamber-event`） | 禁用周期扫描，插件订阅 OpenCode 终态；房间服务复核活跃状态，探针记录触发它提交的事件和会话 ID。 | 目标会话自己的终态事件触发普通帖补投。与 `--openchamber-idle` 的纯扫描路径分别通过；并未测试在线 SSE 断开后重连的握手。 |
| 旧批已进 inbox（`--openchamber-race`） | 故意让普通帖先成为 OpenCode 的待投 `queue`。点名后检查旧批原 ID 升级；放行当前请求，再故意挂住包含旧批的下一次模型请求。 | 旧批先进入模型；它的请求仍挂起时，新 `steer` 已进入 inbox。随后模型按旧帖 → 点名顺序获取正文。新帖不等待旧批完成，既没有撤销也没有复制旧批。已送达条目返回 `409` 另由 `--promotion` 覆盖。 |
| 扩展服务重启（`--openchamber-restart`） | 第一次在普通帖仍缓冲时让扩展进程退出；第二次在 OpenCode 接纳后、房间写入确认前退出。每次验证由 OpenChamber 拉起了另一个服务进程。 | 积压从日志恢复，使用原消息 ID。确认丢失后从会话记录对账，没有额外模型调用。 |
| OpenCode 进程重启（`--opencode-restart`） | 隔离磁盘数据库，先在 inbox 停放一个 ID，重启后按同 ID `resume: true`；送达后再重启并重提同 ID。 | 待投队列及原文保留，恢复只触发一次模型调用；第二次重启后已送达 ID 不重新入队或运行。 |
| Agent 发帖限宽（`--openchamber-length`） | 真实会话连续调用发帖工具，提交含中文、ASCII 英文和 emoji 的文本。 | 显示宽度 101 返回 `ROOM_MESSAGE_TOO_LONG`，未写房间记录或收件 inbox；宽度 100 完整写入并送达。路径点击、提问和撤回仍只在设计里。 |

这些是可控的集成场景，不承诺生产环境的并发、双进程同时崩溃、断电持久性或实际模型线路稳定性。

复现（从项目根目录运行）：

```bash
python3 scripts/probe-opencode-delivery.py
python3 scripts/probe-opencode-delivery.py --openchamber
python3 scripts/probe-opencode-delivery.py --openchamber-idle
python3 scripts/probe-opencode-delivery.py --promotion
python3 scripts/probe-opencode-delivery.py --openchamber-event
python3 scripts/probe-opencode-delivery.py --openchamber-race
python3 scripts/probe-opencode-delivery.py --openchamber-restart
python3 scripts/probe-opencode-delivery.py --opencode-restart
python3 scripts/probe-opencode-delivery.py --openchamber-length
```

需要 Python 3 和 PATH 上的 OpenCode V2；第二条另外需要 OpenChamber 和 Node.js 22 或更新版本。探针默认使用 `/tmp/opencode`（存在时），创建临时目录并自行清理。参考 [OpenCode 服务端插件与会话 hooks](https://opencode.ai/docs/build/plugins/server)、[OpenAPI](https://opencode.ai/docs/openapi.json)。
