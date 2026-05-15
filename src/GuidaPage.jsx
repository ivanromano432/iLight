// Guida completa di Quercus. Accessibile dall'avatar utente in alto a destra.
// Una sezione per ognuno dei 9 mondi + statistiche, obiettivi, abbonamento, FAQ.

import { useState } from 'react';
import { getTheme } from './themes.js';

const fGaramond = '"Cormorant Garamond", serif';
const fCinzel = '"Cinzel", serif';

const SECTIONS = [
  {
    id: 'intro',
    title: 'Filosofia',
    short: 'cosa è Quercus',
    body: [
      'Quercus è una quercia. Cresce lenta, ma forte.',
      'A differenza delle app fitness che ti chiedono di contare calorie e macros ossessivamente, Quercus ti accompagna in un percorso più lento: ti osserva, ti dà spazio per scrivere a parole come stai, e usa l\'intelligenza artificiale per estrarre i dati invece di chiedertelo.',
      'L\'idea è che il benessere arrivi dalla costanza, non dal controllo. Registra anche solo 30 secondi al giorno e Quercus impara.',
    ],
  },
  {
    id: 'peso',
    title: 'I · Peso',
    short: 'pesate e composizione corporea',
    body: [
      '·Tap su "REGISTRA PESO" per aggiungere una pesata. Inserisci almeno il peso in kg.',
      '·Tap su "+ composizione corporea (RENPHO)" per aprire 3 campi opzionali: % grasso, % muscolo, % acqua. Sono quelli tipici che mostra una bilancia smart (Renpho è solo un esempio diffuso). Li copi a mano dalla bilancia, non c\'è sincronizzazione automatica.',
      '·Tap su "obiettivo" per impostare un peso target. Apparirà come linea tratteggiata bianca sul grafico statistiche.',
      '·Il grafico mostra gli ultimi 7 giorni con linea oro (peso) e tratteggiata terra (% grasso). Sotto, il banner narrativo ti dice se stai dimagrendo bene o se stai perdendo muscolo.',
      '·"✦ STATISTICHE COMPLETE" apre l\'analisi avanzata (vedi sezione Statistiche più sotto).',
    ],
  },
  {
    id: 'diario',
    title: 'II · Diario',
    short: 'la magia dell\'IA',
    body: [
      'Il diario è il cuore di Quercus. Scrivi naturale, l\'IA estrae i dati.',
      'Esempio: scrivi "stamane caffè, panino al prosciutto a pranzo, due bicchieri d\'acqua, dormito 7 ore e mezza"',
      'Tap "Registra con IA". Dopo qualche secondo, l\'IA ti propone:',
      '·Pasti riconosciuti (colazione, pranzo, etc.) con kcal stimate',
      '·Bicchieri d\'acqua del giorno',
      '·Una notte di sonno con orari approssimati',
      'Spunti quali vuoi salvare e tap su "Conferma". I dati finiscono nelle pagine giuste.',
      'Suggerimento: scrivi 1 nota al giorno, anche corta. Più materiale ha l\'IA, migliori sono le correlazioni e i riassunti mensili.',
    ],
  },
  {
    id: 'pasti',
    title: 'III · Pasti',
    short: 'pianificati e fatti',
    body: [
      'Tre tab in alto: "consigliati" / "pianificati" / "fatti".',
      '·CONSIGLIATI: chiedi all\'IA un menù della giornata. Risponde con proposte rispettose dei tuoi obiettivi.',
      '·PIANIFICATI: pasti che intendi mangiare. Tap su uno per "spostarlo a FATTI" quando l\'hai consumato.',
      '·FATTI: i pasti effettivamente consumati. Sono quelli che contano per le statistiche.',
      'Per ogni pasto: tipo (colazione, spuntino, pranzo, merenda, cena, spuntino serale), descrizione testuale, grammi opzionali, kcal/proteine/carb/grassi opzionali, foto opzionale dalla galleria o fotocamera.',
      'Suggerimento: non devi compilare tutto. Una descrizione testuale + kcal stimate è già ottimo. La foto aiuta a ricordare a posteriori.',
    ],
  },
  {
    id: 'integra',
    title: 'IV · Integra',
    short: 'integratori giornalieri',
    body: [
      'Due viste: "lista integratori" e "presi oggi".',
      '·Tap su "+ NUOVO INTEGRATORE" per aggiungere un integratore alla tua lista personale (es. Vitamina D, Magnesio). Scegli un colore per riconoscerlo a colpo d\'occhio.',
      '·Nella griglia giornaliera, tap su un integratore per segnarlo come "preso oggi". Tap di nuovo per togliere.',
      '·Lo storico dei presi è separato per ogni giorno: puoi spostarti tra giorni passati usando le frecce.',
      'Suggerimento: usa questa pagina come "checklist" della mattina, non come database medico.',
    ],
  },
  {
    id: 'allena',
    title: 'V · Allena',
    short: 'allenamenti e tipi',
    body: [
      'Prima di registrare allenamenti, hai una lista di "tipi": corsa, camminata, pesi, yoga (i 4 default), più qualunque tipo tu crei.',
      '·Tap su "GESTISCI TIPI" per aggiungere, rinominare o eliminare i tipi. Ogni tipo ha un\'unità di misura (km, min, kg, rep, m).',
      '·Tap su "REGISTRA ALLENAMENTO" per una sessione nuova. Scegli il tipo, inserisci la quantità (es. 5 km, 30 min), aggiungi note opzionali.',
      '·Lo storico mostra le sessioni in ordine temporale. Tap su una sessione per modificarla o eliminarla.',
      'Le sessioni contano per gli obiettivi "Allenamenti/settimana" nella pagina statistiche.',
    ],
  },
  {
    id: 'digiuno',
    title: 'VI · Digiuno',
    short: 'digiuno intermittente',
    body: [
      'Quercus supporta i digiuni intermittenti più comuni (16:8, 18:6, 20:4, 24h) o digiuni liberi senza obiettivo.',
      '·Tap "AVVIA DIGIUNO" → scegli durata target → il timer parte.',
      '·Vedi il timer in tempo reale: ore trascorse e ore restanti al traguardo. Una barra circolare ti mostra il progresso.',
      '·Quando vuoi interrompere, tap "INTERROMPI". Il digiuno viene chiuso e contato anche se non hai raggiunto il target.',
      '·Lo storico mostra tutti i digiuni passati con durata effettiva.',
      'Suggerimento: non saltare il digiuno se ti senti male. Quercus celebra anche i "digiuni interrotti consapevolmente" come dati validi.',
    ],
  },
  {
    id: 'respiro',
    title: 'VII · Respiro',
    short: 'sessioni mindful guidate',
    body: [
      'Sessioni guidate di respirazione/meditazione, dai 2 ai 20 minuti.',
      '·Tipi disponibili: respiro 4-7-8, respiro quadrato, meditazione guidata, pausa consapevole.',
      '·Tap "INIZIA SESSIONE" → scegli tipo e durata → segui il cerchio pulsante e gli inviti vocali.',
      '·Al termine, la sessione viene salvata. Lo storico mostra quante sessioni hai fatto in settimana.',
      'Suggerimento: usa una sessione di 5 minuti come pausa nelle giornate stressanti.',
    ],
  },
  {
    id: 'sonno',
    title: 'VIII · Sonno',
    short: 'qualità delle notti',
    body: [
      '·Tap "REGISTRA SONNO" la mattina al risveglio. Inserisci orario di "a letto", orario di "sveglia", qualità (1-5 stelle).',
      'IMPORTANTE: la "data del risveglio" è il giorno della mattinata, non della sera in cui sei andato a letto. Se vai a letto martedì sera e ti svegli mercoledì, la wake date è mercoledì.',
      '·Note opzionali per ricordare se ti sei svegliato di notte, se hai sognato qualcosa, ecc.',
      'L\'app considera un solo sonno per notte. Se registri di nuovo per la stessa data, sovrascrivi il precedente.',
      'Suggerimento: anche solo registrare gli orari basta. Le note le aggiungi quando hai voglia.',
    ],
  },
  {
    id: 'sera',
    title: 'IX · Sera',
    short: 'rituale di chiusura',
    body: [
      'Pagina di chiusura della giornata. Un riassunto di quello che hai fatto oggi: pasti consumati, bicchieri d\'acqua, allenamenti, sessioni mindful, integratori presi.',
      '·Una sezione di "riflessione serale" dove scrivi 2-3 cose: cosa è andato bene oggi, cosa migliorerei, gratitudine.',
      '·Tap "CHIUDI LA GIORNATA" per archiviare il giorno (puoi sempre riaprire e modificare).',
      'Suggerimento: usa questa pagina la sera, prima di dormire, anche solo per 2 minuti. È la pratica più sottovalutata ma di maggior impatto sulla costanza.',
    ],
  },
  {
    id: 'statistiche',
    title: '✦ Statistiche',
    short: 'trend, pattern, IA',
    body: [
      'Dalla pagina "I peso", tap "✦ STATISTICHE COMPLETE" per accedere al pannello.',
      '·Selettore periodo: 30 GIORNI / 3 MESI / 1 ANNO / SEMPRE.',
      '·TREND PESO: grafico ampio con linea peso e (se hai dati) % grasso. Linea obiettivo tratteggiata bianca se hai impostato un target. Banner "obiettivo previsto il …" stimato con regressione lineare.',
      '·OBIETTIVI: imposta target multipli (sonno ≥ 7h, allenamenti ≥ 3/settimana, idratazione ≥ 8 bicchieri, ecc.). Progress bar colorate: verde se raggiunto, oro se >75%, beige se lontano. Tap su un obiettivo per modificarlo.',
      '·COMPOSIZIONE: ultimi valori di % grasso, muscolo, acqua. Massa magra stimata calcolata.',
      '·PATTERN SETTIMANALI: bar chart con peso medio per giorno della settimana. Identifica il giorno più "leggero" e quello più "pesante".',
      '·CORRELAZIONI (IA): tap su "GENERA INSIGHTS" e l\'IA analizza le tue settimane cercando pattern utili. Es. "le settimane in cui dormi più di 7 ore perdi più peso". Serve avere almeno 2 settimane di dati.',
      '·RIASSUNTO MENSILE (IA): "GENERA RIASSUNTO" per ottenere una narrazione del mese scritta dall\'IA, tono caldo da coach.',
      '·ALTRE ABITUDINI: card numeriche con pasti, sonno medio, acqua media, allenamenti, digiuni, mindful del periodo.',
      '·ESPORTA: scarica tutti i dati in CSV (un file per categoria). Utile per dietologi, medici, o backup personale.',
    ],
  },
  {
    id: 'abbonamento',
    title: '◆ Abbonamento',
    short: 'piani e gestione',
    body: [
      'Quercus ti regala 14 giorni di prova gratuita dal momento della registrazione.',
      'Durante la prova, hai accesso a TUTTE le funzioni senza limiti.',
      'Al termine della prova:',
      '·Mensile: € 4,99/mese',
      '·Annuale: € 39/anno (risparmi 35%)',
      'Tap sull\'avatar in alto a destra → "abbonamento" per vedere il tuo stato.',
      'Pagamento e fatturazione gestiti da Stripe. Puoi annullare quando vuoi dal "↗ GESTISCI ABBONAMENTO" (apre il portale Stripe).',
      'Se non paghi al termine della prova, l\'app entra in modalità "paywall": vedi solo la pagina abbonamento finché non sottoscrivi.',
      'I dati restano salvati su cloud anche se non paghi: quando riattivi l\'abbonamento li ritrovi tutti.',
    ],
  },
  {
    id: 'faq',
    title: '? FAQ',
    short: 'domande comuni',
    body: [
      'I miei dati sono al sicuro?',
      'Sì. Tutto è salvato su Supabase (database cloud su server EU) con Row-Level Security: nessun altro utente può vedere i tuoi dati. Anche Anthropic (l\'IA) riceve solo i dati che le mando per analisi e non li conserva.',
      'Posso usarla offline?',
      'In parte. Puoi navigare le pagine ma le funzioni IA e il salvataggio richiedono internet. Senza connessione, qualche operazione potrebbe non andare a buon fine.',
      'Posso esportare i miei dati?',
      'Sì. Dalle Statistiche, tap "SCARICA CSV". Riceverai un file per ogni categoria (pesi, pasti, sonno, ecc.).',
      'Cosa succede se cancello l\'app dal telefono?',
      'I dati restano sul cloud. Basta che riapri il sito web (goalfit.it) da qualsiasi dispositivo e fai login per ritrovarli.',
      'Posso usarla su più dispositivi?',
      'Sì. È pensata proprio per essere multi-dispositivo. Login con la stessa email su iPhone, iPad, Mac, Android: ritrovi tutto sincronizzato.',
      'Come posso annullare l\'abbonamento?',
      'Tap avatar → abbonamento → "↗ GESTISCI ABBONAMENTO". Si apre il portale Stripe dove puoi annullare in 2 tap. La sub resta attiva fino alla fine del periodo già pagato, poi si chiude.',
    ],
  },
];

