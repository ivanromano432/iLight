import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';

const W = { bg: '#E8E0D2', ink: '#3C3329', tan: '#8C6A4E', accent: '#8B5E3C' };
const fCardo = "'Cardo',serif";
const fCaveat = "'Caveat',cursive";

function ensureFonts() {
  if (document.getElementById('auth-fonts')) return;
  const link = document.createElement('link');
  link.id = 'auth-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;1,400&family=Caveat:wght@500;700&display=swap';
  document.head.appendChild(link);
}

export default function AuthScreen() {
  useEffect(ensureFonts, []);

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setError(''); setInfo('');
    if (!email || !password) { setError('Email e password richieste.'); return; }
    if (password.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error: e1 } = await supabase.auth.signUp({ email, password });
        if (e1) throw e1;
        setInfo('Account creato. Controlla la tua email per confermare e poi torna ad accedere ✿');
        setMode('signin');
        setPassword('');
      } else {
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) throw e2;
        // L'AuthGate ascolterà il cambiamento di sessione e mostrerà l'app
      }
    } catch (err) {
      const msg = err?.message || 'Errore sconosciuto';
      // Traduzione dei messaggi più comuni
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
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setInfo('Ti abbiamo inviato un link via email per reimpostare la password.');
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
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>

        {/* Logo */}
        <img src="/icon-512.png" alt="GoalFit" style={{ width: 128, height: 128, display: 'block', margin: '0 auto 16px', borderRadius: 22, boxShadow: '0 4px 14px rgba(43,168,181,0.18)' }} />
        <div style={{ fontFamily: '"Cinzel", serif', fontSize: 14, letterSpacing: '0.35em', color: '#2BA8B5', textTransform: 'uppercase', margin: '4px 0 4px' }}>
          <span style={{ color: '#9CC73A' }}>GOAL</span>FIT
        </div>
        <div style={{
          fontFamily: fCaveat,
          fontSize: 22,
          color: W.tan,
          marginTop: 8,
          transform: 'rotate(-1deg)',
          display: 'inline-block',
        }}>
          il diario lento del tuo corpo ✿
        </div>

        {/* Linea decorativa */}
        <div style={{
          width: 60,
          height: 1,
          background: W.ink,
          opacity: 0.4,
          margin: '32px auto',
        }} />

        {/* Sottotitolo modale */}
        <div style={{
          fontFamily: fCardo,
          fontStyle: 'italic',
          fontSize: 20,
          color: W.ink,
          marginBottom: 28,
          opacity: 0.85,
        }}>
          {isSignup ? 'creiamo il tuo spazio' : 'bentornato/a'}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="email"
            autoComplete="email"
            placeholder="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={busy}
            style={inputStyle}
          />
          <input
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={busy}
            style={inputStyle}
          />

          {error && (
            <div style={{
              fontFamily: fCardo,
              fontStyle: 'italic',
              fontSize: 14,
              color: '#A0524C',
              marginTop: 4,
            }}>{error}</div>
          )}
          {info && (
            <div style={{
              fontFamily: fCardo,
              fontStyle: 'italic',
              fontSize: 14,
              color: W.tan,
              marginTop: 4,
            }}>{info}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 8,
              background: W.ink,
              color: W.bg,
              border: 'none',
              fontFamily: fCardo,
              fontStyle: 'italic',
              fontSize: 18,
              padding: '14px 28px',
              cursor: busy ? 'wait' : 'pointer',
              letterSpacing: 0.5,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? '...' : (isSignup ? '✦ registrati' : '✦ accedi')}
          </button>
        </form>

        {/* Toggle modalità */}
        <div style={{ marginTop: 26, fontFamily: fCardo, fontSize: 15, color: W.ink, opacity: 0.7 }}>
          {isSignup ? 'hai già un account?' : 'nuovo qui?'}
          {' '}
          <button
            type="button"
            onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(''); setInfo(''); }}
            style={{
              background: 'none',
              border: 'none',
              fontFamily: fCardo,
              fontStyle: 'italic',
              fontSize: 15,
              color: W.accent,
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              padding: 0,
            }}
          >
            {isSignup ? 'accedi' : 'registrati'}
          </button>
        </div>

        {/* Reset password (solo in signin) */}
        {!isSignup && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                fontFamily: fCardo,
                fontStyle: 'italic',
                fontSize: 13,
                color: W.tan,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              password dimenticata?
            </button>
          </div>
        )}

      </div>
    </div>
  );
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
