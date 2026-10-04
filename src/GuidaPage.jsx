// Guida di GoalFit. Si apre dal menu del profilo (foto in alto a destra).
// Una voce per ogni parte dell'app, a fisarmonica.
import { useState } from 'react';
import { C, fSerif, page, column, kicker, h1, link } from './ui.js';

const SECTIONS = [
  { id: 'tasti', title: 'I cinque tasti in basso', body: [
    'In fondo allo schermo trovi sempre cinque tasti: Coach, Aggiorna, la fotocamera al centro, Pasti e Statistiche.',
    'Sono le cose che usi ogni giorno. Tutto il resto è nel menu del profilo: tocca la tua foto in alto a destra.',
  ] },
  { id: 'coach', title: 'Coach', body: [
    'È una chat con l’intelligenza artificiale. Riceve un riepilogo dei tuoi ultimi 30 giorni: peso, pasti, acqua, sonno, allenamenti, digiuni, integratori e note.',
    'Chiedigli come sta andando il peso, cosa mangiare stasera o dove puoi migliorare. La conversazione resta salvata: la ritrovi quando torni, anche da un altro dispositivo. Con "nuova conversazione" riparti da zero.',
    'Può anche modificare i dati dell’app al posto tuo: scrivigli "a pranzo ho mangiato una pizza", "stanotte ho dormito dalle 23:30 alle 6:45" o "stamattina pesavo 80" e ti propone la modifica in una finestra. Può anche mettere in piano i pasti nel Menù (\"preparami i pasti di domani\"), segnare gli integratori, aggiungere una nota al diario e correggere l’inizio del digiuno. Si applica solo se tocchi "applica", e subito dopo puoi ancora annullarla.',
    'Il coach ha una memoria: quando gli dici qualcosa di stabile su di te (un cibo che non mangi, un giorno in cui non puoi allenarti, un obiettivo) lo salva e te lo segnala sotto la risposta. Ne tiene conto anche nei consigli del Menù. Le voci, al massimo 30, le vedi, correggi e cancelli dal menu del profilo, in "Memoria del coach".',
    'Dà consigli generali: non fa diagnosi e non sostituisce medico o nutrizionista.',
  ] },
  { id: 'aggiorna', title: 'Aggiorna', body: [
    'È l’elenco delle cose di oggi, diviso per momenti della giornata. Con un tocco registri il peso, spunti un integratore, aggiungi un bicchiere d’acqua.',
    'Le altre righe (sonno, pasti, allenamento, digiuno, diario) ti portano alla pagina giusta. In alto vedi quante cose hai fatto.',
  ] },
  { id: 'foto', title: 'Fotografare un pasto', body: [
    'Il tasto tondo al centro apre il diario fotografico dei tuoi piatti. Puoi vederlo a griglia oppure come linea del giorno.',
    'Toccalo una seconda volta: compaiono tre icone per scattare una foto, sceglierla dalla libreria o prenderla da un file.',
    'Dopo la foto resti sulla pagina in cui eri: in alto compare un avviso mentre l’IA riconosce il piatto, stima quantità, calorie e nutrienti e sceglie il pasto in base all’ora. Il pasto si registra da solo; per correggerlo toccalo in Pasti.',
  ] },
  { id: 'pasti', title: 'Pasti', body: [
    'Mostra il piatto del giorno: la foto dell’ultimo pasto, le miniature degli altri, le calorie sul tuo obiettivo e proteine, carboidrati e grassi.',
    'In alto scegli il giorno tra gli ultimi sette. Tocca un pasto per modificarlo, il "+" per aggiungerne uno con foto, oppure "aggiungi un pasto senza foto".',
    'Se a un pasto mancano le calorie compare un tasto per farle calcolare all’IA.',
  ] },
  { id: 'statistiche', title: 'Statistiche', body: [
    'In una schermata: il peso con la variazione della settimana, l’andamento degli ultimi 30 giorni, quanto manca all’obiettivo e le calorie giorno per giorno.',
    'Con "tutte le statistiche" apri l’analisi completa: periodo a scelta, obiettivi personali, calendario, giorni della settimana, le letture dell’IA e l’esportazione dei dati.',
  ] },
  { id: 'peso', title: 'Peso e obiettivo', body: [
    'L’anello si riempie man mano che ti avvicini all’obiettivo. Tocca "obiettivo" sotto il numero per impostarlo o cambiarlo.',
    'Il percorso a tappe mostra partenza, tappe raggiunte, oggi, prossima tappa e obiettivo con la data stimata. Le tappe sono automatiche, una ogni 2 kg.',
    'Quando registri il peso puoi aggiungere anche grasso, muscolo e acqua letti dalla bilancia. Tocca una pesata dell’elenco per correggerla o eliminarla.',
  ] },
  { id: 'menu', title: 'Menù e dieta a zona', body: [
    'Il cerchio è il tuo piatto a zona: 40% carboidrati, 30% proteine, 30% grassi. Ogni spicchio si riempie quando copri quel nutriente. Tocca il centro per cambiare gli obiettivi.',
    'Sotto trovi i pasti di oggi, a schede o come linea del giorno. Quelli "in piano" li segni come mangiati con un tocco.',
    'Con "chiedi suggerimenti all’IA" ricevi proposte di pasti che completano la giornata: le aggiungi al menù con un tocco.',
  ] },
  { id: 'digiuno', title: 'Digiuno', body: [
    'Scegli un protocollo (intermittente, prolungato o su misura) e il timer parte. L’anello mostra il tempo trascorso e quanto manca; sotto vedi le fasi, con quella in corso spiegata.',
    'Puoi correggere l’orario di inizio e, a digiuno concluso, modificarlo o eliminarlo dallo storico.',
    'Il digiuno non è adatto in gravidanza, allattamento, diabete, disturbi del comportamento alimentare, sottopeso o se assumi farmaci. Oltre le 24 ore parla con il tuo medico; oltre le 72 ore sconsigliamo di procedere senza supervisione medica.',
  ] },
  { id: 'integrazione', title: 'Integrazione', body: [
    'Aggiungi i tuoi integratori e spuntali quando li prendi. Il calendario mostra gli ultimi 28 giorni: pieno se li hai presi tutti, bordo oro se solo alcuni.',
    'Tocca un giorno per correggerlo. La freccia accanto a un integratore serve per rinominarlo o eliminarlo.',
  ] },
  { id: 'allenamenti', title: 'Allenamenti', body: [
    'Ogni attività ha la sua scheda con ultima sessione, totale degli ultimi 30 giorni e tendenza.',
    '"Registra allenamento" ti fa scegliere l’attività e inserire la sessione. Tocca una scheda per vedere lo storico o modificare l’attività; con "nuova attività" ne crei una e scegli come si misura.',
  ] },
  { id: 'respiro', title: 'Respiro', body: [
    'Respirazione quadrata: inspira, trattieni, espira, riposa, quattro secondi per fase. Scegli 1, 3, 5 o 10 minuti e segui il cerchio.',
    'A fine tempo la sessione si salva da sola. Puoi anche registrare a mano meditazione, camminata o gratitudine.',
  ] },
  { id: 'sonno', title: 'Sonno', body: [
    'Registra la notte al risveglio: orario in cui sei andato a letto, orario della sveglia e qualità da 1 a 5.',
    'La data è quella del mattino in cui ti svegli. Trovi le medie a 7 e 30 giorni e le ultime sette notti; tocca una notte per correggerla.',
  ] },
  { id: 'diario', title: 'Diario', body: [
    'È la cronologia automatica della giornata: pesate, pasti, movimento, respiro e note in ordine di orario.',
    'Puoi aggiungere una nota a mano e far leggere tutto all’IA con "analizza tutto": ti dice a che punto sei, su cosa concentrarti e cosa fare.',
  ] },
  { id: 'abbonamento', title: 'Abbonamento', body: [
    'Hai 14 giorni di prova gratuita con tutte le funzioni, senza carta.',
    'Poi scegli tra due piani. GoalFit: € 6,90 al mese o € 69 all’anno, con tutte le funzioni e ogni giorno 30 messaggi al coach, 15 foto di pasti analizzate e 20 analisi. Premium: € 9,90 al mese o € 99 all’anno, con 150 messaggi al coach, 60 foto e 80 analisi al giorno. Il pagamento è gestito da Stripe e puoi annullare quando vuoi da "gestisci abbonamento".',
    'Se la prova scade senza abbonamento l’app mostra solo la pagina dei piani, ma i tuoi dati restano salvati: li ritrovi appena ti abboni.',
  ] },
  { id: 'faq', title: 'Domande frequenti', body: [
    'I miei dati sono al sicuro? Sono salvati nel database dell’app e legati al tuo account: nessun altro utente può vederli. All’IA arrivano solo i dati necessari per risponderti.',
    'Posso usarla su più dispositivi? Sì: accedi con la stessa email e ritrovi tutto.',
    'Funziona senza connessione? Solo in parte: per salvare e per le funzioni dell’IA serve internet.',
    'Posso esportare i miei dati? Sì, da "tutte le statistiche", con "scarica i dati".',
    'Come elimino l’account? Dal Profilo, in fondo alla pagina. La cancellazione è definitiva.',
    'Non vedo le ultime novità: chiudi e riapri l’app. Il numero di versione è nel menu del profilo, sotto Abbonamento.',
  ] },
];

export default function GuidaPage({ onClose }) {
  const [openSection, setOpenSection] = useState('tasti');
  return (
    <div style={page}>
      <div style={column}>
        <button onClick={onClose} style={{ ...link, minHeight: 44 }}>‹ indietro</button>
        <div style={kicker}>come usare GoalFit</div>
        <h1 style={h1}>Guida</h1>
        <div style={{ marginTop: 14 }}>
          {SECTIONS.map(s => {
            const open = openSection === s.id;
            return (
              <div key={s.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                <button onClick={() => setOpenSection(open ? null : s.id)} aria-expanded={open}
                  style={{ width: '100%', minHeight: 54, background: 'transparent', color: C.cream, border: 'none', padding: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                  <span style={{ fontFamily: fSerif, fontSize: 22, fontWeight: 500, lineHeight: 1.15 }}>{s.title}</span>
                  <span aria-hidden="true" style={{ fontSize: 22, color: C.gold, flexShrink: 0 }}>{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {s.body.map((p, i) => (<p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: C.dim }}>{p}</p>))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
