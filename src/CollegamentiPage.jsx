// Collegamenti con altri servizi. Si apre dal menu del profilo.
import { useState } from 'react';
import { C, fSerif, page, column, kicker, h1, muted, card, btn, btnDanger, link, tag } from './ui.js';

export default function CollegamentiPage({ onClose, whoop, onConnect, onSync, onDisconnect, initialMsg }) {
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(initialMsg || '');
  const [confirmOff, setConfirmOff] = useState(false);
  const run = async (name, fn) => { setBusy(name); setMsg(''); try { const r = await fn(); if (r) setMsg(r); } finally { setBusy(null); } };
  const last = whoop?.last_sync_at ? new Date(whoop.last_sync_at).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div style={page}>
      <div style={{ ...column, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <button onClick={onClose} style={{ ...link, minHeight: 44 }}>‹ indietro</button>
          <div style={kicker}>dati da altri servizi</div>
          <h1 style={h1}>Collegamenti</h1>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: fSerif, fontSize: 28, fontWeight: 500, lineHeight: 1.1 }}>WHOOP</span>
            <span style={{ ...tag, color: whoop?.connected ? C.gold : C.dim }}>{whoop?.connected ? 'collegato' : 'non collegato'}</span>
          </div>
          <span style={muted}>Porta in GoalFit le notti e gli allenamenti registrati dal bracciale, e fa vedere al coach recupero, sforzo e passi di ogni giorno. Quello che hai inserito a mano non viene toccato.</span>
          {whoop?.connected ? (<>
            <span style={{ fontSize: 13, color: C.dim }}>{last ? `Ultimo aggiornamento: ${last}` : 'Non ancora aggiornato'}</span>
            <button onClick={() => run('sync', onSync)} disabled={!!busy} style={{ ...btn(true), width: '100%' }}>{busy === 'sync' ? 'aggiorno…' : 'aggiorna adesso'}</button>
            <button onClick={() => { if (!confirmOff) { setConfirmOff(true); return; } setConfirmOff(false); run('off', onDisconnect); }} disabled={!!busy} style={btnDanger}>{confirmOff ? 'tocca ancora per scollegare' : 'scollega WHOOP'}</button>
          </>) : whoop?.configured === false ? (
            <span style={{ fontSize: 14, color: C.sal, lineHeight: 1.4 }}>Il collegamento a WHOOP non è ancora attivo. Arriva a breve.</span>
          ) : (
            <button onClick={() => run('on', onConnect)} disabled={!!busy} style={{ ...btn(true), width: '100%' }}>{busy === 'on' ? 'apro WHOOP…' : 'collega WHOOP'}</button>
          )}
          {msg && <span role="status" style={{ fontSize: 14, lineHeight: 1.4, color: C.cream }}>{msg}</span>}
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.85 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: fSerif, fontSize: 28, fontWeight: 500, lineHeight: 1.1 }}>Apple Salute</span>
            <span style={{ ...tag, color: C.dim }}>in arrivo</span>
          </div>
          <span style={muted}>Peso, percentuale di grasso, passi e sonno da bilance e orologi (Renpho, Apple Watch e altri). Sarà disponibile con l’app per iPhone, perché Apple non permette di leggere Salute da un’app web.</span>
        </div>

        <span style={{ ...muted, fontSize: 13 }}>Nel frattempo, quando registri il peso puoi inserire a mano grasso, muscolo e acqua letti dalla bilancia.</span>
      </div>
    </div>
  );
}
