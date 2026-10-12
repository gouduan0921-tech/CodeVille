import { useEffect, useMemo, useRef, useState } from 'react';
import { ROOM_MAP } from '../core/layout';
import { ROLES, ROLE_MAP, STAGES, STAGE_MAP, STATUS_META } from '../core/roles';
import type { MeetingType, RoleId, StageId, TaskView } from '../core/types';
import { clearAll } from '../core/persist';
import { closeModal, ctx, toast, ui, useSnap, useUI } from './store';

function Modal(p: { title: React.ReactNode; onClose?: () => void; wide?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && (p.onClose ?? closeModal)()}>
      <div className={`modal ${p.wide ? 'wide' : ''} ${p.className ?? ''}`} role="dialog">
        <div className="modal-head">
          <div className="modal-title">{p.title}</div>
          <button className="x" onClick={p.onClose ?? closeModal} aria-label="关闭">✕</button>
        </div>
        <div className="modal-body">{p.children}</div>
      </div>
    </div>
  );
}

export function Modals() {
  const modal = useUI((s) => s.modal);
  if (modal === 'agent') return <AgentModal />;
  if (modal === 'members') return <MembersModal />;
  if (modal === 'meetings') return <MeetingsModal />;
  if (modal === 'projects') return <ProjectsModal />;
  if (modal === 'settings') return <SettingsModal />;
  return null;
}

// ───────────────────────────── Agent 详情 / 聊天

