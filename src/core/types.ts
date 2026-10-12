// 领域类型。注意：本目录文件需能被 Node 的 --experimental-strip-types 直接运行（用于 tests/sim.test.ts），
// 因此不使用 enum / namespace / 参数属性，import 必须带 .ts 后缀。

export type RoleId = 'frontend' | 'backend' | 'devops' | 'qa' | 'pm' | 'artist' | 'cto';
export type AgentStatus = 'idle' | 'working' | 'meeting' | 'break' | 'blocked' | 'error' | 'offline';
export type StageId = 'backlog' | 'requirement' | 'dev' | 'test' | 'deploy' | 'monitor' | 'done';
export type RoomId = 'cto' | 'product' | 'dev' | 'qa' | 'art' | 'lounge' | 'ops';
export type Dir = 'down' | 'up' | 'left' | 'right';
export type Pose = 'stand' | 'sit';
export type Anim = 'idle' | 'walk' | 'type' | 'read';
export type MeetingType = 'standup' | 'review' | 'incident' | 'planning';
export type LogLevel = 'info' | 'ok' | 'warn' | 'error';

export interface AgentDef {
  id: string;
  name: string;
  role: RoleId;
  /** 角色精灵编号 0..5（pixel-agents 的 6 套角色） */
  skin: number;
  /** 色相偏移（度），用于同一精灵的变体 */
  hue: number;
  offline?: boolean;
}

export interface Bubble {
  text: string;
  kind: 'say' | 'think' | 'alert' | 'ok';
  until: number; // 引擎毫秒时间
}

export interface AgentView {
  id: string;
  name: string;
  role: RoleId;
  skin: number;
  hue: number;
  status: AgentStatus;
  activity: string; // 中文活动描述，例如“编写代码”
  taskId: string | null;
  roomId: RoomId | null;
  deskId: string | null;
  x: number; // 像素坐标（脚底中心）
  y: number;
  dir: Dir;
  pose: Pose;
  anim: Anim;
  energy: number;
  bubble: Bubble | null;
  updatedAt: number;
  doneCount: number;
}

export interface TaskView {
  id: string;
  title: string;
  kind: 'feature' | 'bug' | 'hotfix' | 'chore';
  priority: 'low' | 'medium' | 'high' | 'critical';
  stage: StageId;
  progress: number; // 当前阶段进度 0..100
  workers: Partial<Record<RoleId, string>>;
  bugCount: number;
  createdAt: number;
  doneAt: number | null;
  history: { t: number; text: string }[];
}

export interface LogEntry {
  id: number;
  t: number; // 引擎时间（毫秒）
  clock: string; // 办公室时钟 HH:MM
  agentId?: string;
  level: LogLevel;
  text: string;
}

export interface MeetingView {
  id: string;
  type: MeetingType;
  title: string;
  participants: string[];
  state: 'gathering' | 'running' | 'ended';
  startedAt: number;
  endsAt: number;
  manual: boolean;
  summary?: string;
  resolution?: string;
  actions?: string;
}

export interface Furniture {
  id: string;
  type: string;
  x: number; // 瓦片坐标（左上）
  y: number;
  tag?: string;
}

export interface ChatMessage {
  id: number;
  from: 'user' | 'agent';
  text: string;
  t: number;
}

export interface Settings {
  officeName: string;
  showBubbles: boolean;
  showNames: boolean;
  dayNight: boolean;
  clockMode: 'sim' | 'real';
  speed: 1 | 2 | 4;
  autoMode: boolean;
  autoStandup: boolean;
  paused: boolean;
}

export interface Snapshot {
  now: number;
  clockMinutes: number;
  clock: string;
  ambient: number; // 0 白天 .. 1 深夜
  settings: Settings;
  agents: AgentView[];
  tasks: TaskView[];
  meetings: MeetingView[];
  meetingHistory: MeetingView[];
  logs: LogEntry[];
  furnitureVersion: number;
  incident: { active: boolean; taskId: string | null };
  counts: Record<AgentStatus, number>;
  stageCounts: Record<StageId, number>;
  capacity: Record<RoleId, { desks: number; agents: number }>;
  stats: { done: number; bugs: number; incidents: number; deploys: number };
}
