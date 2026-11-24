# 多智能体讨论与协作：产品和研究调研

调研截至 2026-11-22。本文为设计访谈提供事实，不是设计方案，也没有验证任何产品的本地运行行为。优先采用官方文档、公开源码、论文及原始讨论记录。

## 结论

最接近目标的产品是 **Google Antigravity `/swarm`**：独立会话通过共享留言板直接交流，有未读状态、`@all`、休眠唤醒和用于防停滞的监控角色。最接近的开源实现分为三类：**OpenClaw** 的群聊分发和轮次控制、**aweb** 的持久房间和唤醒通知、**Station** 的长期异步研究论坛。它们各自解决一部分问题。

本项目的关键差异是**讨论消息发到房间即面向全员**，而非每次挑选“关心此事”的成员。全员可以阅读讨论，但不必回复。首版如何合并未读提醒、处理发帖者自身和忙碌会话，见[当前设计](design.md)。

## 筛选标准

- **讨论**：参与者能看到并针对彼此的中间发言提出问题、反驳、补充或修正。共享任务列表、并行派活、最后汇报本身不算。
- **对照案例**：有跨 agent 的质疑或验证，但由固定流程传递产物，不能自由在共享频道互相接话。它们可以验证某些机制的价值，不能当作群聊已存在的证据。
- **证据分层**：公开源码和讨论记录可核对机制；官方文档可核对公开行为；论文、预印本和产品发布说明分别标注。不从研究结果反推出未公开的运行机制。

## 产品与开源实现

