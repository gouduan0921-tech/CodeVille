import type { Engine } from './engine.ts';
import type { AgentDef } from './types.ts';

/**
 * Agent 接入层（MVP 只实现 SimProvider）。
 * 接入真实 Agent（Claude Code / Codex / Hermes / OpenClaw …）时实现同一接口即可：
 *  - listAgents()   返回要显示在办公室里的 Agent
 *  - subscribe()    推送活动事件（开始任务、调用工具、等待输入…），由适配层映射为办公室里的状态/动作
 *  - sendMessage()  流式对话
 *  - stop()         中断当前运行
 * 详见 docs/PROVIDER.md。
 */
export interface ProviderEvent {
  agentId: string;
  type: 'task_start' | 'task_end' | 'tool' | 'waiting' | 'error' | 'message';
  /** 与办公室动作的映射键，例如 'dev.frontend' / 'test.qa' / 'ops.deploy' */
  activity?: string;
  text?: string;
}

export interface AgentProvider {
  readonly id: string;
  readonly name: string;
  listAgents(): AgentDef[];
  subscribe(cb: (ev: ProviderEvent) => void): () => void;
  sendMessage(agentId: string, text: string): AsyncGenerator<string, void, void>;
  stop(agentId: string): void;
}

export class SimProvider implements AgentProvider {
  readonly id = 'sim';
  readonly name = '本地模拟（SimProvider）';
  private engine: Engine;
  constructor(engine: Engine) {
    this.engine = engine;
  }
  listAgents() {
    return this.engine.agents.map((a) => a.def);
  }
  subscribe(cb: (ev: ProviderEvent) => void) {
    const h = (e: any) => cb({ agentId: e.agentId || '', type: 'message', text: e.text });
    this.engine.bus.on('log', h);
    return () => this.engine.bus.off('log', h);
  }
  async *sendMessage(agentId: string, text: string): AsyncGenerator<string, void, void> {
    const reply = this.engine.handleChat(agentId, text);
    const chars = Array.from(reply);
    for (let i = 0; i < chars.length; i += 2) {
      await new Promise((r) => setTimeout(r, 35));
      yield chars.slice(i, i + 2).join('');
    }
  }
  stop(_agentId: string) {
    /* 模拟器无需中断 */
  }
}
