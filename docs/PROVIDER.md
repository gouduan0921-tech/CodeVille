# 接入真实 Agent（Provider）

CodeVille 的 MVP 使用 `SimProvider` 纯模拟。所有与具体 Agent 框架相关的代码都应放在 Provider 里，办公室本身只关心「谁、在做什么、处于什么状态」。

## 接口

```ts
// src/core/provider.ts
export interface AgentProvider {
  readonly id: string;
  readonly name: string;
  listAgents(): AgentDef[];                                   // 要显示在办公室里的 Agent
  subscribe(cb: (ev: ProviderEvent) => void): () => void;     // 活动事件流
  sendMessage(agentId: string, text: string): AsyncGenerator<string>; // 流式对话
  stop(agentId: string): void;                                // 中断
}

export interface ProviderEvent {
  agentId: string;
  type: 'task_start' | 'task_end' | 'tool' | 'waiting' | 'error' | 'message';
  activity?: string; // 映射键，见下表
  text?: string;
}
```

## 事件 → 办公室动作映射建议

| 来源事件（示例） | `activity` | 办公室表现 |
|---|---|---|
| 编辑前端文件（`*.tsx` / `*.css`） | `dev.frontend` | 前端坐工位打字 |
| 编辑后端文件、运行迁移 | `dev.backend` | 后端坐工位打字 |
| 读取/搜索代码、查看 PR | `dev.review` | 去开发区白板前阅读 |
| 运行测试命令 | `test.qa` / `test.rack` | 测试工位 / 真机测试架 |
| `docker build`、`kubectl apply`、部署脚本 | `ops.deploy` | 运维到发布控制台 |
| 查询日志/指标 | `ops.monitor` | 运维盯监控大屏 |
| 等待用户确认（权限请求） | `waiting` | 状态「阻塞」+ 气泡提醒 |
| 进程报错 | `error` | 状态「故障」+ 红色告警气泡 |

## 接入步骤

1. 新建 `src/core/providers/<name>.ts`，实现 `AgentProvider`。
2. 在浏览器无法直接调用本地 CLI 的情况下，增加一个轻量自托管服务（例如 Node + Socket.io），由服务端调用 CLI / 网关，再通过 WebSocket 推送事件。`src/core/bus.ts` 的 `on / off / emit` 已与 `socket.io-client` 对齐，可直接替换。
3. 在 `Engine` 中订阅 Provider 事件：根据 `activity` 为对应 Agent 设定目标（工位 / 白板 / 发布台等），根据 `type` 更新状态。
4. 在「菜单 → Agent 接入」中加入连接配置项。

## 安全提示

参考 My Virtual Office 的建议：Provider 服务是 Agent 的控制面，请仅在本机、局域网或私有网络（如 Tailscale）中访问，不要直接暴露到公网。
