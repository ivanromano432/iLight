// Pagina abbonamento: mostra stato trial/active/expired, propone i piani.
// Usata come PAYWALL (modale fullscreen) quando trial scaduto e no subscription,
// e come pagina di gestione abbonamento dal menu utente.

import { useState } from 'react';
import { supabase } from './supabase.js';
import { C, fSerif, page, column, kicker, h1, muted, card, btn, link, tag } from './ui.js';

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

  // --- Render nuovo stile ---
  const status = (kick, title, text, bar) => (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={tag}>{kick}</span>
      <span style={{ fontFamily: fSerif, fontSize: 30, fontWeight: 500, lineHeight: 1.1 }}>{title}</span>
      {bar != null && <div style={{ height: 10, borderRadius: 5, background: '#2A4466' }}><div style={{ width: `${Math.round(bar * 100)}%`, height: 10, borderRadius: 5, background: C.gold }} /></div>}
      {text && <span style={muted}>{text}</span>}
    </div>
  );
  return (
    <div style={page}>
      <div style={{ ...column, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          {paywallMode
            ? <button onClick={onLogout} style={{ ...link, minHeight: 44 }}>esci dall'account</button>
            : <button onClick={onClose} style={{ ...link, minHeight: 44 }}>‹ indietro</button>}
          <div style={kicker}>GoalFit Premium</div>
          <h1 style={h1}>Abbonamento</h1>
        </div>

        {isLifetimeFree && status('accesso a vita', 'Premium per sempre', 'Hai accesso completo a GoalFit, senza addebiti.')}
        {isTrial && trialDaysLeft > 0 && status('prova gratuita in corso', trialDaysLeft === 1 ? 'Ultimo giorno' : `${trialDaysLeft} giorni rimasti`, null, Math.max(0.04, Math.min(1, (14 - trialDaysLeft) / 14)))}
        {(paywallMode || (isTrial && trialDaysLeft === 0)) && !isActive && status('prova terminata', 'Scegli un piano', 'Per continuare a usare GoalFit serve un abbonamento. I tuoi dati sono tutti al loro posto.')}
        {isActive && status('abbonamento attivo', 'Tutto a posto', profile?.current_period_end ? `Rinnovo automatico il ${new Date(profile.current_period_end).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.` : '')}
        {isPastDue && status('pagamento in sospeso', 'C’è un problema', 'Il metodo di pagamento non è andato a buon fine. Sistemalo da "gestisci abbonamento".')}

        {!isActive && !isLifetimeFree && (<>
          {[...PLANS].sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0)).map(p => (
            <button key={p.id} onClick={() => checkout(p.id)} disabled={!!loading}
              style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 18, borderRadius: 22, background: C.card, border: p.popular ? `2px solid ${C.gold}` : `1px solid ${C.line}`, color: C.cream, textAlign: 'left', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: loading && loading !== p.id ? 0.6 : 1 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={tag}>{p.label.toLowerCase()}</span>
                {p.popular && <span style={{ background: C.gold, color: C.navy, fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 14 }}>consigliato</span>}
              </span>
              <span style={{ fontFamily: fSerif, fontSize: 40, fontWeight: 500, lineHeight: 1.1 }}>{p.price} <span style={{ fontSize: 20 }}>{p.period}</span></span>
              <span style={{ fontSize: 13, color: C.dim }}>{loading === p.id ? 'apro il pagamento…' : (p.saveLabel || 'annulli quando vuoi')}</span>
            </button>
          ))}
          <span style={{ ...muted, fontSize: 13, textAlign: 'center' }}>Tocca un piano per continuare. Pagamento gestito da Stripe: annulli quando vuoi. Il codice sconto si inserisce nella schermata di pagamento.</span>
        </>)}

        {error && <div role="alert" style={{ fontSize: 14, color: C.sal, lineHeight: 1.4 }}>{error}</div>}

        {hasStripeCustomer && !isLifetimeFree && (<>
          <button onClick={openPortal} disabled={!!loading} style={btn(false)}>{loading === 'portal' ? 'apro il portale…' : 'gestisci abbonamento e ricevute'}</button>
          <span style={{ ...muted, fontSize: 12, textAlign: 'center' }}>Cambia metodo di pagamento, scarica le ricevute o annulla.</span>
        </>)}

        {(!isActive || isLifetimeFree) && (
          <div style={{ marginTop: 10 }}>
            <span style={tag}>cosa include</span>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: C.cream }}>
              <li>Foto dei pasti riconosciute dall'IA, con calorie e nutrienti</li>
              <li>Coach che risponde guardando i tuoi dati</li>
              <li>Peso, menù, digiuno, integrazione, allenamenti, respiro, sonno e diario</li>
              <li>Statistiche complete, obiettivi e riassunti mensili dell'IA</li>
              <li>Esportazione dei tuoi dati e sincronizzazione tra dispositivi</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
