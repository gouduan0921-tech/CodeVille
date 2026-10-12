import { Bus } from './bus.ts';
import { ACTIVITY_LABEL, BUBBLES, MEETING_SUMMARIES, MEETING_TITLES, NAME_POOL, REPLIES, TASK_TITLES, pick } from './content.ts';
import { TILE, buildNav, defaultFurniture, deriveAnchors, roomAt, FURNITURE_MAP, COLS, ROWS } from './layout.ts';
import type { Anchor, Nav } from './layout.ts';
import { findPath } from './nav.ts';
import { load, save } from './persist.ts';
import { PIPELINE, ROLES, ROLE_MAP, STAGES, STAGE_MAP } from './roles.ts';
import type {
  AgentDef, AgentStatus, AgentView, Anim, Bubble, ChatMessage, Dir, Furniture, LogEntry, LogLevel, MeetingType, MeetingView,
  Pose, RoleId, RoomId, Settings, Snapshot, StageId, TaskView,
} from './types.ts';

// ───────────────────────────── 内部类型

interface Goal {
  kind: 'work' | 'meeting' | 'break' | 'idle' | 'patrol';
  anchor: Anchor;
  actKey: string;
  anim: Anim;
  arrived: boolean;
  until: number; // 到达后停留结束时间（引擎 ms），0 = 未设置
  meetingId?: string;
}

interface AgentRT {
  def: AgentDef;
  x: number;
  y: number;
  dir: Dir;
  pose: Pose;
  anim: Anim;
  path: [number, number][];
  goal: Goal | null;
  status: AgentStatus;
  actKey: string;
  taskId: string | null;
  deskId: string | null;
  energy: number;
  bubble: Bubble | null;
  nextBubbleAt: number;
  meetingId: string | null;
  updatedAt: number;
  doneCount: number;
  idleSince: number;
  blocked: boolean;
}

interface TaskRT extends TaskView {
  incidentChecked: boolean;
}

interface MeetingRT extends MeetingView {
  gatherDeadline: number;
  nextSpeakAt: number;
}

export interface EngineOptions {
  seed?: number;
  persist?: boolean;
  defs?: AgentDef[];
  furniture?: Furniture[];
  settings?: Partial<Settings>;
}

const WALK_SPEED = 58; // px / s
const MAX_LOGS = 160;

export const DEFAULT_SETTINGS: Settings = {
  officeName: 'CodeVille 研发办公室',
  showBubbles: true,
  showNames: true,
  dayNight: true,
  clockMode: 'sim',
  speed: 1,
  autoMode: true,
  autoStandup: true,
  paused: false,
};

