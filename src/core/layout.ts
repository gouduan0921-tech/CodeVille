import type { Dir, Furniture, Pose, RoleId, RoomId } from './types.ts';

export const TILE = 16;
export const COLS = 64;
export const ROWS = 34;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;

export interface RoomDef {
  id: RoomId;
  name: string;
  en: string;
  emoji: string;
  /** 含边界墙的矩形（包含式） */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  floorTex: string; // 地板贴图 key（pixel-agents floors）
  tint: number; // 地板着色
  accent: string; // 墙体强调色（参考 MVO 的分区彩色墙）
  labelColor: string;
}

export const ROOMS: RoomDef[] = [
  { id: 'cto', name: 'CTO 办公室', en: 'CTO OFFICE', emoji: '⚡', x1: 0, y1: 0, x2: 13, y2: 15, floorTex: 'floor_2', tint: 0xe3d3ad, accent: '#c9a227', labelColor: '#ffd700' },
  { id: 'product', name: '产品会议室', en: 'PRODUCT', emoji: '📋', x1: 13, y1: 0, x2: 28, y2: 15, floorTex: 'floor_4', tint: 0xcdd6ee, accent: '#4d79ff', labelColor: '#8fb0ff' },
  { id: 'dev', name: '开发区', en: 'DEV ZONE', emoji: '💻', x1: 28, y1: 0, x2: 49, y2: 15, floorTex: 'floor_4', tint: 0xd3dce0, accent: '#4061c8', labelColor: '#29b6f6' },
  { id: 'qa', name: '测试实验室', en: 'QA LAB', emoji: '🧪', x1: 49, y1: 0, x2: 63, y2: 15, floorTex: 'floor_4', tint: 0xcfe3d2, accent: '#2e9e5b', labelColor: '#6fe39a' },
  { id: 'art', name: '美术工作室', en: 'ART STUDIO', emoji: '🎨', x1: 0, y1: 15, x2: 18, y2: 33, floorTex: 'floor_2', tint: 0xefd3df, accent: '#d94f8c', labelColor: '#ff7eb6' },
  { id: 'lounge', name: '中央休息区', en: 'LOUNGE', emoji: '☕', x1: 18, y1: 15, x2: 46, y2: 33, floorTex: 'floor_4', tint: 0xd8cdb8, accent: '#78909c', labelColor: '#00e5ff' },
  { id: 'ops', name: '运维中心', en: 'OPS CENTER', emoji: '🛠️', x1: 46, y1: 15, x2: 63, y2: 33, floorTex: 'floor_4', tint: 0xe3cfc2, accent: '#ff7300', labelColor: '#ff9a45' },
];
export const ROOM_MAP: Record<RoomId, RoomDef> = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, RoomDef>;

/** 门洞（瓦片坐标，从墙里“挖掉”） */
export const DOORS: [number, number][] = [
  [13, 8], [13, 9], [28, 8], [28, 9], [49, 8], [49, 9],
  [6, 15], [7, 15], [22, 15], [23, 15], [35, 15], [36, 15], [55, 15], [56, 15],
  [18, 22], [18, 23], [46, 22], [46, 23],
];

/** 墙上的窗户（昼夜会变色），瓦片坐标 */
export const WINDOWS: [number, number][] = [
  [8, 0], [11, 0], [20, 0], [25, 0], [33, 0], [38, 0], [43, 0], [47, 0], [56, 0], [60, 0],
  [4, 33], [12, 33], [25, 33], [31, 33], [38, 33], [52, 33], [58, 33],
];

/** 房间名牌（画在墙带上）：瓦片 x 起点，y 为房间上边界所在行 */
export const ROOM_LABEL_X: Record<RoomId, number> = { cto: 1, product: 14, dev: 29, qa: 50, art: 1, lounge: 24, ops: 47 };

export interface FurnitureDef {
  type: string;
  label: string;
  category: string;
  icon: string;
  tex: string; // Phaser 贴图 key
  sw: number; // 精灵像素宽
  sh: number;
  w: number; // 占地（瓦片）
  h: number;
  blocks: boolean;
  /** 编辑器中是否可放置 */
  placeable: boolean;
}

const f = (type: string, label: string, category: string, icon: string, tex: string, sw: number, sh: number, w: number, h: number, blocks = true, placeable = true): FurnitureDef => ({
  type, label, category, icon, tex, sw, sh, w, h, blocks, placeable,
});

