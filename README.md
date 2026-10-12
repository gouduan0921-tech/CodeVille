# CodeVille · 软件开发团队虚拟办公室

像素风 2D 虚拟办公室：把研发团队（人类或 AI Agent）的工作变成看得见的办公室日常。
**需求 → 开发 → 测试 → 部署 → 监控** 的流水线会驱动每个角色走到对应区域、坐到工位敲代码、在白板前讨论、在测试架前跑用例、在发布台前上线、盯着监控大屏处理告警。

交互与信息架构参考 [My Virtual Office](https://github.com/eliautobot/my-virtual-office)（重新实现，未复制其 AGPL 源码），像素素材来自 [pixel-agents](https://github.com/pixel-agents-hq/pixel-agents)（MIT）。

## 快速开始

需要 Node.js ≥ 20（运行模拟测试需 ≥ 22.6）。

```bash
npm install
npm run dev        # 打开终端里显示的地址（默认 http://localhost:5173）
```

其他命令：

| 命令 | 说明 |
|---|---|
| `npm run build` | 生产构建，输出到 `dist/`（纯静态文件，可放到任何静态服务器/自托管） |
| `npm run preview` | 本地预览构建结果 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test:sim` | 无依赖的模拟引擎测试（布局、寻路、流水线、会议、事故、成员增减） |

## 功能一览

**办公室画布（Phaser 3）**
- 7 个专属分区：CTO 办公室、产品会议室、开发区（上排前端 / 下排后端）、测试实验室、美术工作室、中央休息区、运维中心
- 角色 A* 寻路、坐下/行走/打字/阅读动画，工位电脑有人工作时自动点亮
- 头顶彩色名牌 + 对话/思考/告警气泡（可展开或收起）
- 昼夜循环（窗外天色、室内光照），加速时钟或跟随真实时间
- 流水线看板实时显示各阶段需求数；服务器机柜指示灯闪烁；告警时监控大屏变红、运维中心闪烁
- 滚轮/双指缩放，拖动平移，「适应画面」一键复位

**研发流程模拟（SimProvider）**
- 需求自动或手动进入需求池，按优先级拉入流水线
- 每个阶段由对应角色接手：产品写需求 / 美术出设计 → 前后端开发（偶尔去白板做代码评审）→ 测试（工位 + 真机测试架，约 20% 概率发现缺陷打回开发）→ 运维部署（CTO 到场审批，未到场时显示“阻塞”）→ 运维监控（约 18% 概率触发线上告警）
- 线上告警会自动拉起事故响应会（运维 + CTO + 后端在运维中心作战区集合），结束后恢复或回滚为热修复
- 精力系统：工作消耗精力，空闲时去喝咖啡、坐沙发、接水；CTO 会巡视各区域
- 每天 10:00 自动站会（可关闭）

**界面**
- 右侧栏：研发流水线、部门与成员（实时状态与动作）、会议、状态计数、活动日志
- 成员详情：概览 / 聊天（流式回复，支持「加需求 xxx」「去休息」「开站会」等指令）/ 设置（名字、岗位、外观、配色、移出）
- 成员管理：每个岗位人数自由增减，自动分配对应区域的空工位，显示工位容量
- 会议：发起站会 / 需求评审 / 迭代规划，选择参会人；结束时填写纪要、结论、行动项；历史纪要；事故演练
- 研发看板：七列看板，新建需求，拖拽或下拉切换阶段，显示负责人、进度、缺陷数
- 办公室编辑器：按类别放置家具（含研发专属家具）、拖动、删除、撤销、恢复默认、设置工位岗位、导入/导出布局 JSON
- 设置：办公室名称、名牌/气泡/昼夜开关、时钟模式、模拟速度、自动需求、自动站会、重置数据
- 加载进度、错误页（可清空数据重试）、空状态、禁用态、悬停/选中态
- 桌面与手机适配：手机端侧栏变为底部抽屉，弹层全屏，画布支持双指缩放

快捷键：`空格` 暂停/继续；`Esc` 关闭弹层或结束放置；编辑器中 `Delete` 删除、`Ctrl/⌘+Z` 撤销。

## 目录结构

```
src/
  core/            与框架无关的领域层（可直接用 Node 运行测试）
    types.ts       数据模型：Agent / Task / Meeting / Furniture / Settings / Snapshot
    roles.ts       7 个角色与流水线阶段定义
    layout.ts      地图（64×34 瓦片，16px）、房间、门、家具目录、默认布局、导航网格与锚点
    nav.ts         A* 寻路
    engine.ts      模拟引擎：调度、状态机、任务流转、会议、事故、聊天指令、持久化
    provider.ts    Agent 接入接口 + SimProvider
    bus.ts         事件总线（接口对齐 socket.io-client，便于替换为真实后端）
    content.ts     中文文案（气泡、需求标题、回复）
    persist.ts     localStorage 读写
  game/            Phaser 3 渲染层
    OfficeScene.ts 场景：静态层烘焙、家具、角色、相机、输入、编辑器、昼夜
    textures.ts    素材加载、程序生成的研发家具像素图、角色色相变体
    overlay.ts     名牌与气泡的 DOM 覆盖层（中文像素字体清晰显示）
    createGame.ts  创建 Phaser 实例并暴露控制句柄
  ui/              React 界面（侧栏、工具栏、弹层、编辑器面板）
public/
  assets/          pixel-agents 素材（角色 / 家具 / 地板）及其 MIT 许可证
  fonts/           BoutiqueBitmap9x9（中文）、Press Start 2P（英文），均为 OFL
tests/sim.test.ts  模拟引擎测试
docs/              PROVIDER.md（真实 Agent 接入）、RESEARCH.md（调研与设计决策）
```

数据流：`Engine`（每帧由 Phaser 场景驱动 `update`）→ 场景直接读取引擎状态渲染 → 每 250ms 生成 `Snapshot` 推送给 React（`useSyncExternalStore`）→ 界面操作调用 `Engine` 方法。

## 接入真实 Agent

MVP 使用纯模拟。`src/core/provider.ts` 定义了 `AgentProvider` 接口，接入 Claude Code、Codex、Hermes、OpenClaw 等时实现该接口，并把它们的事件映射为办公室动作即可，详见 [docs/PROVIDER.md](docs/PROVIDER.md)。

## 素材与许可

- 角色、家具、地板像素图：pixel-agents，MIT License © 2026 Pablo De Lucca（见 `public/assets/LICENSE-pixel-agents-MIT.txt`）。角色基于 JIK-A-4 的 Metro City 免费角色包；如需商用，请自行确认该角色包的使用条款。
- 研发专属家具（服务器机柜、监控大屏、测试设备架、发布控制台、流水线看板、画架、看板墙、咖啡机、零食机、饮水机、地毯、窗户）为本项目用代码绘制。
- 字体：BoutiqueBitmap9x9（精品點陣體 9×9）与 Press Start 2P，均为 SIL Open Font License 1.1（见 `public/fonts/`）。
