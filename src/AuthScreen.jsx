import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase.js';
import { C, fSerif, page, card, btn, chip, label, input, link, tag, muted, h2, ensureUiFonts } from './ui.js';

export default function AuthScreen() {
  useEffect(ensureUiFonts, []);

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
        setInfo('Account creato. Controlla la tua email per confermare e poi torna ad accedere');
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
      setInfo('Ti ho inviato un link per reimpostare la password. Controlla la posta');
    } catch (err) {
      setError(err?.message || 'Errore');
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === 'signup';
  const switchMode = (m) => { setMode(m); setError(''); setInfo(''); };
  const check = (on) => ({ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1, background: on ? C.gold : 'transparent', border: `2px solid ${C.gold}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.navy, fontSize: 15, fontWeight: 800, lineHeight: 1 });
  const section = { maxWidth: 480, margin: '0 auto', padding: '34px 24px 0', boxSizing: 'border-box' };

  return (
    <div style={page}>
      <section ref={formRef} style={{ ...section, paddingTop: 56 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          <span style={{ fontFamily: fSerif, fontSize: 56, fontWeight: 500, lineHeight: 1 }}>GoalFit</span>
          <h1 style={{ fontFamily: fSerif, fontSize: 26, fontWeight: 400, lineHeight: 1.2, margin: 0 }}>Il diario quotidiano del tuo corpo</h1>
        </div>
        <form onSubmit={handleSubmit} style={{ ...card, borderRadius: 24, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: C.navy, border: `1px solid ${C.line}`, borderRadius: 26, padding: 4, display: 'flex', gap: 4 }}>
            <button type="button" onClick={() => switchMode('signin')} style={{ ...chip(!isSignup), flex: 1, border: 'none' }}>accedi</button>
            <button type="button" onClick={() => switchMode('signup')} style={{ ...chip(isSignup), flex: 1, border: 'none' }}>crea account</button>
          </div>
          <label><span style={label}>email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value.trim())} autoComplete="email" required style={input(20)} /></label>
          <label><span style={label}>password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={6} required style={input(20)} /></label>
          {isSignup && (<>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13, lineHeight: 1.45 }}>
              <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 22, height: 22, margin: 0 }} />
              <span aria-hidden="true" style={check(consentTerms)}>{consentTerms ? '✓' : ''}</span>
              <span>Ho letto e accetto i <a href="/termini" target="_blank" rel="noopener noreferrer" style={{ color: C.cream }}>Termini di Servizio</a> e l'<a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.cream }}>Informativa Privacy</a>.</span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13, lineHeight: 1.45 }}>
              <input type="checkbox" checked={consentHealth} onChange={e => setConsentHealth(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 22, height: 22, margin: 0 }} />
              <span aria-hidden="true" style={check(consentHealth)}>{consentHealth ? '✓' : ''}</span>
              <span>Acconsento esplicitamente al trattamento dei miei <b>dati sanitari</b> (peso, alimentazione, sonno, attività fisica) ai sensi dell'art. 9.2.a GDPR.</span>
            </label>
            <span style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>Dichiari di avere 18 anni o più. Puoi revocare i consensi in qualunque momento dal profilo.</span>
          </>)}
          {error && <div role="alert" style={{ fontSize: 14, color: C.sal, lineHeight: 1.4 }}>{error}</div>}
          {info && <div style={{ fontSize: 14, lineHeight: 1.4 }}>{info}</div>}
          <button type="submit" disabled={busy} style={{ ...btn(), opacity: busy ? 0.6 : 1 }}>{busy ? '…' : (isSignup ? 'inizia la prova gratuita' : 'accedi')}</button>
          {isSignup && <span style={{ fontSize: 13, color: C.dim, textAlign: 'center' }}>14 giorni gratis · nessuna carta richiesta</span>}
        </form>
        {!isSignup && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button type="button" onClick={handleResetPassword} disabled={busy} style={{ ...link, minHeight: 44 }}>password dimenticata?</button>
          </div>
        )}
      </section>

      <section style={section}>
        <span style={tag}>cosa trovi dentro</span>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          <Feature title="L'IA riconosce i pasti dalle foto" text="Scatti una foto del piatto: l'intelligenza artificiale identifica gli alimenti, stima la porzione e calcola calorie e nutrienti." />
          <Feature title="Dieta a Zona 40/30/30" text="Calorie e nutrienti bilanciati in automatico: 40% carboidrati, 30% proteine, 30% grassi, calcolati su peso, altezza ed età." />
          <Feature title="Un coach che conosce i tuoi dati" text="Chiedi cosa mangiare stasera o perché il peso è fermo: risponde guardando quello che hai registrato." />
          <Feature title="Tutto il corpo in un posto" text="Peso, sonno, allenamenti, acqua, integratori, digiuno e respiro, con statistiche semplici da leggere." />
          <Feature title="100% privato" text="I tuoi dati di salute restano tuoi. Niente pubblicità, niente profilazione. Cancelli l'account in un tocco e tutto sparisce." last />
        </div>
      </section>

      <section style={section}>
        <span style={tag}>come funziona</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <Step n="1" title="Imposta il profilo" text="Età, altezza, peso attuale e obiettivo: l'app calcola il tuo fabbisogno." />
          <Step n="2" title="Registra ogni giorno" text="Una foto per il pasto, un tocco per peso, acqua e integratori." />
          <Step n="3" title="Segui i suggerimenti" text="Menù bilanciati, lettura della giornata e indicazioni concrete per dimagrire." />
        </div>
      </section>

      <section style={section}>
        <div style={{ ...card, borderRadius: 24, padding: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={tag}>prova gratuita</span>
          <span style={{ fontFamily: fSerif, fontSize: 40, fontWeight: 500, lineHeight: 1.1 }}>14 giorni gratis</span>
          <span style={muted}>Tutte le funzioni, senza carta di credito. Poi abbonamento mensile o annuale: cancelli quando vuoi, con diritto di recesso di 14 giorni.</span>
          <button onClick={() => scrollToForm('signup')} style={{ ...btn(), marginTop: 8 }}>inizia ora</button>
          <button onClick={() => scrollToForm('signin')} style={btn(false)}>ho già un account</button>
        </div>
      </section>

      <footer style={{ maxWidth: 480, margin: '0 auto', padding: '34px 24px 44px', textAlign: 'center', fontSize: 12, color: C.dim, lineHeight: 1.7 }}>
        <div style={{ marginBottom: 8 }}>
          <a href="/privacy" style={{ color: C.cream, marginRight: 18 }}>Privacy</a>
          <a href="/termini" style={{ color: C.cream }}>Termini</a>
        </div>
        Romano Formazione S.a.s. · P.IVA 02477940999<br />
        Via Macaggi 25/10 — 16121 Genova
      </footer>
    </div>
  );
}

function Feature({ title, text, last }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${C.line}` }}>
      <h3 style={{ ...h2, fontSize: 22 }}>{title}</h3>
      <p style={{ ...muted, margin: '4px 0 0' }}>{text}</p>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <span style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${C.gold}`, boxSizing: 'border-box', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fSerif, fontSize: 22, color: C.gold }}>{n}</span>
      <div>
        <h3 style={{ ...h2, fontSize: 22 }}>{title}</h3>
        <p style={{ ...muted, margin: '2px 0 0' }}>{text}</p>
      </div>
    </div>
  );
}