function AgentModal() {
  const snap = useSnap();
  const id = useUI((s) => s.agentId);
  const [tab, setTab] = useState<'overview' | 'chat' | 'settings'>('overview');
  const a = snap?.agents.find((x) => x.id === id);
  if (!snap || !a) {
    return (
      <Modal title="成员">
        <div className="empty big">该成员不存在或已离开团队。</div>
      </Modal>
    );
  }
  const role = ROLE_MAP[a.role];
  const task = snap.tasks.find((t) => t.id === a.taskId);
  const meta = STATUS_META[a.status];
  const close = () => {
    closeModal();
    ui.set({ agentId: null });
    ctx.game?.select(null);
  };
  return (
    <Modal
      onClose={close}
      className="agent-modal"
      title={
        <>
          <span className="m-emoji">{role.emoji}</span>
          <span className="m-name">{a.name}</span>
          <span className="role-pill" style={{ background: role.color }}>{role.name}</span>
        </>
      }
    >
      <div className="tabs">
        {(['overview', 'chat', 'settings'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'overview' ? '📄 概览' : t === 'chat' ? '💬 聊天' : '⚙️ 设置'}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <div className="ag-ov">
          <div className="kv-grid">
            <div className="kv">
              <label>状态</label>
              <b style={{ color: meta.color }}>{meta.icon} {meta.label}</b>
            </div>
            <div className="kv">
              <label>当前动作</label>
              <b>{a.status === 'offline' ? '离线' : a.activity}</b>
            </div>
            <div className="kv">
              <label>所在区域</label>
              <b>{a.roomId ? ROOM_MAP[a.roomId].name : '走廊'}</b>
            </div>
            <div className="kv">
              <label>工位</label>
              <b>{a.deskId ? `${role.homeLabel} · 已分配` : '⚠ 无工位（在编辑器中增加）'}</b>
            </div>
            <div className="kv">
              <label>精力</label>
              <div className="prog big">
                <i style={{ width: `${a.energy}%`, background: a.energy < 35 ? '#ff9800' : '#4caf50' }} />
              </div>
            </div>
            <div className="kv">
              <label>已完成</label>
              <b>{a.doneCount} 个需求</b>
            </div>
          </div>
          <div className="card">
            <div className="card-h">当前任务</div>
            {task ? (
              <>
                <div className="task-line">
                  <b>{task.id}</b> {task.title}
                  <span className="stage-pill" style={{ background: STAGE_MAP[task.stage].color }}>{STAGE_MAP[task.stage].name}</span>
                </div>
                <div className="prog big">
                  <i style={{ width: `${task.progress}%`, background: STAGE_MAP[task.stage].color }} />
                </div>
                <ul className="hist">
                  {task.history.slice(-4).map((h, i) => (
                    <li key={i}>{h.text}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="empty">暂无任务 · {role.desc}</div>
            )}
          </div>
          <div className="card">
            <div className="card-h">最近动态</div>
            <ul className="log small">
              {snap.logs.filter((l) => l.agentId === a.id).slice(-6).map((l) => (
                <li key={l.id} className={l.level}>
                  <span className="ts">[{l.clock}]</span> {l.text}
                </li>
              ))}
              {!snap.logs.some((l) => l.agentId === a.id) && <li className="empty">暂无</li>}
            </ul>
          </div>
          <div className="btn-row">
            <button className="btn" onClick={() => setTab('chat')}>💬 发消息</button>
            <button
              className="btn ghost"
              disabled={a.status === 'offline' || a.status === 'meeting'}
              onClick={() => {
                ctx.engine?.handleChat(a.id, '去休息一下');
                toast(`${a.name} 去休息区了`);
              }}
            >
              ☕ 去休息
            </button>
            <button className="btn ghost" onClick={() => ctx.engine?.setOffline(a.id, a.status !== 'offline')}>
              {a.status === 'offline' ? '🟢 上线' : '⚫ 下线'}
            </button>
          </div>
        </div>
      )}
      {tab === 'chat' && <ChatPanel agentId={a.id} offline={a.status === 'offline'} />}
      {tab === 'settings' && <AgentSettings id={a.id} onRemoved={close} />}
    </Modal>
  );
}

function ChatPanel({ agentId, offline }: { agentId: string; offline: boolean }) {
  const snap = useSnap();
  const [text, setText] = useState('');
  const [stream, setStream] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const history = ctx.engine?.chatHistory(agentId) ?? [];
  const shown = stream !== null ? history.slice(0, -1) : history;
  useEffect(() => {
    boxRef.current?.scrollTo({ top: 1e6 });
  }, [history.length, stream]);
  void snap;
  const send = async () => {
    const t = text.trim();
    if (!t || stream !== null || !ctx.provider) return;
    setText('');
    setStream('');
    let acc = '';
    try {
      for await (const chunk of ctx.provider.sendMessage(agentId, t)) {
        acc += chunk;
        setStream(acc);
      }
    } catch {
      toast('发送失败', 'error');
    }
    setStream(null);
  };
  const quick = ['你好', '进度怎么样？', '加需求 首页性能优化', '去休息一下', '大家集合开站会'];
  return (
    <div className="chat">
      <div className="chat-box" ref={boxRef}>
        {shown.length === 0 && stream === null && <div className="empty">还没有对话。试试下方的快捷指令，或输入「加需求 xxx」直接创建需求。</div>}
        {shown.map((m) => (
          <div key={m.id} className={`msg ${m.from}`}>
            <div className="bubble">{m.text}</div>
          </div>
        ))}
        {stream !== null && (
          <div className="msg agent">
            <div className="bubble">
              {stream}
              <span className="caret">▍</span>
            </div>
          </div>
        )}
      </div>
      <div className="quick">
        {quick.map((q) => (
          <button key={q} className="chip" disabled={offline || stream !== null} onClick={() => setText(q)}>
            {q}
          </button>
        ))}
      </div>
      <div className="chat-input">
        <input
          value={text}
          disabled={offline}
          placeholder={offline ? '该成员已离线' : '输入消息，回车发送'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
        />
        <button className="btn" disabled={offline || !text.trim() || stream !== null} onClick={send}>
          {stream !== null ? '输入中…' : '发送'}
        </button>
      </div>
    </div>
  );
}

function AgentSettings({ id, onRemoved }: { id: string; onRemoved: () => void }) {
  const snap = useSnap();
  const a = snap?.agents.find((x) => x.id === id);
  const [name, setName] = useState(a?.name ?? '');
  const [confirm, setConfirm] = useState(false);
  if (!a) return null;
  return (
    <div className="form">
      <label>名字</label>
      <div className="row">
        <input value={name} maxLength={8} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim() || name === a.name} onClick={() => { ctx.engine?.updateAgent(id, { name: name.trim() }); toast('已更新名字', 'ok'); }}>保存</button>
      </div>
      <label>岗位</label>
      <select value={a.role} onChange={(e) => ctx.engine?.updateAgent(id, { role: e.target.value as RoleId })}>
        {ROLES.map((r) => (
          <option key={r.id} value={r.id}>{r.emoji} {r.name}（{r.homeLabel}）</option>
        ))}
      </select>
      <label>外观（角色精灵）</label>
      <div className="skins">
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <button key={s} className={`skin ${a.skin === s ? 'on' : ''}`} onClick={() => ctx.engine?.updateAgent(id, { skin: s })}>
            <span className="skin-img" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/characters/char_${s}.png)` }} />
          </button>
        ))}
      </div>
      <label>配色（色相 {a.hue}°）</label>
      <input type="range" min={0} max={330} step={30} value={a.hue} onChange={(e) => ctx.engine?.updateAgent(id, { hue: Number(e.target.value) })} />
      <div className="danger">
        {!confirm ? (
          <button className="btn danger" onClick={() => setConfirm(true)}>移出团队</button>
        ) : (
          <div className="row">
            <span>确定移出 {a.name}？</span>
            <button className="btn danger" onClick={() => { ctx.engine?.removeAgent(id); onRemoved(); toast(`${a.name} 已移出团队`); }}>确定</button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>取消</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── 成员管理（人数动态可配置）

function MembersModal() {
  const snap = useSnap();
  if (!snap) return null;
  return (
    <Modal title="👤 成员与岗位" wide>
      <p className="hint">每个岗位的人数可以自由增减。新成员会自动分配到对应区域的空工位；工位不够时，可以在「编辑办公室」里添加工位并设置岗位标签。</p>
      <div className="role-grid">
        {ROLES.map((r) => {
          const cap = snap.capacity[r.id];
          const list = snap.agents.filter((a) => a.role === r.id);
          const full = cap.agents >= cap.desks;
          return (
            <div key={r.id} className="role-card" style={{ ['--c' as any]: r.color }}>
              <div className="rc-head">
                <span className="rc-emoji">{r.emoji}</span>
                <div>
                  <b>{r.name}</b>
                  <div className="rc-home">{r.homeLabel}</div>
                </div>
                <div className="stepper">
                  <button disabled={!list.length} onClick={() => list.length && ctx.engine?.removeAgent(list[list.length - 1].id)}>－</button>
                  <span>{list.length}</span>
                  <button onClick={() => { ctx.engine?.addAgent(r.id); if (full) toast(`${r.homeLabel}工位已满，新成员暂无工位`, 'warn'); }}>＋</button>
                </div>
              </div>
              <div className={`rc-cap ${full ? 'full' : ''}`}>工位 {Math.min(cap.agents, cap.desks)}/{cap.desks}{cap.agents > cap.desks ? ` · ${cap.agents - cap.desks} 人无工位` : ''}</div>
              <div className="rc-list">
                {list.length === 0 && <span className="empty">暂无</span>}
                {list.map((a) => (
                  <button key={a.id} className="chip" onClick={() => ui.set({ modal: 'agent', agentId: a.id })}>
                    <i className="dot" style={{ background: STATUS_META[a.status].color }} />
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ───────────────────────────── 会议

function MeetingsModal() {
  const snap = useSnap();
  const endId = useUI((s) => s.endMeetingId);
  const [type, setType] = useState<MeetingType>('standup');
  const [picked, setPicked] = useState<string[] | null>(null);
  const [notes, setNotes] = useState({ summary: '', resolution: '', actions: '' });
  if (!snap) return null;
  const busy = new Set(snap.meetings.flatMap((m) => m.participants));
  const avail = snap.agents.filter((a) => a.status !== 'offline');
  const sel = picked ?? avail.filter((a) => !busy.has(a.id)).map((a) => a.id);
  const name = (id: string) => snap.agents.find((a) => a.id === id)?.name ?? '已离开';
  const endM = snap.meetings.find((m) => m.id === endId);
  const where: Record<MeetingType, string> = { standup: '中央休息区 · 流水线看板前', review: '产品会议室 · 会议桌', planning: '产品会议室 · 会议桌', incident: '运维中心 · 作战区' };

  if (endM) {
    return (
      <Modal title={`📝 结束会议：${endM.title}`} onClose={() => ui.set({ endMeetingId: null })}>
        <div className="form">
          <label>会议纪要</label>
          <textarea rows={3} value={notes.summary} placeholder="这次会议讨论了什么？（留空则自动生成）" onChange={(e) => setNotes({ ...notes, summary: e.target.value })} />
          <label>结论 / 决议</label>
          <textarea rows={2} value={notes.resolution} placeholder="可选" onChange={(e) => setNotes({ ...notes, resolution: e.target.value })} />
          <label>行动项</label>
          <textarea rows={3} value={notes.actions} placeholder={'例如：\n小林：完成登录页\n老周：补充接口文档'} onChange={(e) => setNotes({ ...notes, actions: e.target.value })} />
          <div className="btn-row">
            <button className="btn" onClick={() => { ctx.engine?.endMeeting(endM.id, notes); ui.set({ endMeetingId: null }); setNotes({ summary: '', resolution: '', actions: '' }); toast('会议已结束并记录', 'ok'); }}>结束并保存</button>
            <button className="btn ghost" onClick={() => ui.set({ endMeetingId: null })}>返回</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="🤝 会议" wide>
      <div className="mtg-layout">
        <div className="card">
          <div className="card-h">发起会议</div>
          <div className="seg">
            {(['standup', 'review', 'planning'] as MeetingType[]).map((t) => (
              <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>
                {t === 'standup' ? '☀️ 站会' : t === 'review' ? '📋 需求评审' : '🗓️ 迭代规划'}
              </button>
            ))}
          </div>
          <div className="hint">地点：{where[type]}</div>
          <label className="lbl">参会人（{sel.length}）</label>
          <div className="pick">
            {avail.length === 0 && <span className="empty">没有在线成员</span>}
            {avail.map((a) => {
              const on = sel.includes(a.id);
              const b = busy.has(a.id);
              return (
                <button
                  key={a.id}
                  disabled={b}
                  className={`chip ${on ? 'on' : ''}`}
                  title={b ? '正在其他会议中' : ''}
                  onClick={() => setPicked(on ? sel.filter((x) => x !== a.id) : [...sel, a.id])}
                >
                  {ROLE_MAP[a.role].emoji} {a.name}
                </button>
              );
            })}
          </div>
          <div className="btn-row">
            <button
              className="btn"
              disabled={sel.length < 2}
              onClick={() => {
                const id = ctx.engine?.startMeeting({ type, participants: sel, manual: true });
                if (id) toast('会议已发起，成员正在前往会议地点', 'ok');
                else toast('无法发起会议：至少需要 2 名空闲成员', 'warn');
                setPicked(null);
              }}
            >
              📣 发起会议
            </button>
            <button className="btn ghost danger-ghost" disabled={snap.incident.active} onClick={() => { if (!ctx.engine?.triggerIncident()) toast('当前没有可演练的需求', 'warn'); }}>
              🚨 事故演练
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-h">进行中（{snap.meetings.length}）</div>
          {snap.meetings.length === 0 && <div className="empty">当前没有会议</div>}
          {snap.meetings.map((m) => (
            <div key={m.id} className={`mtg-card ${m.type}`}>
              <div className="mc-top">
                <b>{m.title}</b>
                <span className="pill">{m.state === 'gathering' ? '集合中' : '进行中'}</span>
              </div>
              <div className="mc-ps">{m.participants.map(name).join('、')}</div>
              <button className="btn small" onClick={() => ui.set({ endMeetingId: m.id })}>结束并记录</button>
            </div>
          ))}
          <div className="card-h" style={{ marginTop: 12 }}>历史纪要</div>
          {snap.meetingHistory.length === 0 && <div className="empty">还没有会议记录</div>}
          <div className="mtg-hist">
            {snap.meetingHistory.slice(0, 12).map((m) => (
              <details key={m.id + m.endsAt}>
                <summary>
                  <b>{m.title}</b> <span className="muted">{m.participants.length} 人</span>
                </summary>
                <p>{m.summary}</p>
                {m.resolution && <p><b>结论：</b>{m.resolution}</p>}
                {m.actions && <pre>{m.actions}</pre>}
              </details>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────────── 看板

function ProjectsModal() {
  const snap = useSnap();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TaskView['kind']>('feature');
  const [prio, setPrio] = useState<TaskView['priority']>('medium');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<StageId | null>(null);
  const [showDone, setShowDone] = useState(false);
  const tasks = snap?.tasks ?? [];
  const cols = useMemo(() => STAGES.filter((s) => showDone || s.id !== 'done'), [showDone]);
  if (!snap) return null;
  const name = (id?: string) => (id ? snap.agents.find((a) => a.id === id) : undefined);
  const add = () => {
    if (!title.trim()) return;
    ctx.engine?.addTask({ title: title.trim().slice(0, 40), kind, priority: prio });
    setTitle('');
    toast('需求已加入需求池', 'ok');
  };
  return (
    <Modal title="📋 研发看板" wide className="board-modal">
      <div className="board-bar">
        <input value={title} placeholder="新需求标题，例如：订单详情页改版" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && add()} />
        <select value={kind} onChange={(e) => setKind(e.target.value as TaskView['kind'])}>
          <option value="feature">✨ 功能</option>
          <option value="bug">🐛 缺陷</option>
          <option value="hotfix">🔥 热修复</option>
          <option value="chore">🧹 杂项</option>
        </select>
        <select value={prio} onChange={(e) => setPrio(e.target.value as TaskView['priority'])}>
          <option value="critical">紧急</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <button className="btn" disabled={!title.trim()} onClick={add}>＋ 新建需求</button>
        <label className="check">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> 显示已完成
        </label>
      </div>
      <div className="board">
        {cols.map((s) => {
          const list = tasks.filter((t) => t.stage === s.id).slice(s.id === 'done' ? -20 : 0);
          return (
            <div
              key={s.id}
              className={`col ${overCol === s.id ? 'over' : ''}`}
              style={{ ['--c' as any]: s.color }}
              onDragOver={(e) => { e.preventDefault(); setOverCol(s.id); }}
              onDragLeave={() => setOverCol(null)}
              onDrop={() => {
                if (dragId) ctx.engine?.moveTask(dragId, s.id);
                setDragId(null);
                setOverCol(null);
              }}
            >
              <div className="col-h">
                {s.emoji} {s.name}
                <span>{list.length}</span>
              </div>
              <div className="col-b">
                {list.length === 0 && <div className="empty">拖到这里</div>}
                {list.map((t) => (
                  <div key={t.id} className={`tcard p-${t.priority}`} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)}>
                    <div className="tc-top">
                      <span className="muted">{t.id}</span>
                      <span className={`prio ${t.priority}`}>{{ critical: '紧急', high: '高', medium: '中', low: '低' }[t.priority]}</span>
                    </div>
                    <div className="tc-title">
                      {t.kind === 'bug' ? '🐛 ' : t.kind === 'hotfix' ? '🔥 ' : t.kind === 'chore' ? '🧹 ' : ''}
                      {t.title}
                    </div>
                    {s.id !== 'backlog' && s.id !== 'done' && (
                      <div className="prog">
                        <i style={{ width: `${t.progress}%`, background: s.color }} />
                      </div>
                    )}
                    <div className="tc-foot">
                      {Object.values(t.workers).map((wid) => {
                        const ag = name(wid);
                        return ag ? (
                          <span key={wid} className="who" style={{ borderColor: ROLE_MAP[ag.role].color }}>
                            {ROLE_MAP[ag.role].emoji}{ag.name}
                          </span>
                        ) : null;
                      })}
                      {t.bugCount > 0 && <span className="bugs">🐛×{t.bugCount}</span>}
                      <button className="del" title="删除" onClick={() => ctx.engine?.removeTask(t.id)}>🗑</button>
                    </div>
                    <select className="mv" value={t.stage} onChange={(e) => ctx.engine?.moveTask(t.id, e.target.value as StageId)} aria-label="移动到">
                      {STAGES.map((x) => (
                        <option key={x.id} value={x.id}>移到：{x.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ───────────────────────────── 设置 / 菜单

function SettingsModal() {
  const snap = useSnap();
  const [name, setName] = useState(snap?.settings.officeName ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  if (!snap) return null;
  const s = snap.settings;
  const set = (p: Partial<typeof s>) => ctx.engine?.updateSettings(p);
  const Tog = (p: { k: keyof typeof s; label: string; desc?: string }) => (
    <label className="tog">
      <input type="checkbox" checked={!!s[p.k]} onChange={(e) => set({ [p.k]: e.target.checked } as any)} />
      <span className="sw" />
      <span>
        {p.label}
        {p.desc && <em>{p.desc}</em>}
      </span>
    </label>
  );
  return (
    <Modal title="☰ 菜单与设置" wide>
      <div className="set-grid">
        <div className="card">
          <div className="card-h">🏢 办公室</div>
          <div className="form">
            <label>办公室名称</label>
            <div className="row">
              <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
              <button className="btn" disabled={!name.trim() || name === s.officeName} onClick={() => { set({ officeName: name.trim() }); toast('已保存', 'ok'); }}>保存</button>
            </div>
          </div>
          <Tog k="showNames" label="显示名牌" />
          <Tog k="showBubbles" label="显示对话气泡" />
          <Tog k="dayNight" label="昼夜循环" desc="窗外天色与室内光照随时间变化" />
          <label className="lbl">时钟</label>
          <div className="seg">
            <button className={s.clockMode === 'sim' ? 'on' : ''} onClick={() => set({ clockMode: 'sim' })}>⏱ 加速时钟（1 秒 = 2 分钟）</button>
            <button className={s.clockMode === 'real' ? 'on' : ''} onClick={() => set({ clockMode: 'real' })}>🕐 跟随真实时间</button>
          </div>
        </div>
        <div className="card">
          <div className="card-h">🤖 模拟（SimProvider）</div>
          <Tog k="autoMode" label="自动生成需求" desc="需求池不足时自动产生新需求" />
          <Tog k="autoStandup" label="每日 10:00 自动站会" />
          <Tog k="paused" label="暂停模拟" desc="快捷键：空格" />
          <label className="lbl">速度</label>
          <div className="seg">
            {([1, 2, 4] as const).map((v) => (
              <button key={v} className={s.speed === v ? 'on' : ''} onClick={() => set({ speed: v })}>{v}x</button>
            ))}
          </div>
          <label className="lbl">Agent 接入</label>
          <div className="provider">
            <div className="pv on">● 本地模拟 <em>已连接</em></div>
            <div className="pv">○ Claude Code / Codex / Hermes / OpenClaw <em>预留接口，见 docs/PROVIDER.md</em></div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">💾 数据</div>
          <p className="hint">数据保存在本浏览器（localStorage）。布局可在「编辑办公室」中导入导出。</p>
          {!confirmReset ? (
            <button className="btn danger" onClick={() => setConfirmReset(true)}>重置全部数据</button>
          ) : (
            <div className="row">
              <span>将清空成员、需求、布局与会议记录，确定？</span>
              <button className="btn danger" onClick={() => { clearAll(); location.reload(); }}>确定重置</button>
              <button className="btn ghost" onClick={() => setConfirmReset(false)}>取消</button>
            </div>
          )}
          <div className="card-h" style={{ marginTop: 14 }}>ℹ️ 关于与素材授权</div>
          <ul className="credits">
            <li>角色 / 家具 / 地板像素素材：pixel-agents（MIT License © Pablo De Lucca），角色基于 JIK-A-4 Metro City 免费包</li>
            <li>中文像素字体：精品點陣體 9×9 BoutiqueBitmap9x9（SIL OFL 1.1）</li>
            <li>英文像素字体：Press Start 2P（SIL OFL 1.1）</li>
            <li>交互与布局参考：My Virtual Office（未复制其源码）</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
