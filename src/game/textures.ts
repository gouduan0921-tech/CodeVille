import * as Phaser from 'phaser';
import { STAGES } from '../core/roles.ts';

const BASE = (import.meta as any).env?.BASE_URL ?? './';
export const asset = (p: string) => `${BASE}assets/${p}`;

/** pixel-agents（MIT）素材：furniture/<DIR>/<NAME>.png */
const FURNITURE_FILES: [string, string][] = [
  ['BIN', 'BIN'], ['BOOKSHELF', 'BOOKSHELF'], ['CACTUS', 'CACTUS'], ['CLOCK', 'CLOCK'], ['COFFEE_TABLE', 'COFFEE_TABLE'],
  ['CUSHIONED_CHAIR', 'CUSHIONED_CHAIR_BACK'], ['CUSHIONED_CHAIR', 'CUSHIONED_CHAIR_FRONT'], ['CUSHIONED_CHAIR', 'CUSHIONED_CHAIR_SIDE'],
  ['DESK', 'DESK_FRONT'], ['DOUBLE_BOOKSHELF', 'DOUBLE_BOOKSHELF'], ['HANGING_PLANT', 'HANGING_PLANT'], ['LARGE_PAINTING', 'LARGE_PAINTING'],
  ['LARGE_PLANT', 'LARGE_PLANT'], ['PC', 'PC_BACK'], ['PC', 'PC_FRONT_OFF'], ['PC', 'PC_FRONT_ON_1'], ['PC', 'PC_FRONT_ON_2'], ['PC', 'PC_FRONT_ON_3'],
  ['PLANT', 'PLANT'], ['PLANT_2', 'PLANT_2'], ['POT', 'POT'], ['SMALL_PAINTING', 'SMALL_PAINTING'], ['SOFA', 'SOFA_FRONT'], ['TABLE_FRONT', 'TABLE_FRONT'],
  ['WHITEBOARD', 'WHITEBOARD'],
];

export function queueAssets(load: Phaser.Loader.LoaderPlugin) {
  for (const [dir, name] of FURNITURE_FILES) load.image(`f_${name}`, asset(`furniture/${dir}/${name}.png`));
  for (let i = 0; i < 6; i++) load.image(`rawchar_${i}`, asset(`characters/char_${i}.png`));
  for (const i of [2, 4]) load.image(`floor_${i}`, asset(`floors/floor_${i}.png`));
}

type Ctx = CanvasRenderingContext2D;
function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d') as Ctx;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}
const R = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};
function add(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const [cv, c] = canvas(w, h);
  draw(c);
  scene.textures.addCanvas(key, cv);
}

// 3×5 像素数字
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function digit(c: Ctx, d: number, x: number, y: number, color: string) {
  const s = DIGITS[Math.max(0, Math.min(9, d))];
  c.fillStyle = color;
  for (let i = 0; i < 15; i++) if (s[i] === '1') c.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
}

export function drawPipelineBoard(c: Ctx, counts: Record<string, number>, alert: boolean) {
  c.clearRect(0, 0, 64, 32);
  R(c, '#6d4c41', 0, 4, 64, 28);
  R(c, alert ? '#3a1218' : '#161b2b', 1, 5, 62, 26);
  R(c, '#ffd700', 1, 5, 62, 1);
  const cols = STAGES.filter((s) => s.id !== 'backlog' && s.id !== 'done');
  cols.forEach((s, i) => {
    const x = 3 + i * 12;
    R(c, s.color, x, 8, 10, 3);
    R(c, '#0c101c', x, 12, 10, 16);
    const n = counts[s.id] || 0;
    digit(c, Math.min(9, n), x + 3, 15, n ? '#ffffff' : '#4a5168');
    // 进度小方块
    for (let k = 0; k < Math.min(n, 4); k++) R(c, s.color, x + 1 + k * 2 + (k > 1 ? 0 : 0), 23, 1, 3);
  });
  R(c, '#37474f', 0, 0, 64, 4);
  R(c, '#ffd700', 24, 1, 16, 2);
}