export default function GuidaPage({ profile, onClose }) {
  const Q = getTheme(profile?.theme);
  const [openSection, setOpenSection] = useState('intro');

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse at top, ${Q.bg1} 0%, ${Q.bg2} 100%)`, color: Q.cream, fontFamily: fGaramond, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 14, border: `1px solid ${Q.gold}40`, borderRadius: 20, pointerEvents: 'none', zIndex: 1 }} />
      <div aria-hidden style={{ position: 'absolute', inset: 20, border: `1px solid ${Q.gold}1A`, borderRadius: 16, pointerEvents: 'none', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, padding: '24px 22px 60px', maxWidth: 520, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '8px 14px', cursor: 'pointer' }}>← INDIETRO</button>
          <div style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.45em', color: Q.gold, textTransform: 'uppercase' }}>GUIDA</div>
          <div style={{ width: 70 }} />
        </div>

        {/* Intro hero */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <div style={{ fontFamily: fCinzel, fontSize: 28, letterSpacing: '0.3em', color: Q.gold, textTransform: 'uppercase' }}>QUERCUS</div>
          <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.goldDim, marginTop: 6 }}>guida completa</div>
        </div>

        {/* Lista sezioni accordion */}
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SECTIONS.map(s => {
            const open = openSection === s.id;
            return (
              <div key={s.id} style={{ border: `1px solid ${Q.gold}33` }}>
                <button onClick={() => setOpenSection(open ? null : s.id)}
                  style={{ width: '100%', background: open ? `${Q.gold}11` : 'transparent', color: Q.cream, border: 'none', padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.3em', color: Q.gold, textTransform: 'uppercase' }}>{s.title}</div>
                    <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.goldDim, marginTop: 3 }}>{s.short}</div>
                  </div>
                  <div style={{ fontFamily: fCinzel, fontSize: 14, color: Q.gold }}>{open ? '−' : '+'}</div>
                </button>
                {open && (
                  <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {s.body.map((p, i) => (
                      <div key={i} style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.cream, lineHeight: 1.55 }}>
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer con versione */}
        <div style={{ textAlign: 'center', marginTop: 40, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim }}>
          Quercus · una quercia cresce lenta ma forte
        </div>
      </div>
    </div>
  );
}
