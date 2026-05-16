import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase.js';

const W = { bg: '#E8E0D2', ink: '#3C3329', tan: '#8C6A4E', accent: '#8B5E3C', gold: '#8B6F3F', sage: '#5C6B4E', cream: '#F4F1E8' };
const fCardo = "'Cardo',serif";
const fCaveat = "'Caveat',cursive";
const fCinzel = "'Cinzel',serif";

function ensureFonts() {
  if (document.getElementById('auth-fonts')) return;
  const link = document.createElement('link');
  link.id = 'auth-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;1,400&family=Caveat:wght@500;700&family=Cinzel:wght@400;500&display=swap';
  document.head.appendChild(link);
}

export default function AuthScreen() {
  useEffect(ensureFonts, []);

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentHealth, setConsentHealth] = useState(false);
  const formRef = useRef(null);

  function scrollToForm(targetMode) {
    setMode(targetMode);
    setError(''); setInfo('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setError(''); setInfo('');
    if (!email || !password) { setError('Email e password richieste.'); return; }
    if (password.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return; }
    if (mode === 'signup') {
      if (!consentTerms) { setError('Devi accettare i Termini di Servizio e l\'Informativa Privacy per registrarti.'); return; }
      if (!consentHealth) { setError('Devi dare il consenso esplicito al trattamento dei dati sanitari (è richiesto dal GDPR per usare l\'app).'); return; }
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error: e1 } = await supabase.auth.signUp({ email, password });
        if (e1) throw e1;
        setInfo('Account creato. Controlla la tua email per confermare e poi torna ad accedere ✿');
        setMode('signin');
        setPassword('');
        setConsentTerms(false);
        setConsentHealth(false);
      } else {
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) throw e2;
      }
    } catch (err) {
      const msg = err?.message || 'Errore sconosciuto';
      if (/Invalid login credentials/i.test(msg)) setError('Email o password errate.');
      else if (/Email not confirmed/i.test(msg)) setError('Email non ancora confermata. Controlla la posta.');
      else if (/User already registered/i.test(msg)) setError('Questa email è già registrata. Accedi invece di registrarti.');
      else if (/rate limit/i.test(msg)) setError('Troppi tentativi. Aspetta un minuto.');
      else setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    if (!email) { setError('Inserisci la tua email per ricevere il link di reset.'); return; }
    setBusy(true); setError(''); setInfo('');
    try {
      const { error: e1 } = await supabase.auth.resetPasswordForEmail(email);
      if (e1) throw e1;
      setInfo('Ti ho inviato un link per reimpostare la password. Controlla la posta ✿');
    } catch (err) {
      setError(err?.message || 'Errore');
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <div style={{
      minHeight: '100vh',
      background: W.bg,
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(120,100,80,0.04) 0px, transparent 1px, transparent 3px, rgba(120,100,80,0.04) 4px), repeating-linear-gradient(90deg, rgba(120,100,80,0.04) 0px, transparent 1px, transparent 3px, rgba(120,100,80,0.04) 4px)',
      color: W.ink,
      fontFamily: fCardo,
    }}>

      {/* === BAR TOP === */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: `1px solid ${W.ink}11` }}>
        <div style={{ fontFamily: fCinzel, fontSize: 12, letterSpacing: '0.35em', color: '#2BA8B5' }}>
          <span style={{ color: '#9CC73A' }}>GOAL</span>FIT
        </div>
        <button onClick={() => scrollToForm('signin')} style={{ background: 'none', border: `1px solid ${W.ink}44`, color: W.ink, fontFamily: fCardo, fontStyle: 'italic', fontSize: 14, padding: '6px 14px', cursor: 'pointer' }}>accedi</button>
      </div>

      {/* === HERO === */}
      <section style={{ padding: '50px 24px 30px', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <img src="/icon-512.png" alt="GoalFit" style={{ width: 128, height: 128, display: 'block', margin: '0 auto 18px' }} />
        <h1 style={{ fontFamily: fCardo, fontWeight: 400, fontSize: 32, lineHeight: 1.25, margin: '0 0 16px', color: W.ink }}>
          Il diario quotidiano<br/>
          <em style={{ color: W.accent }}>del tuo corpo</em>
        </h1>
        <p style={{ fontFamily: fCardo, fontStyle: 'italic', fontSize: 17, color: W.tan, maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.55 }}>
          Dimagrisci con la Dieta a Zona 40/30/30. Foto dei piatti riconosciute dall'IA, calorie e macronutrienti calcolati automaticamente, riflessioni personalizzate sul tuo percorso.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => scrollToForm('signup')} style={{ background: W.ink, color: W.bg, border: 'none', fontFamily: fCardo, fontStyle: 'italic', fontSize: 17, padding: '14px 28px', cursor: 'pointer', letterSpacing: 0.5 }}>
            ✦ inizia gratis (14 giorni)
          </button>
          <button onClick={() => scrollToForm('signin')} style={{ background: 'transparent', color: W.ink, border: `1px solid ${W.ink}66`, fontFamily: fCardo, fontStyle: 'italic', fontSize: 17, padding: '14px 28px', cursor: 'pointer' }}>
            ho già un account
          </button>
        </div>
        <div style={{ marginTop: 16, fontFamily: fCardo, fontStyle: 'italic', fontSize: 13, color: W.tan, opacity: 0.85 }}>
          Nessuna carta richiesta per la prova gratuita
        </div>
      </section>

      <Divider />

      {/* === FUNZIONALITÀ === */}
      <section style={{ padding: '40px 24px', maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ fontFamily: fCardo, fontWeight: 400, fontSize: 24, textAlign: 'center', marginBottom: 32, color: W.ink }}>
          <em>Tutto il tuo benessere</em> in un posto solo
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <Feature icon="✦" title="IA che riconosce i pasti dalle foto"
            text="Scatta una foto del tuo piatto. L'intelligenza artificiale identifica gli alimenti, stima la porzione e calcola calorie e macronutrienti."/>
          <Feature icon="◯" title="Dieta a Zona 40/30/30"
            text="Calorie e macro bilanciati automaticamente: 40% carboidrati, 30% proteine, 30% grassi. Calcolo personalizzato col tuo peso, altezza, età."/>
          <Feature icon="✿" title="Diario completo del corpo"
            text="Peso, sonno, allenamenti, idratazione, integratori, digiuno intermittente, sessioni di respiro. Tutto in un'unica app pulita."/>
          <Feature icon="⚖" title="Suggerimenti che fanno dimagrire"
            text="L'IA studia le tue abitudini e propone pasti bilanciati con alimenti che favoriscono il dimagrimento, evitando ciò che lo rallenta."/>
          <Feature icon="∞" title="Statistiche e progressi"
            text="Grafici di peso, media mobile, calorie consumate vs obiettivo. Vedi i tuoi progressi giorno per giorno, settimana per settimana."/>
          <Feature icon="⟡" title="100% privato"
            text="I tuoi dati di salute restano tuoi. Niente pubblicità, niente tracker, niente cookie di profilazione. Cancelli l'account in 1 click e tutto sparisce."/>
        </div>
      </section>

      <Divider />

      {/* === COME FUNZIONA === */}
      <section style={{ padding: '40px 24px', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: fCardo, fontWeight: 400, fontSize: 24, marginBottom: 30, color: W.ink }}>
          <em>Come funziona</em>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 28, textAlign: 'left' }}>
          <Step n="1" title="Imposta il profilo" text="Età, altezza, peso attuale e obiettivo. L'app calcola il tuo fabbisogno calorico con la formula Mifflin-St Jeor."/>
          <Step n="2" title="Registra ogni giorno" text="Tocca una foto per il pasto, segna peso e sonno, accumula bicchieri d'acqua. Pochi tap, tutto coerente."/>
          <Step n="3" title="Segui i suggerimenti" text="L'IA propone menù bilanciati, riflessioni serali e indicazioni concrete su cosa cambiare per dimagrire."/>
        </div>
      </section>

      <Divider />

      {/* === PRICING === */}
      <section style={{ padding: '40px 24px', maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: fCardo, fontWeight: 400, fontSize: 24, marginBottom: 8, color: W.ink }}>
          <em>Prezzo onesto</em>
        </h2>
        <p style={{ fontFamily: fCardo, fontStyle: 'italic', fontSize: 15, color: W.tan, marginBottom: 28 }}>
          Inizia con 14 giorni gratuiti, poi decidi tu.
        </p>
        <div style={{ background: W.cream, border: `1px solid ${W.gold}55`, padding: '28px 24px', textAlign: 'left' }}>
          <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.35em', color: W.tan, textTransform: 'uppercase', marginBottom: 10 }}>PROVA GRATUITA</div>
          <div style={{ fontFamily: fCardo, fontSize: 36, color: W.ink, lineHeight: 1, marginBottom: 8 }}>
            14 giorni <span style={{ fontSize: 18, color: W.tan, fontStyle: 'italic' }}>gratis</span>
          </div>
          <div style={{ fontFamily: fCardo, fontStyle: 'italic', fontSize: 14, color: W.tan, marginBottom: 18 }}>
            Tutte le funzioni, senza carta di credito.
          </div>
          <div style={{ height: 1, background: `${W.ink}22`, margin: '18px 0' }} />
          <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.35em', color: W.tan, textTransform: 'uppercase', marginBottom: 10 }}>POI</div>
          <div style={{ fontFamily: fCardo, fontSize: 16, color: W.ink, lineHeight: 1.6 }}>
            Abbonamento mensile o annuale. Cancella quando vuoi. Diritto di recesso 14 giorni.
          </div>
          <div style={{ marginTop: 22, textAlign: 'center' }}>
            <button onClick={() => scrollToForm('signup')} style={{ background: W.ink, color: W.bg, border: 'none', fontFamily: fCardo, fontStyle: 'italic', fontSize: 17, padding: '12px 26px', cursor: 'pointer' }}>
              inizia ora ✦
            </button>
          </div>
        </div>
      </section>

      <Divider />

      {/* === FORM === */}
      <section ref={formRef} style={{ padding: '40px 24px 28px', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.35em', color: W.tan, textTransform: 'uppercase', marginBottom: 8 }}>
            {isSignup ? 'CREA ACCOUNT' : 'BENTORNATO'}
          </div>
          <h2 style={{ fontFamily: fCardo, fontWeight: 400, fontSize: 26, marginBottom: 6, color: W.ink }}>
            {isSignup ? <em>Inizia il tuo percorso</em> : <em>Riprendi da dove eri</em>}
          </h2>
          <p style={{ fontFamily: fCardo, fontStyle: 'italic', fontSize: 14, color: W.tan, marginBottom: 28 }}>
            {isSignup ? '14 giorni gratuiti, niente carta richiesta.' : 'Accedi con la tua email.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="email" placeholder="email" value={email} onChange={e => setEmail(e.target.value.trim())} autoComplete="email" style={inputStyle} required />
          <input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={6} style={inputStyle} required />

          {error && <div style={{ fontFamily: fCardo, fontStyle: 'italic', fontSize: 14, color: '#A0524C' }}>{error}</div>}
          {info && <div style={{ fontFamily: fCardo, fontStyle: 'italic', fontSize: 14, color: W.tan }}>{info}</div>}

          {isSignup && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontFamily: fCardo, fontStyle: 'italic', fontSize: 13, color: W.ink, lineHeight: 1.5 }}>
                <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, accentColor: W.ink, flexShrink: 0 }} />
                <span>Ho letto e accetto i <a href="/termini" target="_blank" rel="noopener noreferrer" style={{ color: W.tan, borderBottom: `1px solid ${W.tan}66`, textDecoration: 'none' }}>Termini di Servizio</a> e l'<a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: W.tan, borderBottom: `1px solid ${W.tan}66`, textDecoration: 'none' }}>Informativa Privacy</a>.</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontFamily: fCardo, fontStyle: 'italic', fontSize: 13, color: W.ink, lineHeight: 1.5 }}>
                <input type="checkbox" checked={consentHealth} onChange={e => setConsentHealth(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, accentColor: W.ink, flexShrink: 0 }} />
                <span>Acconsento esplicitamente al trattamento dei miei <b>dati sanitari</b> (peso, alimentazione, sonno, attività fisica) ai sensi dell'art. 9.2.a GDPR.</span>
              </label>
              <div style={{ fontFamily: fCardo, fontSize: 11, color: W.tan, fontStyle: 'italic', lineHeight: 1.5, opacity: 0.85 }}>
                Dichiari di avere 18 anni o più. Puoi revocare i consensi in qualunque momento dal profilo.
              </div>
            </div>
          )}

          <button type="submit" disabled={busy} style={{ marginTop: 6, background: W.ink, color: W.bg, border: 'none', fontFamily: fCardo, fontStyle: 'italic', fontSize: 18, padding: '14px 28px', cursor: busy ? 'wait' : 'pointer', letterSpacing: 0.5, opacity: busy ? 0.6 : 1 }}>
            {busy ? '...' : (isSignup ? '✦ registrati' : '✦ accedi')}
          </button>
        </form>

        <div style={{ marginTop: 26, fontFamily: fCardo, fontSize: 15, color: W.ink, opacity: 0.7, textAlign: 'center' }}>
          {isSignup ? 'hai già un account?' : 'nuovo qui?'}
          {' '}
          <button type="button" onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(''); setInfo(''); }} style={{ background: 'none', border: 'none', fontFamily: fCardo, fontStyle: 'italic', fontSize: 15, color: W.accent, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>
            {isSignup ? 'accedi' : 'registrati'}
          </button>
        </div>

        {!isSignup && (
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <button type="button" onClick={handleResetPassword} disabled={busy} style={{ background: 'none', border: 'none', fontFamily: fCardo, fontStyle: 'italic', fontSize: 13, color: W.tan, cursor: 'pointer', padding: 0 }}>
              password dimenticata?
            </button>
          </div>
        )}
      </section>

      {/* === FOOTER === */}
      <footer style={{ marginTop: 40, padding: '28px 24px 36px', borderTop: `1px solid ${W.ink}22`, textAlign: 'center', fontFamily: fCardo, fontSize: 13, color: W.tan, lineHeight: 1.7 }}>
        <div style={{ marginBottom: 10 }}>
          <a href="/privacy" style={{ color: W.tan, marginRight: 16, borderBottom: `1px solid ${W.tan}55`, textDecoration: 'none', paddingBottom: 1 }}>Privacy</a>
          <a href="/termini" style={{ color: W.tan, borderBottom: `1px solid ${W.tan}55`, textDecoration: 'none', paddingBottom: 1 }}>Termini</a>
        </div>
        <div style={{ fontStyle: 'italic', fontSize: 12 }}>
          Romano Formazione S.a.s. · P.IVA 02477940999<br/>
          Via Macaggi 25/10 — 16121 Genova
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, text }) {
  return (
    <div style={{ padding: '16px 4px' }}>
      <div style={{ fontSize: 24, color: W.accent, lineHeight: 1, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ fontFamily: fCardo, fontWeight: 400, fontSize: 18, color: W.ink, marginBottom: 6, lineHeight: 1.3 }}>{title}</h3>
      <p style={{ fontFamily: fCardo, fontStyle: 'italic', fontSize: 14, color: W.tan, lineHeight: 1.55, margin: 0 }}>{text}</p>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <div>
      <div style={{ fontFamily: fCardo, fontSize: 42, color: W.accent, opacity: 0.85, lineHeight: 1, marginBottom: 8, fontStyle: 'italic' }}>{n}</div>
      <h3 style={{ fontFamily: fCardo, fontWeight: 400, fontSize: 18, color: W.ink, marginBottom: 4 }}>{title}</h3>
      <p style={{ fontFamily: fCardo, fontStyle: 'italic', fontSize: 14, color: W.tan, lineHeight: 1.55, margin: 0 }}>{text}</p>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 80, height: 1, background: W.ink, opacity: 0.18, margin: '20px auto' }} />;
}

const inputStyle = {
  fontFamily: fCardo,
  fontSize: 17,
  padding: '12px 16px',
  border: `1px solid ${W.ink}33`,
  background: '#fff',
  color: W.ink,
  outline: 'none',
  borderRadius: 2,
  width: '100%',
  boxSizing: 'border-box',
};