export const FURNITURE_DEFS: FurnitureDef[] = [
  f('desk', '工位', '办公', '🖥️', 'f_DESK_FRONT', 48, 32, 3, 2),
  f('bossDesk', 'CTO 办公桌', '办公', '💼', 'f_DESK_FRONT', 48, 32, 3, 2),
  f('whiteboard', '白板', '办公', '📝', 'f_WHITEBOARD', 32, 32, 2, 1),
  f('kanban', '看板墙', '办公', '🗂️', 'g_kanban', 32, 32, 2, 1),
  f('meetingTable', '会议桌', '办公', '📊', 'f_TABLE_FRONT', 48, 64, 3, 4),
  f('bin', '垃圾桶', '办公', '🗑️', 'f_BIN', 16, 16, 1, 1),
  f('bookshelf', '矮书架', '舒适', '📚', 'f_BOOKSHELF', 32, 16, 2, 1),
  f('doubleBookshelf', '大书架', '舒适', '📚', 'f_DOUBLE_BOOKSHELF', 32, 32, 2, 2),
  f('sofa', '沙发', '舒适', '🛋️', 'f_SOFA_FRONT', 32, 16, 2, 1),
  f('coffeeTable', '茶几', '舒适', '☕', 'f_COFFEE_TABLE', 32, 32, 2, 2),
  f('plant', '绿植', '舒适', '🪴', 'f_PLANT', 16, 32, 1, 1),
  f('plant2', '虎皮兰', '舒适', '🌿', 'f_PLANT_2', 16, 32, 1, 1),
  f('largePlant', '大型绿植', '舒适', '🌳', 'f_LARGE_PLANT', 32, 48, 2, 1),
  f('cactus', '仙人掌', '舒适', '🌵', 'f_CACTUS', 16, 32, 1, 1),
  f('pot', '花盆', '舒适', '🏺', 'f_POT', 16, 16, 1, 1),
  f('rug', '地毯', '舒适', '🟫', 'g_rug', 96, 64, 6, 4, false),
  f('clock', '挂钟', '装饰', '🕐', 'f_CLOCK', 16, 32, 1, 1),
  f('paintingLarge', '大画', '装饰', '🖼️', 'f_LARGE_PAINTING', 32, 32, 2, 1),
  f('paintingSmall', '小画', '装饰', '🖼️', 'f_SMALL_PAINTING', 16, 32, 1, 1),
  f('hangingPlant', '吊兰', '装饰', '🌱', 'f_HANGING_PLANT', 16, 32, 1, 1),
  f('serverRack', '服务器机柜', '研发', '🗄️', 'g_serverRack', 16, 32, 1, 1),
  f('monitorWall', '监控大屏', '研发', '📡', 'g_monitorWall', 48, 32, 3, 1),
  f('testRack', '测试设备架', '研发', '📱', 'g_testRack', 32, 32, 2, 1),
  f('releaseConsole', '发布控制台', '研发', '🚀', 'g_releaseConsole', 32, 16, 2, 1),
  f('pipelineBoard', '流水线看板', '研发', '🔄', 'g_pipelineBoard', 64, 32, 4, 1),
  f('easel', '画架', '研发', '🎨', 'g_easel', 16, 32, 1, 1),
  f('coffeeMachine', '咖啡机', '茶水间', '☕', 'g_coffeeMachine', 16, 32, 1, 1),
  f('vending', '零食机', '茶水间', '🥤', 'g_vending', 16, 32, 1, 1),
  f('waterCooler', '饮水机', '茶水间', '💧', 'g_waterCooler', 16, 32, 1, 1),
];
export const FURNITURE_MAP: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE_DEFS.map((d) => [d.type, d]));
export const FURNITURE_CATEGORIES = ['办公', '研发', '舒适', '茶水间', '装饰'];