function drawRack(c: Ctx, frame: number) {
  R(c, '#1b1f27', 1, 3, 14, 29);
  R(c, '#2b303c', 2, 4, 12, 27);
  for (let u = 0; u < 5; u++) {
    const y = 5 + u * 5;
    R(c, '#3a4150', 3, y, 10, 4);
    R(c, '#1b1f27', 4, y + 3, 6, 1);
    const on = (u + frame) % 2 === 0;
    R(c, on ? '#39d98a' : '#1d5e44', 11, y + 1, 1, 1);
    R(c, (u * 3 + frame) % 3 === 0 ? '#ffb300' : '#6b5310', 11, y + 2, 1, 1);
  }
  R(c, '#14171e', 1, 31, 14, 1);
}

function drawMonitorWall(c: Ctx, frame: number, alert: boolean) {
  R(c, '#1b1f27', 0, 2, 48, 28);
  R(c, '#2d333f', 0, 2, 48, 1);
  for (let i = 0; i < 3; i++) {
    const x = 2 + i * 15;
    R(c, alert ? (frame % 2 ? '#5a1018' : '#3a0d12') : '#0d2b3a', x, 4, 14, 20);
    const line = alert ? '#ff5252' : '#39d98a';
    c.fillStyle = line;
    let y = 16;
    for (let k = 0; k < 12; k++) {
      y += ((k * 7 + i * 3 + frame * 2) % 5) - 2;
      y = Math.max(7, Math.min(21, y));
      c.fillRect(x + 1 + k, alert ? Math.max(6, y - 4) : y, 1, 1);
    }
    R(c, alert ? '#ff5252' : '#2196f3', x + 1, 5, 4, 1);
    R(c, '#0a1a24', x + 1, 22, 12, 1);
  }
  R(c, '#3a4150', 0, 25, 48, 3);
  R(c, '#14171e', 4, 28, 40, 2);
}

function drawTestRack(c: Ctx) {
  R(c, '#3a4150', 0, 6, 32, 26);
  R(c, '#232834', 1, 7, 30, 24);
  const cols = ['#29b6f6', '#ab47bc', '#43a047', '#ffb300', '#ef5350', '#26c6da'];
  for (let row = 0; row < 2; row++) {
    R(c, '#4a5266', 1, 18 + row * 12 - 1, 30, 1);
    for (let i = 0; i < 5; i++) {
      const x = 3 + i * 6;
      const y = 9 + row * 12;
      R(c, '#0e1119', x, y, 5, 9);
      R(c, cols[(i + row * 2) % cols.length], x + 1, y + 1, 3, 6);
      R(c, '#ffffff', x + 1, y + 1, 1, 1);
    }
  }
  R(c, '#14171e', 0, 31, 32, 1);
}

function drawEasel(c: Ctx) {
  R(c, '#8d6e63', 3, 6, 1, 26);
  R(c, '#8d6e63', 12, 6, 1, 26);
  R(c, '#6d4c41', 7, 10, 2, 22);
  R(c, '#6d4c41', 2, 20, 12, 1);
  R(c, '#ffffff', 2, 3, 12, 15);
  R(c, '#cfd8dc', 2, 3, 12, 1);
  R(c, '#ef5350', 4, 6, 4, 3);
  R(c, '#42a5f5', 8, 9, 4, 4);
  R(c, '#ffee58', 5, 12, 3, 3);
  R(c, '#66bb6a', 9, 5, 2, 2);
  R(c, '#14171e', 2, 31, 12, 1);
}

function drawKanban(c: Ctx) {
  R(c, '#6d4c41', 0, 8, 32, 24);
  R(c, '#eceff1', 1, 9, 30, 22);
  R(c, '#cfd8dc', 11, 9, 1, 22);
  R(c, '#cfd8dc', 21, 9, 1, 22);
  R(c, '#ef5350', 2, 10, 8, 2);
  R(c, '#ffb300', 12, 10, 8, 2);
  R(c, '#43a047', 22, 10, 8, 2);
  const notes = ['#fff176', '#ffab91', '#80deea', '#a5d6a7'];
  for (let i = 0; i < 6; i++) R(c, notes[i % 4], 2 + (i % 3) * 10, 14 + Math.floor(i / 3) * 8 + (i % 2), 7, 6);
  R(c, '#14171e', 0, 31, 32, 1);
}

