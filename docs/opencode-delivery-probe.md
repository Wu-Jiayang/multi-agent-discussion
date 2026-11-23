# OpenCode V2：投递与已读验证

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

OpenChamber 2.7.3 的 OpenCode 代理用于读 `/api/session/active` 和会话消息，不能用它提交 `queue` / `steer`；这次的写入在服务端插件内完成。探针的地址和凭据只用于临时同机实例，不作为正式配置协议。示例队列是内存的，领取消费后没有持久确认，**不能用作产品的补投实现**。此集成场景验证的是普通帖仍在房间队列时的按序合批，尚未覆盖旧批已进 inbox、重启恢复或实际 UI。面板从未打开也能正常投递。

## 两种忙碌投递策略的对照

- **房间缓冲，空闲后投递**（`--openchamber-idle`）：普通帖在忙碌期间只留在房间，不发送点名，不需要人为唤醒。释放被模拟模型挂起的请求后，工具和当前轮继续执行，后台观察到目标不在 `/api/session/active` 后自动提交帖子。两组各三次本机测试，从释放请求到下一次模型收到帖子共 **56–105 ms**，包含旧轮剩余步骤和探针的 40 ms 扫描间隔，不是线上延迟保证。第二组同时监听 OpenCode SSE：三次都观察到 `session.execution.succeeded`，没有观察到 `session.idle`。因此不应只订阅 `session.idle`；推荐监听 `session.execution.*` 的终态作为快速检查信号，再查 `/api/session/active`。SSE 不重放，断线、重启、重新连接以及低频扫描应重新检查有积压的收件人。探针的投递本身仍由扫描触发。
- **提前入 OpenCode inbox，再转 `steer`**（`--promotion`）：只把较新的 Q2 改成 `steer` 会让 Q2 和紧急帖越过 Q1。当 Q1、Q2 和紧急帖的更新都赶在同一个模型边界前完成，三条确实按 Q1 → Q2 → 紧急帖一起进入下一次模型调用。但当运行时在多次请求之间继续前进，旧帖可以先分开进入两个模型请求，下一次更新已送达条目返回 **HTTP 409**；最后紧急帖单独进入下一次请求。接口只改一个待投递条目的模式，不能原地追加正文或原子合并多个条目。
- **推荐**：房间缓冲作为常规策略，保留按序的原文。单条升级只作为已经提交后的补救，不作为常规合批机制。若原文极端超出模型可接收范围，设计需明确分批、优先级和排序的取舍，不能假称可无限放入一批。

复现（从项目根目录运行）：

```bash
python3 scripts/probe-opencode-delivery.py
python3 scripts/probe-opencode-delivery.py --openchamber
python3 scripts/probe-opencode-delivery.py --openchamber-idle
python3 scripts/probe-opencode-delivery.py --promotion
```

需要 Python 3 和 PATH 上的 OpenCode V2；第二条另外需要 OpenChamber 和 Node.js 22 或更新版本。探针默认使用 `/tmp/opencode`（存在时），创建临时目录并自行清理。参考 [OpenCode 服务端插件与会话 hooks](https://opencode.ai/docs/build/plugins/server)、[OpenAPI](https://opencode.ai/docs/openapi.json)。
