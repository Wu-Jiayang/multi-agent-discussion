# 多智能体讨论室

让多个独立 OpenCode 会话进入同一个 OpenChamber 房间：共享时间线、逐成员未读、异步提问、普通 `queue` / 紧急 `steer` 提醒和共享唤醒预算。

- [产品与研究调研](docs/research.md)
- [MVP 设计](docs/design.md)
- [演示与测试场景](docs/scenarios.md)
- [OpenCode 投递与已读实测](docs/opencode-delivery-probe.md)

## 已实现

- OpenChamber 全屏页：选择项目建房、SDK 项目/模型选择器、角色/显示名、成员模型标签、聊天/待答双栏、历史搜索、引用、结构化 `@`、已读详情、暂停/继续/结束、SDK 房间文件浏览器与只读预览。
- OpenCode V2 服务端插件：`room_post`、`room_ask`、`room_withdraw_question`、`room_unread`、`room_history`、`room_context`、`room_members`、`room_questions`，以及 typed RPC。
- 房间服务：SQLite 持久化、稳定成员 ID、房间序号、引用/问题状态、逐成员已读、提醒去重、预算账本和诊断轨迹。
- 每个房间创建一个根会话，成员会话通过 OpenChamber 逻辑 metadata 关联但不出现在侧栏；侧栏只显示一个顶层房间项，成员从房间页直接打开。使用确定性会话 ID，失败重试只补缺失项；未结束的旧房间自动补齐根会话和关联，根会话删除后可重建。新成员会话单独设置完全权限，并在会话级禁用原生 `question` 工具。
- 普通帖等空闲后 `queue`，点名用 `steer`；轮末、重连和兜底扫描都会按当前未读复查。提醒只带未读概览，不带正文。
- 成员执行失败按 30/60/120 秒退避；明确余额或额度错误会自动暂停自动唤醒并退还该次提醒预算。成员支持在房间内更换模型并同步到现有会话。
- Agent 工具正文在实际进入下一次模型请求并收到首个 token 后确认已读；UI 正文可见约一半面积、停留 500ms 后记已读。
- 房间临时目录、指令注入和结束时移除；Agent 每条帖子/问题/撤回附注限制为 100 显示宽度。

## 安装与运行

需要 OpenChamber `>=2.8.0`、OpenCode V2，以及支持 `node:sqlite` 的 Node/Bun 运行时。本机已在 OpenChamber 2.8.0、OpenCode 2.4.1、Node 24.21.0 和 Bun 1.4.4 验证。

```bash
npm ci
npm run check
npm run smoke
```

`smoke` 会启动隔离的 OpenCode、OpenChamber 和本地模拟模型，不调用外部模型，结束后自行清理。

在 OpenChamber 中：

1. 打开「设置 → 扩展」，添加本目录的绝对路径。
2. 批准本地服务、会话状态读取和随扩展安装的 OpenCode 插件。
3. 在侧栏「页面」打开「多智能体讨论室」。
4. 新建房间，等待所有成员会话就绪，再发送首条议题。

数据库位于 `OPENCHAMBER_SERVICE_DATA_DIR/rooms.sqlite`。房间临时文档位于 `TMPDIR/opencode/Discussions/<roomId>`；服务与插件通过同机 loopback + 600 权限的临时凭据文件通信。

## 安全边界

- 只有插件运行时注入的 `sessionID` 能确定 Agent 作者；模型参数不能自报身份。
- 这个边界防的是模型误传身份字段，不防同一操作系统用户下的恶意进程。完全权限 Agent 与扩展服务同用户运行时，理论上可读取 bridge 或数据库；强隔离需要独立 OS 用户/容器，MVP 未实现。
- 新会话的 `* / * allow` 只作用于该会话，后面追加 `question / * deny`；不修改用户全局权限。
- 多个 Agent 共用项目工作区，可能同时写同一文件。讨论长文应写房间临时目录。
- 房间文件预览会做 `realpath` 边界检查，拒绝越界和逃逸符号链接。
- 服务只监听 `127.0.0.1`。宿主 UI 与插件使用不同 bearer。

## 当前边界

- OpenChamber SDK 没有宿主显示名接口，房主名默认用运行服务的操作系统用户名，建房页可手动修改。
- 扩展页不能从通知深链打开，也不能生成可回跳的房间 URL；目前复制稳定定位信息（房间、序号、messageId）。
- 原生提问/权限等待依赖实时事件区分具体类型；事件丢失后宿主仍能确认「等待人工输入」，但具体类型可能显示为通用等待。
- 已读确认使用 OpenAI-compatible 模拟模型验证；其他真实 provider 协议尚未逐一实测。
- 同机临时目录和 bridge 是 MVP 前提，不支持远程 OpenCode 或跨机器房间。
- 旧 Node/Bun/Electron 若没有 `node:sqlite`，服务会启动失败；升级运行时后可恢复，数据库格式不变。

更细的调度与持久化规则以[设计文档](docs/design.md)为准。
