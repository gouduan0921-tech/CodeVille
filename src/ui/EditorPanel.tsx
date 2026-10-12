import { useRef, useState } from 'react';
import { FURNITURE_CATEGORIES, FURNITURE_DEFS, FURNITURE_MAP } from '../core/layout';
import { ROLES } from '../core/roles';
import { ctx, toast, useUI } from './store';

export function EditorPanel() {
  const ed = useUI((s) => s.editor);
  const [cat, setCat] = useState(FURNITURE_CATEGORIES[0]);
  const fileRef = useRef<HTMLInputElement>(null);
  const g = ctx.game;
  if (!g) return null;
  const items = FURNITURE_DEFS.filter((d) => d.category === cat && d.placeable);
  const sel = ed.selectedType ? FURNITURE_MAP[ed.selectedType] : null;
  const isDesk = ed.selectedType === 'desk' || ed.selectedType === 'bossDesk';

  const download = () => {
    const blob = new Blob([g.editor.export()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'codeville-layout.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="editor">
      <div className="ed-head">
        <b>✏️ 编辑办公室</b>
        <span className="muted">{ed.count} 件家具 {ed.dirty ? '· 未保存' : ''}</span>
      </div>
      <div className="ed-tabs">
        {FURNITURE_CATEGORIES.map((c) => (
          <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="ed-items">
        {items.map((d) => (
          <button key={d.type} className={`ed-item ${ed.placing === d.type ? 'on' : ''}`} onClick={() => g.editor.place(ed.placing === d.type ? null : d.type)} title={`${d.label}（${d.w}×${d.h} 格）`}>
            <span className="ic">{d.icon}</span>
            <span>{d.label}</span>
          </button>
        ))}
      </div>
      <div className="ed-hint">
        {ed.placing
          ? `点击地面放置「${FURNITURE_MAP[ed.placing].label}」，绿色=可放置，红色=被占用。Esc 结束放置。`
          : sel
            ? `已选中「${sel.label}」：拖动移动，Delete 删除。`
            : '选择上方家具后点击地面放置；点击已有家具可选中并拖动。'}
      </div>
      {isDesk && (
        <div className="ed-tag">
          <label>工位岗位</label>
          <select value={ed.selectedTag ?? ''} onChange={(e) => g.editor.setTag(e.target.value)}>
            <option value="">不限（按房间分配）</option>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="ed-actions">
        <button className="btn small ghost" disabled={!ed.canUndo} onClick={() => g.editor.undo()}>↩️ 撤销</button>
        <button className="btn small ghost" disabled={!ed.selectedId} onClick={() => g.editor.remove()}>🗑 删除</button>
        <button className="btn small ghost" onClick={() => g.editor.reset()}>恢复默认</button>
        <button className="btn small ghost" onClick={download}>⬇ 导出</button>
        <button className="btn small ghost" onClick={() => fileRef.current?.click()}>⬆ 导入</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const ok = g.editor.import(await f.text());
            toast(ok ? '布局已导入（记得保存）' : '文件格式不正确', ok ? 'ok' : 'error');
          }}
        />
      </div>
      <div className="ed-save">
        <button className="btn ghost" onClick={() => g.editor.exit(false)}>取消</button>
        <button className="btn" disabled={!ed.dirty} onClick={() => { g.editor.exit(true); toast('布局已保存，成员会重新分配工位', 'ok'); }}>💾 保存</button>
      </div>
    </div>
  );
}