export function defaultAgents(): AgentDef[] {
  const names: Record<RoleId, string> = { cto: '陈总', pm: '小宋', artist: '阿美', frontend: '小林', backend: '老周', qa: '小吴', devops: '阿稳' };
  return ROLES.map((r) => ({ id: `a-${r.id}-1`, name: names[r.id], role: r.id, skin: r.skin, hue: r.hue }));
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmtClock = (m: number) => {
  const mm = ((Math.floor(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
};

export function ambientAt(minutes: number): number {
  const h = (((minutes / 60) % 24) + 24) % 24;
  if (h >= 7.5 && h < 17.5) return 0;
  if (h >= 17.5 && h < 20) return (h - 17.5) / 2.5;
  if (h >= 20 || h < 5) return 1;
  if (h >= 5 && h < 7.5) return 1 - (h - 5) / 2.5;
  return 0;
}

// ───────────────────────────── 引擎

export class Engine {
  bus = new Bus();
  now = 0;
  settings: Settings;
  furniture: Furniture[];
  furnitureVersion = 1;
  nav: Nav;
  anchors: Anchor[] = [];
  agents: AgentRT[] = [];
  tasks: TaskRT[] = [];
  meetings: MeetingRT[] = [];
  meetingHistory: MeetingView[] = [];
  logs: LogEntry[] = [];
  chats: Record<string, ChatMessage[]> = {};
  incident: { active: boolean; taskId: string | null } = { active: false, taskId: null };
  stats = { done: 0, bugs: 0, incidents: 0, deploys: 0 };
  clockMinutes = 540;
  private rnd: () => number;
  private persistOn: boolean;
  private occupied = new Map<string, string>();
  private logSeq = 0;
  private taskSeq = 0;
  private meetingSeq = 0;
  private chatSeq = 0;
  private dispatchAcc = 0;
  private genAcc = 0;
  private saveAcc = 0;
  private lastStandupDay = -1;
  private dayCounter = 0;
  private dirty = true;

  constructor(opts: EngineOptions = {}) {
    this.rnd = mulberry32(opts.seed ?? (Date.now() & 0xffffffff));
    this.persistOn = !!opts.persist;
    const saved = this.persistOn ? load<any>('state', null) : null;
    this.settings = { ...DEFAULT_SETTINGS, ...(saved?.settings || {}), ...(opts.settings || {}) };
    this.furniture = opts.furniture || saved?.furniture || defaultFurniture();
    this.nav = buildNav(this.furniture);
    this.anchors = deriveAnchors(this.furniture);
    const defs: AgentDef[] = opts.defs || saved?.agents || defaultAgents();
    for (const d of defs) this.spawn(d, false);
    if (saved?.meetingHistory) this.meetingHistory = saved.meetingHistory;
    if (saved?.tasks) {
      for (const t of saved.tasks as TaskView[]) {
        this.taskSeq = Math.max(this.taskSeq, Number(String(t.id).replace(/\D/g, '')) || 0);
        this.tasks.push({ ...t, workers: {}, incidentChecked: false });
      }
    }
    if (saved?.stats) this.stats = { ...this.stats, ...saved.stats };
    if (this.persistOn && saved?.clockMinutes != null) this.clockMinutes = saved.clockMinutes;
    this.log('info', '办公室已开门，欢迎来到 CodeVille ☀️');
    if (!this.tasks.length) {
      this.addTask({ title: pick(TASK_TITLES.feature, this.rnd), kind: 'feature', priority: 'high' }, true);
      this.addTask({ title: pick(TASK_TITLES.feature, this.rnd), kind: 'feature', priority: 'medium' }, true);
    }
  }

  // ───────── 工具

  private r(a: number, b: number) {
    return a + this.rnd() * (b - a);
  }
  private tileOf(a: AgentRT): [number, number] {
    return [Math.max(0, Math.min(COLS - 1, Math.floor(a.x / TILE))), Math.max(0, Math.min(ROWS - 1, Math.floor(a.y / TILE)))];
  }
  private center(tx: number, ty: number): [number, number] {
    return [tx * TILE + TILE / 2, ty * TILE + TILE / 2];
  }
  private agentById(id: string) {
    return this.agents.find((a) => a.def.id === id);
  }
  private markDirty() {
    this.dirty = true;
  }
  log(level: LogLevel, text: string, agentId?: string) {
    const e: LogEntry = { id: ++this.logSeq, t: this.now, clock: fmtClock(this.clockMinutes), level, text, ...(agentId ? { agentId } : {}) };
    this.logs.push(e);
    if (this.logs.length > MAX_LOGS) this.logs.splice(0, this.logs.length - MAX_LOGS);
    this.bus.emit('log', e);
    this.markDirty();
  }
  private say(a: AgentRT, text: string, kind: Bubble['kind'] = 'say', ms = 3600) {
    a.bubble = { text, kind, until: this.now + ms };
    this.markDirty();
  }
  private bubbleFor(a: AgentRT, key: string, kind: Bubble['kind'] = 'say') {
    const pool = BUBBLES[key];
    if (pool) this.say(a, pick(pool, this.rnd), kind);
  }

  // ───────── 成员管理

  private nearestFreeTile(tx: number, ty: number): [number, number] {
    for (let rad = 0; rad < 8; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const x = tx + dx;
          const y = ty + dy;
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          if (!this.nav.blocked[y * COLS + x]) return [x, y];
        }
      }
    }
    return [tx, ty];
  }

  private assignDesk(a: AgentRT) {
    const taken = new Set(this.agents.filter((o) => o !== a && o.deskId).map((o) => o.deskId));
    const seats = this.anchors.filter((n) => n.use === 'seat' && !taken.has(n.id));
    const role = a.def.role;
    const home = ROLE_MAP[role].home;
    const s = seats.find((n) => n.tag === role) || seats.find((n) => n.room === home && n.tag !== 'cto');
    a.deskId = s ? s.id : null;
  }

  private spawn(def: AgentDef, announce = true): AgentRT {
    const a: AgentRT = {
      def: { ...def },
      x: 0, y: 0, dir: 'down', pose: 'stand', anim: 'idle', path: [], goal: null, status: def.offline ? 'offline' : 'idle',
      actKey: 'idle', taskId: null, deskId: null, energy: 70 + this.rnd() * 30, bubble: null, nextBubbleAt: 0,
      meetingId: null, updatedAt: this.now, doneCount: 0, idleSince: this.now, blocked: false,
    };
    this.agents.push(a);
    this.assignDesk(a);
    const seat = this.anchors.find((n) => n.id === a.deskId);
    const w = this.anchors.filter((n) => n.use === 'wander');
    const spot = seat || pick(w, this.rnd);
    const [tx, ty] = this.nearestFreeTile(spot.x, spot.y);
    const [px, py] = this.center(seat ? seat.x : tx, seat ? seat.y : ty);
    a.x = px;
    a.y = py;
    if (seat) {
      a.dir = seat.dir;
      a.pose = seat.pose;
    }
    if (announce) this.log('info', `${def.name}（${ROLE_MAP[def.role].name}）加入了团队`, def.id);
    this.markDirty();
    return a;
  }

  addAgent(role: RoleId, name?: string): AgentDef | null {
    const used = new Set(this.agents.map((a) => a.def.name));
    const nm = name || NAME_POOL.find((n) => !used.has(n)) || `成员${this.agents.length + 1}`;
    const rd = ROLE_MAP[role];
    const same = this.agents.filter((a) => a.def.role === role).length;
    const def: AgentDef = {
      id: `a-${role}-${Date.now().toString(36)}${Math.floor(this.rnd() * 1000)}`,
      name: nm,
      role,
      skin: (rd.skin + same) % 6,
      hue: same >= 6 ? (same * 47) % 360 : rd.hue,
    };
    this.spawn(def);
    this.afterRosterChange();
    return def;
  }

  removeAgent(id: string) {
    const a = this.agentById(id);
    if (!a) return;
    this.releaseAgentFromTask(a);
    this.clearGoal(a);
    this.meetings.forEach((m) => {
      m.participants = m.participants.filter((p) => p !== id);
    });
    this.agents = this.agents.filter((x) => x !== a);
    this.log('info', `${a.def.name} 离开了团队`);
    this.afterRosterChange();
  }

  updateAgent(id: string, patch: Partial<Pick<AgentDef, 'name' | 'skin' | 'hue' | 'role'>>) {
    const a = this.agentById(id);
    if (!a) return;
    const roleChanged = patch.role && patch.role !== a.def.role;
    Object.assign(a.def, patch);
    if (roleChanged) {
      this.releaseAgentFromTask(a);
      this.clearGoal(a);
      a.deskId = null;
      this.assignDesk(a);
    }
    this.afterRosterChange();
  }

  setOffline(id: string, off: boolean) {
    const a = this.agentById(id);
    if (!a) return;
    a.def.offline = off;
    if (off) {
      this.releaseAgentFromTask(a);
      this.clearGoal(a);
      a.status = 'offline';
      a.bubble = null;
      this.log('warn', `${a.def.name} 已下线`, id);
    } else {
      a.status = 'idle';
      this.log('info', `${a.def.name} 重新上线`, id);
    }
    this.afterRosterChange();
  }

  private afterRosterChange() {
    this.persist();
    this.markDirty();
    this.bus.emit('roster');
  }

  // ───────── 家具变更（编辑器）

  setFurniture(next: Furniture[]) {
    this.furniture = next.map((f) => ({ ...f }));
    this.nav = buildNav(this.furniture);
    this.anchors = deriveAnchors(this.furniture);
    this.furnitureVersion++;
    const ids = new Set(this.anchors.map((n) => n.id));
    this.occupied.clear();
    for (const a of this.agents) {
      if (a.deskId && !ids.has(a.deskId)) a.deskId = null;
      if (!a.deskId) this.assignDesk(a);
      this.clearGoal(a, false);
      const [tx, ty] = this.tileOf(a);
      if (this.nav.blocked[ty * COLS + tx] && !this.isAnchorTile(tx, ty)) {
        const [nx, ny] = this.nearestFreeTile(tx, ty);
        [a.x, a.y] = this.center(nx, ny);
      }
      a.path = [];
      a.pose = 'stand';
    }
    this.persist();
    this.markDirty();
    this.bus.emit('furniture');
  }

  private isAnchorTile(tx: number, ty: number) {
    return this.anchors.some((n) => n.x === tx && n.y === ty);
  }

  // ───────── 时钟

  private advanceClock(dtMs: number) {
    if (this.settings.clockMode === 'real') {
      const d = new Date();
      this.clockMinutes = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    } else {
      const before = this.clockMinutes;
      this.clockMinutes += (dtMs / 1000) * 2; // 现实 1 秒 = 办公室 2 分钟
      if (this.clockMinutes >= 1440) {
        this.clockMinutes -= 1440;
        this.dayCounter++;
      }
      void before;
    }
    if (this.settings.autoStandup && this.clockMinutes >= 600 && this.clockMinutes < 640 && this.lastStandupDay !== this.dayCounter) {
      this.lastStandupDay = this.dayCounter;
      this.startMeeting({ type: 'standup' });
    }
  }

  // ───────── 任务

  addTask(p: { title: string; kind?: TaskView['kind']; priority?: TaskView['priority'] }, silent = false): TaskView {
    const t: TaskRT = {
      id: `T-${String(++this.taskSeq).padStart(3, '0')}`,
      title: p.title,
      kind: p.kind || 'feature',
      priority: p.priority || 'medium',
      stage: 'backlog',
      progress: 0,
      workers: {},
      bugCount: 0,
      createdAt: this.now,
      doneAt: null,
      history: [{ t: this.now, text: '进入需求池' }],
      incidentChecked: false,
    };
    this.tasks.push(t);
    if (!silent) this.log('info', `新需求「${t.title}」进入需求池`);
    this.persist();
    this.markDirty();
    return t;
  }

  moveTask(id: string, stage: StageId) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t || t.stage === stage) return;
    this.releaseTaskWorkers(t);
    t.stage = stage;
    t.progress = 0;
    t.history.push({ t: this.now, text: `手动移动到「${STAGE_MAP[stage].name}」` });
    if (stage === 'done') t.doneAt = this.now;
    this.log('info', `需求「${t.title}」被移动到「${STAGE_MAP[stage].name}」`);
    this.persist();
    this.markDirty();
  }

  removeTask(id: string) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    this.releaseTaskWorkers(t);
    this.tasks = this.tasks.filter((x) => x !== t);
    this.persist();
    this.markDirty();
  }

  private releaseTaskWorkers(t: TaskRT) {
    for (const id of Object.values(t.workers)) {
      const a = id ? this.agentById(id) : undefined;
      if (a && a.taskId === t.id) this.releaseAgentFromTask(a);
    }
    t.workers = {};
  }

  private releaseAgentFromTask(a: AgentRT) {
    if (a.taskId) {
      const t = this.tasks.find((x) => x.id === a.taskId);
      if (t) for (const k of Object.keys(t.workers) as RoleId[]) if (t.workers[k] === a.def.id) delete t.workers[k];
    }
    a.taskId = null;
    a.blocked = false;
    if (a.goal && a.goal.kind === 'work') this.clearGoal(a);
  }

  private teamHas(role: RoleId) {
    return this.agents.some((a) => a.def.role === role && !a.def.offline);
  }

  private activeTasks() {
    return this.tasks.filter((t) => t.stage !== 'backlog' && t.stage !== 'done');
  }

  private dispatch() {
    // 需求池 → 需求
    const wip = Math.max(2, this.agents.filter((a) => a.def.role === 'frontend' || a.def.role === 'backend').length + 1);
    if (this.activeTasks().length < wip) {
      const prio = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      const next = this.tasks.filter((t) => t.stage === 'backlog').sort((a, b) => prio[a.priority] - prio[b.priority] || a.createdAt - b.createdAt)[0];
      if (next) {
        next.stage = 'requirement';
        next.progress = 0;
        next.history.push({ t: this.now, text: '进入「需求」阶段' });
        this.log('info', `「${next.title}」开始需求梳理`);
      }
    }
    for (const t of this.activeTasks()) {
      const need = STAGE_MAP[t.stage].needs.filter((r) => this.teamHas(r));
      for (const role of need) {
        const cur = t.workers[role] ? this.agentById(t.workers[role] as string) : undefined;
        if (cur && !cur.def.offline && cur.taskId === t.id) continue;
        const cands = this.agents
          .filter((a) => a.def.role === role && !a.def.offline && !a.taskId && !a.meetingId)
          .sort((x, y) => x.doneCount - y.doneCount || x.idleSince - y.idleSince);
        const pickA = cands[0];
        if (!pickA) continue;
        t.workers[role] = pickA.def.id;
        pickA.taskId = t.id;
        pickA.idleSince = this.now;
        this.clearGoal(pickA);
        this.log('info', `${pickA.def.name} 接手「${t.title}」（${STAGE_MAP[t.stage].name}）`, pickA.def.id);
      }
    }
  }

  private atWork(a: AgentRT) {
    return !!a.goal && a.goal.kind === 'work' && a.goal.arrived;
  }

  private progressTasks(dt: number) {
    for (const t of this.activeTasks()) {
      const stage = STAGE_MAP[t.stage];
      const need = stage.needs.filter((r) => this.teamHas(r));
      let rate = 1;
      let working = 0;
      if (need.length) {
        for (const r of need) {
          const a = t.workers[r] ? this.agentById(t.workers[r] as string) : undefined;
          if (a && this.atWork(a)) working++;
        }
        rate = working / need.length;
        // 部署阶段：已到场但在等审批 → 阻塞
        for (const r of need) {
          const a = t.workers[r] ? this.agentById(t.workers[r] as string) : undefined;
          if (a) a.blocked = t.stage === 'deploy' && this.atWork(a) && working < need.length;
        }
      }
      if (t.stage === 'monitor' && this.incident.active && this.incident.taskId === t.id) continue; // 事故处理中暂停
      t.progress = Math.min(100, t.progress + (dt / 1000) * (100 / stage.seconds) * rate);
      if (t.progress >= 100) this.completeStage(t);
    }
  }

  private workersOf(t: TaskRT) {
    return (Object.values(t.workers).filter(Boolean) as string[]).map((id) => this.agentById(id)).filter(Boolean) as AgentRT[];
  }

  private completeStage(t: TaskRT) {
    const ws = this.workersOf(t);
    const advance = (to: StageId, text: string, lvl: LogLevel = 'info') => {
      this.releaseTaskWorkers(t);
      t.stage = to;
      t.progress = 0;
      t.history.push({ t: this.now, text });
      this.log(lvl, text);
      if (to === 'done') {
        t.doneAt = this.now;
        this.stats.done++;
        ws.forEach((a) => {
          a.doneCount++;
          if (this.rnd() < 0.6) this.bubbleFor(a, 'done', 'ok');
        });
      }
      this.persist();
      this.markDirty();
    };
    switch (t.stage) {
      case 'requirement':
        advance('dev', `「${t.title}」需求评审通过，进入开发`);
        break;
      case 'dev':
        advance('test', `「${t.title}」开发完成，提交测试`);
        break;
      case 'test': {
        const failP = t.bugCount > 0 ? 0.08 : 0.2;
        if (this.rnd() < failP) {
          t.bugCount++;
          this.stats.bugs++;
          const qa = ws.find((a) => a.def.role === 'qa');
          if (qa) this.bubbleFor(qa, 'bug', 'alert');
          this.releaseTaskWorkers(t);
          t.stage = 'dev';
          t.progress = 55;
          t.history.push({ t: this.now, text: '测试发现缺陷，打回开发' });
          this.log('warn', `「${t.title}」测试发现缺陷 🐛，打回开发`, qa?.def.id);
          this.agents.filter((a) => a.def.role === 'frontend' || a.def.role === 'backend').forEach((a) => {
            if (this.rnd() < 0.5) this.bubbleFor(a, 'bugfix');
          });
        } else {
          advance('deploy', `「${t.title}」测试通过，准备部署`, 'ok');
        }
        break;
      }
      case 'deploy':
        this.stats.deploys++;
        advance('monitor', `「${t.title}」已部署，进入监控观察`, 'ok');
        break;
      case 'monitor': {
        if (!t.incidentChecked && t.kind !== 'chore' && this.rnd() < 0.18 && !this.incident.active) {
          t.incidentChecked = true;
          this.startIncident(t);
        } else {
          advance('done', `「${t.title}」上线稳定，需求完成 🎉`, 'ok');
        }
        break;
      }
      default:
        break;
    }
  }

  // ───────── 事故

  private startIncident(t: TaskRT) {
    this.incident = { active: true, taskId: t.id };
    this.stats.incidents++;
    t.history.push({ t: this.now, text: '线上告警' });
    this.log('error', `🚨 线上告警：「${t.title}」错误率飙升！`);
    const ops = this.agents.filter((a) => a.def.role === 'devops' && !a.def.offline);
    ops.forEach((a) => this.bubbleFor(a, 'incident', 'alert'));
    const parts = [
      ...ops,
      ...this.agents.filter((a) => a.def.role === 'cto' && !a.def.offline),
      ...this.agents.filter((a) => a.def.role === 'backend' && !a.def.offline).slice(0, 1),
    ];
    const id = this.startMeeting({ type: 'incident', participants: parts.map((p) => p.def.id), title: `事故响应：${t.title}` });
    if (!id) this.resolveIncident();
  }

  private resolveIncident() {
    const tid = this.incident.taskId;
    this.incident = { active: false, taskId: null };
    const t = this.tasks.find((x) => x.id === tid);
    if (!t) return;
    if (this.rnd() < 0.65) {
      this.log('ok', `事故已修复，「${t.title}」恢复稳定 ✓`);
      this.agents.filter((a) => a.def.role === 'devops').forEach((a) => this.bubbleFor(a, 'resolved', 'ok'));
      t.progress = 100;
      this.completeStage(t);
    } else {
      this.log('warn', `事故回滚，「${t.title}」转为热修复并打回开发`);
      this.releaseTaskWorkers(t);
      t.kind = 'hotfix';
      t.priority = 'critical';
      t.bugCount++;
      t.stage = 'dev';
      t.progress = 40;
      t.history.push({ t: this.now, text: '线上回滚，转热修复' });
    }
    this.markDirty();
  }

  triggerIncident() {
    const t = this.tasks.find((x) => x.stage === 'monitor') || this.activeTasks()[0];
    if (!t || this.incident.active) return false;
    this.startIncident(t as TaskRT);
    return true;
  }

  // ───────── 会议

  startMeeting(p: { type: MeetingType; participants?: string[]; title?: string; manual?: boolean; durationSec?: number }): string | null {
    const busy = new Set(this.meetings.filter((m) => m.state !== 'ended').flatMap((m) => m.participants));
    let ids = p.participants;
    if (!ids) {
      const roles: RoleId[] = p.type === 'standup' ? ROLES.map((r) => r.id) : ['pm', 'cto', 'frontend', 'backend', 'artist', 'qa'];
      ids = this.agents.filter((a) => roles.includes(a.def.role)).map((a) => a.def.id);
    }
    ids = ids.filter((id) => {
      const a = this.agentById(id);
      return a && !a.def.offline && !busy.has(id);
    });
    if (ids.length < 1 || (p.type !== 'incident' && ids.length < 2)) return null;
    const id = `M-${String(++this.meetingSeq).padStart(3, '0')}`;
    const m: MeetingRT = {
      id, type: p.type, title: p.title || MEETING_TITLES[p.type], participants: ids, state: 'gathering', startedAt: this.now,
      endsAt: 0, manual: !!p.manual, gatherDeadline: this.now + 14000, nextSpeakAt: 0,
    };
    (m as any).durationMs = (p.durationSec ?? (p.type === 'incident' ? 16 : p.manual ? 40 : 14)) * 1000;
    this.meetings.push(m);
    // 分配站位
    const use = p.type === 'standup' ? 'board' : p.type === 'incident' ? 'warroom' : 'msit';
    const pool = this.anchors.filter((n) => n.use === use && !this.occupied.has(n.id));
    const extra = this.anchors.filter((n) => n.use === 'wander' && !this.occupied.has(n.id));
    ids.forEach((aid, i) => {
      const a = this.agentById(aid) as AgentRT;
      this.releaseAgentFromTask(a);
      this.clearGoal(a);
      a.meetingId = id;
      const anchor = pool[i] || extra[i - pool.length] || pool[pool.length - 1];
      if (anchor) this.setGoal(a, { kind: 'meeting', anchor, actKey: 'meeting', anim: 'idle', meetingId: id });
    });
    this.log('info', `📣 ${m.title} 开始集合（${ids.length} 人）`);
    this.markDirty();
    return id;
  }

  endMeeting(id: string, notes?: { summary?: string; resolution?: string; actions?: string }) {
    const m = this.meetings.find((x) => x.id === id);
    if (!m || m.state === 'ended') return;
    m.state = 'ended';
    m.summary = notes?.summary?.trim() || pick(MEETING_SUMMARIES[m.type] || ['会议结束。'], this.rnd);
    m.resolution = notes?.resolution?.trim() || '';
    m.actions = notes?.actions?.trim() || '';
    for (const pid of m.participants) {
      const a = this.agentById(pid);
      if (a && a.meetingId === id) {
        a.meetingId = null;
        this.clearGoal(a);
        a.idleSince = this.now;
      }
    }
    this.meetings = this.meetings.filter((x) => x !== m);
    const view: MeetingView = { id: m.id, type: m.type, title: m.title, participants: m.participants, state: 'ended', startedAt: m.startedAt, endsAt: this.now, manual: m.manual, summary: m.summary, resolution: m.resolution, actions: m.actions };
    this.meetingHistory.unshift(view);
    this.meetingHistory = this.meetingHistory.slice(0, 30);
    this.log('info', `${m.title} 结束：${m.summary}`);
    if (m.type === 'incident' && this.incident.active) this.resolveIncident();
    this.persist();
    this.markDirty();
  }

  private updateMeetings() {
    for (const m of [...this.meetings]) {
      const ps = m.participants.map((p) => this.agentById(p)).filter(Boolean) as AgentRT[];
      if (m.state === 'gathering') {
        const allIn = ps.every((a) => a.goal?.kind === 'meeting' && a.goal.arrived);
        if (allIn || this.now > m.gatherDeadline) {
          m.state = 'running';
          m.endsAt = this.now + (m as any).durationMs;
          m.nextSpeakAt = this.now + 800;
          ps.forEach((a) => a.status !== 'offline' && this.markDirty());
        }
      } else if (m.state === 'running') {
        if (this.now >= m.nextSpeakAt && ps.length) {
          m.nextSpeakAt = this.now + this.r(2400, 4200);
          this.bubbleFor(pick(ps, this.rnd), 'meeting');
        }
        const limit = m.manual ? m.endsAt + 80000 : m.endsAt;
        if (this.now >= limit) this.endMeeting(m.id);
      }
    }
  }

  // ───────── 目标/移动

  private clearGoal(a: AgentRT, keepPath = false) {
    if (a.goal && this.occupied.get(a.goal.anchor.id) === a.def.id) this.occupied.delete(a.goal.anchor.id);
    a.goal = null;
    if (!keepPath) a.path = [];
  }

  private setGoal(a: AgentRT, g: Omit<Goal, 'arrived' | 'until'>): boolean {
    this.clearGoal(a);
    const [sx, sy] = this.tileOf(a);
    const path = findPath(this.nav, sx, sy, g.anchor.x, g.anchor.y);
    if (!path) {
      // 无路可走：直接传送到锚点，避免卡死（并记录）
      this.log('warn', `${a.def.name} 找不到通往目的地的路径，已瞬移`, a.def.id);
      [a.x, a.y] = this.center(g.anchor.x, g.anchor.y);
      a.path = [];
    } else {
      a.path = path;
    }
    a.goal = { ...g, arrived: false, until: 0 };
    this.occupied.set(g.anchor.id, a.def.id);
    if (a.path.length === 0) this.arrive(a);
    return true;
  }

  private arrive(a: AgentRT) {
    const g = a.goal;
    if (!g) return;
    g.arrived = true;
    [a.x, a.y] = this.center(g.anchor.x, g.anchor.y);
    a.dir = g.anchor.dir;
    a.pose = g.anchor.pose;
    a.anim = g.anim;
    a.updatedAt = this.now;
    if (g.kind === 'work') g.until = this.now + this.r(6000, 11000);
    else if (g.kind === 'break') g.until = this.now + this.r(7000, 13000);
    else if (g.kind === 'idle') g.until = this.now + this.r(5000, 12000);
    else if (g.kind === 'patrol') g.until = this.now + this.r(3000, 5000);
    else g.until = Infinity; // 会议由会议逻辑结束
    if (g.kind === 'patrol') this.bubbleFor(a, 'cto.patrol');
    if (g.kind === 'break') this.bubbleFor(a, g.actKey);
    a.nextBubbleAt = this.now + this.r(1200, 3500);
  }

  private moveAgent(a: AgentRT, dt: number) {
    if (!a.path.length) return;
    let remain = (WALK_SPEED * dt) / 1000;
    while (remain > 0 && a.path.length) {
      const [tx, ty] = a.path[0];
      const [cx, cy] = this.center(tx, ty);
      const dx = cx - a.x;
      const dy = cy - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.001) {
        a.path.shift();
        continue;
      }
      if (Math.abs(dx) > Math.abs(dy)) a.dir = dx > 0 ? 'right' : 'left';
      else a.dir = dy > 0 ? 'down' : 'up';
      if (d <= remain) {
        a.x = cx;
        a.y = cy;
        remain -= d;
        a.path.shift();
      } else {
        a.x += (dx / d) * remain;
        a.y += (dy / d) * remain;
        remain = 0;
      }
    }
    a.pose = 'stand';
    a.anim = 'walk';
    if (!a.path.length && a.goal) this.arrive(a);
  }

  // ───────── 决策

  private freeAnchor(use: Anchor['use'], room?: RoomId | null, pref?: (n: Anchor) => boolean): Anchor | null {
    let list = this.anchors.filter((n) => n.use === use && (!room || n.room === room) && !this.occupied.has(n.id));
    if (pref) {
      const p = list.filter(pref);
      if (p.length) list = p;
    }
    return list.length ? pick(list, this.rnd) : null;
  }

  private deskAnchor(a: AgentRT) {
    return a.deskId ? this.anchors.find((n) => n.id === a.deskId) || null : null;
  }

  private chooseWork(a: AgentRT, t: TaskRT): Omit<Goal, 'arrived' | 'until'> | null {
    const role = a.def.role;
    const desk = this.deskAnchor(a);
    const atDesk = (key: string, anim: Anim = 'type') => (desk ? { kind: 'work' as const, anchor: desk, actKey: key, anim } : null);
    const stand = (use: Anchor['use'], room: RoomId | null, key: string, anim: Anim = 'type') => {
      const n = this.freeAnchor(use, room);
      return n ? { kind: 'work' as const, anchor: n, actKey: key, anim } : null;
    };
    const r = this.rnd();
    let g: Omit<Goal, 'arrived' | 'until'> | null = null;
    switch (t.stage) {
      case 'requirement':
        if (role === 'pm') g = r < 0.45 ? stand('whiteboard', 'product', 'req.pm') : atDesk('req.pm');
        else if (role === 'artist') g = r < 0.4 ? stand('easel', 'art', 'req.artist') : atDesk('req.artist');
        break;
      case 'dev':
        if (role === 'frontend' || role === 'backend') {
          g = r < 0.22 ? stand('whiteboard', 'dev', 'dev.review', 'read') : atDesk(role === 'frontend' ? 'dev.frontend' : 'dev.backend');
        }
        break;
      case 'test':
        if (role === 'qa') g = r < 0.4 ? stand('testRack', 'qa', 'test.rack') : atDesk('test.qa');
        break;
      case 'deploy':
        if (role === 'devops') g = stand('console', 'ops', 'ops.deploy');
        else if (role === 'cto') g = stand('console', 'ops', 'cto.approve', 'read');
        break;
      case 'monitor':
        if (role === 'devops') g = stand('monitor', 'ops', 'ops.monitor', 'read') || atDesk('ops.monitor', 'read');
        break;
      default:
        break;
    }
    return g || (desk ? { kind: 'work', anchor: desk, actKey: 'desk', anim: 'type' } : null);
  }

  private chooseIdle(a: AgentRT): Omit<Goal, 'arrived' | 'until'> | null {
    const role = a.def.role;
    const desk = this.deskAnchor(a);
    const r = this.rnd();
    if (a.energy < 38 || r < 0.14) {
      const opts: [Anchor['use'], string][] = [['coffee', 'break.coffee'], ['sofa', 'break.sofa'], ['water', 'break.water'], ['snack', 'break.snack']];
      const [use, key] = pick(opts, this.rnd);
      const n = this.freeAnchor(use, 'lounge');
      if (n) return { kind: 'break', anchor: n, actKey: key, anim: n.pose === 'sit' ? 'idle' : 'read' };
    }
    if (role === 'cto' && r < 0.55) {
      const n = this.freeAnchor('patrol');
      if (n) return { kind: 'patrol', anchor: n, actKey: 'cto.patrol', anim: 'idle' };
    }
    if (role === 'artist' && r < 0.4) {
      const n = this.freeAnchor('easel', 'art');
      if (n) return { kind: 'idle', anchor: n, actKey: 'art.idle', anim: 'type' };
    }
    if (role === 'devops' && r < 0.4) {
      const n = this.freeAnchor('monitor', 'ops');
      if (n) return { kind: 'idle', anchor: n, actKey: 'ops.monitor', anim: 'read' };
    }
    if (r < 0.2) {
      const n = this.freeAnchor('wander', 'lounge');
      if (n) return { kind: 'idle', anchor: n, actKey: 'chat', anim: 'idle' };
    }
    if (desk) return { kind: 'idle', anchor: desk, actKey: 'desk', anim: 'read' };
    const n = this.freeAnchor('wander', 'lounge');
    return n ? { kind: 'idle', anchor: n, actKey: 'idle', anim: 'idle' } : null;
  }

  private think(a: AgentRT) {
    if (a.def.offline || a.meetingId) return;
    const g = a.goal;
    if (g && !(g.arrived && this.now >= g.until)) return;
    if (g) this.clearGoal(a, true);
    let next: Omit<Goal, 'arrived' | 'until'> | null = null;
    if (a.taskId) {
      const t = this.tasks.find((x) => x.id === a.taskId);
      if (t) next = this.chooseWork(a, t);
    } else {
      next = this.chooseIdle(a);
      a.idleSince = a.idleSince || this.now;
    }
    if (next) this.setGoal(a, next);
  }

  private refreshStatus(a: AgentRT) {
    let s: AgentStatus = 'idle';
    if (a.def.offline) s = 'offline';
    else if (a.meetingId) s = 'meeting';
    else if (this.incident.active && a.def.role === 'devops') s = 'error';
    else if (a.taskId && a.goal?.kind === 'work') s = a.blocked ? 'blocked' : 'working';
    else if (a.goal?.kind === 'break') s = 'break';
    if (s !== a.status) {
      a.status = s;
      a.updatedAt = this.now;
      this.markDirty();
    }
    const key = a.def.offline ? 'offline' : a.blocked ? 'waiting' : a.goal?.actKey || 'idle';
    a.actKey = key;
    if (!a.path.length && a.goal?.arrived) a.anim = a.goal.anim;
  }

  // ───────── 主循环

  update(realDtMs: number) {
    const s = this.settings;
    if (s.paused) {
      this.cleanBubbles();
      return;
    }
    const dt = Math.min(realDtMs, 100) * s.speed;
    this.now += dt;
    this.advanceClock(dt);
    this.dispatchAcc += dt;
    if (this.dispatchAcc > 400) {
      this.dispatchAcc = 0;
      this.dispatch();
    }
    this.genAcc += dt;
    if (this.genAcc > 20000) {
      this.genAcc = 0;
      if (s.autoMode && this.tasks.filter((t) => t.stage !== 'done').length < 5) this.spawnRandomTask();
    }
    for (const a of this.agents) {
      if (a.def.offline) continue;
      const working = a.taskId && a.goal?.kind === 'work' && a.goal.arrived;
      a.energy = Math.max(0, Math.min(100, a.energy + ((working ? -1.1 : a.goal?.kind === 'break' ? 4 : 0.5) * dt) / 1000));
      this.think(a);
      this.moveAgent(a, dt);
      this.refreshStatus(a);
      if (a.goal?.arrived && a.status === 'working' && this.now >= a.nextBubbleAt) {
        a.nextBubbleAt = this.now + this.r(5000, 11000);
        this.bubbleFor(a, a.actKey in BUBBLES ? a.actKey : 'idle', 'think');
      } else if (a.status === 'idle' && a.goal?.arrived && this.now >= a.nextBubbleAt) {
        a.nextBubbleAt = this.now + this.r(9000, 18000);
        if (this.rnd() < 0.5) this.bubbleFor(a, a.actKey === 'chat' ? 'chat' : 'idle', 'think');
      }
    }
    this.progressTasks(dt);
    this.updateMeetings();
    this.cleanBubbles();
    this.saveAcc += dt;
    if (this.saveAcc > 15000) {
      this.saveAcc = 0;
      this.persist();
    }
  }

  private cleanBubbles() {
    for (const a of this.agents) {
      if (a.bubble && a.bubble.until < this.now) {
        a.bubble = null;
        this.markDirty();
      }
    }
  }

  private spawnRandomTask() {
    const r = this.rnd();
    const kind: TaskView['kind'] = r < 0.6 ? 'feature' : r < 0.75 ? 'bug' : r < 0.9 ? 'chore' : 'hotfix';
    const title = pick(TASK_TITLES[kind], this.rnd);
    this.addTask({ title, kind, priority: kind === 'hotfix' ? 'critical' : kind === 'bug' ? 'high' : pick(['low', 'medium', 'medium', 'high'] as const, this.rnd) });
  }

  // ───────── 对话（SimProvider 使用）

  chatHistory(id: string) {
    return this.chats[id] || [];
  }

  handleChat(id: string, text: string): string {
    const a = this.agentById(id);
    if (!a) return '（该成员已不在团队中）';
    const list = (this.chats[id] ||= []);
    list.push({ id: ++this.chatSeq, from: 'user', text, t: this.now });
    let reply: string;
    const t = this.tasks.find((x) => x.id === a.taskId);
    const m = text.match(/^(?:\/task|加需求|新需求)[:：\s]*(.+)$/);
    if (m) {
      const nt = this.addTask({ title: m[1].trim().slice(0, 40), kind: 'feature', priority: 'medium' });
      reply = pick(REPLIES.task, this.rnd).replace('{title}', nt.title);
    } else if (/休息|歇|咖啡/.test(text)) {
      this.releaseAgentFromTask(a);
      const n = this.freeAnchor('coffee', 'lounge') || this.freeAnchor('sofa', 'lounge');
      if (n && !a.meetingId) this.setGoal(a, { kind: 'break', anchor: n, actKey: n.use === 'coffee' ? 'break.coffee' : 'break.sofa', anim: 'idle' });
      reply = pick(REPLIES.breakAck, this.rnd);
    } else if (/站会|开会|集合/.test(text)) {
      this.startMeeting({ type: 'standup', manual: false });
      reply = pick(REPLIES.meetAck, this.rnd);
    } else if (a.meetingId) {
      reply = pick(REPLIES.meeting, this.rnd);
    } else if (a.status === 'break') {
      reply = pick(REPLIES.break, this.rnd);
    } else if (/你好|嗨|hi|hello/i.test(text)) {
      reply = pick(REPLIES.greet, this.rnd);
    } else if (t) {
      reply = pick(REPLIES.working, this.rnd).replace('{task}', t.title).replace('{stage}', STAGE_MAP[t.stage].name).replace('{p}', String(Math.round(t.progress)));
    } else if (/进度|在做|任务|忙/.test(text)) {
      reply = pick(REPLIES.idle, this.rnd);
    } else {
      reply = pick(REPLIES.unknown, this.rnd);
    }
    list.push({ id: ++this.chatSeq, from: 'agent', text: reply, t: this.now });
    if (list.length > 60) list.splice(0, list.length - 60);
    this.say(a, reply.length > 16 ? reply.slice(0, 16) + '…' : reply, 'say', 4200);
    this.markDirty();
    return reply;
  }

  // ───────── 持久化与重置

  private persist() {
    if (!this.persistOn) return;
    save('state', {
      settings: this.settings,
      agents: this.agents.map((a) => a.def),
      furniture: this.furniture,
      meetingHistory: this.meetingHistory,
      tasks: this.tasks.slice(-40).map(({ incidentChecked, ...t }) => { void incidentChecked; return { ...t, workers: {} }; }),
      stats: this.stats,
      clockMinutes: this.clockMinutes,
    });
  }

  updateSettings(patch: Partial<Settings>) {
    Object.assign(this.settings, patch);
    this.persist();
    this.markDirty();
    this.bus.emit('settings', this.settings);
  }

  // ───────── 快照

  private roomOf(a: AgentRT): RoomId | null {
    const [tx, ty] = this.tileOf(a);
    return roomAt(tx, ty);
  }

  consumeDirty() {
    const d = this.dirty;
    this.dirty = false;
    return d;
  }

  snapshot(): Snapshot {
    const counts = { working: 0, idle: 0, meeting: 0, break: 0, blocked: 0, error: 0, offline: 0 } as Record<AgentStatus, number>;
    const agents: AgentView[] = this.agents.map((a) => {
      counts[a.status]++;
      return {
        id: a.def.id, name: a.def.name, role: a.def.role, skin: a.def.skin, hue: a.def.hue, status: a.status,
        activity: ACTIVITY_LABEL[a.actKey] || '待命', taskId: a.taskId, roomId: this.roomOf(a), deskId: a.deskId,
        x: a.x, y: a.y, dir: a.dir, pose: a.pose, anim: a.anim, energy: Math.round(a.energy), bubble: a.bubble,
        updatedAt: a.updatedAt, doneCount: a.doneCount,
      };
    });
    const stageCounts = {} as Record<StageId, number>;
    for (const s of STAGES) stageCounts[s.id] = 0;
    for (const t of this.tasks) stageCounts[t.stage]++;
    const capacity = {} as Snapshot['capacity'];
    for (const r of ROLES) {
      capacity[r.id] = {
        desks: this.anchors.filter((n) => n.use === 'seat' && n.tag === r.id).length,
        agents: this.agents.filter((a) => a.def.role === r.id).length,
      };
    }
    return {
      now: this.now,
      clockMinutes: this.clockMinutes,
      clock: fmtClock(this.clockMinutes),
      ambient: this.settings.dayNight ? ambientAt(this.clockMinutes) : 0,
      settings: { ...this.settings },
      agents,
      tasks: this.tasks.map(({ incidentChecked, ...t }) => { void incidentChecked; return { ...t, workers: { ...t.workers } }; }),
      meetings: this.meetings.map(({ gatherDeadline, nextSpeakAt, ...m }) => { void gatherDeadline; void nextSpeakAt; return { ...m }; }),
      meetingHistory: this.meetingHistory,
      logs: this.logs.slice(-80),
      furnitureVersion: this.furnitureVersion,
      incident: { ...this.incident },
      counts,
      stageCounts,
      capacity,
      stats: { ...this.stats },
    };
  }
}

export { FURNITURE_MAP, PIPELINE };
