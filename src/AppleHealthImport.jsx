// Import dati da Apple Health.
// Accetta:
//   - export.zip (esportazione completa: Salute > icona profilo > "Esporta tutti i dati Salute")
//   - export.xml (file gia' estratto dal .zip)
//
// Estrae i Record dei tipi:
//   HKQuantityTypeIdentifierBodyMass            -> weight (kg)
//   HKQuantityTypeIdentifierBodyFatPercentage   -> bodyFat (%)
//   HKQuantityTypeIdentifierLeanBodyMass        -> muscle (kg)
//
// Aggrega per timestamp a granularita' minuto (stesso minuto = stesso record).
// Confronta con existingWeights e importa solo i timestamp nuovi.

import { useState } from 'react';
import JSZip from 'jszip';
import { getTheme } from './themes.js';
import { supabase } from './supabase.js';

const fGaramond = '"Cormorant Garamond", serif';
const fCinzel = '"Cinzel", serif';

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return (Date.now() + Math.random()).toString();
}

// Parsa "2024-01-15 08:30:42 +0100" -> Date
function parseAppleDate(s) {
  if (!s) return null;
  // primo spazio (data/ora) -> T, secondo spazio (ora/offset) -> niente
  const iso = s.replace(' ', 'T').replace(' ', '');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// Tronca un Date al minuto (per dedup)
function minuteKey(d) {
  const x = new Date(d.getTime());
  x.setSeconds(0, 0);
  return x.toISOString();
}

// Estrae attributi da una stringa tipo `type="X" value="Y"`
function parseAttrs(attrStr) {
  const out = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    out[m[1]] = m[2];
  }
  return out;
}

// Da una stringa XML estrae array di {type, ts, value, unit}
function extractRecords(xmlString) {
  const TARGETS = new Set([
    'HKQuantityTypeIdentifierBodyMass',
    'HKQuantityTypeIdentifierBodyFatPercentage',
    'HKQuantityTypeIdentifierLeanBodyMass',
  ]);
  const out = [];
  // <Record ... /> oppure <Record ...>...</Record> — ci basta lo start tag
  const re = /<Record\s+([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(xmlString)) !== null) {
    const a = parseAttrs(m[1]);
    if (!TARGETS.has(a.type)) continue;
    const d = parseAppleDate(a.startDate || a.creationDate || a.endDate);
    if (!d) continue;
    const v = parseFloat(a.value);
    if (isNaN(v)) continue;
    out.push({ type: a.type, ts: d, value: v, unit: a.unit || '' });
  }
  return out;
}

// Converte unita' nel formato che usa l'app
function normalize(rec) {
  const u = (rec.unit || '').toLowerCase();
  if (rec.type === 'HKQuantityTypeIdentifierBodyMass' || rec.type === 'HKQuantityTypeIdentifierLeanBodyMass') {
    // kg standard. lb -> kg
    if (u === 'lb' || u === 'lbs') return rec.value * 0.45359237;
    return rec.value;
  }
  if (rec.type === 'HKQuantityTypeIdentifierBodyFatPercentage') {
    // Apple usa di solito frazione (0.18 = 18%). Se < 1 -> *100.
    if (rec.value > 0 && rec.value < 1) return rec.value * 100;
    return rec.value;
  }
  return rec.value;
}

// Aggrega records per minuteKey -> {ts, weight, bodyFat, muscle}
function aggregate(records) {
  const map = new Map();
  for (const r of records) {
    const k = minuteKey(r.ts);
    if (!map.has(k)) map.set(k, { ts: r.ts.toISOString(), weight: null, bodyFat: null, muscle: null });
    const slot = map.get(k);
    const v = normalize(r);
    if (r.type === 'HKQuantityTypeIdentifierBodyMass') slot.weight = v;
    else if (r.type === 'HKQuantityTypeIdentifierBodyFatPercentage') slot.bodyFat = v;
    else if (r.type === 'HKQuantityTypeIdentifierLeanBodyMass') slot.muscle = v;
  }
  // Tieni solo quelli con peso (BodyFat/Lean senza peso non sono utili al diario peso)
  return Array.from(map.values()).filter(x => x.weight != null);
}

