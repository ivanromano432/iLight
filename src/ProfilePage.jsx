// Pagina profilo personale: nome visualizzato + foto avatar.
// La foto viene ridimensionata e cropp-ata a 200x200 client-side per essere leggera.
// Salvataggio diretto su profiles.avatar_data (base64) e profiles.display_name.

import { useState, useRef, useEffect } from 'react';
import { THEMES, THEME_ORDER, DEFAULT_THEME, getTheme } from './themes.js';
import { supabase } from './supabase.js';
import { pushSupported, getPushStatus, subscribePush, unsubscribePush, registerServiceWorker } from './pushNotifications.js';

const fGaramond = '"Cormorant Garamond", serif';
const fCinzel = '"Cinzel", serif';

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
  // Tema dinamico — la pagina segue il tema attivo
  const Q = getTheme(profile?.theme);

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
      const dataUrl = await resizeAndCropImage(f, 200);
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

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse at top, ${Q.bg1} 0%, ${Q.bg2} 100%)`, color: Q.cream, fontFamily: fGaramond, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 14, border: `1px solid ${Q.gold}40`, borderRadius: 20, pointerEvents: 'none', zIndex: 1 }} />
      <div aria-hidden style={{ position: 'absolute', inset: 20, border: `1px solid ${Q.gold}1A`, borderRadius: 16, pointerEvents: 'none', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, padding: '24px 22px 60px', maxWidth: 460, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '8px 14px', cursor: 'pointer' }}>← INDIETRO</button>
          <div style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.45em', color: Q.gold, textTransform: 'uppercase' }}>PROFILO</div>
          <div style={{ width: 70 }} />
        </div>

        {/* Avatar grande */}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <div style={{ display: 'inline-block', position: 'relative' }}>
            <div style={{ width: 140, height: 140, borderRadius: '50%', overflow: 'hidden', border: `1px solid ${Q.gold}66`, background: `${Q.gold}11`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatar ? (
                <img src={avatar} alt="profilo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 64, color: Q.gold, lineHeight: 1 }}>{fallbackInitial}</span>
              )}
            </div>
            {avatar && (
              <button onClick={removeAvatar}
                style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: '50%', background: Q.bg2, color: '#C99A7A', border: `1px solid #C99A7A66`, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="rimuovi foto">
                ✕
              </button>
            )}
          </div>
          <div style={{ marginTop: 18 }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.35em', padding: '10px 18px', cursor: 'pointer', textTransform: 'uppercase' }}>
              {avatar ? '↻ CAMBIA FOTO' : '+ CARICA FOTO'}
            </button>
            <div style={{ marginTop: 8, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim }}>
              dalla galleria o fotocamera
            </div>
          </div>
        </div>

        {/* Nome */}
        <div style={{ marginTop: 38 }}>
          <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>NOME VISUALIZZATO</div>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="il tuo nome"
            maxLength={40}
            style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: `1px solid ${Q.gold}66`, color: Q.cream, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 20, padding: '10px 14px', textAlign: 'center', outline: 'none' }} />
          <div style={{ marginTop: 6, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim, textAlign: 'center' }}>
            opzionale · viene mostrato nell'app al posto dell'email
          </div>
        </div>

        {/* Email read-only */}
        <div style={{ marginTop: 26, padding: '14px 18px', border: `1px solid ${Q.gold}22`, background: `${Q.gold}08` }}>
          <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 4 }}>EMAIL ACCOUNT</div>
          <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 15, color: Q.cream, wordBreak: 'break-all' }}>{email}</div>
          <div style={{ marginTop: 6, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim }}>l'email non si può cambiare per ora</div>
        </div>

        {/* === I MIEI DATI === Servono per calcolare in modo personalizzato calorie e macronutrienti */}
        <div style={{ marginTop: 30 }}>
          <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>I MIEI DATI</div>
          <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim, textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>
            usati per calcolare il fabbisogno calorico personalizzato (formula Mifflin-St Jeor)
          </div>

          {/* Sesso */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>SESSO BIOLOGICO</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {[
                { id: 'm', label: 'uomo' },
                { id: 'f', label: 'donna' },
                { id: 'other', label: 'altro' },
              ].map(opt => {
                const selected = sex === opt.id;
                return (
                  <button key={opt.id} onClick={() => setSex(opt.id)}
                    style={{
                      flex: 1,
                      background: selected ? `${Q.gold}1A` : 'transparent',
                      border: `1px solid ${selected ? Q.gold : Q.gold + '44'}`,
                      color: selected ? Q.gold : Q.goldDim,
                      fontFamily: fGaramond,
                      fontStyle: 'italic',
                      fontSize: 14,
                      padding: '10px 8px',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Altezza + Anno di nascita affiancati */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>ALTEZZA · CM</div>
              <input type="text" inputMode="numeric" value={heightCm}
                onChange={e => setHeightCm(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                placeholder="178"
                style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: `1px solid ${Q.gold}66`, color: Q.cream, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 18, padding: '10px 14px', textAlign: 'center', outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>ANNO DI NASCITA</div>
              <input type="text" inputMode="numeric" value={birthYear}
                onChange={e => setBirthYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="1985"
                style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: `1px solid ${Q.gold}66`, color: Q.cream, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 18, padding: '10px 14px', textAlign: 'center', outline: 'none' }} />
            </div>
          </div>
          {birthYear && parseInt(birthYear) > 1900 && parseInt(birthYear) < new Date().getFullYear() && (
            <div style={{ marginTop: 6, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim, textAlign: 'center' }}>
              ({new Date().getFullYear() - parseInt(birthYear)} anni)
            </div>
          )}
        </div>

        {/* Selettore tema */}
        <div style={{ marginTop: 30 }}>
          <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>TEMA VISIVO</div>
          <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim, textAlign: 'center', marginBottom: 14 }}>
            scegli lo stile cromatico di tutta l'app
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {THEME_ORDER.map(id => {
              const t = THEMES[id];
              const selected = themeId === id;
              return (
                <button key={id} onClick={() => setThemeId(id)}
                  style={{
                    background: selected ? `${Q.gold}1A` : 'transparent',
                    border: `1px solid ${selected ? Q.gold : Q.gold + '44'}`,
                    padding: '10px 10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}>
                  {/* Swatch a 3 colori */}
                  <div style={{ display: 'flex', gap: 4, height: 18 }}>
                    {t.swatch.map((c, i) => (
                      <div key={i} style={{ flex: 1, background: c, borderRadius: 2, border: `1px solid ${Q.gold}22` }} />
                    ))}
                  </div>
                  <div>
                    <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.25em', color: selected ? Q.gold : Q.cream, textTransform: 'uppercase' }}>
                      {selected ? '✓ ' : ''}{t.name}
                    </div>
                    <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim, marginTop: 2 }}>
                      {t.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim, textAlign: 'center' }}>
            in questo primo aggiornamento il tema cambia solo le pagine I peso, II diario e III pasti. Altre pagine seguono nel prossimo deploy.
          </div>
        </div>

        {/* Errore */}
        {error && (
          <div style={{ marginTop: 18, padding: '10px 14px', border: `1px solid #C99A7A66`, background: '#C99A7A14', color: '#C99A7A', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Salva */}
        <div style={{ marginTop: 30, textAlign: 'center' }}>
          <button onClick={save} disabled={!dirty || saving}
            style={{ background: (dirty && !saving) ? Q.gold : '#555', color: (dirty && !saving) ? Q.ink : '#999', border: 'none', fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.4em', padding: '12px 28px', cursor: (dirty && !saving) ? 'pointer' : 'not-allowed', textTransform: 'uppercase' }}>
            {saving ? 'salvataggio…' : justSaved ? '✓ salvato' : 'SALVA'}
          </button>
        </div>

        {/* === NOTIFICHE === Promemoria push (richiede iOS 16.4+ con PWA installata) */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${Q.gold}22` }}>
          <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>NOTIFICHE PROMEMORIA</div>
          {!pushStatus.supported ? (
            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim, textAlign: 'center', padding: '12px', lineHeight: 1.6 }}>
              Le notifiche push non sono supportate dal tuo browser. Su iPhone serve iOS 16.4+ con la PWA installata sulla schermata Home.
            </div>
          ) : pushStatus.permission === 'denied' ? (
            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: '#C99A7A', textAlign: 'center', padding: '12px', lineHeight: 1.6 }}>
              Hai negato i permessi notifica. Vai nelle impostazioni del browser/iOS per riabilitarli.
            </div>
          ) : (
            <>
              <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim, textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
                Tre promemoria al giorno, scegli quali e a che ora.
              </div>

              {/* Toggle Mattina */}
              <NotifToggleRow Q={Q} fGaramond={fGaramond} fCinzel={fCinzel}
                label="Mattina · pesata"
                desc="Buongiorno, ricordati di pesarti"
                enabled={notifMorning}
                hour={notifMorningHour}
                onToggle={() => toggleNotif('morning', notifMorning)}
                onHourChange={(h) => updateNotifHour('morning', h)}
                busy={pushBusy}
              />

              {/* Toggle Pomeriggio */}
              <NotifToggleRow Q={Q} fGaramond={fGaramond} fCinzel={fCinzel}
                label="Pomeriggio · acqua"
                desc="Pausa idratazione"
                enabled={notifAfternoon}
                hour={notifAfternoonHour}
                onToggle={() => toggleNotif('afternoon', notifAfternoon)}
                onHourChange={(h) => updateNotifHour('afternoon', h)}
                busy={pushBusy}
              />

              {/* Toggle Sera */}
              <NotifToggleRow Q={Q} fGaramond={fGaramond} fCinzel={fCinzel}
                label="Sera · diario"
                desc="Una nota per chiudere la giornata"
                enabled={notifEvening}
                hour={notifEveningHour}
                onToggle={() => toggleNotif('evening', notifEvening)}
                onHourChange={(h) => updateNotifHour('evening', h)}
                busy={pushBusy}
              />

              {pushError && (
                <div style={{ marginTop: 10, padding: '8px 12px', border: `1px solid #C99A7A66`, background: '#C99A7A14', color: '#C99A7A', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, textAlign: 'center' }}>
                  {pushError}
                </div>
              )}

              {pushStatus.subscribed && (
                <div style={{ marginTop: 14, textAlign: 'center' }}>
                  <button onClick={disablePushCompletely} disabled={pushBusy}
                    style={{ background: 'transparent', color: Q.goldDim, border: `1px solid ${Q.goldDim}44`, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, padding: '6px 14px', cursor: pushBusy ? 'default' : 'pointer' }}>
                    spegni tutte le notifiche
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Link legali */}
        <div style={{ marginTop: 50, paddingTop: 24, borderTop: `1px solid ${Q.gold}22`, textAlign: 'center' }}>
          <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 10 }}>DOCUMENTI LEGALI</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18 }}>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.gold, textDecoration: 'none', borderBottom: `1px solid ${Q.gold}66`, paddingBottom: 2 }}>Privacy Policy</a>
            <a href="/termini" target="_blank" rel="noopener noreferrer" style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.gold, textDecoration: 'none', borderBottom: `1px solid ${Q.gold}66`, paddingBottom: 2 }}>Termini di Servizio</a>
          </div>
          <div style={{ marginTop: 14, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim, lineHeight: 1.5 }}>
            Romano Formazione S.a.s. · P.IVA 02477940999<br/>Via Macaggi 25/10 — 16121 Genova
          </div>
        </div>

        {/* Zona pericolosa: cancellazione account (GDPR art. 17) */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid #C99A7A33`, textAlign: 'center' }}>
          <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: '#C99A7A', textTransform: 'uppercase', marginBottom: 12 }}>ZONA RISERVATA</div>
          <button onClick={() => { setDeleteOpen(true); setDeleteConfirmText(''); setDeleteError(''); }}
            style={{ background: 'transparent', color: '#C99A7A', border: `1px solid #C99A7A66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '10px 22px', cursor: 'pointer', textTransform: 'uppercase' }}>
            elimina il mio account
          </button>
          <div style={{ marginTop: 10, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim, maxWidth: 320, margin: '10px auto 0', lineHeight: 1.5 }}>
            Cancella definitivamente account, dati di salute, foto e abbonamento. Operazione irreversibile.
          </div>
        </div>
      </div>

      {/* Modal di conferma cancellazione */}
      {deleteOpen && (
        <div onClick={() => !deleting && setDeleteOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: Q.bg2 || '#1F140C', border: `1px solid #C99A7A`, padding: '24px 22px', maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: fCinzel, fontSize: 12, letterSpacing: '0.4em', color: '#C99A7A', textAlign: 'center', marginBottom: 14, textTransform: 'uppercase' }}>⚠ Conferma cancellazione</div>

            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.cream, lineHeight: 1.6, marginBottom: 16 }}>
              Stai per cancellare <strong style={{ color: '#C99A7A' }}>definitivamente</strong> il tuo account e tutti i dati associati. Saranno eliminati:
            </div>

            <ul style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.cream, lineHeight: 1.8, marginBottom: 18, paddingLeft: 22 }}>
              <li>Profilo, peso, alimentazione, sonno, integratori, allenamenti</li>
              <li>Foto dei pasti caricate</li>
              <li>Eventuale abbonamento Stripe attivo</li>
              <li>Note del diario e obiettivi personali</li>
            </ul>

            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.goldDim, marginBottom: 18, lineHeight: 1.5, padding: '10px 12px', background: `${Q.gold}11`, border: `1px solid ${Q.gold}33` }}>
              L'operazione è <strong>irreversibile</strong>. Non potrai recuperare i dati né riattivare lo stesso account. Le eventuali fatture emesse saranno conservate per 10 anni come previsto dalla legge fiscale.
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: Q.goldDim, marginBottom: 6, textTransform: 'uppercase' }}>per confermare, scrivi <span style={{ color: '#C99A7A' }}>ELIMINA</span></div>
              <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} disabled={deleting}
                placeholder="ELIMINA"
                style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: `1px solid ${Q.gold}66`, color: Q.cream, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 16, padding: '10px 14px', textAlign: 'center', outline: 'none', letterSpacing: '0.2em' }} />
            </div>

            {deleteError && (
              <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: '#C99A7A', textAlign: 'center', marginBottom: 12 }}>{deleteError}</div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button onClick={() => setDeleteOpen(false)} disabled={deleting}
                style={{ flex: 1, background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '11px 16px', cursor: deleting ? 'default' : 'pointer', textTransform: 'uppercase', opacity: deleting ? 0.5 : 1 }}>
                annulla
              </button>
              <button onClick={deleteAccount} disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'ELIMINA'}
                style={{ flex: 1, background: (deleting || deleteConfirmText.trim().toUpperCase() !== 'ELIMINA') ? 'transparent' : '#C99A7A', color: (deleting || deleteConfirmText.trim().toUpperCase() !== 'ELIMINA') ? '#C99A7A' : '#1F140C', border: `1px solid #C99A7A`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '11px 16px', cursor: (deleting || deleteConfirmText.trim().toUpperCase() !== 'ELIMINA') ? 'default' : 'pointer', textTransform: 'uppercase', opacity: (deleting || deleteConfirmText.trim().toUpperCase() !== 'ELIMINA') ? 0.5 : 1 }}>
                {deleting ? '⋯ cancellazione' : 'elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Riga di un singolo toggle notifica con selettore orario.
function NotifToggleRow({ Q, fGaramond, fCinzel, label, desc, enabled, hour, onToggle, onHourChange, busy }) {
  return (
    <div style={{ marginBottom: 10, padding: '10px 12px', border: `1px solid ${Q.gold}33`, background: `${Q.gold}06`, display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Toggle visivo */}
      <button onClick={onToggle} disabled={busy}
        style={{ width: 42, height: 22, borderRadius: 11, background: enabled ? Q.gold : `${Q.goldDim}55`, border: 'none', position: 'relative', cursor: busy ? 'default' : 'pointer', flexShrink: 0, transition: 'background 0.2s', opacity: busy ? 0.5 : 1 }}>
        <span style={{ position: 'absolute', top: 2, left: enabled ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: Q.bg2 || '#fff', transition: 'left 0.2s' }} />
      </button>

      {/* Label e descrizione */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.25em', color: enabled ? Q.gold : Q.goldDim, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim, lineHeight: 1.3, marginTop: 2 }}>{desc}</div>
      </div>

      {/* Selettore orario */}
      <select value={hour} onChange={e => onHourChange(parseInt(e.target.value))}
        disabled={!enabled || busy}
        style={{ background: 'transparent', border: `1px solid ${Q.gold}44`, color: enabled ? Q.gold : Q.goldDim, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, padding: '5px 8px', cursor: enabled ? 'pointer' : 'default', borderRadius: 0, flexShrink: 0 }}>
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i} style={{ background: Q.bg2 || '#1F140C', color: Q.cream }}>
            {String(i).padStart(2, '0')}:00
          </option>
        ))}
      </select>
    </div>
  );
}
