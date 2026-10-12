# 调研记录与设计决策

## 参考作品要点（My Virtual Office，eliautobot/my-virtual-office）

- 技术形态：原生 JS + Canvas（`app/game.js` 约 1.7 万行）+ Python 后端（`server.py`），Docker 自托管；**AGPL-3.0**。
- 角色与家具全部用 Canvas 代码绘制，仓库内没有可提取的精灵图。
- 画布：默认 1000×740，网格 `TILE = 40`，顶部 90px 墙带，灰色棋盘地板（`#c0c0c0` / `#b0b0b0`），分区彩色墙。
- 界面：左侧画布，右侧深色 Dashboard（PC 性能、API 用量、Branches、状态计数、活动日志），底部按钮栏（Menu / Edit Office / Agents / Expand All / Minimize All / Models / Cron / Reset）。
- 配色令牌：`--ui-bg #0a0a0f`、`--ui-surface #1a1a2e`、`--ui-border #2a2a3e`、`--ui-text #e8e8f0`、金色 `#ffd700`、`--gba-cream #f8f8d8`；标题字体 Press Start 2P。
- 交互：点击 Agent 打开详情与聊天；编辑器（家具目录、吸附网格、墙体、撤销、布局导入导出）；会议系统（1 对 1、会议桌、结束时填写纪要/决议/行动项）；Branch 分组；昼夜与天气；状态 working / idle / meeting / break。

## pixel-agents（MIT）

- 16px 瓦片；角色表 112×96：3 行（下 / 上 / 右，左为右翻转）× 7 帧（0–2 行走、3–4 打字、5–6 阅读）。
- 提供家具、地板 PNG 与 manifest；CodeVille 复用这些素材。

## 已确认的决策

| 项 | 决定 |
|---|---|
| 技术栈 | React + TypeScript + Phaser 3；事件总线接口对齐 Socket.io，MVP 进程内运行 |
| 授权 | 以 pixel-agents MIT 素材为主，参照 MVO 的布局/交互/配色重新实现，不复制 MVO 代码 |
| 像素尺寸 | 16px 瓦片，Phaser 中按屏幕自适应缩放 |
| 研发专属素材 | 代码生成，风格对齐 pixel-agents |
| 持久化 | localStorage + 布局 JSON 导入导出 |
| 字体 | 中文 BoutiqueBitmap9x9（OFL），英文 Press Start 2P（OFL） |
| 人数 | 动态可配置，默认每个岗位 1 人 |
| MVP 范围 | 简单昼夜循环 + 基础会议系统；宠物、天气后续再做 |

## 与参考作品的差异（垂直增强）

- 固定 7 个研发岗位与专属区域，按流水线顺序布局。
- 需求在看板上的阶段变化驱动角色移动；测试失败打回、部署需 CTO 审批、监控告警触发事故响应会。
- 研发专属家具：监控大屏、服务器机柜、测试设备架、发布控制台、流水线看板、画架、看板墙。
- MVO 付费版能力（不限人数、编辑器、外观编辑）全部包含。

## 尚未实现 / 后续

- 墙体编辑（MVO 支持自定义墙与门）
- 办公室宠物、真实天气
- 真实 Agent 接入（接口已预留）
- 多人协作 / 服务端持久化
