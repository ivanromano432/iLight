// Pagina abbonamento: mostra stato trial/active/expired, propone i piani.
// Usata come PAYWALL (modale fullscreen) quando trial scaduto e no subscription,
// e come pagina di gestione abbonamento dal menu utente.

import { useState } from 'react';
import { supabase } from './supabase.js';
import { getTheme } from './themes.js';

// Tema fisso refettorio per modalità paywall (pricing deve essere stabile)
const REFETTORIO = { bg1: '#3A2818', bg2: '#1F140C', gold: '#C9A876', goldDim: '#8B7355', cream: '#E8D8B8', ink: '#1F140C' };
const fGaramond = '"Cormorant Garamond", serif';
const fCinzel = '"Cinzel", serif';

const PLANS = [
  { id: 'monthly', label: 'MENSILE', price: '€ 4,99', period: 'al mese', popular: false, saveLabel: null },
  { id: 'yearly', label: 'ANNUALE', price: '€ 39', period: 'all\'anno', popular: true, saveLabel: 'risparmi 35%' },
];

function daysUntil(isoDate) {
  if (!isoDate) return 0;
  const ms = new Date(isoDate) - new Date();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export default function SubscriptionPage({ user, profile, onClose, paywallMode = false, onLogout }) {
  // In modalità paywall mantengo lo stile refettorio coerente coi piani/prezzi.
  // In modalità normale (dall'avatar) seguo il tema attivo dell'utente.
  const Q = paywallMode ? REFETTORIO : getTheme(profile?.theme);

  const [loading, setLoading] = useState(null); // 'monthly' | 'yearly' | 'portal' | null
  const [error, setError] = useState(null);

  const isLifetimeFree = !!profile?.is_lifetime_free;
  const isTrial = !isLifetimeFree && profile?.subscription_status === 'trial';
  const isActive = !isLifetimeFree && profile?.subscription_status === 'active';
  const isPastDue = profile?.subscription_status === 'past_due';
  const isCanceled = profile?.subscription_status === 'canceled' || profile?.subscription_status === 'none';
  const trialDaysLeft = isTrial ? daysUntil(profile?.trial_ends_at) : 0;
  const hasStripeCustomer = !!profile?.stripe_customer_id;

  const checkout = async (plan) => {
    setError(null); setLoading(plan);
    try {
      const res = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId: user.id, userEmail: user.email }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Errore checkout');
      window.location.href = data.url;
    } catch (e) {
      setError(e.message || String(e));
      setLoading(null);
    }
  };

  const openPortal = async () => {
    setError(null); setLoading('portal');
    try {
      const res = await fetch('/api/stripe-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Errore portale');
      window.location.href = data.url;
    } catch (e) {
      setError(e.message || String(e));
      setLoading(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse at top, ${Q.bg1} 0%, ${Q.bg2} 100%)`, color: Q.cream, fontFamily: fGaramond, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 14, border: `1px solid ${Q.gold}40`, borderRadius: 20, pointerEvents: 'none', zIndex: 1 }} />
      <div aria-hidden style={{ position: 'absolute', inset: 20, border: `1px solid ${Q.gold}1A`, borderRadius: 16, pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 2, padding: '24px 22px 60px', maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {paywallMode ? (
            <button onClick={onLogout} style={{ background: 'transparent', color: Q.goldDim, border: `1px solid ${Q.goldDim}66`, fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', padding: '8px 12px', cursor: 'pointer' }}>ESCI</button>
          ) : (
            <button onClick={onClose} style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '8px 14px', cursor: 'pointer' }}>← INDIETRO</button>
          )}
          <div style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.45em', color: Q.gold, textTransform: 'uppercase' }}>ABBONAMENTO</div>
          <div style={{ width: 70 }} />
        </div>

        {/* Hero / stato corrente */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <div style={{ fontFamily: fCinzel, fontSize: 28, letterSpacing: '0.3em', color: Q.gold, textTransform: 'uppercase' }}>GOALFIT</div>
          <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.goldDim, marginTop: 6 }}>Premium</div>
        </div>

        {/* Banner stato */}
        {isLifetimeFree && (
          <div style={{ marginTop: 28, padding: '14px 18px', textAlign: 'center', border: `1px solid ${Q.gold}66`, background: `${Q.gold}11` }}>
            <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.35em', color: Q.gold, textTransform: 'uppercase' }}>✦ ACCESSO LIFETIME</div>
            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.cream, marginTop: 6 }}>
              Hai accesso completo a GoalFit Premium per sempre, senza addebiti.
            </div>
          </div>
        )}
        {isTrial && trialDaysLeft > 0 && (
          <div style={{ marginTop: 28, padding: '14px 18px', textAlign: 'center', border: `1px solid #A5B88944`, background: '#A5B8890E' }}>
            <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', color: '#A5B889', textTransform: 'uppercase' }}>PROVA GRATUITA IN CORSO</div>
            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 18, color: Q.cream, marginTop: 6 }}>
              {trialDaysLeft === 1 ? 'ultimo giorno' : `rimangono ${trialDaysLeft} giorni`}
            </div>
          </div>
        )}
        {(paywallMode || (isTrial && trialDaysLeft === 0)) && !isActive && (
          <div style={{ marginTop: 28, padding: '14px 18px', textAlign: 'center', border: `1px solid #C99A7A44`, background: '#C99A7A0E' }}>
            <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', color: '#C99A7A', textTransform: 'uppercase' }}>PROVA TERMINATA</div>
            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.cream, marginTop: 6 }}>
              Per continuare a usare GoalFit, scegli un piano
            </div>
          </div>
        )}
        {isActive && (
          <div style={{ marginTop: 28, padding: '14px 18px', textAlign: 'center', border: `1px solid #A5B88944`, background: '#A5B8890E' }}>
            <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', color: '#A5B889', textTransform: 'uppercase' }}>ABBONAMENTO ATTIVO</div>
            {profile?.current_period_end && (
              <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.cream, marginTop: 6 }}>
                rinnovo automatico il {new Date(profile.current_period_end).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        )}
        {isPastDue && (
          <div style={{ marginTop: 28, padding: '14px 18px', textAlign: 'center', border: `1px solid #C99A7A44`, background: '#C99A7A0E' }}>
            <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', color: '#C99A7A', textTransform: 'uppercase' }}>PAGAMENTO IN SOSPESO</div>
            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.cream, marginTop: 6 }}>
              C'è un problema col tuo metodo di pagamento. Gestiscilo dal portale.
            </div>
          </div>
        )}

        {/* Cosa include (anche per lifetime, come riepilogo amichevole) */}
        {(!isActive && !isLifetimeFree) || isLifetimeFree ? (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.4em', color: Q.gold, textTransform: 'uppercase', textAlign: 'center', marginBottom: 16 }}>{isLifetimeFree ? '✦ HAI ACCESSO A' : '✦ INCLUSO'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.cream, paddingLeft: 12 }}>
              <div>· Diario libero con analisi IA dei tuoi pasti</div>
              <div>· 9 mondi tematici per peso, sonno, allenamento, mindful, digiuno…</div>
              <div>· Statistiche avanzate: trend lungo periodo, correlazioni, pattern</div>
              <div>· Riassunti mensili generati dall'IA</div>
              <div>· Obiettivi multipli con progress bar</div>
              <div>· Esportazione CSV di tutti i tuoi dati</div>
              <div>· Sincronizzazione multi-dispositivo</div>
            </div>
          </div>
        ) : null}

        {/* Cosa include (versione ridotta, sostituita sopra) */}
        {false && !isActive && !isLifetimeFree && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.4em', color: Q.gold, textTransform: 'uppercase', textAlign: 'center', marginBottom: 16 }}>✦ INCLUSO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.cream, paddingLeft: 12 }}>
              <div>· Diario libero con analisi IA dei tuoi pasti</div>
              <div>· 9 mondi tematici per peso, sonno, allenamento, mindful, digiuno…</div>
              <div>· Statistiche avanzate: trend lungo periodo, correlazioni, pattern</div>
              <div>· Riassunti mensili generati dall'IA</div>
              <div>· Obiettivi multipli con progress bar</div>
              <div>· Esportazione CSV di tutti i tuoi dati</div>
              <div>· Sincronizzazione multi-dispositivo</div>
            </div>
          </div>
        )}

        {/* Piani */}
        {!isActive && !isLifetimeFree && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {PLANS.map(p => (
                <button key={p.id} onClick={() => checkout(p.id)} disabled={!!loading}
                  style={{ position: 'relative', background: p.popular ? Q.gold : 'transparent', color: p.popular ? Q.ink : Q.cream, border: `1px solid ${p.popular ? Q.gold : Q.gold + '66'}`, padding: '20px 22px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading && loading !== p.id ? 0.5 : 1, textAlign: 'left', fontFamily: fGaramond }}>
                  {p.popular && (
                    <div style={{ position: 'absolute', top: -10, right: 16, background: '#A5B889', color: Q.ink, fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.25em', padding: '3px 10px', textTransform: 'uppercase' }}>consigliato</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.35em' }}>{p.label}</span>
                    <span style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 26 }}>{p.price}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontStyle: 'italic', fontSize: 13, opacity: 0.8 }}>
                    <span>{p.saveLabel || ' '}</span>
                    <span>{p.period}</span>
                  </div>
                  {loading === p.id && <div style={{ marginTop: 8, textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12 }}>apertura checkout…</div>}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim, textAlign: 'center', lineHeight: 1.5 }}>
              Pagamento gestito da Stripe. Annulla quando vuoi.<br />
              Hai un codice sconto? Inseriscilo nella schermata checkout.
            </div>
          </div>
        )}

        {/* Gestisci abbonamento esistente */}
        {hasStripeCustomer && !isLifetimeFree && (
          <div style={{ marginTop: 30, textAlign: 'center' }}>
            <button onClick={openPortal} disabled={!!loading}
              style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '10px 18px', cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase' }}>
              {loading === 'portal' ? 'apertura portale…' : '↗ GESTISCI ABBONAMENTO'}
            </button>
            <div style={{ marginTop: 8, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim }}>
              cambia metodo pagamento, scarica ricevute, annulla
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 20, padding: '10px 14px', border: `1px solid #C99A7A66`, background: '#C99A7A14', color: '#C99A7A', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