export default function AppleHealthImport({ profile, existingWeights, onImport, onClose }) {
  const Q = getTheme(profile?.theme);

  const [stage, setStage] = useState('idle'); // 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState({ all: [], newOnes: [], skipped: 0, withBf: 0, withMuscle: 0 });

  async function readFile(file) {
    setError('');
    setStage('parsing');
    try {
      const lower = (file.name || '').toLowerCase();
      const isZipLike = lower.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
      const isXmlLike = lower.endsWith('.xml') || file.type === 'text/xml' || file.type === 'application/xml';

      let xmlString;

      if (isXmlLike && !isZipLike) {
        xmlString = await file.text();
      } else {
        // Trattiamo qualsiasi cosa che non sia chiaramente .xml come ZIP (anche file senza estensione su iOS)
        const buf = await file.arrayBuffer();
        let zip;
        try {
          zip = await JSZip.loadAsync(buf);
        } catch (zipErr) {
          throw new Error('Non riesco ad aprire il file come ZIP. Assicurati di aver caricato export.zip (o export.xml estratto) dall\'app Salute.');
        }

        // Raccoglie TUTTI i file dentro lo zip
        const allFiles = [];
        zip.forEach((path, e) => { if (!e.dir) allFiles.push({ path, entry: e }); });

        // 1) Cerca export.xml preciso (qualsiasi cartella)
        let entry = allFiles.find(f => /(^|\/)export\.xml$/i.test(f.path))?.entry;

        // 2) Se non trovato, cerca un .xml che NON sia export_cda.xml (CDA è inutile)
        if (!entry) {
          entry = allFiles.find(f => /\.xml$/i.test(f.path) && !/_cda\.xml$/i.test(f.path))?.entry;
        }

        // 3) Se ancora niente, vedi se c'e' uno zip annidato (Apple a volte fa export.zip > apple_health_export.zip)
        if (!entry) {
          const innerZipEntry = allFiles.find(f => /\.zip$/i.test(f.path));
          if (innerZipEntry) {
            try {
              const innerBuf = await innerZipEntry.entry.async('arraybuffer');
              const innerZip = await JSZip.loadAsync(innerBuf);
              const innerFiles = [];
              innerZip.forEach((p, e) => { if (!e.dir) innerFiles.push({ path: p, entry: e }); });
              entry = innerFiles.find(f => /(^|\/)export\.xml$/i.test(f.path))?.entry
                   || innerFiles.find(f => /\.xml$/i.test(f.path) && !/_cda\.xml$/i.test(f.path))?.entry;
            } catch (_) { /* ignora */ }
          }
        }

        if (!entry) {
          const sample = allFiles.slice(0, 5).map(f => f.path).join(', ') || '(zip vuoto)';
          throw new Error(`Nessun file XML trovato nello zip. Contenuto: ${sample}${allFiles.length > 5 ? '...' : ''}. Verifica di aver scelto l'esportazione di Apple Salute (Salute > tuo profilo > Esporta tutti i dati Salute).`);
        }

        xmlString = await entry.async('string');
      }

      if (!xmlString || xmlString.length < 100) {
        throw new Error('Il file XML e\' vuoto o corrotto.');
      }

      const records = extractRecords(xmlString);
      if (records.length === 0) {
        throw new Error('Nessun dato di peso, percentuale di grasso o massa magra trovato. Verifica di aver registrato pesate nell\'app Salute.');
      }
      const all = aggregate(records).sort((a, b) => new Date(a.ts) - new Date(b.ts));

      // Dedup contro existingWeights (per minuteKey)
      const existingKeys = new Set((existingWeights || []).map(e => minuteKey(new Date(e.ts))));
      const newOnes = all.filter(x => !existingKeys.has(minuteKey(new Date(x.ts))));

      const withBf = newOnes.filter(x => x.bodyFat != null).length;
      const withMuscle = newOnes.filter(x => x.muscle != null).length;

      setParsed({ all, newOnes, skipped: all.length - newOnes.length, withBf, withMuscle });
      setStage('preview');
    } catch (e) {
      console.error('[apple health import]', e);
      setError(e.message || 'Errore durante la lettura del file');
      setStage('error');
    }
  }

  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function doImport() {
    setStage('importing');
    setProgress({ done: 0, total: parsed.newOnes.length });
    try {
      if (!profile?.id) throw new Error('Profilo non disponibile. Riprova dopo aver effettuato di nuovo l\'accesso.');

      // Costruisco le righe direttamente nel formato DB
      const allRows = parsed.newOnes.map(x => ({
        id: newId(),
        user_id: profile.id,
        ts: x.ts,
        weight: Math.round(x.weight * 10) / 10,
        body_fat: x.bodyFat != null ? Math.round(x.bodyFat * 10) / 10 : null,
        muscle: x.muscle != null ? Math.round(x.muscle * 10) / 10 : null,
        body_water: null,
      }));

      // Insert a batch di 100 righe per evitare payload enormi
      const CHUNK_SIZE = 100;
      const errors = [];
      let inserted = 0;
      for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
        const chunk = allRows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('weights').insert(chunk);
        if (error) {
          console.error('[apple health import] chunk error', i, error);
          errors.push(`batch ${Math.floor(i / CHUNK_SIZE) + 1}: ${error.message || 'errore sconosciuto'}`);
          // Fermo dopo 3 errori per non spammare
          if (errors.length >= 3) {
            errors.push(`(altri batch saltati dopo ${errors.length} errori)`);
            break;
          }
        } else {
          inserted += chunk.length;
        }
        setProgress({ done: inserted, total: allRows.length });
      }

      if (errors.length > 0 && inserted === 0) {
        throw new Error(`Nessuna pesata salvata. Primo errore: ${errors[0]}`);
      }

      // Aggiorno lo state locale dell'app con quelle effettivamente salvate
      const savedAppFormat = allRows.slice(0, inserted).map(r => ({
        id: r.id, ts: r.ts, weight: r.weight, bodyFat: r.body_fat, muscle: r.muscle, water: r.body_water,
      }));
      if (onImport) await onImport(savedAppFormat);

      setProgress({ done: inserted, total: allRows.length });
      if (errors.length > 0) {
        setError(`${inserted} pesate salvate, ${allRows.length - inserted} fallite.\n\nDettagli:\n${errors.join('\n')}`);
        setStage('error');
      } else {
        setStage('done');
      }
    } catch (e) {
      console.error('[apple health import] save', e);
      setError('Errore nel salvataggio: ' + (e.message || 'sconosciuto'));
      setStage('error');
    }
  }

  function onPick(e) {
    const f = e.target.files?.[0];
    if (f) readFile(f);
    e.target.value = '';
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, ${Q.bg1} 0%, ${Q.bg2} 100%)`,
      color: Q.cream,
      padding: '40px 24px 60px',
      fontFamily: fGaramond,
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: fCinzel,
            fontSize: 11,
            letterSpacing: '0.4em',
            color: Q.goldDim,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            ✦ IMPORTAZIONE ✦
          </div>
          <h1 style={{
            fontFamily: fGaramond,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 32,
            color: Q.gold,
            margin: 0,
            letterSpacing: '0.02em',
          }}>
            da Apple Salute
          </h1>
        </div>

        {/* IDLE: upload */}
        {stage === 'idle' && (
          <div>
            <p style={{ fontSize: 16, lineHeight: 1.55, color: Q.cream, marginBottom: 18 }}>
              Importa le tue pesate da <em>Apple Salute</em>. Vengono presi peso, percentuale di grasso e massa magra (kg).
            </p>
            <div style={{
              background: `${Q.gold}0D`,
              border: `1px solid ${Q.gold}22`,
              padding: '18px 18px',
              marginBottom: 22,
            }}>
              <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 10 }}>
                Come esportare
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6, color: Q.cream }}>
                <li>Apri l'app <strong>Salute</strong> su iPhone</li>
                <li>Tocca la tua immagine in alto a destra</li>
                <li>Scorri in fondo: <em>Esporta tutti i dati Salute</em></li>
                <li>Condividi il file <code style={{ color: Q.gold }}>export.zip</code> con te stesso (Mail, AirDrop, File)</li>
                <li>Caricalo qui sotto</li>
              </ol>
            </div>

            <label style={{
              display: 'block',
              textAlign: 'center',
              padding: '18px 20px',
              background: 'transparent',
              color: Q.gold,
              border: `1px dashed ${Q.gold}88`,
              fontFamily: fCinzel,
              fontSize: 11,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}>
              ✦ scegli export.zip o export.xml
              <input
                type="file"
                accept=".zip,.xml,application/zip,application/x-zip-compressed,text/xml,application/xml"
                onChange={onPick}
                style={{ display: 'none' }}
              />
            </label>

            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <button onClick={onClose} style={{
                background: 'transparent',
                color: Q.goldDim,
                border: 'none',
                fontFamily: fCinzel,
                fontSize: 10,
                letterSpacing: '0.35em',
                padding: '8px 16px',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}>
                annulla
              </button>
            </div>
          </div>
        )}

        {/* PARSING */}
        {stage === 'parsing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 18, color: Q.gold }}>
              lettura del file in corso...
            </div>
            <div style={{ fontSize: 13, color: Q.goldDim, marginTop: 8 }}>
              file grandi possono richiedere qualche secondo
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {stage === 'preview' && (
          <div>
            <div style={{
              background: `${Q.gold}10`,
              border: `1px solid ${Q.gold}33`,
              padding: '20px 18px',
              marginBottom: 22,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', color: Q.goldDim, textTransform: 'uppercase' }}>
                  PESATE TOTALI TROVATE
                </span>
                <span style={{ fontFamily: fGaramond, fontSize: 24, color: Q.gold }}>{parsed.all.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', color: Q.goldDim, textTransform: 'uppercase' }}>
                  NUOVE DA IMPORTARE
                </span>
                <span style={{ fontFamily: fGaramond, fontSize: 24, color: '#A5B889' }}>{parsed.newOnes.length}</span>
              </div>
              {parsed.skipped > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <span style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', color: Q.goldDim, textTransform: 'uppercase' }}>
                    GIA' PRESENTI (saltate)
                  </span>
                  <span style={{ fontFamily: fGaramond, fontSize: 18, color: Q.goldDim }}>{parsed.skipped}</span>
                </div>
              )}
              {(parsed.withBf > 0 || parsed.withMuscle > 0) && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${Q.gold}22`, fontSize: 13, color: Q.cream }}>
                  {parsed.withBf > 0 && <div>✦ {parsed.withBf} con % grasso</div>}
                  {parsed.withMuscle > 0 && <div style={{ marginTop: 4 }}>✦ {parsed.withMuscle} con massa magra</div>}
                </div>
              )}
            </div>

            {parsed.newOnes.length > 0 ? (
              <>
                <div style={{ fontSize: 13, fontStyle: 'italic', color: Q.cream, textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>
                  Prima pesata: <span style={{ color: Q.gold }}>{new Date(parsed.newOnes[0].ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <br />Ultima pesata: <span style={{ color: Q.gold }}>{new Date(parsed.newOnes[parsed.newOnes.length - 1].ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <button onClick={doImport} style={{
                  width: '100%',
                  background: Q.gold,
                  color: Q.ink,
                  border: 'none',
                  fontFamily: fCinzel,
                  fontSize: 11,
                  letterSpacing: '0.35em',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}>
                  ✦ importa {parsed.newOnes.length} pesate
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: 15, color: Q.goldDim, padding: '12px 0 24px' }}>
                Tutti i dati sono gia' presenti nel tuo diario.
              </div>
            )}

            <button onClick={onClose} style={{
              width: '100%',
              background: 'transparent',
              color: Q.goldDim,
              border: `1px solid ${Q.gold}33`,
              fontFamily: fCinzel,
              fontSize: 10,
              letterSpacing: '0.35em',
              padding: '12px 20px',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}>
              annulla
            </button>
          </div>
        )}

        {/* IMPORTING */}
        {stage === 'importing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 18, color: Q.gold }}>
              salvataggio in corso...
            </div>
            {progress.total > 0 && (
              <>
                <div style={{ marginTop: 14, fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.3em', color: Q.goldDim }}>
                  {progress.done} / {progress.total}
                </div>
                <div style={{ marginTop: 12, width: '80%', maxWidth: 320, margin: '12px auto 0', height: 4, background: `${Q.gold}22`, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((progress.done / progress.total) * 100)}%`, height: '100%', background: Q.gold, transition: 'width 0.2s' }} />
                </div>
              </>
            )}
          </div>
        )}

        {/* DONE */}
        {stage === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              fontFamily: fCinzel,
              fontSize: 11,
              letterSpacing: '0.4em',
              color: '#A5B889',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}>
              ✦ importazione completata ✦
            </div>
            <p style={{ fontSize: 18, fontStyle: 'italic', color: Q.cream, marginBottom: 30 }}>
              {parsed.newOnes.length} pesate aggiunte al tuo diario.
            </p>
            <button onClick={onClose} style={{
              background: Q.gold,
              color: Q.ink,
              border: 'none',
              fontFamily: fCinzel,
              fontSize: 11,
              letterSpacing: '0.35em',
              padding: '14px 28px',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}>
              ✦ chiudi
            </button>
          </div>
        )}

        {/* ERROR */}
        {stage === 'error' && (
          <div>
            <div style={{
              background: Q.cream,
              border: `2px solid ${Q.ink}`,
              padding: '18px 18px',
              marginBottom: 22,
              fontSize: 15,
              color: Q.ink,
              lineHeight: 1.5,
              fontFamily: fGaramond,
            }}>
              <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: Q.ink, opacity: 0.6, marginBottom: 8 }}>
                ⚠ errore
              </div>
              {error}
            </div>
            <button onClick={() => { setStage('idle'); setError(''); }} style={{
              width: '100%',
              background: 'transparent',
              color: Q.gold,
              border: `1px solid ${Q.gold}88`,
              fontFamily: fCinzel,
              fontSize: 10,
              letterSpacing: '0.35em',
              padding: '12px 20px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              riprova
            </button>
            <button onClick={onClose} style={{
              width: '100%',
              background: 'transparent',
              color: Q.goldDim,
              border: 'none',
              fontFamily: fCinzel,
              fontSize: 10,
              letterSpacing: '0.35em',
              padding: '10px 20px',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}>
              annulla
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