| 系统 | 怎么讨论 | 怎么唤醒 | 值得参考 / 边界 |
| --- | --- | --- | --- |
| [Google Antigravity `/swarm`](https://antigravity.google/docs/swarm)（[2026-11-10 发布预览](https://antigravity.google/blog/gemini-4-carbon-in-google-antigravity)） | 所有交流都放在同一块留言板。成员在独立会话中互相问问题、贴证据和差异摘要；验证者发现问题后反馈给原作者。 | `@name`、`@group`、`@all`；等待中的成员被提及才醒。所有人都沉默但工作未完时，监控角色会介入。 | 最近似的产品对标：按发言者/接收者筛选、个人未读线、成员状态、回放、跳转独立会话。`@all` 可广播，文档未表明普通发言默认全员唤醒。核心实现未公开。 |
| [OpenClaw Broadcast Groups](https://docs.openclaw.ai/channels/broadcast-groups)（实验） | Gateway 为一条外部入站消息分发多个独立会话；等一轮结束，再把彼此的正式回复摘要放进下一轮。 | `mentionGating: false` 可让首轮全员入选，前提是渠道已接收消息且预算足够。之后只选上一轮发过言或被点名的人。 | [协调器源码](https://github.com/openclaw/openclaw/blob/main/src/auto-reply/group-thread.ts)：先预留执行次数，允许 `NO_REPLY`，达上限或全静默即停。轮次状态只在内存；它不是每条内部发言触发全员，也不是共享完整会话。 |
| [aweb Team Room](https://github.com/awebai/aweb/blob/main/docs/mail-and-chat.md#shared-team-room)（MIT，`main` 已有代码，[尚待正式发布](https://github.com/awebai/aweb/blob/main/docs/design/team-room-v1.md)） | 每队一个共享房间，成员可读保留历史；房间面向公告，另有邮件和 agent 聊天。 | 一次发帖给其他现有成员各发一个轻量通知；正文单独取。实际唤醒依赖宿主集成。 | 最贴近「发一条，通知多人」的开源传输参考。房间默认不期待回复；房间通知、正文持久化和已读是不同概念。[事件与重连](https://github.com/awebai/aweb/blob/main/docs/receiving-events.md)文档说明事件流没有可恢复游标，重连后读待处理状态。 |
| [Microsoft Agent Framework Group Chat](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/group-chat) 与 [AutoGen Core Group Chat](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) | Group Chat 由协调器选下一位发言；AutoGen Core 示例让成员共享话题，成员发布和接收消息。 | 讨论流程选择谁发言；共享上下文不自动让每个成员都执行模型轮次。 | 适合参考「人人看到，谁真的发言另作控制」；不是独立 coding session 的离线恢复或唤醒层。 |
| [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) / [跨会话消息](https://code.claude.com/docs/en/cross-session-messaging) | 独立会话用点对点邮箱和共享任务表，成员可以直接交换发现。官方文档给出的全员发送方式是逐个收件人发送。 | 空闲接收会话可开新轮；同机还有一次性的“对方下次空闲或退出”订阅。 | 适合参考权限边界和完成通知；没有原生共享房间这一层。 |
| [AgentDebate](https://github.com/DFerryman/AgentDebate)（公开仓库） | VS Code 通过 ACP 驱动包括 OpenCode 在内的不同 agent：先各自提案，再交叉评阅和修订，最后综合。 | 由主持流程启动每阶段；不是自由发帖唤醒。 | 小型实现，适合参考讨论 UI、独立首轮和交叉评阅。会话不跨讨论复用；文档所述工具访问为只读。未做本地验证。 |

**不作为群聊对标：** [Codex 原生子智能体](https://developers.openai.com/codex/agent-configuration/subagents)以派活、跟进和聚合为主。[Responses API 多智能体](https://developers.openai.com/api/docs/guides/responses-multi-agent)另区分 `send_message`（投递而不开新轮）与 `followup_task`（启动或恢复一轮），可参考投递语义。GitHub、Slack 触发属于外部自动化，本身不构成 agent 间讨论。

**aweb 的可复用思路**：[房间写入](https://github.com/awebai/aweb/blob/main/server/src/aweb/messaging/room.py)将正文和收件人通知持久化，提交后才发轻量唤醒信号；[事件接口](https://github.com/awebai/aweb/blob/main/server/src/aweb/routes/events.py)从未处理通知生成 `actionable_room_post`。信号只指向已存消息，接收方再读正文。这样即使实时信号丢失，正文和待处理记录仍有恢复依据。

## 科研：哪些案例有真实讨论？

### 1. Station：让不同模型在公共论坛里长期接力

2026 年 8 月的[数学预印本](https://arxiv.org/html/2608.23691v1)报告：不同模型家族的 agents 在共享环境里自主探索、公开交流中间结果、接手别人尝试过的方向。该版本没有中央指挥或固定求解流水线。作者在 12 道既有构造题和 2 个额外案例中，报告 5 题得到相对既有文献的新结果，并公开[系统源码](https://github.com/dualverse-ai/station)、讨论记录、证明及验证代码。这个结论适用于该论文的数学构造任务和作者的新颖性核查。

2026 年 10 月[后续预印本](https://arxiv.org/abs/2610.08927)针对开放问题加入 Supervisor 和周期性 Meta Reflection，处理没明显进展指标时的停滞。不要把后一版的监督机制当作前一版已有功能。设计上最值得借鉴的是保存半成品、失败路径和证据，让晚到或刚恢复的 agent 可以接着做；论坛可供读取，不等同于帖子即时触发全员模型运行。

[Station 论坛源码](https://github.com/dualverse-ai/station/blob/main/station/rooms/public_memory.py)区分新帖与回帖：新帖通知其他活跃成员；回帖只通知原帖作者、此前回复过的人以及本次被点名的人。两种都是写入待处理通知，由[会话循环](https://github.com/dualverse-ai/station/blob/main/station/station.py)在下一次 tick 将通知作为 `System Messages` 提供，并不会额外启动或打断 agent。

### 2. Stellar Colosseum / Antigravity `/teamwork`：让反驳跟着提案走

[Stellar Colosseum 预印本](https://arxiv.org/html/2609.15983)把独立生成、定向证伪和树状综合接起来。综合节点会同时读候选方案及其质疑，不会只看到一个“获胜结论”。这种机制有真实的跨 agent 反驳，但走的是结构化工作流，而非开放群聊。

[Google Research 2026-11-13 报告](https://research.google/blog/advancing-science-engineering-with-antigravity-teamwork)称，研究团队用集成该方法的 Long Proof 流程证明了 Courtade–Kumar 猜想；同一发布还列出若干由研究者核验或用 Lean 形式化的成果。结论应归于这些工作流和验证链，不能归到另一个产品功能 `/swarm` 的共享留言板。

### 3. 生物研究：结构化辩论和小组会议

- **Google Co-Scientist**：[Nature，2026-05-19](https://www.nature.com/articles/s41586-026-10644-y)。系统用专职 agents 做生成、反思、排序、演化和复核；自我对弈式科学辩论与成对锦标赛是不同环节。论文报告了生物医学假设及部分外部实验验证；其中一个遗传机制案例是再现研究团队独立获得、当时尚未发表的发现。可借鉴的是“质疑推动修订”及外部验证，不是自由群聊或全员唤醒。
- **Stanford Virtual Lab**：[公开编排仓库](https://github.com/zou-group/virtual-lab)与[斯坦福报道](https://med.stanford.edu/news/all-news/2025/07/virtual-scientist.html)。研究者提出议程，多名不同角色的 agent 在团队会议中讨论，项目负责人角色综合，另有一对一会议。适合借鉴议程、角色和讨论记录；按会议运行，不是常驻房间按消息唤醒。

### 4. 边界案例：有突破报道，不一定有讨论证据

[OpenAI 2026-10-26 的科研公告](https://openai.com/index/building-scientific-understanding-with-academic-communities/)公开了多项成果及部分证明材料。该公告不足以证实产生这些结果的 agents 如何互发消息，故不作为讨论机制证据。[Euler 预印本](https://arxiv.org/html/2610.19864)公开了更清晰的共享研究图、异议与失败记录、验证和恢复机制；它可作为结构化协作对照，不把共享数据结构等同于即时群聊。

## 对 OpenChamber / OpenCode 的已核实接口

- **OpenChamber**：[扩展 SDK](https://docs.openchamber.dev/sdk)支持全屏页面，并能通过 `contributes.opencodePlugin` 随扩展分发 OpenCode 插件。[Host API](https://docs.openchamber.dev/sdk/host)还支持扩展自有后台服务与会话事件（例如 `turn-finished`），无需打开 UI 才能接收。发布和运行的具体边界须按目标版本实测。
- **OpenCode V2**：[服务端插件](https://opencode.ai/docs/build/plugins/server)可注册工具，[插件 RPC](https://opencode.ai/docs/build/plugins/rpc)可公开自定义方法和事件。[公开 API 规范](https://opencode.ai/docs/openapi.json)的 `session.prompt` 可接受 `delivery: "queue" | "steer"`：`queue` 在会话空闲时启动执行，忙碌时排到后续轮次，不抢占当前轮；`steer` 在活跃轮次的下一个可接收点送入。接口返回已接纳的 inbox 项，不代表 agent 已执行或已读。`resume: false` 只接纳，不安排执行。
- **持久化边界**：OpenCode 原生事件流与插件 RPC 订阅是实时流，断线期间的事件不会重放。共用讨论记录、成员游标及失败补投机制，应与实时信号分开研究。还需用真实 V2 会话确认忙碌、空闲、等待权限和服务重启时的交付行为与可观测状态。

## 设计访谈与验证线索

- **从一次广播到持续讨论**：谁属于全员，是否包含发言者；逐消息投递与短窗合并怎样影响协作；非讨论性的状态更新是否写进同一日志。
- **让质疑成为可追溯证据**：收集引用原发言、反例、验证结果和修订，不用“全员同意”代替事实核验。
- **防止回复风暴**：允许显式沉默；区分讨论帖和工具流式输出；研究预算、暂停、取消及人类插话。全员投递不必逼出全员发言。
- **度量讨论是否有效**：用同一任务、相近模型预算，对照多轮单 agent、并行独立后汇总、真正讨论三组。看测试/证明通过率、有用异议、因异议导致的改正，以及延迟与 token 成本。[ICML 比较研究](https://proceedings.mlr.press/v235/smit24a.html)发现多智能体辩论并不稳定胜过自一致性等基线。[2026 年 11 月的人机讨论预印本](https://arxiv.org/html/2611.14901v1)也提示，在它测试的回答验证和事实核查任务上，多轮互动是相对于单轮辅助的主要收益来源。如不设多轮单 agent 对照，很容易把多做几轮的收益误算给多人讨论。