function drawVending(c: Ctx) {
  R(c, '#8e1b1b', 1, 3, 14, 29);
  R(c, '#c62828', 2, 4, 12, 27);
  R(c, '#0f1722', 3, 6, 8, 16);
  const cs = ['#ffb300', '#42a5f5', '#66bb6a', '#ef5350'];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) R(c, cs[(r + i) % 4], 4 + i * 2 + i, 7 + r * 4, 2, 3);
  R(c, '#2b303c', 12, 8, 2, 8);
  R(c, '#0f1722', 4, 24, 8, 4);
  R(c, '#14171e', 1, 31, 14, 1);
}

function drawCooler(c: Ctx) {
  R(c, '#4fc3f7', 4, 3, 8, 10);
  R(c, '#b3e5fc', 5, 4, 2, 7);
  R(c, '#0288d1', 4, 3, 8, 1);
  R(c, '#cfd8dc', 3, 14, 10, 16);
  R(c, '#eceff1', 4, 15, 8, 5);
  R(c, '#ef5350', 5, 22, 2, 2);
  R(c, '#42a5f5', 9, 22, 2, 2);
  R(c, '#90a4ae', 3, 29, 10, 2);
  R(c, '#14171e', 3, 31, 10, 1);
}

function drawCoffeeMachine(c: Ctx) {
  // 木质柜台
  R(c, '#6d4c41', 0, 19, 16, 12);
  R(c, '#a1887f', 0, 18, 16, 2);
  R(c, '#5d4037', 7, 21, 1, 9);
  R(c, '#d7ccc8', 3, 24, 2, 1);
  R(c, '#d7ccc8', 10, 24, 2, 1);
  // 咖啡机
  R(c, '#212121', 2, 5, 12, 13);
  R(c, '#424242', 2, 5, 12, 2);
  R(c, '#616161', 3, 8, 10, 3);
  R(c, '#ff5252', 11, 9, 1, 1);
  R(c, '#69f0ae', 9, 9, 1, 1);
  R(c, '#757575', 6, 12, 4, 1);
  R(c, '#9e9e9e', 7, 13, 2, 1);
  // 咖啡杯 + 热气
  R(c, '#ffffff', 6, 15, 4, 3);
  R(c, '#6d4c41', 7, 15, 2, 1);
  R(c, '#ffffff', 10, 16, 1, 1);
  R(c, 'rgba(255,255,255,0.6)', 7, 1, 1, 2);
  R(c, 'rgba(255,255,255,0.6)', 9, 2, 1, 2);
  R(c, '#14171e', 0, 31, 16, 1);
}

function drawConsole(c: Ctx) {
  R(c, '#263238', 0, 2, 32, 14);
  R(c, '#37474f', 0, 2, 32, 2);
  R(c, '#0d2b3a', 2, 5, 10, 6);
  R(c, '#39d98a', 3, 8, 6, 1);
  R(c, '#b71c1c', 18, 6, 6, 6);
  R(c, '#ef5350', 19, 6, 4, 4);
  R(c, '#1b5e20', 25, 6, 5, 6);
  R(c, '#43a047', 26, 6, 3, 4);
  R(c, '#14171e', 0, 15, 32, 1);
}

function drawRug(c: Ctx) {
  R(c, '#d7ccc8', 0, 0, 96, 64);
  R(c, '#6a4a5a', 2, 2, 92, 60);
  R(c, '#8a5f74', 5, 5, 86, 54);
  for (let x = 8; x < 88; x += 6) for (let y = 8; y < 56; y += 6) R(c, (x + y) % 12 === 0 ? '#d7a86e' : '#7a5266', x, y, 3, 3);
}

function drawWindow(c: Ctx, mode: 'day' | 'dusk' | 'night') {
  R(c, '#cfd8dc', 0, 1, 16, 14);
  R(c, mode === 'day' ? '#7ec8ff' : mode === 'dusk' ? '#ff9e5e' : '#0b1030', 2, 3, 12, 10);
  if (mode === 'day') {
    R(c, '#ffffff', 3, 5, 5, 2);
    R(c, '#ffffff', 5, 4, 3, 1);
    R(c, '#ffe082', 11, 4, 2, 2);
  } else if (mode === 'dusk') {
    R(c, '#ff7043', 2, 9, 12, 4);
    R(c, '#ffe082', 10, 8, 3, 3);
  } else {
    R(c, '#ffffff', 4, 5, 1, 1);
    R(c, '#ffffff', 9, 4, 1, 1);
    R(c, '#bbdefb', 11, 8, 1, 1);
    R(c, '#fff59d', 4, 9, 3, 3);
    R(c, '#0b1030', 5, 9, 2, 2);
  }
  R(c, '#cfd8dc', 7, 3, 2, 10);
  R(c, '#cfd8dc', 2, 7, 12, 1);
  R(c, '#90a4ae', 0, 14, 16, 1);
}

