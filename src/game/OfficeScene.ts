import * as Phaser from 'phaser';
import { Engine, ambientAt } from '../core/engine.ts';
import {
  COLS, DOORS, FURNITURE_MAP, ROOMS, ROOM_LABEL_X, ROWS, TILE, WINDOWS, WORLD_H, WORLD_W, buildWallMap, defaultFurniture, deriveAnchors, idx, roomAt,
} from '../core/layout.ts';
import type { Furniture } from '../core/types.ts';
import { Overlay } from './overlay.ts';
import { DIR_ROW, FRAME, drawPipelineBoard, ensureCharTexture, makeProceduralTextures, queueAssets } from './textures.ts';

export interface EditorState {
  active: boolean;
  placing: string | null;
  selectedId: string | null;
  selectedType: string | null;
  selectedTag: string | null;
  canUndo: boolean;
  dirty: boolean;
  count: number;
}

export interface SceneHooks {
  onProgress(p: number): void;
  onReady(): void;
  onError(msg: string): void;
  onSelect(id: string | null): void;
  onEditor(s: EditorState): void;
  publish(): void;
}

interface CharView {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  texKey: string;
}

export class OfficeScene extends Phaser.Scene {
  engine: Engine;
  hooks: SceneHooks;
  overlay!: Overlay;
  selectedId: string | null = null;

  private camX = WORLD_W / 2;
  private camY = WORLD_H / 2;
  private zoom = 1;
  private userMoved = false;
  private chars = new Map<string, CharView>();
  private furnGroup: Phaser.GameObjects.GameObject[] = [];
  private pcBySeat = new Map<string, Phaser.GameObjects.Image>();
  private racks: Phaser.GameObjects.Image[] = [];
  private monitorWalls: Phaser.GameObjects.Image[] = [];
  private boards: Phaser.GameObjects.Image[] = [];
  private windows: Phaser.GameObjects.Image[] = [];
  private nightRect!: Phaser.GameObjects.Rectangle;
  private alertRect!: Phaser.GameObjects.Rectangle;
  private ring!: Phaser.GameObjects.Graphics;
  private editGfx!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private pipelineCtx!: CanvasRenderingContext2D;
  private pipelineTex!: Phaser.Textures.CanvasTexture;
  private boardAcc = 0;
  private pubAcc = 0;
  private clockT = 0;
  private ready = false;

  // 输入
  private downInfo: { x: number; y: number; t: number; moved: boolean } | null = null;
  private pinchDist = 0;
  private pinching = false;
  private dragFurn: { id: string; dx: number; dy: number; pushed: boolean } | null = null;

  // 编辑器
  private editor: EditorState = { active: false, placing: null, selectedId: null, selectedType: null, selectedTag: null, canUndo: false, dirty: false, count: 0 };
  private draft: Furniture[] = [];
  private undo: string[] = [];
  private furnVersionDrawn = -1;
  private idSeq = 1000;

  constructor(engine: Engine, hooks: SceneHooks) {
    super('office');
    this.engine = engine;
    this.hooks = hooks;
  }

  // ───────────────────────── 生命周期

  preload() {
    this.load.on('progress', (v: number) => this.hooks.onProgress(v));
    this.load.on('loaderror', (f: any) => this.hooks.onError(`素材加载失败：${f?.key ?? ''}`));
    queueAssets(this.load);
  }

