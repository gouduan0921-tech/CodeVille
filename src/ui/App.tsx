import { useEffect, useRef } from 'react';
import { Engine } from '../core/engine';
import { SimProvider } from '../core/provider';
import { clearAll } from '../core/persist';
import { createGame } from '../game/createGame';
import type { GameHandle } from '../game/createGame';
import { EditorPanel } from './EditorPanel';
import { Hud, Toolbar } from './Toolbar';
import { Modals } from './Modals';
import { Sidebar } from './Sidebar';
import { closeModal, ctx, openAgent, sim, ui, useUI } from './store';

export function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const loading = useUI((s) => s.loading);
  const progress = useUI((s) => s.progress);
  const error = useUI((s) => s.error);
  const sidebarOpen = useUI((s) => s.sidebarOpen);
  const editing = useUI((s) => s.editor.active);
  const t = useUI((s) => s.toast);

  useEffect(() => {
    let disposed = false;
    let handle: GameHandle | null = null;
    let engine: Engine;
    try {
      engine = new Engine({ persist: true });
    } catch (e) {
      console.error(e);
      ui.set({ error: '本地存档损坏，已无法读取。可以点击“清空数据并重试”。', loading: false });
      return;
    }
    ctx.engine = engine;
    ctx.provider = new SimProvider(engine);
    sim.set({ snap: engine.snapshot() });
    createGame(stageRef.current as HTMLDivElement, engine, {
      onProgress: (p) => ui.set({ progress: p }),
      onReady: () => ui.set({ loading: false }),
      onError: (msg) => ui.set({ error: msg, loading: false }),
      onSelect: (id) => {
        if (id) openAgent(id);
        else if (ui.get().modal === 'agent') {
          closeModal();
          ui.set({ agentId: null });
        }
      },
      onEditor: (s) => ui.set({ editor: s }),
      publish: () => sim.set({ snap: engine.snapshot() }),
    })
      .then((h) => {
        if (disposed) h.destroy();
        else {
          handle = h;
          ctx.game = h;
        }
      })
      .catch((e) => ui.set({ error: `启动失败：${e?.message ?? e}`, loading: false }));
    return () => {
      disposed = true;
      handle?.destroy();
      ctx.game = null;
    };
  }, []);

  // 键盘快捷键（输入框内不触发）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const st = ui.get();
      if (e.key === 'Escape') {
        if (st.editor.active && st.editor.placing) ctx.game?.editor.place(null);
        else if (st.modal) closeModal();
        else if (st.agentId) {
          ui.set({ agentId: null });
          ctx.game?.select(null);
        }
      } else if (st.editor.active && (e.key === 'Delete' || e.key === 'Backspace')) {
        ctx.game?.editor.remove();
      } else if (st.editor.active && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        ctx.game?.editor.undo();
      } else if (e.key === ' ' && !st.modal) {
        e.preventDefault();
        ctx.engine?.updateSettings({ paused: !ctx.engine.settings.paused });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`app ${sidebarOpen ? 'sb-open' : ''} ${editing ? 'editing' : ''}`}>
      <main className="stage-wrap">
        <div className="stage" ref={stageRef} />
        {!loading && !error && <Hud />}
        {editing && <EditorPanel />}
        <Toolbar />
      </main>
      <Sidebar />
      <Modals />
      {loading && !error && (
        <div className="screen loading">
          <div className="logo">CODEVILLE</div>
          <div className="sub">研发办公室正在开门…</div>
          <div className="bar">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="hint">加载像素素材 {Math.round(progress * 100)}%</div>
        </div>
      )}
      {error && (
        <div className="screen error">
          <div className="logo err">⚠ 出错了</div>
          <div className="sub">{error}</div>
          <div className="row">
            <button className="btn" onClick={() => location.reload()}>重新加载</button>
            <button
              className="btn ghost"
              onClick={() => {
                clearAll();
                location.reload();
              }}
            >
              清空数据并重试
            </button>
          </div>
        </div>
      )}
      {t && <div className={`toast ${t.level}`}>{t.text}</div>}
    </div>
  );
}
