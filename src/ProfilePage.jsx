// Pagina profilo personale: nome visualizzato + foto avatar.
// La foto viene ridimensionata e cropp-ata a 200x200 client-side per essere leggera.
// Salvataggio diretto su profiles.avatar_data (base64) e profiles.display_name.

import { useState, useRef } from 'react';

const Q = { bg1: '#3A2818', bg2: '#1F140C', gold: '#C9A876', goldDim: '#8B7355', cream: '#E8D8B8', ink: '#1F140C' };
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
  const [name, setName] = useState(profile?.display_name || '');
  const [avatar, setAvatar] = useState(profile?.avatar_data || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(0);
  const fileInputRef = useRef(null);

  const email = user?.email || '';
  const fallbackInitial = ((name?.[0]) || email[0] || '?').toUpperCase();
  const dirty = (name || '') !== (profile?.display_name || '') || (avatar || null) !== (profile?.avatar_data || null);

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
      await updProfile({
        display_name: name.trim() || null,
        avatar_data: avatar || null,
      });
      setSavedAt(Date.now());
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const justSaved = savedAt && Date.now() - savedAt < 3000;

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
      </div>
    </div>
  );
}