export function defaultFurniture(): Furniture[] {
  const out: Furniture[] = [];
  let n = 0;
  const add = (type: string, x: number, y: number, tag?: string) => out.push({ id: `${type}-${++n}`, type, x, y, ...(tag ? { tag } : {}) });

  // ───── CTO 办公室
  add('doubleBookshelf', 1, 1);
  add('whiteboard', 5, 2);
  add('clock', 8, 2);
  add('paintingLarge', 10, 2);
  add('largePlant', 11, 3);
  add('bossDesk', 5, 4, 'cto');
  add('sofa', 2, 10);
  add('coffeeTable', 2, 12);
  add('plant', 12, 13);
  add('bin', 11, 13);

  // ───── 产品会议室
  add('whiteboard', 15, 2);
  add('whiteboard', 24, 2);
  add('clock', 20, 2);
  add('meetingTable', 19, 6);
  add('desk', 15, 4, 'pm');
  add('desk', 24, 4, 'pm');
  add('desk', 15, 10, 'pm');
  add('desk', 24, 10, 'pm');
  add('plant', 14, 13);
  add('plant2', 27, 13);

  // ───── 开发区（上排前端 / 下排后端）
  for (const x of [30, 34, 38, 42, 46]) {
    add('desk', x, 4, 'frontend');
    add('desk', x, 10, 'backend');
  }
  add('whiteboard', 32, 2);
  add('whiteboard', 40, 2);
  add('clock', 36, 2);
  add('doubleBookshelf', 44, 1);
  add('plant', 29, 13);
  add('plant2', 48, 13);

  // ───── 测试实验室
  add('desk', 51, 4, 'qa');
  add('desk', 56, 4, 'qa');
  add('desk', 51, 10, 'qa');
  add('desk', 56, 10, 'qa');
  add('kanban', 54, 2);
  add('testRack', 59, 2);
  add('testRack', 61, 2);
  add('plant', 50, 13);
  add('cactus', 62, 13);

  // ───── 美术工作室
  for (const x of [2, 7, 12]) add('desk', x, 18, 'artist');
  add('paintingLarge', 5, 17);
  add('paintingLarge', 10, 17);
  add('doubleBookshelf', 15, 16);
  add('easel', 3, 27);
  add('easel', 6, 27);
  add('easel', 9, 27);
  add('plant', 1, 31);
  add('cactus', 16, 25);

  // ───── 中央休息区
  add('pipelineBoard', 30, 17);
  add('coffeeMachine', 38, 17);
  add('vending', 40, 17);
  add('waterCooler', 42, 17);
  add('rug', 21, 23);
  add('sofa', 22, 24);
  add('sofa', 25, 24);
  add('coffeeTable', 23, 26);
  add('largePlant', 19, 31);
  add('largePlant', 43, 31);
  add('plant', 20, 17);
  add('rug', 34, 24);
  add('sofa', 35, 24);
  add('sofa', 38, 24);
  add('coffeeTable', 36, 26);

  // ───── 运维中心
  add('monitorWall', 50, 17);
  add('monitorWall', 54, 17);
  for (const x of [58, 59, 60, 61]) add('serverRack', x, 17);
  add('releaseConsole', 59, 21);
  for (const x of [48, 53, 58]) {
    add('desk', x, 24, 'devops');
    add('desk', x, 29, 'devops');
  }
  add('plant', 47, 32);
  add('plant2', 62, 32);
  return out;
}

// ───────────────────────────── 导航网格与锚点

export interface Nav {
  cols: number;
  rows: number;
  wall: Uint8Array; // 1 = 墙
  blocked: Uint8Array; // 1 = 不可通行（墙 + 家具占地）
}

export const idx = (x: number, y: number) => y * COLS + x;

export function buildWallMap(): Uint8Array {
  const wall = new Uint8Array(COLS * ROWS);
  for (const r of ROOMS) {
    for (let x = r.x1; x <= r.x2; x++) {
      wall[idx(x, r.y1)] = 1;
      wall[idx(x, r.y2)] = 1;
    }
    for (let y = r.y1; y <= r.y2; y++) {
      wall[idx(r.x1, y)] = 1;
      wall[idx(r.x2, y)] = 1;
    }
  }
  for (const [x, y] of DOORS) wall[idx(x, y)] = 0;
  return wall;
}

export function buildNav(furniture: Furniture[]): Nav {
  const wall = buildWallMap();
  const blocked = new Uint8Array(wall);
  for (const fu of furniture) {
    const d = FURNITURE_MAP[fu.type];
    if (!d || !d.blocks) continue;
    for (let dy = 0; dy < d.h; dy++) {
      for (let dx = 0; dx < d.w; dx++) {
        const x = fu.x + dx;
        const y = fu.y + dy;
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS) blocked[idx(x, y)] = 1;
      }
    }
  }
  return { cols: COLS, rows: ROWS, wall, blocked };
}

export function roomAt(tx: number, ty: number): RoomId | null {
  for (const r of ROOMS) {
    if (tx > r.x1 && tx < r.x2 && ty > r.y1 && ty < r.y2) return r.id;
  }
  return null;
}

export type AnchorUse =
  | 'seat' | 'msit' | 'sofa'
  | 'whiteboard' | 'testRack' | 'kanban' | 'easel' | 'monitor' | 'console' | 'rack'
  | 'coffee' | 'snack' | 'water' | 'board' | 'warroom' | 'patrol' | 'wander';

