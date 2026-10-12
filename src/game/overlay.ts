import type { Engine } from '../core/engine.ts';
import { ROLE_MAP } from '../core/roles.ts';

interface Item {
  tag: HTMLDivElement;
  nm: HTMLSpanElement;
  bub: HTMLDivElement;
  last: string;
  bubText: string;
  bubKind: string;
}

/**
 * DOM 覆盖层：名牌与对话气泡用 HTML 渲染（中文像素字体清晰、可换行），
 * 每帧按相机把世界坐标投影到屏幕。
 */
export class Overlay {
  root: HTMLDivElement;
  items = new Map<string, Item>();
  bubbleMode: 'full' | 'mini' = 'full';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'cv-overlay';
    parent.appendChild(this.root);
  }

  destroy() {
    this.root.remove();
    this.items.clear();
  }

  private make(id: string): Item {
    const tag = document.createElement('div');
    tag.className = 'cv-tag';
    const nm = document.createElement('span');
    nm.className = 'cv-nm';
    tag.appendChild(nm);
    const bub = document.createElement('div');
    bub.className = 'cv-bub';
    bub.style.display = 'none';
    this.root.appendChild(tag);
    this.root.appendChild(bub);
    const it = { tag, nm, bub, last: '', bubText: '', bubKind: '' };
    this.items.set(id, it);
    return it;
  }

  update(engine: Engine, project: (wx: number, wy: number) => { x: number; y: number }, selectedId: string | null, scale = 1) {
    const seen = new Set<string>();
    const s = engine.settings;
    for (const a of engine.agents) {
      seen.add(a.def.id);
      const it = this.items.get(a.def.id) || this.make(a.def.id);
      const role = ROLE_MAP[a.def.role];
      const label = `${role.emoji} ${a.def.name}`;
      if (it.nm.textContent !== label) it.nm.textContent = label;
      it.tag.style.setProperty('--c', role.color);
      it.tag.classList.toggle('sel', a.def.id === selectedId);
      it.tag.classList.toggle('off', !!a.def.offline);
      const sit = a.pose === 'sit' ? 4 : 0;
      const p = project(a.x, a.y + 8 + sit - 34);
      const key = `${Math.round(p.x)},${Math.round(p.y)},${scale.toFixed(2)}`;
      it.tag.style.display = s.showNames ? '' : 'none';
      if (it.last !== key) {
        it.last = key;
        it.tag.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
        it.tag.style.transformOrigin = '50% 100%';
        it.bub.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y) - (s.showNames ? 16 * scale : 0)}px) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
        it.bub.style.transformOrigin = '50% 100%';
      }
      const b = a.bubble;
      if (b && s.showBubbles) {
        const text = this.bubbleMode === 'mini' ? '💬' : b.text;
        if (it.bubText !== text || it.bubKind !== b.kind) {
          it.bubText = text;
          it.bubKind = b.kind;
          it.bub.textContent = text;
          it.bub.className = `cv-bub ${b.kind} ${this.bubbleMode}`;
        }
        it.bub.style.display = '';
      } else if (it.bub.style.display !== 'none') {
        it.bub.style.display = 'none';
        it.bubText = '';
      }
    }
    for (const [id, it] of this.items) {
      if (!seen.has(id)) {
        it.tag.remove();
        it.bub.remove();
        this.items.delete(id);
      }
    }
  }
}
