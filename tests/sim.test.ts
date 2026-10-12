// 运行：npm run test:sim   （Node ≥ 22.6，无需任何依赖）
import { Engine } from '../src/core/engine.ts';
import { COLS, FURNITURE_MAP, ROOMS, buildNav, defaultFurniture, deriveAnchors, idx, roomAt } from '../src/core/layout.ts';
import { reachable } from '../src/core/nav.ts';

let failed = 0;
const ok = (c: boolean, msg: string) => {
  if (!c) {
    failed++;
    console.error('  ✘', msg);
  } else console.log('  ✔', msg);
};

console.log('— 布局检查');
const fu = defaultFurniture();
const nav = buildNav(fu);
const anchors = deriveAnchors(fu);
// 1. 家具占地不重叠、不压墙
const occ = new Map<number, string>();
const overlaps: string[] = [];
const onWall: string[] = [];
for (const f of fu) {
  const d = FURNITURE_MAP[f.type];
  if (!d) { overlaps.push('未知类型 ' + f.type); continue; }
  if (!d.blocks) continue;
  for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) {
    const i = idx(f.x + dx, f.y + dy);
    if (nav.wall[i]) onWall.push(`${f.id}@${f.x + dx},${f.y + dy}`);
    if (occ.has(i)) overlaps.push(`${f.id} 与 ${occ.get(i)} @${f.x + dx},${f.y + dy}`);
    occ.set(i, f.id);
  }
}
ok(overlaps.length === 0, `家具占地无重叠 ${overlaps.slice(0, 5).join(' | ')}`);
ok(onWall.length === 0, `家具不压墙 ${onWall.slice(0, 5).join(' | ')}`);
// 2. 锚点可达
const reach = reachable(nav, 31, 21);
const bad = anchors.filter((a) => !reach[idx(a.x, a.y)] && !(a.use === 'sofa'));
ok(bad.length === 0, `所有锚点从休息区可达（不可达：${bad.slice(0, 6).map((b) => b.id).join(', ')}）`);
// sofa 锚点：邻格应可达
const sofaBad = anchors.filter((a) => a.use === 'sofa').filter((a) => ![[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => reach[idx(a.x + dx, a.y + dy)]));
ok(sofaBad.length === 0, '沙发座位邻格可达');
// 3. 锚点不在墙上
ok(anchors.every((a) => !nav.wall[idx(a.x, a.y)]), '锚点不在墙上');
// 4. 每个房间都有锚点/桌位
const seatsByRoom: Record<string, number> = {};
anchors.filter((a) => a.use === 'seat').forEach((a) => (seatsByRoom[a.room || '?'] = (seatsByRoom[a.room || '?'] || 0) + 1));
console.log('  工位分布', JSON.stringify(seatsByRoom));
ok(ROOMS.every((r) => r.id === 'lounge' || seatsByRoom[r.id] > 0), '每个部门房间都有工位');
ok(anchors.filter((a) => a.use === 'msit').length === 10, '会议桌 10 个座位');
ok(anchors.filter((a) => a.use === 'board').length >= 8, '站会区 ≥ 8 个站位');
ok(roomAt(5, 5) === 'cto', 'roomAt 正确');
void COLS;

console.log('— 模拟检查（默认 7 人，快进约 30 分钟办公室时间）');
const e = new Engine({ seed: 7, settings: { autoMode: true, autoStandup: true } });
const start = new Map(e.agents.map((a) => [a.def.id, [a.x, a.y]]));
const statusSeen = new Set<string>();
let maxMeet = 0;
for (let i = 0; i < 20 * 60 * 15; i++) {
  e.update(50);
  if (i % 20 === 0) {
    e.agents.forEach((a) => statusSeen.add(a.status));
    maxMeet = Math.max(maxMeet, e.meetings.length);
  }
}
const snap = e.snapshot();
console.log('  时钟', snap.clock, '| 完成', snap.stats, '| 阶段', JSON.stringify(snap.stageCounts));
console.log('  出现过的状态', [...statusSeen].join(','));
ok(snap.stats.done >= 2, `至少完成 2 个需求（实际 ${snap.stats.done}）`);
ok(snap.stats.deploys >= 2, `发生部署（${snap.stats.deploys}）`);
ok(statusSeen.has('working') && statusSeen.has('idle'), '出现 working / idle 状态');
ok(statusSeen.has('break') || statusSeen.has('meeting'), '出现 break 或 meeting 状态');
ok(maxMeet >= 1 || snap.meetingHistory.length >= 1, '发生过会议');
ok(snap.logs.length > 10, '产生活动日志');
const moved = e.agents.filter((a) => { const s = start.get(a.def.id) as number[]; return Math.hypot(a.x - s[0], a.y - s[1]) > 1; }).length;
ok(moved >= 3 || snap.stats.done > 0, `角色会移动（移动过的最终位置 ${moved} 人）`);
ok(e.agents.every((a) => !nav.wall[idx(Math.floor(a.x / 16), Math.floor(a.y / 16))]), '没有角色卡在墙里');

console.log('— 手动操作');
const mid = e.startMeeting({ type: 'review', manual: true });
ok(!!mid, '可以手动发起需求评审');
for (let i = 0; i < 20 * 40; i++) e.update(50);
ok(e.meetings.some((m) => m.id === mid && m.state === 'running'), '会议进入进行中');
e.endMeeting(mid as string, { summary: '测试纪要' });
ok(e.meetingHistory[0]?.summary === '测试纪要', '结束会议生成纪要');
ok(e.triggerIncident() || true, '触发事故不抛异常');
for (let i = 0; i < 20 * 60; i++) e.update(50);
const r = e.handleChat('a-frontend-1', '加需求 测试需求A');
ok(/测试需求A/.test(r), '聊天指令可新增需求');
const n0 = e.agents.length;
e.addAgent('frontend');
e.addAgent('backend');
ok(e.agents.length === n0 + 2, '可动态增加成员');
const extra = e.agents.filter((a) => a.def.role === 'frontend').length;
ok(extra === 2, '同岗位多人');
for (let i = 0; i < 20 * 120; i++) e.update(50);
e.removeAgent(e.agents[e.agents.length - 1].def.id);
ok(e.agents.length === n0 + 1, '可移除成员');
// 编辑器：移除一张桌子后系统仍可运行
const f2 = e.furniture.filter((f) => f.id !== 'desk-40');
e.setFurniture(f2);
for (let i = 0; i < 20 * 60; i++) e.update(50);
ok(true, '家具变更后继续运行');

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
(globalThis as any).process.exit(failed ? 1 : 0);
