import { ROOM_MAP } from '../core/layout';
import { ctx, toast, ui, useSnap, useUI } from './store';

function Btn(p: { icon: string; label: string; onClick: () => void; active?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button className={`tb-btn ${p.active ? 'on' : ''}`} onClick={p.onClick} disabled={p.disabled} title={p.title || p.label}>
      <span className="ic">{p.icon}</span>
      <span className="lb">{p.label}</span>
    </button>
  );
}

export function Toolbar() {
  const snap = useSnap();
  const editing = useUI((s) => s.editor.active);
  const bubbleMode = useUI((s) => s.bubbleMode);
  const loading = useUI((s) => s.loading);
  const s = snap?.settings;
  const dis = loading || !snap;
  const setBubble = (m: 'full' | 'mini') => {
    ui.set({ bubbleMode: m });
    ctx.game?.setBubbleMode(m);
    if (!ctx.engine?.settings.showBubbles) ctx.engine?.updateSettings({ showBubbles: true });
  };
  return (
    <nav className="toolbar">
      <Btn icon="☰" label="菜单" disabled={dis} onClick={() => ui.set({ modal: 'settings' })} />
      <Btn
        icon="✏️"
        label={editing ? '编辑中' : '编辑办公室'}
        active={editing}
        disabled={dis}
        onClick={() => (editing ? ctx.game?.editor.exit(false) : ctx.game?.editor.enter())}
      />
      <Btn icon="👤" label="成员" disabled={dis || editing} onClick={() => ui.set({ modal: 'members' })} />
      <Btn icon="📋" label="看板" disabled={dis || editing} onClick={() => ui.set({ modal: 'projects' })} />
      <Btn icon="🤝" label="会议" disabled={dis || editing} onClick={() => ui.set({ modal: 'meetings' })} />
      <span className="tb-sep" />
      <Btn icon="💬" label="展开气泡" active={bubbleMode === 'full' && !!s?.showBubbles} disabled={dis} onClick={() => setBubble('full')} />
      <Btn icon="🫧" label="收起气泡" active={bubbleMode === 'mini' && !!s?.showBubbles} disabled={dis} onClick={() => setBubble('mini')} />
      <span className="tb-sep" />
      <Btn
        icon={s?.paused ? '▶️' : '⏸️'}
        label={s?.paused ? '继续' : '暂停'}
        active={!!s?.paused}
        disabled={dis}
        title="暂停 / 继续模拟（空格键）"
        onClick={() => ctx.engine?.updateSettings({ paused: !s?.paused })}
      />
      <Btn
        icon="⏩"
        label={`${s?.speed ?? 1}x 速度`}
        disabled={dis}
        onClick={() => {
          const next = s?.speed === 1 ? 2 : s?.speed === 2 ? 4 : 1;
          ctx.engine?.updateSettings({ speed: next as 1 | 2 | 4 });
          toast(`模拟速度 ${next}x`);
        }}
      />
      <Btn icon="🎯" label="适应画面" disabled={dis} onClick={() => ctx.game?.fit()} />
    </nav>
  );
}

export function Hud() {
  const snap = useSnap();
  const sidebarOpen = useUI((s) => s.sidebarOpen);
  if (!snap) return null;
  const amb = snap.ambient;
  const tod = amb < 0.15 ? '☀️ 白天' : amb < 0.7 ? '🌇 黄昏' : '🌙 夜晚';
  const meeting = snap.meetings[0];
  return (
    <>
      <div className="hud tl">
        <div className="hud-card clock">
          <b>{snap.clock}</b>
          <span>{snap.settings.dayNight ? tod : '恒定光照'}</span>
          {snap.settings.paused && <em className="paused">已暂停</em>}
        </div>
        {snap.incident.active && (
          <div className="hud-card alert" onClick={() => ui.set({ modal: 'meetings' })}>
            🚨 线上告警 · {ROOM_MAP.ops.name}紧急处理中
          </div>
        )}
        {meeting && !snap.incident.active && (
          <div className="hud-card meet" onClick={() => ui.set({ modal: 'meetings' })}>
            📣 {meeting.title} · {meeting.state === 'gathering' ? '集合中' : '进行中'}
          </div>
        )}
      </div>
      <div className="hud tr">
        <button className="hud-btn" title="放大" onClick={() => ctx.game?.zoomBy(1.25)}>＋</button>
        <button className="hud-btn" title="缩小" onClick={() => ctx.game?.zoomBy(0.8)}>－</button>
        <button className="hud-btn mob" title="侧边栏" onClick={() => ui.set({ sidebarOpen: !sidebarOpen })}>
          {sidebarOpen ? '✕' : '☰'}
        </button>
      </div>
    </>
  );
}
