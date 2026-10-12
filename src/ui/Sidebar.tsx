import { useEffect, useRef, useState } from 'react';
import { PIPELINE, ROLES, ROLE_MAP, STAGE_MAP, STATUS_META } from '../core/roles';
import { openAgent, ui, useSnap, useUI } from './store';

function Section(p: { title: string; icon: string; right?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(p.defaultOpen ?? true);
  return (
    <section className="sb-sec">
      <header onClick={() => setOpen(!open)}>
        <span className="arr">{open ? '▼' : '▶'}</span>
        <span className="ic">{p.icon}</span>
        <span className="tt">{p.title}</span>
        {p.right && <span className="rt" onClick={(e) => e.stopPropagation()}>{p.right}</span>}
      </header>
      {open && <div className="sb-body">{p.children}</div>}
    </section>
  );
}

export function Sidebar() {
  const snap = useSnap();
  const selected = useUI((s) => s.agentId);
  const logRef = useRef<HTMLUListElement>(null);
  const lastLog = snap?.logs[snap.logs.length - 1]?.id;
  useEffect(() => {
    const el = logRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 60) el.scrollTop = el.scrollHeight;
  }, [lastLog]);

  if (!snap) return <aside className="sidebar" />;
  const active = snap.tasks.filter((t) => t.stage !== 'backlog' && t.stage !== 'done');
  const agentName = (id?: string) => snap.agents.find((a) => a.id === id)?.name;

  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>CODEVILLE</h1>
        <div className="brand-sub">⚡ {snap.settings.officeName} ⚡</div>
      </div>

      <Section title="研发流水线" icon="🔄" right={<button className="mini" onClick={() => ui.set({ modal: 'projects' })}>看板</button>}>
        <div className="pipe">
          {PIPELINE.map((id, i) => {
            const st = STAGE_MAP[id];
            const n = snap.stageCounts[id];
            return (
              <div key={id} className={`pipe-step ${n ? 'has' : ''}`} style={{ ['--c' as any]: st.color }}>
                <div className="pe">{st.emoji}</div>
                <div className="pn">{st.name}</div>
                <div className="pc">{n}</div>
                {i < PIPELINE.length - 1 && <div className="pa">›</div>}
              </div>
            );
          })}
        </div>
        {active.length === 0 ? (
          <div className="empty">暂无进行中的需求 · 需求池 {snap.stageCounts.backlog} 个</div>
        ) : (
          <ul className="task-mini">
            {active.slice(0, 6).map((t) => (
              <li key={t.id}>
                <div className="tm-top">
                  <span className={`kind ${t.kind}`}>{t.kind === 'bug' ? '🐛' : t.kind === 'hotfix' ? '🔥' : t.kind === 'chore' ? '🧹' : '✨'}</span>
                  <span className="tm-title">{t.title}</span>
                  <span className="tm-stage" style={{ color: STAGE_MAP[t.stage].color }}>{STAGE_MAP[t.stage].name}</span>
                </div>
                <div className="prog">
                  <i style={{ width: `${t.progress}%`, background: STAGE_MAP[t.stage].color }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="stats">
          <span>✅ 完成 {snap.stats.done}</span>
          <span>🚀 部署 {snap.stats.deploys}</span>
          <span>🐛 缺陷 {snap.stats.bugs}</span>
          <span>🚨 事故 {snap.stats.incidents}</span>
        </div>
      </Section>

      <Section title="部门与成员" icon="🏢" right={<button className="mini" onClick={() => ui.set({ modal: 'members' })}>＋ 成员</button>}>
        {snap.agents.length === 0 && <div className="empty">还没有成员，点击「＋ 成员」组建你的研发团队。</div>}
        {ROLES.map((r) => {
          const list = snap.agents.filter((a) => a.role === r.id);
          if (!list.length) return null;
          return (
            <div key={r.id} className="branch" style={{ ['--c' as any]: r.color }}>
              <div className="br-head">
                <span>{r.emoji}</span>
                <b>{r.name}</b>
                <span className="br-home">{r.homeLabel}</span>
                <span className="br-n">{list.length}</span>
              </div>
              {list.map((a) => {
                const meta = STATUS_META[a.status];
                return (
                  <div key={a.id} className={`ag-row ${selected === a.id ? 'sel' : ''}`} onClick={() => openAgent(a.id)}>
                    <span className="dot" style={{ background: meta.color }} />
                    <span className="nm">{a.name}</span>
                    <span className="act">{a.status === 'offline' ? '离线' : a.activity}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </Section>

      {(snap.meetings.length > 0 || snap.meetingHistory.length > 0) && (
        <Section title="会议" icon="🤝" right={<button className="mini" onClick={() => ui.set({ modal: 'meetings' })}>管理</button>}>
          {snap.meetings.map((m) => (
            <div key={m.id} className={`mtg-mini ${m.type}`}>
              <b>{m.title}</b>
              <span>{m.state === 'gathering' ? '集合中' : '进行中'} · {m.participants.length} 人</span>
            </div>
          ))}
          {snap.meetings.length === 0 && snap.meetingHistory[0] && (
            <div className="mtg-mini ended">
              <b>上次：{snap.meetingHistory[0].title}</b>
              <span>{snap.meetingHistory[0].summary}</span>
            </div>
          )}
        </Section>
      )}

      <div className="counts">
        {(['working', 'idle', 'meeting', 'break', 'blocked', 'error'] as const).map((k) => (
          <span key={k} className={snap.counts[k] ? '' : 'zero'}>
            <i style={{ background: STATUS_META[k].color }} />
            {STATUS_META[k].label}：{snap.counts[k]}
          </span>
        ))}
      </div>

      <Section title="活动日志" icon="›">
        <ul className="log" ref={logRef}>
          {snap.logs.length === 0 && <li className="empty">暂无活动</li>}
          {snap.logs.map((l) => (
            <li key={l.id} className={l.level} onClick={() => l.agentId && openAgent(l.agentId)}>
              <span className="ts">[{l.clock}]</span>
              <span className="tx">{l.text}</span>
            </li>
          ))}
        </ul>
      </Section>
      <div className="sb-foot">
        当前在岗 {snap.agents.filter((a) => a.status !== 'offline').length}/{snap.agents.length} 人 · {ROLE_MAP.cto.emoji}{' '}
        {agentName(snap.agents.find((a) => a.role === 'cto')?.id) ?? '暂无 CTO'}
      </div>
    </aside>
  );
}
