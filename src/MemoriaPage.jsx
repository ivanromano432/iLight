// Memoria del coach. Si apre dal menu del profilo.
// Le cose che il coach tiene presenti in ogni risposta: si possono aggiungere, correggere e togliere.
import { useEffect, useState } from 'react';
import { C, fSerif, page, column, kicker, h1, muted, card, btn, btnDanger, chip, label, input, link, tag } from './ui.js';
import { MEMORY_MAX, MEMORY_CATEGORIES, loadMemory, addMemory, updateMemory, deleteMemory, clearMemory } from './coachMemory.js';

export default function MemoriaPage({ onClose, profile, updProfile }) {
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null); // null | { id?, category, content, priority }
  const [err, setErr] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const learn = profile?.coach_learn !== false;

  async function reload() { setItems(await loadMemory()); }
  useEffect(() => { reload(); }, []);

  async function saveEdit() {
    const text = (edit.content || '').trim();
    if (!text) return;
    setErr('');
    if (edit.id) await updateMemory(edit.id, edit);
    else {
      const r = await addMemory({ ...edit, source: 'utente' });
      if (r?.error) { setErr(r.error === 'memoria piena' ? `La memoria è piena (${MEMORY_MAX} voci): togline una prima di aggiungerne un'altra.` : r.error === 'già presente' ? 'Questa voce c\'è già.' : 'Non sono riuscito a salvare. Riprova.'); return; }
    }
    setEdit(null); reload();
  }
  async function remove(id) { await deleteMemory(id); reload(); }
  async function clearAll() {
    if (!confirmClear) { setConfirmClear(true); return; }
    setConfirmClear(false); await clearMemory(); reload();
  }

  const list = items || [];
  const full = list.length >= MEMORY_MAX;
  return (
    <div style={page}>
      <div style={column}>
        <button onClick={onClose} style={{ ...link, minHeight: 44 }}>‹ indietro</button>
        <div style={kicker}>cosa ricorda di te · {list.length} di {MEMORY_MAX}</div>
        <h1 style={h1}>Memoria del coach</h1>
        <p style={{ ...muted, margin: '12px 0 16px' }}>Il coach tiene a mente queste cose in ogni risposta e nei consigli del Menù. Le impara dalle conversazioni: puoi toglierle, correggerle o aggiungerne. Quelle a priorità alta vengono sempre rispettate.</p>

        {items === null && <p style={muted}>carico…</p>}
        {items !== null && list.length === 0 && !edit && (
          <div style={{ ...card, fontSize: 15, lineHeight: 1.5 }}>Ancora niente. Scrivi al coach cose come "non mangio latticini" o "il lunedì non riesco ad allenarmi", oppure aggiungile qui sotto.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {MEMORY_CATEGORIES.map(cat => {
            const rows = list.filter(m => m.category === cat.id);
            if (rows.length === 0) return null;
            return (
              <div key={cat.id} style={{ ...card, padding: '16px 18px 6px' }}>
                <div style={tag}>{cat.label}</div>
                {rows.map((m, i) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                    <button onClick={() => { setErr(''); setEdit({ id: m.id, category: m.category, content: m.content, priority: m.priority }); }} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: C.cream, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 15, lineHeight: 1.35, wordBreak: 'break-word' }}>{m.content}</span>
                      <span style={{ fontSize: 12, color: m.priority === 'alta' ? C.gold : C.dim }}>{m.priority === 'alta' ? 'priorità alta · ' : ''}{m.source === 'chat' ? 'dalla chat' : 'aggiunta da te'} · {new Date(m.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                    </button>
                    <button onClick={() => remove(m.id)} aria-label={`togli: ${m.content}`} style={{ width: 44, height: 44, borderRadius: '50%', border: `1px solid ${C.line}`, background: 'transparent', color: C.dim, fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            );
          })}

          {edit ? (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={tag}>{edit.id ? 'modifica voce' : 'nuova voce'}</div>
              <div>
                <label style={label} htmlFor="mem-text">cosa deve ricordare</label>
                <input id="mem-text" autoFocus value={edit.content} maxLength={200} onChange={e => setEdit({ ...edit, content: e.target.value })} placeholder="es. Non mangio latticini" style={input(18)} />
              </div>
              <div>
                <span style={label}>categoria</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {MEMORY_CATEGORIES.map(c => (<button key={c.id} onClick={() => setEdit({ ...edit, category: c.id })} style={{ ...chip(edit.category === c.id), padding: '0 14px' }}>{c.label}</button>))}
                </div>
              </div>
              <div>
                <span style={label}>priorità</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginTop: 6 }}>
                  <button onClick={() => setEdit({ ...edit, priority: 'normale' })} style={chip(edit.priority !== 'alta')}>normale</button>
                  <button onClick={() => setEdit({ ...edit, priority: 'alta' })} style={chip(edit.priority === 'alta')}>alta</button>
                </div>
              </div>
              {err && <div style={{ fontSize: 13, color: C.sal }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEdit(null); setErr(''); }} style={{ ...btn(false), flex: 1 }}>annulla</button>
                <button onClick={saveEdit} disabled={!edit.content.trim()} style={{ ...btn(true), flex: 1, opacity: edit.content.trim() ? 1 : 0.5 }}>salva</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setErr(''); setEdit({ category: 'alimentazione', content: '', priority: 'normale' }); }} disabled={full} style={{ ...btn(false), width: '100%', opacity: full ? 0.5 : 1 }}>{full ? `memoria piena (${MEMORY_MAX} voci)` : 'aggiungi una cosa da ricordare'}</button>
          )}

          <button onClick={() => updProfile && updProfile({ coach_learn: !learn })} role="switch" aria-checked={learn}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, background: 'transparent', border: 'none', borderBottom: `1px solid ${C.line}`, padding: 0, color: C.cream, fontFamily: 'inherit', fontSize: 15, cursor: 'pointer', textAlign: 'left' }}>
            <span>Impara dalle conversazioni</span>
            <span style={{ width: 46, height: 28, borderRadius: 14, background: learn ? C.gold : '#2A4466', display: 'flex', alignItems: 'center', justifyContent: learn ? 'flex-end' : 'flex-start', padding: 3, boxSizing: 'border-box', flexShrink: 0 }}><span style={{ width: 22, height: 22, borderRadius: '50%', background: C.cream }} /></span>
          </button>

          <button onClick={() => updProfile && updProfile({ coach_checkin: profile?.coach_checkin === false })} role="switch" aria-checked={profile?.coach_checkin !== false}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, background: 'transparent', border: 'none', borderBottom: `1px solid ${C.line}`, padding: 0, color: C.cream, fontFamily: 'inherit', fontSize: 15, cursor: 'pointer', textAlign: 'left' }}>
            <span>Il punto della settimana<span style={{ display: 'block', fontSize: 12, color: C.dim }}>una volta a settimana il coach ti scrive lui</span></span>
            <span style={{ width: 46, height: 28, borderRadius: 14, background: profile?.coach_checkin !== false ? C.gold : '#2A4466', display: 'flex', alignItems: 'center', justifyContent: profile?.coach_checkin !== false ? 'flex-end' : 'flex-start', padding: 3, boxSizing: 'border-box', flexShrink: 0 }}><span style={{ width: 22, height: 22, borderRadius: '50%', background: C.cream }} /></span>
          </button>

          {list.length > 0 && <button onClick={clearAll} style={btnDanger}>{confirmClear ? 'tocca ancora per cancellare tutto' : 'cancella tutta la memoria'}</button>}
        </div>
      </div>
    </div>
  );
}