  create() {
    try {
      makeProceduralTextures(this);
      this.bakeStatic();
      this.pipelineTex = this.textures.get('g_pipelineBoard') as Phaser.Textures.CanvasTexture;
      this.pipelineCtx = this.pipelineTex.getContext();

      this.cameras.main.setBackgroundColor('#0a0a0f');
      this.nightRect = this.add.rectangle(0, 0, WORLD_W, WORLD_H, 0x0a1238, 0).setOrigin(0, 0).setDepth(9000);
      const ops = ROOMS.find((r) => r.id === 'ops')!;
      this.alertRect = this.add
        .rectangle(ops.x1 * TILE, ops.y1 * TILE, (ops.x2 - ops.x1 + 1) * TILE, (ops.y2 - ops.y1 + 1) * TILE, 0xff1744, 0)
        .setOrigin(0, 0)
        .setDepth(8999);
      this.ring = this.add.graphics().setDepth(8990);
      this.editGfx = this.add.graphics().setDepth(8995);
      this.ghost = this.add.image(0, 0, 'f_PLANT').setOrigin(0, 1).setAlpha(0.6).setDepth(8996).setVisible(false);

      this.draft = this.engine.furniture.map((f) => ({ ...f }));
      this.buildFurniture(this.draft);
      this.furnVersionDrawn = this.engine.furnitureVersion;

      this.overlay = new Overlay(this.game.canvas.parentElement as HTMLElement);
      this.input.addPointer(1);
      this.setupInput();
      this.scale.on('resize', () => this.onResize());
      this.onResize(true);
      this.ready = true;
      this.hooks.onReady();
    } catch (e: any) {
      console.error(e);
      this.hooks.onError(`场景初始化失败：${e?.message ?? e}`);
    }
  }

  destroyOverlay() {
    this.overlay?.destroy();
  }

  // ───────────────────────── 静态层（地板 / 墙 / 门 / 名牌）

