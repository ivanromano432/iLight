// Pagina profilo personale: nome visualizzato + foto avatar.
// La foto viene ridimensionata e cropp-ata a 200x200 client-side per essere leggera.
// Salvataggio diretto su profiles.avatar_data (base64) e profiles.display_name.

import { useState, useRef, useEffect } from 'react';
import { DEFAULT_THEME } from './themes.js';
import { Camera } from 'lucide-react';
import { C, fSerif, page, column, kicker, h1, h2, muted, btn, btnDanger, chip, label, input, link, tag } from './ui.js';
import { supabase } from './supabase.js';
import { pushSupported, getPushStatus, subscribePush, unsubscribePush, registerServiceWorker } from './pushNotifications.js';


// Ridimensiona e crop-pa centralmente un'immagine in un quadrato size x size, qualità jpeg 0.85
function resizeAndCropImage(file, size = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossibile leggere il file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Immagine non valida'));
      img.onload = () => {
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage({ user, profile, updProfile, onClose }) {

  const [name, setName] = useState(profile?.display_name || '');
  const [avatar, setAvatar] = useState(profile?.avatar_data || null);
  const [themeId, setThemeId] = useState(profile?.theme || DEFAULT_THEME);
  const [sex, setSex] = useState(profile?.sex || null);
  const [heightCm, setHeightCm] = useState(profile?.height_cm != null ? String(profile.height_cm) : '');
  const [birthYear, setBirthYear] = useState(profile?.birth_year != null ? String(profile.birth_year) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(0);
  // Cancellazione account (GDPR art. 17)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Notifiche push
  const [pushStatus, setPushStatus] = useState({ supported: false, permission: 'default', subscribed: false });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const [notifMorning, setNotifMorning] = useState(!!profile?.notif_morning_enabled);
  const [notifAfternoon, setNotifAfternoon] = useState(!!profile?.notif_afternoon_enabled);
  const [notifEvening, setNotifEvening] = useState(!!profile?.notif_evening_enabled);
  const [notifMorningHour, setNotifMorningHour] = useState(profile?.notif_morning_hour ?? 8);
  const [notifAfternoonHour, setNotifAfternoonHour] = useState(profile?.notif_afternoon_hour ?? 13);
  const [notifEveningHour, setNotifEveningHour] = useState(profile?.notif_evening_hour ?? 20);
  const fileInputRef = useRef(null);

  // Al mount: registra SW e leggi stato push
  useEffect(() => {
    (async () => {
      await registerServiceWorker();
      const status = await getPushStatus();
      setPushStatus(status);
    })();
  }, []);

  // Sync preferenze notifiche dal profile (quando arriva da Supabase dopo il mount)
  useEffect(() => {
    if (profile?.notif_morning_enabled !== undefined) setNotifMorning(!!profile.notif_morning_enabled);
    if (profile?.notif_afternoon_enabled !== undefined) setNotifAfternoon(!!profile.notif_afternoon_enabled);
    if (profile?.notif_evening_enabled !== undefined) setNotifEvening(!!profile.notif_evening_enabled);
    if (profile?.notif_morning_hour != null) setNotifMorningHour(profile.notif_morning_hour);
    if (profile?.notif_afternoon_hour != null) setNotifAfternoonHour(profile.notif_afternoon_hour);
    if (profile?.notif_evening_hour != null) setNotifEveningHour(profile.notif_evening_hour);
  }, [profile?.notif_morning_enabled, profile?.notif_afternoon_enabled, profile?.notif_evening_enabled,
      profile?.notif_morning_hour, profile?.notif_afternoon_hour, profile?.notif_evening_hour]);

  // Toggle di una singola preferenza notifica (salva immediatamente)
  async function toggleNotif(key, currentValue) {
    const newValue = !currentValue;
    // Aggiorno state locale ottimisticamente
    if (key === 'morning') setNotifMorning(newValue);
    if (key === 'afternoon') setNotifAfternoon(newValue);
    if (key === 'evening') setNotifEvening(newValue);
    // Se sto attivando una notifica ma push non è ancora attivato, attivalo
    if (newValue && !pushStatus.subscribed) {
      setPushBusy(true); setPushError('');
      const r = await subscribePush();
      setPushBusy(false);
      if (!r.ok) {
        setPushError(r.error || 'Errore attivazione notifiche');
        // Rollback
        if (key === 'morning') setNotifMorning(false);
        if (key === 'afternoon') setNotifAfternoon(false);
        if (key === 'evening') setNotifEvening(false);
        return;
      }
      setPushStatus(await getPushStatus());
    }
    // Salva nel profilo
    const field = `notif_${key}_enabled`;
    await updProfile({ [field]: newValue });
  }

  async function updateNotifHour(key, hour) {
    if (key === 'morning') setNotifMorningHour(hour);
    if (key === 'afternoon') setNotifAfternoonHour(hour);
    if (key === 'evening') setNotifEveningHour(hour);
    const field = `notif_${key}_hour`;
    await updProfile({ [field]: hour });
  }

  // Disattiva push completamente (annulla sottoscrizione + spegne tutti i flag)
  async function disablePushCompletely() {
    setPushBusy(true); setPushError('');
    const r = await unsubscribePush();
    setPushBusy(false);
    if (!r.ok) { setPushError(r.error); return; }
    setPushStatus(await getPushStatus());
    setNotifMorning(false); setNotifAfternoon(false); setNotifEvening(false);
    await updProfile({ notif_morning_enabled: false, notif_afternoon_enabled: false, notif_evening_enabled: false });
  }

  // Se il profile cambia dopo il mount (es. perché ancora in caricamento al primo render
  // o aggiornato da altra azione), risincronizza lo state locale.
  // Senza questo, salvare il tema senza aver visto la foto la sovrascriveva con null.
  useEffect(() => {
    if (profile?.display_name !== undefined) setName(profile.display_name || '');
    if (profile?.avatar_data !== undefined) setAvatar(profile.avatar_data || null);
    if (profile?.theme !== undefined) setThemeId(profile.theme || DEFAULT_THEME);
    if (profile?.sex !== undefined) setSex(profile.sex || null);
    if (profile?.height_cm !== undefined) setHeightCm(profile.height_cm != null ? String(profile.height_cm) : '');
    if (profile?.birth_year !== undefined) setBirthYear(profile.birth_year != null ? String(profile.birth_year) : '');
  }, [profile?.display_name, profile?.avatar_data, profile?.theme, profile?.sex, profile?.height_cm, profile?.birth_year]);

  const email = user?.email || '';
  const fallbackInitial = ((name?.[0]) || email[0] || '?').toUpperCase();
  const dirty = (name || '') !== (profile?.display_name || '') ||
                (avatar || null) !== (profile?.avatar_data || null) ||
                (themeId || DEFAULT_THEME) !== (profile?.theme || DEFAULT_THEME) ||
                (sex || null) !== (profile?.sex || null) ||
                (parseInt(heightCm) || null) !== (profile?.height_cm || null) ||
                (parseInt(birthYear) || null) !== (profile?.birth_year || null);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (!f.type.startsWith('image/')) {
      setError('Il file deve essere un\'immagine.');
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setError('Immagine troppo grande (max 12 MB). Scegline una più piccola.');
      return;
    }
    try {
      const dataUrl = await resizeAndCropImage(f, 400);
      setAvatar(dataUrl);
    } catch (err) {
      setError(err.message || 'Errore durante l\'elaborazione dell\'immagine');
    } finally {
      // Reset input così re-uploadi anche lo stesso file
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAvatar = () => { setAvatar(null); };

  const save = async () => {
    if (!updProfile) return;
    setSaving(true); setError(null);
    try {
      // Manda SOLO i campi davvero cambiati rispetto al profilo corrente.
      // Evita di sovrascrivere accidentalmente avatar_data o display_name con null.
      const fields = {};
      const newName = name.trim() || null;
      const currentName = profile?.display_name || null;
      if (newName !== currentName) fields.display_name = newName;

      const newAvatar = avatar || null;
      const currentAvatar = profile?.avatar_data || null;
      if (newAvatar !== currentAvatar) fields.avatar_data = newAvatar;

      const newTheme = themeId || DEFAULT_THEME;
      const currentTheme = profile?.theme || DEFAULT_THEME;
      if (newTheme !== currentTheme) fields.theme = newTheme;

      const newSex = sex || null;
      const currentSex = profile?.sex || null;
      if (newSex !== currentSex) fields.sex = newSex;

      const newHeight = parseInt(heightCm) || null;
      const currentHeight = profile?.height_cm || null;
      if (newHeight !== currentHeight) fields.height_cm = newHeight;

      const newBirthYear = parseInt(birthYear) || null;
      const currentBirthYear = profile?.birth_year || null;
      if (newBirthYear !== currentBirthYear) fields.birth_year = newBirthYear;

      if (Object.keys(fields).length > 0) {
        await updProfile(fields);
      }
      setSavedAt(Date.now());
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const justSaved = savedAt && Date.now() - savedAt < 3000;

  // Cancellazione account: chiama l'API /api/delete-account passando il JWT corrente
  async function deleteAccount() {
    if (deleteConfirmText.trim().toUpperCase() !== 'ELIMINA') {
      setDeleteError('Devi scrivere ELIMINA in maiuscolo per confermare.');
      return;
    }
    setDeleting(true); setDeleteError('');
    try {
      // Recupero il JWT corrente
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setDeleteError('Sessione non valida. Esci e accedi di nuovo.');
        setDeleting(false);
        return;
      }
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setDeleteError(data.error || `Errore HTTP ${res.status}`);
        setDeleting(false);
        return;
      }
      // Successo: faccio logout dal client, l'utente è già cancellato server-side
      await supabase.auth.signOut();
      // Reload completo: l'app riparte e mostra la schermata di login
      window.location.href = '/';
    } catch (err) {
      setDeleteError(err.message || 'Errore di rete');
      setDeleting(false);
    }
  }

  // --- Render nuovo stile ---
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const notifRow = (lab, desc, enabled, hour, key) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, borderBottom: `1px solid ${C.line}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{lab}</div>
        <div style={{ fontSize: 12, color: C.dim }}>{desc}</div>
      </div>
      <select value={hour} onChange={e => updateNotifHour(key, parseInt(e.target.value))} disabled={!enabled} aria-label={`ora del promemoria ${lab}`}
        style={{ background: C.navy, color: C.cream, border: `1px solid ${C.line}`, borderRadius: 12, fontFamily: 'inherit', fontSize: 14, padding: '8px 6px', opacity: enabled ? 1 : 0.5 }}>
        {hours.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
      </select>
      <button onClick={() => toggleNotif(key, enabled)} disabled={pushBusy} role="switch" aria-checked={enabled} aria-label={`promemoria ${lab}`}
        style={{ width: 52, height: 44, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ width: 46, height: 28, borderRadius: 14, background: enabled ? C.gold : '#2A4466', display: 'flex', alignItems: 'center', justifyContent: enabled ? 'flex-end' : 'flex-start', padding: 3, boxSizing: 'border-box' }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: C.cream }} />
        </span>
      </button>
    </div>
  );
  const canDelete = deleteConfirmText.trim().toUpperCase() === 'ELIMINA';
  return (
    <div style={page}>
      <div style={{ ...column, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <button onClick={onClose} style={{ ...link, minHeight: 44 }}>‹ indietro</button>
          <div style={kicker}>il tuo account</div>
          <h1 style={h1}>Profilo</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} aria-label={avatar ? 'cambia foto del profilo' : 'carica foto del profilo'} style={{ position: 'relative', width: 116, height: 116, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <span style={{ display: 'flex', width: 116, height: 116, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.gold}`, boxSizing: 'border-box', background: '#2A4466', alignItems: 'center', justifyContent: 'center' }}>
              {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontFamily: fSerif, fontSize: 54, color: C.cream, lineHeight: 1 }}>{fallbackInitial}</span>}
            </span>
            <span aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 0, width: 38, height: 38, borderRadius: '50%', background: C.gold, border: `3px solid ${C.navy}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Camera size={18} strokeWidth={2} color={C.navy} /></span>
          </button>
          <div style={{ display: 'flex', gap: 18 }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ ...link, minHeight: 40 }}>{avatar ? 'cambia foto' : 'carica una foto'}</button>
            {avatar && <button onClick={removeAvatar} style={{ ...link, minHeight: 40 }}>rimuovi</button>}
          </div>
        </div>

        <label><span style={label}>nome · mostrato nell'app al posto dell'email</span>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="il tuo nome" maxLength={40} style={input(24)} /></label>
        <div><span style={label}>email · non modificabile</span>
          <div style={{ fontFamily: fSerif, fontSize: 19, wordBreak: 'break-all', padding: '2px 0 6px', borderBottom: `1px solid ${C.line}`, color: C.dim }}>{email}</div></div>

        <div style={{ ...tag, marginTop: 8 }}>i miei dati</div>
        <span style={{ ...muted, fontSize: 13, marginTop: -10 }}>Servono per calcolare il tuo fabbisogno di calorie.</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {[['m', 'Uomo'], ['f', 'Donna'], ['other', 'Altro']].map(([id, l]) => (<button key={id} onClick={() => setSex(id)} aria-pressed={sex === id} style={chip(sex === id)}>{l}</button>))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <label><span style={label}>altezza (cm)</span>
            <input type="text" inputMode="numeric" value={heightCm} onChange={e => setHeightCm(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="178" style={input(24)} /></label>
          <label><span style={label}>anno di nascita{birthYear && parseInt(birthYear) > 1900 && parseInt(birthYear) < new Date().getFullYear() ? ` · ${new Date().getFullYear() - parseInt(birthYear)} anni` : ''}</span>
            <input type="text" inputMode="numeric" value={birthYear} onChange={e => setBirthYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="1985" style={input(24)} /></label>
        </div>
        {error && <div role="alert" style={{ fontSize: 14, color: C.sal }}>{error}</div>}
        <button onClick={save} disabled={!dirty || saving} style={{ ...btn(), opacity: (!dirty || saving) ? 0.5 : 1 }}>{saving ? 'salvataggio…' : justSaved ? 'salvato' : 'salva'}</button>

        <div style={{ ...tag, marginTop: 12 }}>promemoria</div>
        {!pushStatus.supported ? (
          <span style={{ ...muted, fontSize: 13 }}>Le notifiche non sono supportate da questo browser. Su iPhone serve iOS 16.4 o successivo, con GoalFit aggiunta alla schermata Home.</span>
        ) : pushStatus.permission === 'denied' ? (
          <span style={{ fontSize: 13, color: C.sal, lineHeight: 1.5 }}>Hai negato il permesso per le notifiche. Riattivalo dalle impostazioni del telefono o del browser.</span>
        ) : (
          <div>
            {notifRow('Mattina', 'ricordati di pesarti', notifMorning, notifMorningHour, 'morning')}
            {notifRow('Pomeriggio', 'pausa acqua', notifAfternoon, notifAfternoonHour, 'afternoon')}
            {notifRow('Sera', 'una nota nel diario', notifEvening, notifEveningHour, 'evening')}
            {pushError && <div role="alert" style={{ marginTop: 10, fontSize: 13, color: C.sal }}>{pushError}</div>}
            {pushStatus.subscribed && <button onClick={disablePushCompletely} disabled={pushBusy} style={{ ...link, minHeight: 44, marginTop: 6 }}>spegni tutte le notifiche</button>}
          </div>
        )}

        <div style={{ ...tag, marginTop: 12 }}>documenti</div>
        <div>
          {[['/privacy', 'Informativa privacy'], ['/termini', 'Termini di servizio']].map(([href, l]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, borderBottom: `1px solid ${C.line}`, color: C.cream, textDecoration: 'none', fontSize: 15 }}><span>{l}</span><span style={{ color: C.dim, fontSize: 18 }}>›</span></a>
          ))}
        </div>

        <button onClick={() => { setDeleteOpen(true); setDeleteConfirmText(''); setDeleteError(''); }} style={{ ...btnDanger, marginTop: 12 }}>elimina il mio account</button>
        <span style={{ ...muted, fontSize: 12, textAlign: 'center' }}>Cancella per sempre account, dati di salute, foto e abbonamento.</span>
        <span style={{ fontSize: 12, color: C.dim, textAlign: 'center', lineHeight: 1.6, marginTop: 6 }}>Romano Formazione S.a.s. · P.IVA 02477940999<br />Via Macaggi 25/10 — 16121 Genova</span>
      </div>

      {deleteOpen && (
        <div onClick={() => !deleting && setDeleteOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(4,12,28,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9500, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Elimina account" style={{ background: 'linear-gradient(180deg, #4A6A62 0%, #2A4A5C 28%, #16304F 62%, #122849 100%)', border: `1px solid ${C.sal}`, borderRadius: 24, padding: 22, maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, color: C.cream }}>
            <h2 style={h2}>Eliminare l'account?</h2>
            <span style={{ fontSize: 14, lineHeight: 1.5 }}>Stai per cancellare <b>definitivamente</b> il tuo account e tutti i dati associati:</span>
            <ul style={{ fontSize: 14, lineHeight: 1.6, margin: 0, paddingLeft: 20 }}>
              <li>profilo, peso, alimentazione, sonno, integratori, allenamenti</li>
              <li>foto dei pasti caricate</li>
              <li>eventuale abbonamento attivo</li>
              <li>note del diario, obiettivi e conversazioni con il coach</li>
            </ul>
            <span style={{ fontSize: 13, lineHeight: 1.5, color: C.dim }}>L'operazione è irreversibile: non potrai recuperare i dati né riattivare lo stesso account. Le eventuali fatture emesse restano conservate per gli obblighi di legge.</span>
            <label><span style={label}>per confermare scrivi ELIMINA</span>
              <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} disabled={deleting} placeholder="ELIMINA" style={input(22)} /></label>
            {deleteError && <div role="alert" style={{ fontSize: 13, color: C.sal }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setDeleteOpen(false)} disabled={deleting} style={{ ...btn(), flex: 1, minHeight: 46 }}>annulla</button>
              <button onClick={deleteAccount} disabled={deleting || !canDelete} style={{ ...btnDanger, flex: 1, minHeight: 46, opacity: (deleting || !canDelete) ? 0.5 : 1 }}>{deleting ? 'cancellazione…' : 'elimina'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
