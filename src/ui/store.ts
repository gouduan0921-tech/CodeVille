import { useSyncExternalStore } from 'react';
import type { Engine } from '../core/engine';
import type { SimProvider } from '../core/provider';
import type { Snapshot } from '../core/types';
import type { EditorState, GameHandle } from '../game/createGame';

export function createStore<T extends object>(init: T) {
  let state = init;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(p: Partial<T> | ((s: T) => Partial<T>)) {
      state = { ...state, ...(typeof p === 'function' ? p(state) : p) };
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
  };
}

export type ModalId = null | 'agent' | 'members' | 'meetings' | 'projects' | 'settings' | 'about';

export interface UIState {
  loading: boolean;
  progress: number;
  error: string | null;
  modal: ModalId;
  agentId: string | null;
  sidebarOpen: boolean;
  bubbleMode: 'full' | 'mini';
  editor: EditorState;
  toast: { id: number; text: string; level: 'info' | 'ok' | 'warn' | 'error' } | null;
  endMeetingId: string | null;
}

export const ui = createStore<UIState>({
  loading: true,
  progress: 0,
  error: null,
  modal: null,
  agentId: null,
  sidebarOpen: false,
  bubbleMode: 'full',
  editor: { active: false, placing: null, selectedId: null, selectedType: null, selectedTag: null, canUndo: false, dirty: false, count: 0 },
  toast: null,
  endMeetingId: null,
});

export const sim = createStore<{ snap: Snapshot | null }>({ snap: null });

/** 引擎 / 游戏句柄的全局单例（由 main.tsx 初始化） */
export const ctx: { engine: Engine | null; game: GameHandle | null; provider: SimProvider | null } = { engine: null, game: null, provider: null };

export function useUI<S>(sel: (s: UIState) => S): S {
  return useSyncExternalStore(ui.subscribe, () => sel(ui.get()));
}
export function useSnap(): Snapshot | null {
  return useSyncExternalStore(sim.subscribe, () => sim.get().snap);
}

let toastSeq = 0;
export function toast(text: string, level: 'info' | 'ok' | 'warn' | 'error' = 'info') {
  const id = ++toastSeq;
  ui.set({ toast: { id, text, level } });
  setTimeout(() => {
    if (ui.get().toast?.id === id) ui.set({ toast: null });
  }, 3200);
}

export function openAgent(id: string) {
  ui.set({ modal: 'agent', agentId: id });
  ctx.game?.select(id);
}
export function closeModal() {
  ui.set({ modal: null, endMeetingId: null });
}
