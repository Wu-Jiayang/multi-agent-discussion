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
2. 会话 A 调用插件工具。插件使用调用方真实会话 ID 将帖子送到本地后台；后台按收件人开 300 ms 合并窗。普通帖先独立交付为 `queue`；之后的普通上下文帖和点名帖作为两条独立帖子到达服务，合成一次 `steer`，保留两个帖子 ID 和原顺序。
3. 后台与插件通过临时 loopback 地址及随机凭据通信；插件用 `ctx.session.prompt` 投递给正在工作的会话 B。B 的下一个模型请求看到两条合批帖，之后的请求才带上已经入队的普通帖。

OpenChamber 2.7.3 的后台 OpenCode 代理只开放指定的读取接口，不能用它提交 `queue` / `steer`；这次的写入在服务端插件内完成。探针的地址和凭据只用于临时同机实例，不作为正式配置协议。示例队列是内存的，领取消费后没有持久确认，**不能用作产品的补投实现**。本次未验证关闭一个实际打开的面板、真实 UI、跨机器通信或重启恢复；测试证明的是面板从未打开也能正常投递。

复现（从项目根目录运行）：

```bash
python3 scripts/probe-opencode-delivery.py
python3 scripts/probe-opencode-delivery.py --openchamber
```

需要 Python 3 和 PATH 上的 OpenCode V2；第二条另外需要 OpenChamber 和 Node.js 22 或更新版本。探针默认使用 `/tmp/opencode`（存在时），创建临时目录并自行清理。参考 [OpenCode 服务端插件与会话 hooks](https://opencode.ai/docs/build/plugins/server)、[OpenAPI](https://opencode.ai/docs/openapi.json)。