export interface Anchor {
  id: string;
  use: AnchorUse;
  x: number;
  y: number;
  dir: Dir;
  pose: Pose;
  room: RoomId | null;
  furnitureId?: string;
  tag?: string;
  role?: RoleId;
}

const STAND_BELOW: Record<string, AnchorUse> = {
  whiteboard: 'whiteboard',
  testRack: 'testRack',
  kanban: 'kanban',
  easel: 'easel',
  monitorWall: 'monitor',
  serverRack: 'rack',
  releaseConsole: 'console',
  coffeeMachine: 'coffee',
  vending: 'snack',
  waterCooler: 'water',
};

/** CTO 巡视点 */
export const PATROL_POINTS: [number, number][] = [
  [6, 9], [20, 12], [33, 7], [40, 7], [55, 7], [9, 22], [31, 22], [40, 21], [52, 21], [55, 27],
];
/** 休息区闲逛点 */
export const WANDER_POINTS: [number, number][] = [
  [28, 21], [31, 21], [34, 21], [28, 28], [31, 28], [34, 28], [40, 28], [30, 30], [38, 30], [24, 21],
];
/** 事故作战室站位 */
export const WARROOM_POINTS: [number, number][] = [
  [50, 20], [51, 20], [52, 20], [53, 20], [54, 20], [55, 20], [51, 21], [53, 21],
];

export function deriveAnchors(furniture: Furniture[]): Anchor[] {
  const out: Anchor[] = [];
  for (const fu of furniture) {
    const d = FURNITURE_MAP[fu.type];
    if (!d) continue;
    if (fu.type === 'desk' || fu.type === 'bossDesk') {
      const x = fu.x + 1;
      const y = fu.y + 2;
      out.push({ id: `seat:${fu.id}`, use: 'seat', x, y, dir: 'up', pose: 'sit', room: roomAt(x, y), furnitureId: fu.id, tag: fu.tag });
    } else if (fu.type === 'meetingTable') {
      let n = 0;
      const push = (x: number, y: number, dir: Dir) => out.push({ id: `msit:${fu.id}:${n++}`, use: 'msit', x, y, dir, pose: 'sit', room: roomAt(x, y), furnitureId: fu.id });
      for (let i = 0; i < 3; i++) push(fu.x + i, fu.y - 1, 'down');
      for (let i = 0; i < 3; i++) push(fu.x + i, fu.y + 4, 'up');
      for (let j = 1; j <= 2; j++) push(fu.x - 1, fu.y + j, 'right');
      for (let j = 1; j <= 2; j++) push(fu.x + 3, fu.y + j, 'left');
    } else if (fu.type === 'sofa') {
      for (let i = 0; i < 2; i++) out.push({ id: `sofa:${fu.id}:${i}`, use: 'sofa', x: fu.x + i, y: fu.y, dir: 'down', pose: 'sit', room: roomAt(fu.x + i, fu.y), furnitureId: fu.id });
    } else if (fu.type === 'pipelineBoard') {
      let n = 0;
      for (let row = 1; row <= 2; row++) for (let i = 0; i < d.w; i++) out.push({ id: `stand:board:${fu.id}:${n++}`, use: 'board', x: fu.x + i, y: fu.y + row, dir: 'up', pose: 'stand', room: roomAt(fu.x + i, fu.y + row), furnitureId: fu.id });
    } else if (STAND_BELOW[fu.type]) {
      const use = STAND_BELOW[fu.type];
      for (let i = 0; i < d.w; i++) {
        out.push({ id: `stand:${use}:${fu.id}:${i}`, use, x: fu.x + i, y: fu.y + d.h, dir: 'up', pose: 'stand', room: roomAt(fu.x + i, fu.y + d.h), furnitureId: fu.id });
      }
    }
  }
  WARROOM_POINTS.forEach(([x, y], i) => out.push({ id: `warroom:${i}`, use: 'warroom', x, y, dir: 'up', pose: 'stand', room: roomAt(x, y) }));
  PATROL_POINTS.forEach(([x, y], i) => out.push({ id: `patrol:${i}`, use: 'patrol', x, y, dir: 'down', pose: 'stand', room: roomAt(x, y) }));
  WANDER_POINTS.forEach(([x, y], i) => out.push({ id: `wander:${i}`, use: 'wander', x, y, dir: 'down', pose: 'stand', room: roomAt(x, y) }));
  return out;
}