export function makeProceduralTextures(scene: Phaser.Scene) {
  add(scene, 'g_serverRack_0', 16, 32, (c) => drawRack(c, 0));
  add(scene, 'g_serverRack_1', 16, 32, (c) => drawRack(c, 1));
  add(scene, 'g_serverRack', 16, 32, (c) => drawRack(c, 0));
  add(scene, 'g_monitorWall_0', 48, 32, (c) => drawMonitorWall(c, 0, false));
  add(scene, 'g_monitorWall_1', 48, 32, (c) => drawMonitorWall(c, 1, false));
  add(scene, 'g_monitorWall_2', 48, 32, (c) => drawMonitorWall(c, 0, true));
  add(scene, 'g_monitorWall_3', 48, 32, (c) => drawMonitorWall(c, 1, true));
  add(scene, 'g_monitorWall', 48, 32, (c) => drawMonitorWall(c, 0, false));
  add(scene, 'g_testRack', 32, 32, drawTestRack);
  add(scene, 'g_easel', 16, 32, drawEasel);
  add(scene, 'g_kanban', 32, 32, drawKanban);
  add(scene, 'g_vending', 16, 32, drawVending);
  add(scene, 'g_waterCooler', 16, 32, drawCooler);
  add(scene, 'g_coffeeMachine', 16, 32, drawCoffeeMachine);
  add(scene, 'g_releaseConsole', 32, 16, drawConsole);
  add(scene, 'g_rug', 96, 64, drawRug);
  add(scene, 'g_pipelineBoard', 64, 32, (c) => drawPipelineBoard(c, {}, false));
  add(scene, 'win_day', 16, 16, (c) => drawWindow(c, 'day'));
  add(scene, 'win_dusk', 16, 16, (c) => drawWindow(c, 'dusk'));
  add(scene, 'win_night', 16, 16, (c) => drawWindow(c, 'night'));
  add(scene, 'shadow', 14, 6, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.32)';
    c.fillRect(2, 1, 10, 4);
    c.fillRect(0, 2, 14, 2);
  });
}

// ───────────── 角色：把 112×96 精灵表转成带帧的 canvas 纹理，并支持色相偏移
function hueRotate(data: ImageData, deg: number) {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const m = [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
  ];
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i] = Math.max(0, Math.min(255, r * m[0] + g * m[1] + b * m[2]));
    d[i + 1] = Math.max(0, Math.min(255, r * m[3] + g * m[4] + b * m[5]));
    d[i + 2] = Math.max(0, Math.min(255, r * m[6] + g * m[7] + b * m[8]));
  }
}

export function ensureCharTexture(scene: Phaser.Scene, skin: number, hue: number): string {
  const sk = ((skin % 6) + 6) % 6;
  const hu = ((Math.round(hue) % 360) + 360) % 360;
  const key = `ch_${sk}_${hu}`;
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get(`rawchar_${sk}`).getSourceImage() as HTMLImageElement;
  const [cv, c] = canvas(112, 96);
  c.drawImage(src, 0, 0);
  if (hu) {
    const data = c.getImageData(0, 0, 112, 96);
    hueRotate(data, hu);
    c.putImageData(data, 0, 0);
  }
  const tex = scene.textures.addCanvas(key, cv);
  if (tex) {
    for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) tex.add(row * 7 + col, 0, col * 16, row * 32, 16, 32);
  }
  return key;
}

/** 与 pixel-agents 精灵表对应：每行 7 帧（0-2 行走，3-4 打字，5-6 阅读）；行：下 / 上 / 右（左 = 右翻转） */
export const FRAME = { walk: [0, 1, 2, 1], type: [3, 4], read: [5, 6], idle: [1] };
export const DIR_ROW: Record<string, number> = { down: 0, up: 1, right: 2, left: 2 };