  private bakeStatic() {
    const cv = document.createElement('canvas');
    cv.width = WORLD_W;
    cv.height = WORLD_H;
    const c = cv.getContext('2d') as CanvasRenderingContext2D;
    c.imageSmoothingEnabled = false;
    const wall = buildWallMap();

    for (const r of ROOMS) {
      const img = this.textures.get(r.floorTex).getSourceImage() as HTMLImageElement;
      for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) c.drawImage(img, x * TILE, y * TILE);
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = '#' + r.tint.toString(16).padStart(6, '0');
      c.fillRect(r.x1 * TILE, r.y1 * TILE, (r.x2 - r.x1 + 1) * TILE, (r.y2 - r.y1 + 1) * TILE);
      c.globalCompositeOperation = 'source-over';
    }
    // 门垫
    for (const [x, y] of DOORS) {
      const horizontal = !!wall[idx(x - 1, y)] || !!wall[idx(x + 1, y)];
      c.fillStyle = '#b7aa94';
      c.fillRect(x * TILE, y * TILE, TILE, TILE);
      c.fillStyle = '#8d7b62';
      if (horizontal) {
        c.fillRect(x * TILE, y * TILE + 2, TILE, 2);
        c.fillRect(x * TILE, y * TILE + 12, TILE, 2);
      } else {
        c.fillRect(x * TILE + 2, y * TILE, 2, TILE);
        c.fillRect(x * TILE + 12, y * TILE, 2, TILE);
      }
    }
    // 墙体投影（落在地面上）
    c.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (wall[idx(x, y)]) continue;
        if (y > 0 && wall[idx(x, y - 1)]) c.fillRect(x * TILE, y * TILE, TILE, 5);
        if (x > 0 && wall[idx(x - 1, y)]) c.fillRect(x * TILE, y * TILE, 4, TILE);
      }
    }
    // 墙体
    const owner = (x: number, y: number) =>
      ROOMS.find((r) => (x >= r.x1 && x <= r.x2 && (y === r.y1 || y === r.y2)) || (y >= r.y1 && y <= r.y2 && (x === r.x1 || x === r.x2)));
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!wall[idx(x, y)]) continue;
        const px = x * TILE;
        const py = y * TILE;
        const accent = owner(x, y)?.accent ?? '#78909c';
        const up = y > 0 && !!wall[idx(x, y - 1)];
        const down = y < ROWS - 1 && !!wall[idx(x, y + 1)];
        c.fillStyle = '#4a5c66';
        c.fillRect(px, py, TILE, TILE);
        if (!up) {
          c.fillStyle = '#7b929e';
          c.fillRect(px, py, TILE, 3);
          c.fillStyle = '#5f7581';
          c.fillRect(px, py + 3, TILE, 1);
        }
        if (!down) {
          c.fillStyle = accent;
          c.fillRect(px, py + TILE - 5, TILE, 4);
          c.fillStyle = '#2b363c';
          c.fillRect(px, py + TILE - 1, TILE, 1);
        } else if (up) {
          c.fillStyle = accent;
          c.fillRect(px + 6, py, 4, TILE);
          c.fillStyle = 'rgba(0,0,0,0.25)';
          c.fillRect(px + 10, py, 1, TILE);
        } else {
          c.fillStyle = accent;
          c.fillRect(px + 6, py + 4, 4, TILE - 4);
        }
      }
    }
    // 名牌（画在墙带上）
    c.textBaseline = 'top';
    for (const r of ROOMS) {
      const x = ROOM_LABEL_X[r.id] * TILE + 2;
      const y = r.y1 * TILE + 3;
      c.font = '10px CVPixel, "PingFang SC", "Microsoft YaHei", sans-serif';
      const w = Math.ceil(c.measureText(r.name).width);
      c.fillStyle = 'rgba(10,10,15,0.55)';
      c.fillRect(x - 2, y - 1, w + 4, 11);
      c.fillStyle = r.labelColor;
      c.fillText(r.name, x, y);
    }
    this.textures.addCanvas('bg_static', cv);
    this.add.image(0, 0, 'bg_static').setOrigin(0, 0).setDepth(-1000);
    this.windows = WINDOWS.map(([x, y]) => this.add.image(x * TILE, y * TILE, 'win_day').setOrigin(0, 0).setDepth(-999));
  }

  // ───────────────────────── 家具

  private buildFurniture(list: Furniture[]) {
    this.furnGroup.forEach((o) => o.destroy());
    this.furnGroup = [];
    this.pcBySeat.clear();
    this.racks = [];
    this.monitorWalls = [];
    this.boards = [];
    const push = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.furnGroup.push(o);
      return o;
    };
    for (const f of list) {
      const d = FURNITURE_MAP[f.type];
      if (!d) continue;
      const baseY = (f.y + d.h) * TILE;
      const img = push(this.add.image(f.x * TILE, baseY, d.tex).setOrigin(0, 1));
      img.setDepth(f.type === 'rug' ? -500 : baseY);
      if (f.type === 'serverRack') this.racks.push(img);
      if (f.type === 'monitorWall') this.monitorWalls.push(img);
      if (f.type === 'pipelineBoard') this.boards.push(img);
      if (f.type === 'desk' || f.type === 'bossDesk') {
        const pc = push(this.add.image((f.x + 1) * TILE, f.y * TILE + 29, 'f_PC_FRONT_OFF').setOrigin(0, 1).setDepth((f.y + 2) * TILE + 1));
        this.pcBySeat.set(`seat:${f.id}`, pc);
        push(this.add.image((f.x + 1) * TILE, (f.y + 3) * TILE - 3, 'f_CUSHIONED_CHAIR_BACK').setOrigin(0, 1).setDepth((f.y + 3) * TILE + 2));
      }
    }
    // 会议椅
    for (const n of deriveAnchors(list)) {
      if (n.use !== 'msit') continue;
      const key = n.dir === 'down' ? 'f_CUSHIONED_CHAIR_FRONT' : n.dir === 'up' ? 'f_CUSHIONED_CHAIR_BACK' : 'f_CUSHIONED_CHAIR_SIDE';
      const ch = this.add.image(n.x * TILE, (n.y + 1) * TILE, key).setOrigin(0, 1).setDepth((n.y + 1) * TILE + 2);
      if (n.dir === 'left') ch.setFlipX(true);
      push(ch);
    }
  }

  // ───────────────────────── 相机

  private applyCam() {
    const cam = this.cameras.main;
    cam.setZoom(this.zoom);
    cam.centerOn(this.camX, this.camY);
  }

  private fitZoom() {
    return Math.min(this.scale.width / WORLD_W, this.scale.height / WORLD_H);
  }

  fit() {
    const w = this.scale.width;
    const h = this.scale.height;
    // 竖屏（手机）：按高度适配约 75%，可左右拖动；横屏：完整显示
    this.zoom = w < h ? Math.max(this.fitZoom(), (h * 0.75) / WORLD_H) : this.fitZoom();
    this.camX = WORLD_W / 2;
    this.camY = WORLD_H / 2;
    this.userMoved = false;
    this.applyCam();
  }

  zoomBy(f: number) {
    this.zoomAt(this.scale.width / 2, this.scale.height / 2, f);
  }

  private onResize(first = false) {
    if (first || !this.userMoved) this.fit();
    else this.clampCam();
  }

  private clampCam() {
    const w = this.scale.width / this.zoom;
    const h = this.scale.height / this.zoom;
    const pad = TILE * 3;
    this.camX = w >= WORLD_W + pad * 2 ? WORLD_W / 2 : Math.max(w / 2 - pad, Math.min(WORLD_W - w / 2 + pad, this.camX));
    this.camY = h >= WORLD_H + pad * 2 ? WORLD_H / 2 : Math.max(h / 2 - pad, Math.min(WORLD_H - h / 2 + pad, this.camY));
    this.applyCam();
  }

  private toWorld(sx: number, sy: number) {
    return { x: this.camX + (sx - this.scale.width / 2) / this.zoom, y: this.camY + (sy - this.scale.height / 2) / this.zoom };
  }

  toScreen = (wx: number, wy: number) => ({ x: (wx - this.camX) * this.zoom + this.scale.width / 2, y: (wy - this.camY) * this.zoom + this.scale.height / 2 });

  private zoomAt(sx: number, sy: number, f: number) {
    const before = this.toWorld(sx, sy);
    const min = this.fitZoom() * 0.7;
    this.zoom = Math.max(min, Math.min(6, this.zoom * f));
    this.camX = before.x - (sx - this.scale.width / 2) / this.zoom;
    this.camY = before.y - (sy - this.scale.height / 2) / this.zoom;
    this.userMoved = true;
    this.clampCam();
  }

  // ───────────────────────── 输入

  private setupInput() {
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAt(p.x, p.y, dy > 0 ? 1 / 1.12 : 1.12);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.downInfo = { x: p.x, y: p.y, t: performance.now(), moved: false };
      if (this.editor.active) this.editorDown(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
  }

  private onMove(p: Phaser.Input.Pointer) {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown) {
      const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      if (this.pinchDist > 0) this.zoomAt(mx, my, d / this.pinchDist);
      this.pinchDist = d;
      this.pinching = true;
      return;
    }
    this.pinchDist = 0;
    if (this.editor.active) {
      const w = this.toWorld(p.x, p.y);
      this.editorMove(w.x, w.y);
      if (this.dragFurn) return;
    }
    if (!p.isDown || !this.downInfo || this.pinching) {
      this.updateHoverCursor(p);
      return;
    }
    const dx = p.x - this.downInfo.x;
    const dy = p.y - this.downInfo.y;
    if (!this.downInfo.moved && Math.hypot(dx, dy) < 5) return;
    this.downInfo.moved = true;
    this.camX -= (p.x - p.prevPosition.x) / this.zoom;
    this.camY -= (p.y - p.prevPosition.y) / this.zoom;
    this.userMoved = true;
    this.clampCam();
  }

  private updateHoverCursor(p: Phaser.Input.Pointer) {
    if (this.editor.active) {
      this.input.setDefaultCursor(this.editor.placing ? 'copy' : 'default');
      return;
    }
    const w = this.toWorld(p.x, p.y);
    this.input.setDefaultCursor(this.hitAgent(w.x, w.y) ? 'pointer' : 'default');
  }

  private onUp(p: Phaser.Input.Pointer) {
    const info = this.downInfo;
    this.downInfo = null;
    if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) this.pinchDist = 0;
    if (this.pinching) {
      if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pinching = false;
      return;
    }
    if (this.editor.active) {
      this.editorUp(p, info);
      return;
    }
    if (!info || info.moved || performance.now() - info.t > 500) return;
    const w = this.toWorld(p.x, p.y);
    const hit = this.hitAgent(w.x, w.y);
    this.selectedId = hit;
    this.hooks.onSelect(hit);
  }

  private hitAgent(wx: number, wy: number): string | null {
    let best: string | null = null;
    let bestY = -1;
    for (const a of this.engine.agents) {
      const fy = a.y + 8;
      if (wx >= a.x - 9 && wx <= a.x + 9 && wy >= fy - 32 && wy <= fy + 3 && fy > bestY) {
        best = a.def.id;
        bestY = fy;
      }
    }
    return best;
  }

  select(id: string | null) {
    this.selectedId = id;
  }

  // ───────────────────────── 编辑器

  private emitEditor() {
    const sel = this.draft.find((f) => f.id === this.editor.selectedId);
    this.editor = {
      ...this.editor,
      selectedType: sel?.type ?? null,
      selectedTag: sel?.tag ?? null,
      canUndo: this.undo.length > 0,
      count: this.draft.length,
    };
    this.hooks.onEditor({ ...this.editor });
  }

  private pushUndo() {
    this.undo.push(JSON.stringify(this.draft));
    if (this.undo.length > 40) this.undo.shift();
    this.editor.dirty = true;
  }

  private redraw() {
    this.buildFurniture(this.draft);
    this.emitEditor();
  }

  editorEnter() {
    this.draft = this.engine.furniture.map((f) => ({ ...f }));
    this.undo = [];
    this.editor = { active: true, placing: null, selectedId: null, selectedType: null, selectedTag: null, canUndo: false, dirty: false, count: this.draft.length };
    this.redraw();
  }

  editorExit(save: boolean) {
    if (save && this.editor.dirty) this.engine.setFurniture(this.draft);
    this.draft = this.engine.furniture.map((f) => ({ ...f }));
    this.furnVersionDrawn = this.engine.furnitureVersion;
    this.editor = { active: false, placing: null, selectedId: null, selectedType: null, selectedTag: null, canUndo: false, dirty: false, count: this.draft.length };
    this.ghost.setVisible(false);
    this.editGfx.clear();
    this.input.setDefaultCursor('default');
    this.buildFurniture(this.draft);
    this.emitEditor();
  }

  editorPlace(type: string | null) {
    this.editor.placing = type;
    this.editor.selectedId = null;
    if (type) this.ghost.setTexture(FURNITURE_MAP[type].tex).setVisible(true);
    else this.ghost.setVisible(false);
    this.emitEditor();
  }

  editorDelete() {
    const id = this.editor.selectedId;
    if (!id) return;
    this.pushUndo();
    this.draft = this.draft.filter((f) => f.id !== id);
    this.editor.selectedId = null;
    this.redraw();
  }

  editorUndo() {
    const prev = this.undo.pop();
    if (!prev) return;
    this.draft = JSON.parse(prev);
    this.editor.selectedId = null;
    this.redraw();
  }

  editorSetTag(tag: string) {
    const f = this.draft.find((x) => x.id === this.editor.selectedId);
    if (!f) return;
    this.pushUndo();
    if (tag) f.tag = tag;
    else delete f.tag;
    this.emitEditor();
  }

  editorReset() {
    this.pushUndo();
    this.draft = defaultFurniture();
    this.editor.selectedId = null;
    this.redraw();
  }

  editorExport(): string {
    return JSON.stringify({ format: 'codeville-layout', version: 1, furniture: this.draft }, null, 2);
  }

  editorImport(json: string): boolean {
    try {
      const o = JSON.parse(json);
      const list: Furniture[] = o.furniture;
      if (!Array.isArray(list)) return false;
      const ok = list.every((f) => f && typeof f.type === 'string' && FURNITURE_MAP[f.type] && Number.isFinite(f.x) && Number.isFinite(f.y));
      if (!ok) return false;
      this.pushUndo();
      this.draft = list.map((f, i) => ({ id: f.id || `imp-${i}`, type: f.type, x: f.x | 0, y: f.y | 0, ...(f.tag ? { tag: f.tag } : {}) }));
      this.redraw();
      return true;
    } catch {
      return false;
    }
  }

  private footprintOk(type: string, x: number, y: number, ignoreId?: string): boolean {
    const d = FURNITURE_MAP[type];
    const wall = buildWallMap();
    const occ = new Set<number>();
    for (const f of this.draft) {
      if (f.id === ignoreId) continue;
      const fd = FURNITURE_MAP[f.type];
      if (!fd || !fd.blocks) continue;
      for (let dy = 0; dy < fd.h; dy++) for (let dx = 0; dx < fd.w; dx++) occ.add(idx(f.x + dx, f.y + dy));
    }
    for (let dy = 0; dy < d.h; dy++) {
      for (let dx = 0; dx < d.w; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
        if (wall[idx(tx, ty)] || roomAt(tx, ty) === null) return false;
        if (d.blocks && occ.has(idx(tx, ty))) return false;
      }
    }
    if (type === 'desk' || type === 'bossDesk') {
      const sx = x + 1;
      const sy = y + 2;
      if (sx >= COLS || sy >= ROWS || wall[idx(sx, sy)] || roomAt(sx, sy) === null || occ.has(idx(sx, sy))) return false;
    }
    return true;
  }

  private snapTile(wx: number, wy: number, type: string) {
    const d = FURNITURE_MAP[type];
    return { x: Math.floor(wx / TILE - (d.w - 1) / 2 + 0.0001), y: Math.floor(wy / TILE - (d.h - 1) / 2 + 0.0001) };
  }

  private hitFurniture(wx: number, wy: number): Furniture | null {
    let best: Furniture | null = null;
    let bestArea = Infinity;
    for (const f of this.draft) {
      const d = FURNITURE_MAP[f.type];
      if (!d) continue;
      const x1 = f.x * TILE;
      const y2 = (f.y + d.h) * TILE;
      const hh = Math.max(d.sh, d.h * TILE);
      if (wx >= x1 && wx <= x1 + Math.max(d.sw, d.w * TILE) && wy >= y2 - hh && wy <= y2) {
        const area = d.sw * d.sh;
        if (area <= bestArea) {
          best = f;
          bestArea = area;
        }
      }
    }
    return best;
  }

  private editorDown(p: Phaser.Input.Pointer) {
    if (this.pinching || this.editor.placing) return;
    const w = this.toWorld(p.x, p.y);
    const f = this.hitFurniture(w.x, w.y);
    if (f) {
      this.editor.selectedId = f.id;
      this.dragFurn = { id: f.id, dx: w.x / TILE - f.x, dy: w.y / TILE - f.y, pushed: false };
      this.emitEditor();
    }
  }

  private editorMove(wx: number, wy: number) {
    if (this.editor.placing) {
      const t = this.editor.placing;
      const s = this.snapTile(wx, wy, t);
      const d = FURNITURE_MAP[t];
      const ok = this.footprintOk(t, s.x, s.y);
      this.ghost.setPosition(s.x * TILE, (s.y + d.h) * TILE).setTint(ok ? 0xb8ffb8 : 0xff8080).setVisible(true);
      return;
    }
    if (this.dragFurn && this.downInfo) {
      const f = this.draft.find((x) => x.id === this.dragFurn!.id);
      if (!f) return;
      const nx = Math.floor(wx / TILE - this.dragFurn.dx + 0.5);
      const ny = Math.floor(wy / TILE - this.dragFurn.dy + 0.5);
      if ((nx !== f.x || ny !== f.y) && this.footprintOk(f.type, nx, ny, f.id)) {
        if (!this.dragFurn.pushed) {
          this.undo.push(JSON.stringify(this.draft));
          this.editor.dirty = true;
          this.dragFurn.pushed = true;
        }
        f.x = nx;
        f.y = ny;
        this.buildFurniture(this.draft);
      }
    }
  }

  private editorUp(p: Phaser.Input.Pointer, info: { x: number; y: number; t: number; moved: boolean } | null) {
    const drag = this.dragFurn;
    this.dragFurn = null;
    if (drag) {
      this.emitEditor();
      return;
    }
    if (!info || info.moved) return;
    const w = this.toWorld(p.x, p.y);
    if (this.editor.placing) {
      const t = this.editor.placing;
      const s = this.snapTile(w.x, w.y, t);
      if (this.footprintOk(t, s.x, s.y)) {
        this.pushUndo();
        const tag = t === 'bossDesk' ? 'cto' : undefined;
        this.draft.push({ id: `${t}-n${++this.idSeq}`, type: t, x: s.x, y: s.y, ...(tag ? { tag } : {}) });
        this.redraw();
      }
      return;
    }
    if (!this.hitFurniture(w.x, w.y)) {
      this.editor.selectedId = null;
      this.emitEditor();
    }
  }

  // ───────────────────────── 每帧

  update(_time: number, delta: number) {
    if (!this.ready) return;
    const eng = this.engine;
    eng.update(delta);
    this.clockT += delta;

    if (!this.editor.active && this.furnVersionDrawn !== eng.furnitureVersion) {
      this.draft = eng.furniture.map((f) => ({ ...f }));
      this.buildFurniture(this.draft);
      this.furnVersionDrawn = eng.furnitureVersion;
    }

    this.updateChars();
    this.updateFurnitureAnim(delta);
    this.updateAmbient();
    this.drawOverlays();
    this.overlay.update(eng, this.toScreen, this.selectedId, Math.max(0.65, Math.min(1.35, this.zoom / 1.5)));

    this.pubAcc += delta;
    if (this.pubAcc > 250) {
      this.pubAcc = 0;
      this.hooks.publish();
    }
  }

  private updateChars() {
    const t = this.clockT;
    const seen = new Set<string>();
    for (const a of this.engine.agents) {
      seen.add(a.def.id);
      const texKey = ensureCharTexture(this, a.def.skin, a.def.hue);
      let v = this.chars.get(a.def.id);
      if (!v) {
        const sprite = this.add.sprite(a.x, a.y + 8, texKey, 1).setOrigin(0.5, 1);
        const shadow = this.add.image(a.x, a.y + 8, 'shadow').setOrigin(0.5, 0.5);
        v = { sprite, shadow, texKey };
        this.chars.set(a.def.id, v);
      }
      if (v.texKey !== texKey) {
        v.sprite.setTexture(texKey, 1);
        v.texKey = texKey;
      }
      const row = DIR_ROW[a.dir] ?? 0;
      let col = 1;
      if (a.anim === 'walk') col = FRAME.walk[Math.floor(t / 140) % 4];
      else if (a.anim === 'type') col = FRAME.type[Math.floor(t / 280) % 2];
      else if (a.anim === 'read') col = FRAME.read[Math.floor(t / 520) % 2];
      v.sprite.setFrame(row * 7 + col);
      v.sprite.setFlipX(a.dir === 'left');
      const sitOff = a.pose === 'sit' && a.dir === 'up' ? 4 : a.pose === 'sit' ? -1 : 0;
      v.sprite.setPosition(Math.round(a.x), Math.round(a.y + 8 + sitOff));
      v.sprite.setDepth(a.y + 8 + (a.pose === 'sit' ? 6 : 0));
      v.sprite.setAlpha(a.def.offline ? 0.4 : 1);
      v.shadow.setPosition(Math.round(a.x), Math.round(a.y + 8));
      v.shadow.setDepth(a.y + 7.5);
      v.shadow.setVisible(a.pose !== 'sit');
    }
    for (const [id, v] of this.chars) {
      if (!seen.has(id)) {
        v.sprite.destroy();
        v.shadow.destroy();
        this.chars.delete(id);
      }
    }
  }

  private updateFurnitureAnim(delta: number) {
    const t = this.clockT;
    const eng = this.engine;
    const byDesk = new Set<string>();
    for (const a of eng.agents) {
      if (a.deskId && a.goal?.arrived && a.pose === 'sit' && !a.def.offline && a.goal.anchor.id === a.deskId) byDesk.add(a.deskId);
    }
    for (const [seat, img] of this.pcBySeat) {
      img.setTexture(byDesk.has(seat) ? `f_PC_FRONT_ON_${(Math.floor(t / 500) % 3) + 1}` : 'f_PC_FRONT_OFF');
    }
    const blink = Math.floor(t / 450) % 2;
    for (const r of this.racks) r.setTexture(`g_serverRack_${blink}`);
    const alert = eng.incident.active;
    for (const w of this.monitorWalls) w.setTexture(`g_monitorWall_${(alert ? 2 : 0) + (Math.floor(t / (alert ? 300 : 900)) % 2)}`);
    this.boardAcc += delta;
    if (this.boardAcc > 500 && this.boards.length) {
      this.boardAcc = 0;
      const counts: Record<string, number> = {};
      for (const k of eng.tasks) counts[k.stage] = (counts[k.stage] || 0) + 1;
      drawPipelineBoard(this.pipelineCtx, counts, alert);
      this.pipelineTex.refresh();
    }
  }

  private updateAmbient() {
    const amb = this.engine.settings.dayNight ? ambientAt(this.engine.clockMinutes) : 0;
    this.nightRect.setFillStyle(0x0a1238, amb * 0.56);
    const mode = amb < 0.15 ? 'win_day' : amb < 0.7 ? 'win_dusk' : 'win_night';
    for (const w of this.windows) if (w.texture.key !== mode) w.setTexture(mode);
    const pulse = this.engine.incident.active ? 0.07 + 0.07 * Math.sin(this.clockT / 180) : 0;
    this.alertRect.setFillStyle(0xff1744, pulse);
  }

  private drawOverlays() {
    this.ring.clear();
    if (this.selectedId) {
      const a = this.engine.agents.find((x) => x.def.id === this.selectedId);
      if (a) {
        this.ring.lineStyle(1, 0xffd700, 1);
        this.ring.strokeEllipse(Math.round(a.x), Math.round(a.y + 8), 16, 7);
      }
    }
    this.editGfx.clear();
    if (this.editor.active) {
      this.editGfx.lineStyle(1, 0xffffff, 0.06);
      for (let x = 0; x <= COLS; x++) this.editGfx.lineBetween(x * TILE, 0, x * TILE, WORLD_H);
      for (let y = 0; y <= ROWS; y++) this.editGfx.lineBetween(0, y * TILE, WORLD_W, y * TILE);
      const sel = this.draft.find((f) => f.id === this.editor.selectedId);
      if (sel) {
        const d = FURNITURE_MAP[sel.type];
        const hh = Math.max(d.sh, d.h * TILE);
        this.editGfx.lineStyle(2, 0xffd700, 1);
        this.editGfx.strokeRect(sel.x * TILE, (sel.y + d.h) * TILE - hh, Math.max(d.sw, d.w * TILE), hh);
      }
    }
  }
}
