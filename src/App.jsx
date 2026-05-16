import { useState, useEffect, useMemo, useRef, lazy } from 'react';
import {
  weightsRepo, profileRepo, waterRepo, sleepsRepo, diaryRepo, mealsRepo,
  workoutsRepo, workoutTypesRepo, supplementsRepo, suppTakenRepo, mindfulRepo, fastsRepo,
  goalsRepo,
} from './repo.js';
// Lazy-loaded: queste pagine sono pesanti e/o usate solo on-demand → chunk separati per ridurre il bundle iniziale
const StatistichePage = lazy(() => import('./Statistiche.jsx'));
const SubscriptionPage = lazy(() => import('./SubscriptionPage.jsx'));
const ProfileSetup = lazy(() => import('./ProfileSetup.jsx'));
const GuidaPage = lazy(() => import('./GuidaPage.jsx'));
const ProfilePage = lazy(() => import('./ProfilePage.jsx'));
const LayoutPage = lazy(() => import('./LayoutPage.jsx'));
// Onboarding componente lazy; le helper sincrone arrivano da un file dedicato (vedi onboardingHelpers.js)
const Onboarding = lazy(() => import('./Onboarding.jsx'));
import { hasSeenOnboarding, markOnboardingSeen } from './onboardingHelpers.js';
import { uploadMealPhoto as uploadMealPhotoToStorage, deleteMealPhoto as deleteMealPhotoFromStorage } from './photoStorage.js';
import { getTheme } from './themes.js';
import { supabase } from './supabase.js';

const Q = { bg1: '#3A2818', bg2: '#1F140C', gold: '#C9A876', goldDim: '#8B7355', cream: '#E8D8B8', ink: '#1F140C' };
const W = { bg: '#E8E0D2', ink: '#3C3329', tan: '#8C6A4E' };
const J = { bg: '#E5E3D5', dark: '#2D3A2E', sage: '#5C6B4E', light: '#8FA288' };
const A = { bg1: '#F4F0E6', bg2: '#E8E2D2', ink: '#1F2724', sage: '#4A5C4D' };
const T = { bg: '#F2EBDC', ink: '#1F1A12', dim: '#6B5D45' };
const S = { bg1: '#1E1A2E', bg2: '#0F0D1A', silver: '#B8B0C9', pale: '#F2E8D0', gold: '#C9A876', dim: '#6B6478' };
const N = { bg1: '#2C3340', bg2: '#14171F', cream: '#F2E8D0', dim: '#8A8270', gold: '#C9A876', body: '#DDD3C2' };
const NAV = { bg: '#1A1108', border: '#3A2818', dim: '#6B5D45', gold: '#C9A876', cream: '#E8D8B8' };
const M = { bg1: '#EAE6D2', bg2: '#D8D4C0', ink: '#3A4339', accent: '#7A8E78', dim: '#9CA194', cream: '#F4F1E5' };
const D = { bg1: '#1F2228', bg2: '#0E1115', cream: '#E8E4D5', accent: '#C9A876', amber: '#D4A23E', dim: '#6B6478', active: '#A8826E', danger: '#C99A7A' };
const SUPP_COLORS = ['#4A5C4D','#A0524C','#C9A876','#5C6B7E','#8B5E83','#7A8C5E','#A8826E','#6B4A3D'];

const fCinzel = "'Cinzel',serif", fGaramond = "'EB Garamond',serif", fCardo = "'Cardo',serif", fCaveat = "'Caveat',cursive";
const fMarcellus = "'Marcellus',serif", fBodoni = "'Bodoni Moda',serif", fCormorant = "'Cormorant Garamond',serif";
const fFraunces = "'Fraunces',serif", fDmSans = "'DM Sans',sans-serif";

function useGoogleFonts() {
  useEffect(() => {
    if (document.getElementById('app-fonts-v5')) return;
    const link = document.createElement('link'); link.id = 'app-fonts-v5'; link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Cardo:ital,wght@0,400;1,400&family=Caveat:wght@500;700&family=Marcellus&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,400&family=DM+Sans:wght@400;500&display=swap';
    document.head.appendChild(link);
  }, []);
}

const hasSt = () => typeof window !== 'undefined' && window.storage;
async function sGet(k){ if(!hasSt())return null; try{const r=await window.storage.get(k); return r?.value??null;}catch(_){return null;} }
async function sSet(k,v){ if(!hasSt())return false; try{await window.storage.set(k,v); return true;}catch(_){return false;} }
async function sDel(k){ if(!hasSt())return false; try{await window.storage.delete(k); return true;}catch(_){return false;} }
function safeParse(s, fb){ if(!s)return fb; try{return JSON.parse(s);}catch(_){return fb;} }

function fmt(n,d=1){ if(n==null||isNaN(n))return '—'; return Number(n).toFixed(d).replace('.',','); }
function fmt0(n){ if(n==null||isNaN(n))return '—'; return Math.round(Number(n)).toString(); }
function parseNum(s,min,max){ if(s==null||s==='')return null; const n=parseFloat(String(s).replace(',','.')); if(isNaN(n)||n<min||n>max)return null; return Math.round(n*100)/100; }
function sameDay(a,b){ return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function dayKey(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseDayKey(k){
  const [y,m,d] = k.split('-').map(Number);
  return new Date(y, m - 1, d); // m da 1-based (ISO) a 0-based (Date constructor)
}
function timeOfDay(d){ const h=d.getHours(); if(h<5)return 'notte'; if(h<12)return 'mattina'; if(h<18)return 'pomeriggio'; return 'sera'; }
function durHours(b,w){ if(!b||!w)return null; const [bh,bm]=b.split(':').map(Number); const [wh,wm]=w.split(':').map(Number); if([bh,bm,wh,wm].some(isNaN))return null; const bM=bh*60+bm; let wM=wh*60+wm; if(wM<=bM)wM+=1440; return (wM-bM)/60; }
function fmtDur(h){ if(h==null)return '—'; const hh=Math.floor(h); const mm=Math.round((h-hh)*60); return `${hh}h ${String(mm).padStart(2,'0')}`; }
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString() + Math.random().toString(36).slice(2,6));

async function resizeImage(file, max=480, q=0.7){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=e=>{ const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); const s=Math.min(max/img.width,max/img.height,1); c.width=Math.round(img.width*s); c.height=Math.round(img.height*s); c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',q)); }; img.onerror=rej; img.src=e.target.result; };
    r.onerror=rej; r.readAsDataURL(file);
  });
}

async function suggestMeals(habitsSummary, avoidList = []){
  const variations = [
    'con focus su proteine magre e verdure di stagione',
    'con piatti veloci da preparare in meno di 15 minuti',
    'con cucina mediterranea tradizionale italiana',
    'con sapori freschi, crudi e leggeri',
    'con piatti caldi, comfort food sano',
    'con preparazioni etniche bilanciate (asiatiche, mediorientali, sudamericane)',
    'con focus su grassi buoni (avocado, frutta secca, pesce azzurro)',
    'con piatti unici completi a base di legumi e cereali integrali',
    'con cucina povera contadina rivisitata in chiave light',
    'con un occhio alla colazione salata e proteica all\'inglese o americana',
    'con piatti freddi tipo bowl, poke o insalate elaborate',
    'con preparazioni al forno e cotture lunghe',
  ];
  const variation = variations[Math.floor(Math.random()*variations.length)];
  const avoidStr = avoidList.length > 0
    ? `\n\nIMPORTANTE: NON proporre nessuno dei seguenti pasti già suggeriti in precedenza (proponi pasti diversi, ingredienti diversi, stili diversi):\n- ${avoidList.slice(-20).join('\n- ')}`
    : '';
  const seed = Math.random().toString(36).slice(2,8);
  const prompt = `Sei un nutrizionista. Analizza queste abitudini alimentari di un utente che vuole dimagrire mantenendo macronutrienti bilanciati. Proponi 6 pasti concreti (mix di colazioni, spuntini, pranzi, merende, cene) coerenti con la cucina italiana ma con varietà.

QUESTA VOLTA, dai un focus particolare ${variation}. (id richiesta: ${seed})

Rispondi SOLO con JSON:
{
  "meals": [
    {
      "type": "colazione" | "spuntino_m" | "pranzo" | "merenda" | "cena" | "spuntino_s",
      "description": "<descrizione concreta in italiano, es. 'Insalata di pollo con avocado e pomodorini'>",
      "qty_g": <int peso totale stimato>,
      "kcal": <int>,
      "p": <num proteine in g>,
      "c": <num carboidrati in g>,
      "g": <num grassi in g>,
      "perche": "<una frase breve sul perché aiuta a dimagrire>"
    }
  ]
}

Vincoli:
- Calorie totali giornaliere se tutti i pasti consumati: idealmente 1500-1800 kcal per dimagrire
- Proteine alte (1.6-2g per kg di peso ideale)
- Pasti realistici e veloci da preparare in Italia
- Variazione rispetto alle abitudini abituali se troppo squilibrate
- VARIETÀ: proponi ingredienti, preparazioni e stili diversi rispetto a quanto già suggerito

Abitudini dell'utente:
${habitsSummary}${avoidStr}`;
  try {
    const res = await fetch("/api/anthropic",{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:2500, system:"Sei un nutrizionista italiano creativo. Rispondi SEMPRE e SOLO con JSON valido. Proponi sempre pasti vari e diversi tra richieste.", messages:[{role:"user",content:prompt}] })});
    if (!res.ok) { let detail=''; try { const j=await res.json(); detail = j?.error?.message || (typeof j?.error === 'string' ? j.error : null) || j?.message || JSON.stringify(j); } catch(_) { detail = await res.text().catch(()=>'') } throw new Error('HTTP '+res.status+' '+(detail||'unknown')); }
    const data = await res.json();
    const txt = data.content?.find(c=>c.type==='text')?.text || '';
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a===-1 || b===-1) throw new Error('Risposta non valida');
    const p = JSON.parse(txt.slice(a,b+1));
    const meals = Array.isArray(p.meals) ? p.meals.map(m=>({ type:String(m.type||'pranzo'), description:String(m.description||''), qty_g:m.qty_g!=null?Number(m.qty_g):null, kcal:m.kcal!=null?Number(m.kcal):null, p:m.p!=null?Number(m.p):null, c:m.c!=null?Number(m.c):null, g:m.g!=null?Number(m.g):null, perche:String(m.perche||'') })) : [];
    return { meals };
  } catch (e) { return { error: e.message || 'Errore' }; }
}

// Stima kcal/proteine/carbo/grassi di un pasto a partire da descrizione, quantità in grammi e foto opzionale.
// Se è presente solo la foto (no descrizione né quantità), l'AI identifica il nome del cibo e stima la quantità.
async function estimateMealNutrition({ description, qty_g, photo }) {
  const desc = (description || '').trim();
  if (!desc && !photo) return { error: 'Servono almeno descrizione o foto.' };
  const hasDesc = !!desc;
  const hasQty = qty_g!=null && qty_g!=='' && !isNaN(qty_g);
  const qtyTxt = hasQty ? `${qty_g} g` : '(da stimare tu dalla foto)';
  const photoOnly = !!photo && !hasDesc;
  const promptText = photoOnly
    ? `Sei un nutrizionista italiano. Analizza la foto del pasto allegata.

Devi:
1. Identificare il piatto/alimento principale (nome breve e descrittivo in italiano, es. "Spaghetti alla carbonara", "Insalata di pollo", "Pizza margherita")
2. Stimare la quantità in grammi guardando la porzione nella foto
3. Calcolare i valori nutrizionali per quella quantità stimata

Rispondi SOLO con JSON valido nella forma:
{"name": "<nome del piatto in italiano>", "qty_g": <int grammi stimati>, "kcal": <int>, "p": <num>, "c": <num>, "g": <num>, "note": "<breve nota di 5-10 parole su come hai stimato>"}

p = proteine in grammi, c = carboidrati in grammi, g = grassi in grammi. Niente testo prima o dopo.`
    : `Sei un nutrizionista italiano. Stima i valori nutrizionali del seguente pasto.

Descrizione: ${desc || '(vedi foto)'}
Quantità: ${qtyTxt}

Considera porzione, cottura e preparazione tipica italiana. Sii preciso ma realista.
${photo ? 'Usa anche la foto allegata come riferimento visivo per stimare le porzioni.' : ''}
${!hasQty ? 'Stima tu la quantità in grammi e includila nel campo qty_g.' : ''}

Rispondi SOLO con JSON valido nella forma:
{"qty_g": <int grammi${hasQty?' (uguale a '+qty_g+')':' stimati'}>, "kcal": <int>, "p": <num>, "c": <num>, "g": <num>, "note": "<breve nota di 5-10 parole su come hai stimato>"}

p = proteine in grammi, c = carboidrati in grammi, g = grassi in grammi. Niente testo prima o dopo.`;

  // Costruisci il content del messaggio: se c'è foto, usa formato multimodale
  let content;
  if (photo && typeof photo === 'string' && photo.startsWith('data:image/')) {
    // Estrai mime type e base64 da data URL
    const m = photo.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (m) {
      content = [
        { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
        { type: 'text', text: promptText },
      ];
    } else {
      content = promptText;
    }
  } else {
    content = promptText;
  }

  try {
    const res = await fetch('/api/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: 'Sei un nutrizionista italiano. Rispondi SEMPRE e SOLO con JSON valido. Niente testo extra.',
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j?.error?.message || j?.message || JSON.stringify(j); } catch(_) { detail = await res.text().catch(()=>'') }
      throw new Error('HTTP ' + res.status + ' ' + (detail || ''));
    }
    const data = await res.json();
    const txt = data.content?.find(c=>c.type==='text')?.text || '';
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('Risposta IA non valida');
    const parsed = JSON.parse(txt.slice(a, b+1));
    const kcal = parsed.kcal!=null ? Math.max(0, Math.round(Number(parsed.kcal))) : null;
    const p = parsed.p!=null ? Math.max(0, Math.round(Number(parsed.p)*10)/10) : null;
    const c = parsed.c!=null ? Math.max(0, Math.round(Number(parsed.c)*10)/10) : null;
    const g = parsed.g!=null ? Math.max(0, Math.round(Number(parsed.g)*10)/10) : null;
    const qg = parsed.qty_g!=null ? Math.max(0, Math.round(Number(parsed.qty_g))) : null;
    const name = parsed.name ? String(parsed.name).trim() : null;
    if (kcal == null || p == null || c == null || g == null) throw new Error('Stima incompleta dall\'IA');
    return { name, qty_g: qg, kcal, p, c, g, note: String(parsed.note || '') };
  } catch (e) {
    return { error: e.message || 'Errore' };
  }
}

function buildEatingHabitsSummary({ meals, weights, goal }){
  const now = new Date();
  const last14 = meals.filter(m=>(now-new Date(m.ts))<14*86400000 && m.status!=='planned');
  const byType = {}; last14.forEach(m=>{ if(!byType[m.type]) byType[m.type]=[]; byType[m.type].push(m); });
  const dayKeys = new Set(last14.map(m=>dayKey(new Date(m.ts))));
  const totalDays = dayKeys.size || 1;
  const avgKcal = last14.reduce((a,m)=>a+(m.kcal||0),0)/totalDays;
  const avgP = last14.reduce((a,m)=>a+(m.p||0),0)/totalDays;
  const avgC = last14.reduce((a,m)=>a+(m.c||0),0)/totalDays;
  const avgG = last14.reduce((a,m)=>a+(m.g||0),0)/totalDays;
  const sortedW = [...weights].sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  const latestW = sortedW[0];
  let out = '';
  out += `Peso: ${latestW?fmt(latestW.weight)+' kg':'—'}, Obiettivo: ${goal!=null?fmt(goal)+' kg':'—'}\n`;
  out += `Medie giornaliere ultimi 14g (${totalDays} giorni registrati):\n`;
  out += `- Calorie: ${Math.round(avgKcal)||'—'} kcal\n- Proteine: ${Math.round(avgP)||'—'} g\n- Carboidrati: ${Math.round(avgC)||'—'} g\n- Grassi: ${Math.round(avgG)||'—'} g\n`;
  out += `\nPasti registrati per tipologia:\n`;
  for (const type of ['colazione','spuntino_m','pranzo','merenda','cena','spuntino_s']) {
    const list = byType[type] || [];
    if (list.length === 0) continue;
    const typeName = MEAL_TYPES.find(t=>t.id===type)?.name || type;
    const descs = list.slice(-8).map(m=>m.description).filter(Boolean);
    out += `- ${typeName} (${list.length} volte): ${descs.join('; ')}\n`;
  }
  return out;
}

function buildWeightLossSummary({ weights, goal, meals, workouts, workoutTypes, supps, taken, sleeps, water }){
  const now = new Date();
  const sortedW = [...weights].sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  const latestW = sortedW[sortedW.length-1];
  const oldestW = sortedW[0];
  // 7-day avg
  const last7Days = []; for(let i=6;i>=0;i--){ const d=new Date(now); d.setDate(d.getDate()-i); last7Days.push(d); }
  const last7avg = (vals)=>{ const v=vals.filter(x=>x!=null); return v.length?v.reduce((a,b)=>a+b,0)/v.length:null; };
  const wByDay = (d)=>{ const arr=sortedW.filter(e=>sameDay(new Date(e.ts),d)).map(e=>e.weight); return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null; };
  const w7 = last7Days.map(wByDay);
  const avgW7 = last7avg(w7);
  // 30-day weight trend
  const days30=[]; for(let i=29;i>=0;i--){ const d=new Date(now); d.setDate(d.getDate()-i); days30.push(d); }
  const w30 = days30.map(wByDay).filter(x=>x!=null);
  const trend30 = w30.length>=2 ? (w30[w30.length-1]-w30[0]).toFixed(1) : null;
  // Calorie & macros 7g
  const mealsLast7 = meals.filter(m=>(now-new Date(m.ts))<7*86400000 && m.status!=='planned');
  const mealsByDay7 = {}; mealsLast7.forEach(m=>{ const k=dayKey(new Date(m.ts)); if(!mealsByDay7[k]) mealsByDay7[k]={kcal:0,p:0,c:0,g:0}; mealsByDay7[k].kcal+=m.kcal||0; mealsByDay7[k].p+=m.p||0; mealsByDay7[k].c+=m.c||0; mealsByDay7[k].g+=m.g||0; });
  const daysWithMeals = Object.keys(mealsByDay7).length;
  const avgKcal = daysWithMeals>0 ? Object.values(mealsByDay7).reduce((a,b)=>a+b.kcal,0)/daysWithMeals : null;
  const avgP = daysWithMeals>0 ? Object.values(mealsByDay7).reduce((a,b)=>a+b.p,0)/daysWithMeals : null;
  const avgC = daysWithMeals>0 ? Object.values(mealsByDay7).reduce((a,b)=>a+b.c,0)/daysWithMeals : null;
  const avgG = daysWithMeals>0 ? Object.values(mealsByDay7).reduce((a,b)=>a+b.g,0)/daysWithMeals : null;
  // Sonno 7g
  const sleepsLast7 = sleeps.filter(s=>{ const d=parseDayKey(s.wakeDate); return (now-d)<8*86400000; });
  const sleepDurs = sleepsLast7.map(s=>durHours(s.bedtime,s.waketime)).filter(x=>x!=null);
  const avgSleep = sleepDurs.length>0 ? sleepDurs.reduce((a,b)=>a+b,0)/sleepDurs.length : null;
  const avgQuality = sleepsLast7.length>0 ? sleepsLast7.reduce((a,s)=>a+(s.quality||0),0)/sleepsLast7.length : null;
  // Allenamenti 7g
  const wkLast7 = workouts.filter(w=>(now-new Date(w.ts))<7*86400000);
  const wkByType = {}; wkLast7.forEach(w=>{ const t=workoutTypes.find(x=>x.id===w.typeId); const name=t?.name||'?'; const unit=t?.unit||''; if(!wkByType[name]){wkByType[name]={count:0,qty:0,unit};} wkByType[name].count++; wkByType[name].qty+=w.qty||0; });
  // Acqua 7g
  const waterLast7 = last7Days.map(d=>water[dayKey(d)]||0);
  const avgWater = waterLast7.reduce((a,b)=>a+b,0)/7;
  // Integratori — regolarità 28g
  const days28=[]; for(let i=27;i>=0;i--){ const d=new Date(now); d.setDate(d.getDate()-i); days28.push(d); }
  const suppReg = supps.map(s=>{ const c=days28.filter(d=>(taken[dayKey(d)]||[]).includes(s.id)).length; return `${s.name} ${Math.round((c/28)*100)}%`; }).join(', ');

  let out = '';
  out += `Peso attuale: ${latestW?fmt(latestW.weight)+' kg':'non registrato'}\n`;
  out += `Obiettivo: ${goal!=null?fmt(goal)+' kg':'non impostato'}\n`;
  if (latestW && goal!=null) out += `Distanza dall'obiettivo: ${fmt(latestW.weight-goal,1)} kg\n`;
  out += `Media peso ultimi 7 giorni: ${avgW7!=null?fmt(avgW7)+' kg':'—'}\n`;
  out += `Variazione 30 giorni: ${trend30!=null?(trend30>0?'+':'')+trend30+' kg':'dati insufficienti'}\n`;
  if (latestW?.bodyFat!=null) out += `% grasso corporeo: ${fmt(latestW.bodyFat)}%\n`;
  if (latestW?.muscle!=null) out += `% muscolo: ${fmt(latestW.muscle)}%\n`;
  if (latestW?.water!=null) out += `% acqua corporea: ${fmt(latestW.water)}%\n`;
  out += `\nALIMENTAZIONE (media 7g, ${daysWithMeals} giorni con dati):\n`;
  out += `- Calorie/giorno: ${avgKcal!=null?Math.round(avgKcal)+' kcal':'—'}\n`;
  out += `- Proteine: ${avgP!=null?Math.round(avgP)+' g':'—'}, Carboidrati: ${avgC!=null?Math.round(avgC)+' g':'—'}, Grassi: ${avgG!=null?Math.round(avgG)+' g':'—'}\n`;
  out += `- Acqua: ${fmt(avgWater,1)} bicchieri/giorno\n`;
  out += `\nSONNO (ultimi 7g, ${sleepDurs.length} notti):\n`;
  out += `- Durata media: ${avgSleep!=null?fmtDur(avgSleep):'—'}\n`;
  out += `- Qualità media: ${avgQuality!=null?fmt(avgQuality,1)+'/5':'—'}\n`;
  out += `\nMOVIMENTO (ultimi 7g):\n`;
  if (Object.keys(wkByType).length===0) out += '- Nessun allenamento\n';
  else for(const name in wkByType){ const x=wkByType[name]; out += `- ${name}: ${x.count} sessioni, ${fmt0(x.qty)} ${x.unit}\n`; }
  out += `\nINTEGRATORI (regolarità 28g): ${suppReg||'nessuno registrato'}\n`;
  return out;
}

const PAGES = [
  { id:'oggi', label:'oggi', roman:'✦' },
  { id:'peso', label:'peso', roman:'I' },
  { id:'pasti', label:'pasti', roman:'II' },
  { id:'menu', label:'menù', roman:'III' },
  { id:'digiuno', label:'digiuno', roman:'IV' },
  { id:'integra', label:'rituale', roman:'V' },
  { id:'respiro', label:'corpo', roman:'VI' },
  { id:'sonno', label:'sonno', roman:'VII' },
  { id:'sera', label:'sera', roman:'VIII' },
];
const DEF_TYPES = [
  { id:'corsa', name:'Corsa', unit:'km' },
  { id:'camminata', name:'Camminata', unit:'km' },
  { id:'pesi', name:'Pesi', unit:'min' },
  { id:'yoga', name:'Yoga', unit:'min' },
];
const UNITS = ['km','min','kg','reps','m'];
const MEAL_TYPES = [
  { id:'colazione', name:'Colazione', order:1, abbr:'COL' },
  { id:'spuntino_m', name:'Spuntino', order:2, abbr:'SPU' },
  { id:'pranzo', name:'Pranzo', order:3, abbr:'PRA' },
  { id:'merenda', name:'Merenda', order:4, abbr:'MER' },
  { id:'cena', name:'Cena', order:5, abbr:'CEN' },
  { id:'spuntino_s', name:'Spuntino serale', order:6, abbr:'SPS' },
];

export default function App({ user, onLogout }){
  useGoogleFonts();
  const [pageIdx, setPageIdx] = useState(0);
  // Scroll automatico in cima quando si cambia tab della nav
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { try { window.scrollTo(0, 0); } catch (__) {} }
  }, [pageIdx]);
  const [showStats, setShowStats] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [showGuida, setShowGuida] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [weights, setWeights] = useState([]);
  const [goal, setGoal] = useState(null);
  const [foodNotes, setFoodNotes] = useState([]);
  const [waterByDay, setWaterByDay] = useState({});
  const [waterGoal, setWaterGoal] = useState(8);
  const [meals, setMeals] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [workoutTypes, setWorkoutTypes] = useState(DEF_TYPES);
  const [supplements, setSupplements] = useState([]);
  const [suppTaken, setSuppTaken] = useState({});
  const [sleeps, setSleeps] = useState([]);
  const [mindfulSessions, setMindfulSessions] = useState([]);
  const [fasts, setFasts] = useState([]);
  const [userGoals, setUserGoals] = useState([]);

  useEffect(()=>{(async()=>{
    if (!user) return;

    // Wipe one-time dei dati legacy in localStorage (clean start scelto dall'utente).
    // Marcato con flag namespaced per utente così non rivipia se cambi account.
    const migKey = `quercus_migrated_v1_${user.id}`;
    const alreadyWiped = await sGet(migKey);
    if (!alreadyWiped) {
      await Promise.all([
        sDel('weights'), sDel('goal'), sDel('foodnotes'), sDel('water'),
        sDel('watergoal'), sDel('meals'), sDel('workouts'), sDel('workouttypes'),
        sDel('supps'), sDel('supptaken'), sDel('sleeps'), sDel('mindful'), sDel('fasts'),
      ]);
      await sSet(migKey, '1');
    }

    // Tutto da Supabase ora
    const [
      weightsFromDb, profile, waterFromDb, sleepsFromDb, diaryFromDb, mealsFromDb,
      workoutsFromDb, workoutTypesFromDb, suppsFromDb, takenFromDb, mindfulFromDb, fastsFromDb,
      goalsFromDb,
    ] = await Promise.all([
      weightsRepo.load(user.id),
      profileRepo.load(user.id),
      waterRepo.load(user.id),
      sleepsRepo.load(user.id),
      diaryRepo.load(user.id),
      mealsRepo.load(user.id),
      workoutsRepo.load(user.id),
      workoutTypesRepo.load(user.id),
      supplementsRepo.load(user.id),
      suppTakenRepo.load(user.id),
      mindfulRepo.load(user.id),
      fastsRepo.load(user.id),
      goalsRepo.load(user.id),
    ]);
    // watergoal: lo lascio anche in localStorage come fallback locale rapido
    const wag = await sGet('watergoal');
    setWeights(weightsFromDb);
    setGoal(profile?.goal_weight != null ? Number(profile.goal_weight) : null);
    setProfile(profile);
    setFoodNotes(diaryFromDb);
    setWaterByDay(waterFromDb);
    const wgn = profile?.water_goal ?? (wag?parseInt(wag):null); setWaterGoal(wgn&&!isNaN(wgn)?wgn:8);
    setMeals(mealsFromDb);
    setWorkouts(workoutsFromDb);
    // Migrazione lazy: foto base64 nel DB → Supabase Storage (in background, non blocca UI)
    (async () => {
      const toMigrate = mealsFromDb.filter(m => m.photo && !m.photo_url);
      if (toMigrate.length === 0) return;
      console.log(`[migrazione foto] ${toMigrate.length} pasti da migrare a Storage`);
      const updated = [...mealsFromDb];
      let migratedCount = 0;
      for (const meal of toMigrate) {
        try {
          const url = await uploadMealPhotoToStorage(user.id, meal.id, meal.photo);
          const idx = updated.findIndex(m => m.id === meal.id);
          if (idx >= 0) updated[idx] = { ...updated[idx], photo_url: url, photo: null };
          // Persist immediatamente: UPDATE photo_url e clear photo per questo pasto
          await mealsRepo.sync(user.id, [meal], [{...meal, photo_url: url, photo: null}]);
          migratedCount++;
        } catch (err) {
          console.warn('[migrazione foto] fallita per meal', meal.id, err);
        }
      }
      if (migratedCount > 0) {
        console.log(`[migrazione foto] migrate ${migratedCount}/${toMigrate.length}`);
        setMeals(updated);
      }
    })();
    // Se workout_types vuoto, seed dei default con UUID veri (DEF_TYPES ha id testuali → no UUID)
    let workoutTypesToUse = workoutTypesFromDb;
    if (workoutTypesFromDb.length === 0) {
      workoutTypesToUse = DEF_TYPES.map(t => ({
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now()+Math.random()).toString(),
        name: t.name,
        unit: t.unit,
      }));
      await workoutTypesRepo.sync(user.id, [], workoutTypesToUse);
    }
    setWorkoutTypes(workoutTypesToUse);
    setSupplements(suppsFromDb);
    setSuppTaken(takenFromDb);
    setSleeps(sleepsFromDb);
    setMindfulSessions(mindfulFromDb);
    setFasts(fastsFromDb);
    setUserGoals(goalsFromDb);
    setLoaded(true);

    // Mostra onboarding al primo accesso. Controllo sia il flag persistente
    // su Supabase (profile.onboarded) sia il fallback in localStorage.
    // Dopo l'onboarding, se setup_completed=false oppure mancano i 3 dati chiave
    // (sex/height_cm/birth_year) necessari per il calcolo nutrizionale, mostra ProfileSetup.
    const isOnboardedServer = !!profile?.onboarded;
    const isOnboardedLocal = hasSeenOnboarding(user.id);
    const setupDone = !!profile?.setup_completed;
    const hasCoreData = !!(profile?.sex && profile?.height_cm && profile?.birth_year);
    const needsSetup = !setupDone || !hasCoreData;
    if (!isOnboardedServer && !isOnboardedLocal) {
      setShowOnboarding(true);
    } else {
      if (isOnboardedServer && !isOnboardedLocal) {
        try { markOnboardingSeen(user.id); } catch (_) {}
      }
      if (needsSetup) {
        setShowProfileSetup(true);
      }
    }
  })();},[user]);

  // updWeights: aggiorna state + sync delta su Supabase
  const updWeights = async (newList) => {
    const oldList = weights;
    setWeights(newList);
    if (user) {
      try {
        const r = await weightsRepo.sync(user.id, oldList, newList);
        if (r && r.ok === false) {
          window.alert('Errore salvataggio peso:\n' + (r.errors?.join('\n') || 'sconosciuto'));
        }
      } catch (err) {
        console.error('updWeights threw:', err);
        window.alert('Errore nel salvataggio del peso: ' + (err?.message || err));
      }
    }
  };
  // updGoal: scrive su profiles.goal_weight
  const updGoal = async g => {
    setGoal(g);
    if (user) await profileRepo.update(user.id, { goal_weight: g });
  };

  const upd = (key, setter) => async n => { setter(n); await sSet(key, typeof n==='string'?n:JSON.stringify(n)); };
  // updFoodNotes (diary): aggiorna state + sync delta su Supabase
  const updFoodNotes = async (newList) => {
    const oldList = foodNotes;
    setFoodNotes(newList);
    if (user) {
      const r = await diaryRepo.sync(user.id, oldList, newList);
      if (r && r.ok === false) console.error('Errore salvataggio diario:', r.errors);
    }
  };
  // updWater: aggiorna state + sync upsert su Supabase
  const updWater = async (newMap) => {
    const oldMap = waterByDay;
    setWaterByDay(newMap);
    if (user) {
      const r = await waterRepo.sync(user.id, oldMap, newMap);
      if (r && r.ok === false) {
        console.error('Errore salvataggio acqua:', r.errors);
      }
    }
  };
  const updWaterGoal = async g => {
    setWaterGoal(g);
    await sSet('watergoal', String(g));
    if (user) await profileRepo.update(user.id, { water_goal: g });
  };
  // updMeals: aggiorna state + sync delta su Supabase
  const updMeals = async (newList) => {
    const oldList = meals;
    setMeals(newList);
    if (user) {
      const r = await mealsRepo.sync(user.id, oldList, newList);
      if (r && r.ok === false) console.error('Errore salvataggio pasti:', r.errors);
    }
  };
  // updWorkouts: sync su Supabase
  const updWorkouts = async (newList) => {
    const oldList = workouts;
    setWorkouts(newList);
    if (user) {
      const r = await workoutsRepo.sync(user.id, oldList, newList);
      if (r && r.ok === false) console.error('Errore salvataggio allenamenti:', r.errors);
    }
  };
  // updWorkoutTypes: sync su Supabase
  const updWorkoutTypes = async (newList) => {
    const oldList = workoutTypes;
    setWorkoutTypes(newList);
    if (user) {
      const r = await workoutTypesRepo.sync(user.id, oldList, newList);
      if (r && r.ok === false) console.error('Errore salvataggio tipi allenamento:', r.errors);
    }
  };
  // updSupps: sync su Supabase
  const updSupps = async (newList) => {
    const oldList = supplements;
    setSupplements(newList);
    if (user) {
      const r = await supplementsRepo.sync(user.id, oldList, newList);
      if (r && r.ok === false) console.error('Errore salvataggio integratori:', r.errors);
    }
  };
  // updTaken: sync su Supabase (mappa dayKey → [suppId])
  const updTaken = async (newMap) => {
    const oldMap = suppTaken;
    setSuppTaken(newMap);
    if (user) {
      const r = await suppTakenRepo.sync(user.id, oldMap, newMap);
      if (r && r.ok === false) console.error('Errore salvataggio integratori presi:', r.errors);
    }
  };
  // updSleeps: aggiorna state + sync delta su Supabase
  const updSleeps = async (newList) => {
    const oldList = sleeps;
    setSleeps(newList);
    if (user) {
      const r = await sleepsRepo.sync(user.id, oldList, newList);
      if (r && r.ok === false) {
        console.error('Errore salvataggio sonno:', r.errors);
      }
    }
  };
  // updMindful: sync su Supabase
  const updMindful = async (newList) => {
    const oldList = mindfulSessions;
    setMindfulSessions(newList);
    if (user) {
      const r = await mindfulRepo.sync(user.id, oldList, newList);
      if (r && r.ok === false) console.error('Errore salvataggio mindful:', r.errors);
    }
  };
  // updFasts: sync su Supabase
  const updFasts = async (newList) => {
    const oldList = fasts;
    setFasts(newList);
    if (user) {
      const r = await fastsRepo.sync(user.id, oldList, newList);
      if (r && r.ok === false) console.error('Errore salvataggio digiuni:', r.errors);
    }
  };
  // updGoals: sync su Supabase
  const updGoals = async (newList) => {
    const oldList = userGoals;
    setUserGoals(newList);
    if (user) {
      const r = await goalsRepo.sync(user.id, oldList, newList);
      if (r && r.ok === false) console.error('Errore salvataggio obiettivi:', r.errors);
    }
  };
  // updProfile: salva campi del profilo (display_name, avatar_data, ecc.) e aggiorna lo state
  const updProfile = async (fields) => {
    if (!user) return;
    await profileRepo.update(user.id, fields);
    setProfile(prev => ({ ...prev, ...fields }));
  };

  const page = PAGES[pageIdx].id;

  // Gate paywall: se la prova è terminata e l'abbonamento non è attivo, mostra solo la pagina abbonamento
  // is_lifetime_free bypassa tutto (accesso eterno gratuito per creatore/omaggi)
  const isLifetimeFree = !!profile?.is_lifetime_free;
  const trialExpired = profile?.trial_ends_at && new Date(profile.trial_ends_at) < new Date();
  const hasActive = profile?.subscription_status === 'active' || isLifetimeFree;
  const needsPaywall = loaded && profile && !hasActive && trialExpired;

  if (needsPaywall && !showSub) {
    return (
      <SubscriptionPage
        user={user}
        profile={profile}
        paywallMode={true}
        onLogout={async () => { await supabase.auth.signOut(); }}
      />
    );
  }

  if (showOnboarding) {
    return (
      <Onboarding
        userId={user?.id}
        profile={profile}
        updProfile={updProfile}
        onDone={() => {
          setShowOnboarding(false);
          // Dopo l'onboarding, se non è completato il setup OPPURE mancano i dati chiave, mostra il form
          const hasCoreData = !!(profile?.sex && profile?.height_cm && profile?.birth_year);
          if (!profile?.setup_completed || !hasCoreData) setShowProfileSetup(true);
        }}
      />
    );
  }

  if (showProfileSetup) {
    const sortedW = [...(weights||[])].sort((a,b)=>new Date(b.ts)-new Date(a.ts));
    const latestWeight = sortedW[0]?.weight || null;
    return (
      <ProfileSetup
        profile={profile}
        updProfile={updProfile}
        latestWeight={latestWeight}
        onCreateWeight={async (w) => { await updWeights([...(weights||[]), w]); }}
        onDone={() => setShowProfileSetup(false)}
      />
    );
  }

  if (showGuida) {
    return <GuidaPage profile={profile} onClose={() => setShowGuida(false)} />;
  }

  if (showProfile) {
    return <ProfilePage user={user} profile={profile} updProfile={updProfile} onClose={() => setShowProfile(false)} />;
  }

  if (showLayout) {
    return <LayoutPage profile={profile} updProfile={updProfile} onClose={() => setShowLayout(false)} />;
  }

  // Calcolo stato abbonamento per il menu avatar
  const subState = (() => {
    if (!profile) return { label: 'caricamento…', color: '#8C6A4E', tone: 'neutral', ctaLabel: '◆ abbonamento', ctaPrimary: false };
    const isLifetimeFree = !!profile.is_lifetime_free;
    const trialDays = profile.trial_ends_at ? Math.max(0, Math.ceil((new Date(profile.trial_ends_at) - new Date()) / 86400000)) : 0;
    const isTrial = !isLifetimeFree && profile.subscription_status === 'trial' && trialDays > 0;
    const isActive = !isLifetimeFree && profile.subscription_status === 'active';
    const isPastDue = profile.subscription_status === 'past_due';
    const trialExpired = !isLifetimeFree && !isActive && profile.trial_ends_at && new Date(profile.trial_ends_at) < new Date();
    if (isLifetimeFree) return { label: '✦ Accesso lifetime', color: '#8C6A4E', tone: 'lifetime', ctaLabel: '◆ il tuo abbonamento', ctaPrimary: false };
    if (isActive) return { label: '✦ Premium attivo', color: '#6B8E5C', tone: 'active', ctaLabel: '◆ gestisci abbonamento', ctaPrimary: false };
    if (isPastDue) return { label: '⚠ pagamento in sospeso', color: '#C99A7A', tone: 'past_due', ctaLabel: '◆ risolvi', ctaPrimary: true };
    if (trialExpired) return { label: '✕ prova terminata', color: '#C99A7A', tone: 'expired', ctaLabel: '✦ abbonati ora', ctaPrimary: true };
    if (isTrial) return { label: `✦ Prova: rimangono ${trialDays} ${trialDays === 1 ? 'giorno' : 'giorni'}`, color: '#8C6A4E', tone: 'trial', ctaLabel: '✦ abbonati ora', ctaPrimary: true };
    return { label: 'abbonamento', color: '#8C6A4E', tone: 'neutral', ctaLabel: '◆ abbonamento', ctaPrimary: false };
  })();

  // Avatar + menu account (rendering subito sotto, in fixed)
  const accountEmail = user?.email || '';
  const displayName = profile?.display_name || '';
  const accountInitial = ((displayName?.[0]) || accountEmail[0] || '?').toUpperCase();
  const avatarSrc = profile?.avatar_data || null;
  const renderAccountMenu = () => (
    <>
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 9000 }}>
        <button onClick={() => setShowAccountMenu(!showAccountMenu)} aria-label="account"
          style={{ width: 36, height: 36, borderRadius: '50%', background: avatarSrc ? 'transparent' : 'rgba(232,224,210,0.85)', border: '1px solid rgba(60,51,41,0.2)', color: '#3C3329', fontFamily: "'Cardo',serif", fontSize: 16, fontStyle: 'italic', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', overflow: 'hidden', padding: 0 }}>
          {avatarSrc ? <img src={avatarSrc} alt="profilo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : accountInitial}
        </button>
        {showAccountMenu && (
          <div style={{ position: 'absolute', top: 44, right: 0, background: '#E8E0D2', border: '1px solid rgba(60,51,41,0.2)', padding: '14px 16px', minWidth: 240, fontFamily: "'Cardo',serif", color: '#3C3329', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: '#8C6A4E', marginBottom: 4 }}>connesso come</div>
            <div style={{ fontSize: 14, marginBottom: 10, wordBreak: 'break-all' }}>{displayName || accountEmail}</div>

            {/* Badge stato abbonamento */}
            <div style={{ padding: '8px 10px', border: `1px solid ${subState.color}66`, background: `${subState.color}14`, marginBottom: 12, fontSize: 13, fontStyle: 'italic', color: subState.color, textAlign: 'center' }}>
              {subState.label}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => { setShowAccountMenu(false); setShowProfile(true); }}
                style={{ background: 'transparent', color: '#3C3329', border: '1px solid rgba(60,51,41,0.25)', fontFamily: "'Cardo',serif", fontStyle: 'italic', fontSize: 14, padding: '8px 12px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                ☉ profilo
              </button>
              <button onClick={() => { setShowAccountMenu(false); setShowLayout(true); }}
                style={{ background: 'transparent', color: '#3C3329', border: '1px solid rgba(60,51,41,0.25)', fontFamily: "'Cardo',serif", fontStyle: 'italic', fontSize: 14, padding: '8px 12px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                ✦ layout
              </button>
              <button onClick={() => { setShowAccountMenu(false); setShowGuida(true); }}
                style={{ background: 'transparent', color: '#3C3329', border: '1px solid rgba(60,51,41,0.25)', fontFamily: "'Cardo',serif", fontStyle: 'italic', fontSize: 14, padding: '8px 12px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                ✦ guida
              </button>
              <button onClick={() => { setShowAccountMenu(false); setShowSub(true); }}
                style={{
                  background: subState.ctaPrimary ? '#C9A876' : 'transparent',
                  color: subState.ctaPrimary ? '#1F140C' : '#3C3329',
                  border: subState.ctaPrimary ? '1px solid #C9A876' : '1px solid rgba(60,51,41,0.25)',
                  fontFamily: "'Cardo',serif", fontStyle: 'italic', fontSize: 14,
                  padding: '8px 12px', cursor: 'pointer', width: '100%', textAlign: 'left',
                  fontWeight: subState.ctaPrimary ? 600 : 400,
                }}>
                {subState.ctaLabel}
              </button>
              <button onClick={() => { setShowAccountMenu(false); onLogout && onLogout(); }}
                style={{ background: '#3C3329', color: '#E8E0D2', border: 'none', fontFamily: "'Cardo',serif", fontStyle: 'italic', fontSize: 14, padding: '8px 12px', cursor: 'pointer', width: '100%', marginTop: 4 }}>
                esci
              </button>
            </div>
          </div>
        )}
      </div>
      {showAccountMenu && <div onClick={() => setShowAccountMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 8999, background: 'transparent' }} />}
    </>
  );

  if (showSub) {
    return (
      <>
        <SubscriptionPage
          user={user}
          profile={profile}
          onClose={() => setShowSub(false)}
        />
        {renderAccountMenu()}
      </>
    );
  }

  if (showStats) {
    return (
      <>
        <StatistichePage
          weights={weights} meals={meals} sleeps={sleeps} water={waterByDay}
          workouts={workouts} workoutTypes={workoutTypes}
          supplements={supplements} suppTaken={suppTaken}
          mindful={mindfulSessions} fasts={fasts} diaryNotes={foodNotes}
          goal={goal}
          userGoals={userGoals} updGoals={updGoals}
          profile={profile}
          onClose={() => setShowStats(false)}
        />
        {renderAccountMenu()}
      </>
    );
  }
  return (
    <div style={{minHeight:'100vh', background:'#000', position:'relative'}}>
      <div style={{paddingBottom:76}}>
        {(() => { const __theme = getTheme(profile?.theme); return (<>
        {page==='oggi' && <OggiPage theme={__theme} loaded={loaded} profile={profile} weights={weights} goal={goal} meals={meals} notes={foodNotes} water={waterByDay} waterGoal={waterGoal} workouts={workouts} sleeps={sleeps} fasts={fasts} supps={supplements} taken={suppTaken} updWater={updWater} setPage={setPageIdx} />}
        {page==='peso' && <PesoPage theme={__theme} loaded={loaded} weights={weights} goal={goal} updWeights={updWeights} updGoal={updGoal} meals={meals} updMeals={updMeals} openStats={() => setShowStats(true)} profile={profile} openSub={() => setShowSub(true)} />}
        {page==='pasti' && <PastiPage user={user} theme={__theme} loaded={loaded} meals={meals} updMeals={updMeals} notes={foodNotes} weights={weights} goal={goal} />}
        {page==='menu' && <MenuPage theme={__theme} loaded={loaded} meals={meals} updMeals={updMeals} weights={weights} goal={goal} profile={profile} updProfile={updProfile} />}
        {page==='integra' && <IntegraPage theme={__theme} loaded={loaded} supps={supplements} taken={suppTaken} updSupps={updSupps} updTaken={updTaken} />}
        {page==='digiuno' && <DigiunoPage theme={__theme} loaded={loaded} fasts={fasts} updFasts={updFasts} />}
        {page==='respiro' && <RespiroPage theme={__theme} loaded={loaded} sessions={mindfulSessions} updSessions={updMindful} workouts={workouts} types={workoutTypes} updWorkouts={updWorkouts} updTypes={updWorkoutTypes} />}
        {page==='sonno' && <SonnoPage theme={__theme} loaded={loaded} sleeps={sleeps} updSleeps={updSleeps} />}
        {page==='sera' && <SeraPage theme={__theme} loaded={loaded} weights={weights} goal={goal} notes={foodNotes} water={waterByDay} waterGoal={waterGoal} meals={meals} workouts={workouts} workoutTypes={workoutTypes} supps={supplements} taken={suppTaken} sleeps={sleeps} mindful={mindfulSessions} updNotes={updFoodNotes} profile={profile} />}
        </>); })()}
      </div>
      <BottomNav theme={getTheme(profile?.theme)} currentIdx={pageIdx} onChange={setPageIdx} />
      {renderAccountMenu()}
    </div>
  );
}

function BottomNav({ theme, currentIdx, onChange }){
  // Tema dinamico: bottom nav usa colori del tema attivo
  const NAV = theme ? { bg: theme.bg2, border: theme.border, dim: theme.dim, gold: theme.gold, cream: theme.cream } : { bg: '#1A1108', border: '#3A2818', dim: '#6B5D45', gold: '#C9A876', cream: '#E8D8B8' };
  return (
    <div style={{position:'fixed',left:0,right:0,bottom:0,background:NAV.bg,borderTop:`1px solid ${NAV.border}`,display:'flex',justifyContent:'space-around',alignItems:'center',paddingTop:10,paddingBottom:14,zIndex:50}}>
      {PAGES.map((p,i)=>{const active=i===currentIdx; return (
        <button key={p.id} onClick={()=>onChange(i)} style={{background:'transparent',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:1,padding:'4px 2px',minWidth:30,flex:'1 0 auto'}}>
          <span style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.1em',color:active?NAV.gold:NAV.dim}}>{p.roman}</span>
          <span style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:8.5,color:active?NAV.cream:NAV.dim}}>{p.label}</span>
        </button>
      );})}
    </div>
  );
}

function buildLineChart(values, chartW, chartH){
  const padX=8, padY=14;
  const valid=values.filter(v=>v!=null);
  if(valid.length===0) return { path:'', area:'', points:[], min:null, max:null, padX, padY, chartH, chartW };
  const min=Math.min(...valid), max=Math.max(...valid), span=Math.max(max-min,0.5);
  const xStep=(chartW-padX*2)/Math.max(1,values.length-1);
  const points = values.map((v,i)=>v==null?null:{ x:padX+i*xStep, y:padY+(chartH-padY*2)*(1-(v-min)/span), v }).filter(Boolean);
  let path='', area='';
  if(points.length>1){
    path=points.map((p,i)=>`${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
    area=path + ` L ${points[points.length-1].x} ${chartH} L ${points[0].x} ${chartH} Z`;
  }
  return { path, area, points, min, max, padX, padY, chartH, chartW };
}

function OggiPage({ theme, loaded, profile, weights, goal, meals, notes, water, waterGoal, workouts, sleeps, fasts, supps, taken, updWater, setPage }){
  const Q = theme || { bg1: '#3A2818', bg2: '#1F140C', gold: '#C9A876', goldDim: '#8B7355', cream: '#E8D8B8', ink: '#1F140C' };
  const now = new Date();
  const todayKey = dayKey(now);
  const h = now.getHours();

  // Saluto dinamico
  const greet = h < 6 ? 'Buonanotte' : h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : h < 22 ? 'Buonasera' : 'Buonanotte';
  const firstName = (profile?.display_name || '').split(' ')[0] || '';

  // Data formattata
  const dataOggi = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  // Dati di oggi
  const todayWeights = (weights || []).filter(w => sameDay(new Date(w.ts), now));
  const lastWeight = todayWeights[todayWeights.length - 1];
  const todayMeals = (meals || []).filter(m => sameDay(new Date(m.ts), now) && m.status !== 'planned');
  const todayKcal = todayMeals.reduce((a, m) => a + (m.kcal || 0), 0);
  // Target kcal del giorno (Zona 40/30/30, stessa formula di MenuPage e SeraPage)
  const kcalTarget = computeNutritionTarget(profile, weights, goal).kcal;
  const todayNotes = (notes || []).filter(n => sameDay(new Date(n.ts), now));
  const todayWater = water?.[todayKey] || 0;
  const todayWorkouts = (workouts || []).filter(w => sameDay(new Date(w.ts), now));
  const lastNight = (sleeps || []).find(s => s.wakeDate === todayKey);
  const activeFast = (fasts || []).find(f => !f.end_ts);
  const todayTaken = (taken?.[todayKey] || []).length;
  const totalSupps = (supps || []).length;

  // BMI / progresso peso
  const heightM = profile?.height_cm ? profile.height_cm / 100 : null;
  const bmi = lastWeight && heightM ? lastWeight.weight / (heightM * heightM) : null;
  const goalDistance = (lastWeight && goal) ? (lastWeight.weight - goal) : null;

  // Card style
  const card = (extra = {}) => ({
    padding: '14px 16px',
    background: `${Q.gold}0D`,
    border: `1px solid ${Q.gold}33`,
    borderRadius: 2,
    ...extra,
  });
  const cardTitle = {
    fontFamily: fCinzel,
    fontSize: 9,
    letterSpacing: '0.4em',
    color: Q.gold,
    textTransform: 'uppercase',
    opacity: 0.9,
  };
  const cardValue = {
    fontFamily: fGaramond,
    fontStyle: 'italic',
    fontSize: 22,
    color: Q.gold,
    marginTop: 2,
  };
  const cardSub = {
    fontFamily: fGaramond,
    fontStyle: 'italic',
    fontSize: 13,
    color: Q.cream,
    opacity: 0.7,
    marginTop: 2,
  };
  const miniBtn = {
    background: 'transparent',
    color: Q.gold,
    border: `1px solid ${Q.gold}66`,
    fontFamily: fCinzel,
    fontSize: 9,
    letterSpacing: '0.25em',
    padding: '6px 12px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    borderRadius: 0,
  };

  // Vai a una pagina by id
  function go(pageId) {
    const idx = PAGES.findIndex(p => p.id === pageId);
    if (idx >= 0) setPage(idx);
  }

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse at top, ${Q.bg1} 0%, ${Q.bg2} 100%)`, color: Q.cream, fontFamily: fGaramond, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 14, border: `1px solid ${Q.gold}40`, borderRadius: 20, pointerEvents: 'none', zIndex: 1 }} />
      <div aria-hidden style={{ position: 'absolute', inset: 20, border: `1px solid ${Q.gold}1A`, borderRadius: 16, pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 2, padding: '32px 24px 28px', maxWidth: 480, margin: '0 auto' }}>

        {/* Saluto */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.45em', color: Q.gold, opacity: 0.7, textTransform: 'uppercase', marginBottom: 8 }}>
            ✦ OGGI ✦
          </div>
          <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 28, color: Q.gold, lineHeight: 1.2 }}>
            {greet}{firstName ? `, ${firstName}` : ''}
          </div>
          <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.cream, opacity: 0.65, marginTop: 4 }}>
            {dataOggi}
          </div>
        </div>

        {!loaded && <Loading color={Q.goldDim || Q.gold} />}

        {loaded && (<>

          {/* Peso */}
          <div style={card({ marginBottom: 10 })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={cardTitle}>I · peso</div>
                {lastWeight ? (
                  <>
                    <div style={cardValue}>{fmt(lastWeight.weight)} <span style={{ fontSize: 11, color: Q.goldDim || Q.gold, opacity: 0.7, fontFamily: fCinzel, letterSpacing: '0.2em', fontStyle: 'normal' }}>KG</span></div>
                    <div style={cardSub}>
                      {bmi ? `BMI ${bmi.toFixed(1)}` : ''}
                      {bmi && goalDistance != null ? ' · ' : ''}
                      {goalDistance != null ? (goalDistance > 0 ? `${fmt(goalDistance)} kg dall'obiettivo` : 'sei al peso obiettivo ✓') : ''}
                    </div>
                  </>
                ) : (
                  <div style={cardSub}>non hai ancora pesato oggi</div>
                )}
              </div>
              <button onClick={() => go('peso')} style={miniBtn}>{lastWeight ? 'vedi' : '+ pesa'}</button>
            </div>
          </div>

          {/* Pasti — mostra kcal consumate / obiettivo invece del conteggio */}
          <div style={card({ marginBottom: 10 })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={cardTitle}>III · pasti</div>
                <div style={cardValue}>{fmt0(todayKcal)}<span style={{ fontSize: 16, color: Q.goldDim || Q.gold, opacity: 0.7, fontFamily: fGaramond, fontStyle: 'italic', margin: '0 4px' }}>/</span>{fmt0(kcalTarget)} <span style={{ fontSize: 11, color: Q.goldDim || Q.gold, opacity: 0.7, fontFamily: fCinzel, letterSpacing: '0.2em', fontStyle: 'normal' }}>KCAL</span></div>
                <div style={cardSub}>
                  {todayKcal === 0
                    ? 'nessun pasto registrato oggi'
                    : todayKcal < kcalTarget * 0.95
                      ? `mancano ${fmt0(kcalTarget - todayKcal)} kcal all'obiettivo`
                      : todayKcal > kcalTarget * 1.05
                        ? `+${fmt0(todayKcal - kcalTarget)} kcal sopra l'obiettivo`
                        : "✓ obiettivo del giorno raggiunto"}
                </div>
              </div>
              <button onClick={() => go('pasti')} style={miniBtn}>+ pasto</button>
            </div>
          </div>

          {/* Acqua + Sonno + Allenamento (riga compatta a 3 colonne) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <button onClick={async () => { await updWater({ ...water, [todayKey]: Math.min(100, todayWater + 1) }); }}
              style={{ ...card({}), textAlign: 'left', cursor: 'pointer', borderRadius: 2 }}>
              <div style={cardTitle}>acqua</div>
              <div style={{ ...cardValue, fontSize: 18 }}>{todayWater}<span style={{ fontSize: 11, color: Q.goldDim || Q.gold, opacity: 0.7, fontFamily: fGaramond, fontStyle: 'italic' }}>/{waterGoal}</span></div>
              <div style={{ ...cardSub, fontSize: 11 }}>tap per +1</div>
            </button>
            <div style={card({})}>
              <div style={cardTitle}>sonno</div>
              <div style={{ ...cardValue, fontSize: 18 }}>{lastNight ? fmtDur(durHours(lastNight.bedtime, lastNight.waketime)) : '—'}</div>
              <div style={{ ...cardSub, fontSize: 11 }}>{lastNight ? `qualità ${lastNight.quality}/5` : 'notte non registrata'}</div>
            </div>
            <div style={card({})}>
              <div style={cardTitle}>corpo</div>
              <div style={{ ...cardValue, fontSize: 18 }}>{todayWorkouts.length}</div>
              <div style={{ ...cardSub, fontSize: 11 }}>{todayWorkouts.length > 0 ? 'sessioni oggi' : 'niente ancora'}</div>
            </div>
          </div>

          {/* Digiuno attivo (solo se c'è) */}
          {activeFast && (() => {
            const startTs = new Date(activeFast.start_ts);
            const elapsedH = (now.getTime() - startTs.getTime()) / 3600000;
            const targetH = activeFast.target_h || null;
            const pct = targetH ? Math.min(100, (elapsedH / targetH) * 100) : null;
            return (
              <div style={card({ marginBottom: 10, background: `${Q.gold}1A` })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={cardTitle}>IV · digiuno in corso</div>
                    <div style={cardValue}>{elapsedH.toFixed(1)}h{targetH ? ` / ${targetH}h` : ''}</div>
                    {pct != null && <div style={cardSub}>{pct.toFixed(0)}% completato</div>}
                  </div>
                  <button onClick={() => go('digiuno')} style={miniBtn}>vedi</button>
                </div>
              </div>
            );
          })()}

          {/* Integratori (solo se ne ha definiti) */}
          {totalSupps > 0 && (
            <div style={card({ marginBottom: 10 })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={cardTitle}>VI · rituale</div>
                  <div style={cardValue}>{todayTaken} / {totalSupps}</div>
                  <div style={cardSub}>integratori di oggi</div>
                </div>
                <button onClick={() => go('integra')} style={miniBtn}>aggiorna</button>
              </div>
            </div>
          )}

          {/* Riepilogo sera (link veloce) */}
          <div style={{ marginTop: 22, textAlign: 'center' }}>
            <button onClick={() => go('sera')} style={{ ...miniBtn, padding: '10px 20px', fontSize: 10 }}>
              ✦ riepilogo della giornata
            </button>
          </div>

          {/* Frase motivazionale */}
          <div style={{ marginTop: 26, textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.cream, opacity: 0.55, lineHeight: 1.5, padding: '0 16px' }}>
            {(() => {
              if (todayMeals.length === 0 && !lastWeight && todayNotes.length === 0) {
                return 'Una piccola pesata, una nota o un bicchiere d\'acqua: basta poco per cominciare.';
              }
              if (goalDistance != null && Math.abs(goalDistance) < 1) {
                return 'Sei a un soffio dall\'obiettivo. Costanza, non fretta.';
              }
              if (todayNotes.length >= 3) {
                return 'Stai scrivendo molto, è una buona giornata.';
              }
              if (todayWater >= waterGoal) {
                return 'Acqua a posto. Il corpo te ne sarà grato.';
              }
              return 'Una cosa per volta. Niente conteggi ossessivi, solo cura.';
            })()}
          </div>

        </>)}
      </div>
    </div>
  );
}
function PesoPage({ theme, loaded, weights, goal, updWeights, updGoal, meals, updMeals, openStats, profile, openSub }){
  // Tema dinamico: shadowing del Q globale del modulo per usare il tema attivo
  const Q = theme || { bg1: '#3A2818', bg2: '#1F140C', gold: '#C9A876', goldDim: '#8B7355', cream: '#E8D8B8', ink: '#1F140C' };
  const [editing, setEditing] = useState(null);
  const [showGoal, setShowGoal] = useState(false);
  const [draft, setDraft] = useState({ w:'', bf:'', mu:'', wa:'' });
  const [draftGoal, setDraftGoal] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [photoView, setPhotoView] = useState(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoFileRef = useRef(null);

  const mealsWithPhotos = useMemo(()=>(meals||[]).filter(m=>m.photo||m.photo_url).sort((a,b)=>new Date(b.ts)-new Date(a.ts)),[meals]);

  async function uploadMealPhoto(e){
    const file = e.target.files?.[0]; if(!file) return;
    setUploadingPhoto(true);
    try {
      const b64 = await resizeImage(file, 480, 0.7);
      const now = new Date();
      const h = now.getHours();
      let type = 'pranzo';
      if (h < 10) type = 'colazione';
      else if (h < 12) type = 'spuntino_m';
      else if (h < 15) type = 'pranzo';
      else if (h < 17) type = 'merenda';
      else if (h < 21) type = 'cena';
      else type = 'spuntino_s';
      const mealId = newId();
      // Upload su Supabase Storage, salva solo URL nel DB (no base64)
      let photoUrl = null;
      const userId = profile?.id;
      if (userId) {
        try { photoUrl = await uploadMealPhotoToStorage(userId, mealId, b64); }
        catch (err) { console.warn('[meal photo] upload Storage fallito, fallback base64', err); }
      }
      await updMeals([...(meals||[]),{id:mealId,ts:now.toISOString(),type,description:'',qty_g:null,kcal:null,p:null,c:null,g:null,photo:photoUrl?null:b64,photo_url:photoUrl,status:'eaten'}]);
    } catch(_){}
    finally { setUploadingPhoto(false); }
    e.target.value = '';
  }

  function openNew(){ setError(''); setDraft({w:'',bf:'',mu:'',wa:''}); setExpanded(false); setEditing('new'); }
  function openEdit(e){
    setError('');
    setDraft({ w:String(e.weight).replace('.',','), bf:e.bodyFat!=null?String(e.bodyFat).replace('.',','):'', mu:e.muscle!=null?String(e.muscle).replace('.',','):'', wa:e.water!=null?String(e.water).replace('.',','):'' });
    setExpanded(e.bodyFat!=null||e.muscle!=null||e.water!=null);
    setEditing(e.id);
  }
  async function save(){
    const w = parseNum(draft.w,20,300); if(w==null){ setError('peso non valido (20–300)'); return; }
    const data = { weight:w, bodyFat:parseNum(draft.bf,1,80), muscle:parseNum(draft.mu,1,80), water:parseNum(draft.wa,1,99) };
    if(editing==='new') await updWeights([...weights, { id:newId(), ts:new Date().toISOString(), ...data }]);
    else await updWeights(weights.map(e=>e.id===editing?{...e,...data}:e));
    setEditing(null); setError('');
  }
  async function del(){ await updWeights(weights.filter(e=>e.id!==editing)); setEditing(null); }
  async function saveGoal(){ const g=parseNum(draftGoal,20,300); if(g==null)return; await updGoal(g); setShowGoal(false); setDraftGoal(''); }

  const [period, setPeriod] = useState(7); // 7, 30, 365 giorni

  const sorted = useMemo(()=>[...weights].sort((a,b)=>new Date(a.ts)-new Date(b.ts)), [weights]);
  const dailyData = useMemo(()=>{
    // Indicizza tutte le pesate per dayKey
    const map={};
    sorted.forEach(e=>{
      const k=dayKey(new Date(e.ts));
      if(!map[k]) map[k]={ ws:[], bfs:[] };
      map[k].ws.push(e.weight);
      if(e.bodyFat!=null) map[k].bfs.push(e.bodyFat);
    });
    const today=new Date();
    // 7/30 giorni: punto per ogni giorno. 365: aggrega per settimana (52 punti)
    if (period === 365) {
      const out=[];
      for(let w=51;w>=0;w--){
        const weekEnd=new Date(today); weekEnd.setDate(weekEnd.getDate()-w*7);
        const weekStart=new Date(weekEnd); weekStart.setDate(weekStart.getDate()-6);
        let ws=[], bfs=[];
        for(let i=0;i<7;i++){
          const d=new Date(weekStart); d.setDate(d.getDate()+i);
          const m=map[dayKey(d)];
          if(m){ ws=ws.concat(m.ws); bfs=bfs.concat(m.bfs); }
        }
        out.push({
          date: weekEnd,
          avg: ws.length>0 ? ws.reduce((a,b)=>a+b,0)/ws.length : null,
          bfAvg: bfs.length>0 ? bfs.reduce((a,b)=>a+b,0)/bfs.length : null,
          count: ws.length,
        });
      }
      return out;
    } else {
      const out=[];
      for(let i=period-1;i>=0;i--){
        const d=new Date(today); d.setDate(d.getDate()-i);
        const m=map[dayKey(d)];
        out.push({
          date:d,
          avg: m && m.ws.length>0 ? m.ws.reduce((a,b)=>a+b,0)/m.ws.length : null,
          bfAvg: m && m.bfs.length>0 ? m.bfs.reduce((a,b)=>a+b,0)/m.bfs.length : null,
          count: m?.ws.length || 0,
        });
      }
      return out;
    }
  },[sorted, period]);

  const latest = sorted[sorted.length-1] || null;
  const todayEntries = sorted.filter(e=>sameDay(new Date(e.ts),new Date()));
  const todayAvg = todayEntries.length>0 ? todayEntries.reduce((a,b)=>a+b.weight,0)/todayEntries.length : null;
  const todayCell = dailyData[dailyData.length-1];
  const prev = [...dailyData].slice(0,-1).reverse().find(d=>d.avg!=null);
  const delta = todayCell?.avg!=null && prev?.avg!=null ? todayCell.avg-prev.avg : null;
  const first7 = dailyData.find(d=>d.avg!=null);
  const last7 = [...dailyData].reverse().find(d=>d.avg!=null);
  const weekDelta = first7&&last7&&first7!==last7 ? last7.avg-first7.avg : null;
  // Body fat delta sui 7 giorni
  const firstBf = dailyData.find(d=>d.bfAvg!=null);
  const lastBf = [...dailyData].reverse().find(d=>d.bfAvg!=null);
  const weekBfDelta = firstBf && lastBf && firstBf!==lastBf ? lastBf.bfAvg - firstBf.bfAvg : null;
  // Qualità del trend: il peso che scende è "buono" solo se anche il grasso scende
  let quality = null;
  if (weekDelta != null && weekBfDelta != null) {
    const w = weekDelta, bf = weekBfDelta;
    if (Math.abs(w)<0.2 && Math.abs(bf)<0.3) quality = { label:'situazione stabile', color:Q.goldDim };
    else if (w < -0.2 && bf < -0.3) quality = { label:'stai dimagrendo bene · grasso in calo', color:'#A5B889' };
    else if (w < -0.2 && bf > 0.3) quality = { label:'peso in calo ma grasso in aumento · stai perdendo muscolo', color:'#C99A7A' };
    else if (w < -0.2) quality = { label:'peso in calo', color:'#A5B889' };
    else if (w > 0.2 && bf < -0.3) quality = { label:'peso sale ma grasso scende · stai mettendo muscolo', color:'#A5B889' };
    else if (w > 0.2 && bf > 0.3) quality = { label:'sia peso che grasso in aumento', color:'#C99A7A' };
    else if (w > 0.2) quality = { label:'peso in aumento', color:'#C99A7A' };
    else if (bf < -0.3) quality = { label:'grasso in calo · ricomposizione', color:'#A5B889' };
    else if (bf > 0.3) quality = { label:'grasso in aumento', color:'#C99A7A' };
  }
  const streak = useMemo(()=>{ let s=0; for(let i=dailyData.length-1;i>=0;i--){ if(dailyData[i].count>0)s++; else break; } return s; },[dailyData]);
  const totalDelta = sorted.length>=2 ? sorted[sorted.length-1].weight-sorted[0].weight : null;

  // Velocità media degli ultimi 30 giorni (kg/settimana). Serve sia per il display sia per l'ETA.
  // Usa una regressione lineare semplice (slope) per stabilità.
  const rate = useMemo(()=>{
    const cutoff = Date.now() - 30*24*60*60*1000;
    const recent = sorted.filter(e => new Date(e.ts).getTime() >= cutoff);
    if (recent.length < 3) return null;
    const t0 = new Date(recent[0].ts).getTime();
    const xs = recent.map(e => (new Date(e.ts).getTime() - t0) / (24*60*60*1000)); // giorni dal primo
    const ys = recent.map(e => e.weight);
    const n = xs.length;
    const sumX = xs.reduce((a,b)=>a+b,0);
    const sumY = ys.reduce((a,b)=>a+b,0);
    const sumXY = xs.reduce((s,x,i)=>s+x*ys[i],0);
    const sumXX = xs.reduce((s,x)=>s+x*x,0);
    const denom = n*sumXX - sumX*sumX;
    if (denom === 0) return null;
    const slope = (n*sumXY - sumX*sumY) / denom; // kg/giorno
    const spanDays = xs[xs.length-1] - xs[0];
    if (spanDays < 7) return null; // serve almeno una settimana di dati
    return { perDay: slope, perWeek: slope*7 };
  }, [sorted]);

  // ETA: quando raggiungerai l'obiettivo, basato su rate
  const eta = useMemo(()=>{
    if (!goal || !latest || !rate) return null;
    const distance = latest.weight - goal;
    if (Math.abs(distance) < 0.3) return { reached: true };
    // Per raggiungere l'obiettivo, rate deve avere segno opposto al distance
    // distance > 0 = devo perdere → serve rate negativo
    // distance < 0 = devo prendere → serve rate positivo
    if (distance > 0 && rate.perDay >= -0.005) return { stalled: true };
    if (distance < 0 && rate.perDay <= 0.005) return { stalled: true };
    const daysToGoal = distance / -rate.perDay;
    if (daysToGoal <= 0 || daysToGoal > 365*3) return null;
    const d = new Date(); d.setDate(d.getDate() + Math.round(daysToGoal));
    return { date: d, days: Math.round(daysToGoal), weeks: Math.round(daysToGoal/7) };
  }, [goal, latest, rate]);
  const { path, area, points } = buildLineChart(dailyData.map(d=>d.avg), 280, 70);
  const bfChart = buildLineChart(dailyData.map(d=>d.bfAvg), 280, 70);

  return (
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at top, ${Q.bg1} 0%, ${Q.bg2} 100%)`,color:Q.cream,fontFamily:fGaramond,position:'relative',overflow:'hidden'}}>
      <div aria-hidden style={{position:'absolute',inset:14,border:`1px solid ${Q.gold}40`,borderRadius:20,pointerEvents:'none',zIndex:1}} />
      <div aria-hidden style={{position:'absolute',inset:20,border:`1px solid ${Q.gold}1A`,borderRadius:16,pointerEvents:'none',zIndex:1}} />
      <div style={{position:'relative',zIndex:2,padding:'32px 28px 28px',maxWidth:480,margin:'0 auto'}}>
        <Header q="PESO" sub="I" color={Q.gold} dim={Q.goldDim} mark="✦" />
        {!loaded && <Loading color={Q.goldDim} />}
        {loaded && weights.length===0 && (
          <div style={{textAlign:'center',padding:'40px 8px 0'}}>
            <div style={{fontStyle:'italic',fontSize:22,color:Q.cream,marginBottom:18}}>Il diario è ancora vuoto.</div>
            <div style={{fontStyle:'italic',fontSize:14,color:Q.goldDim,lineHeight:1.6,maxWidth:280,margin:'0 auto'}}>La prima pesata apre il sentiero.</div>
            <button onClick={openNew} style={btnSolid(Q.gold,Q.ink)}>PRIMA PESATA</button>
          </div>
        )}
        {loaded && weights.length>0 && (<>
          <div style={{textAlign:'center',marginTop:14}}>
            <div style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.45em',color:Q.goldDim,textTransform:'uppercase'}}>
              {todayEntries.length>1?`OGGI · MEDIA DI ${todayEntries.length}`:todayEntries.length===1?'OGGI':latest?`ULTIMO · ${new Date(latest.ts).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}`:''}
            </div>
            <div style={{fontStyle:'italic',fontSize:78,lineHeight:1,color:Q.cream,marginTop:8,letterSpacing:'-0.02em'}}>{fmt(todayAvg ?? latest?.weight)}</div>
            <div style={{fontFamily:fCinzel,fontSize:10,letterSpacing:'0.4em',color:Q.goldDim,marginTop:4}}>CHILOGRAMMI</div>
            {delta!=null && <div style={{fontStyle:'italic',fontSize:14,color:delta<0?'#A5B889':delta>0?'#C99A7A':Q.goldDim,marginTop:8}}>{delta<0?'— ':delta>0?'+ ':''}{fmt(Math.abs(delta),1)} dal giorno precedente</div>}
          </div>
          {latest && (latest.bodyFat!=null||latest.muscle!=null||latest.water!=null) && (
            <div style={{display:'flex',justifyContent:'space-around',marginTop:14,padding:'10px 0',borderTop:`1px solid ${Q.gold}22`,borderBottom:`1px solid ${Q.gold}22`}}>
              {latest.bodyFat!=null && <BodyStat label="grasso" value={`${fmt(latest.bodyFat,1)}%`} Q={Q} />}
              {latest.muscle!=null && <BodyStat label="muscolo" value={`${fmt(latest.muscle,1)}%`} Q={Q} />}
              {latest.water!=null && <BodyStat label="acqua" value={`${fmt(latest.water,1)}%`} Q={Q} />}
            </div>
          )}
          <div style={{marginTop:18,padding:'12px 0 8px',borderTop:`1px solid ${Q.gold}33`,borderBottom:`1px solid ${Q.gold}33`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{display:'flex',gap:4}}>
                {[
                  {v:7, label:'7g'},
                  {v:30, label:'30g'},
                  {v:365, label:'1a'},
                ].map(opt=>(
                  <button key={opt.v} onClick={()=>setPeriod(opt.v)} style={{
                    fontFamily:fCinzel,fontSize:9,letterSpacing:'0.3em',
                    background:period===opt.v?`${Q.gold}1F`:'transparent',
                    color:period===opt.v?Q.gold:Q.goldDim,
                    border:`1px solid ${period===opt.v?Q.gold+'55':Q.gold+'22'}`,
                    padding:'4px 10px',cursor:'pointer',textTransform:'uppercase',
                  }}>{opt.label}</button>
                ))}
              </div>
              <span style={{display:'flex',gap:10,alignItems:'baseline'}}>
                <span style={{color:Q.gold,fontFamily:fGaramond,fontStyle:'italic',fontSize:13,letterSpacing:0}}>{weekDelta!=null?`${weekDelta<0?'— ':'+ '}${fmt(Math.abs(weekDelta),1)} kg`:'—'}</span>
                {weekBfDelta!=null && <span style={{color:'#C99A7A',fontFamily:fGaramond,fontStyle:'italic',fontSize:12,letterSpacing:0}}>{`${weekBfDelta<0?'— ':'+ '}${fmt(Math.abs(weekBfDelta),1)}% grasso`}</span>}
              </span>
            </div>
            <svg viewBox="0 0 280 70" width="100%" height={70} style={{display:'block'}}>
              <defs><linearGradient id="qa" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={Q.gold} stopOpacity="0.18"/><stop offset="100%" stopColor={Q.gold} stopOpacity="0"/></linearGradient></defs>
              {points.length>1 && <path d={area} fill="url(#qa)" />}
              {/* Linea media peso del periodo selezionato: orizzontale, cream del tema, tratteggio largo per non confondersi con quella del grasso */}
              {(() => {
                const validAvgs = dailyData.map(d=>d.avg).filter(v=>v!=null);
                if (validAvgs.length < 2) return null;
                const avgVal = validAvgs.reduce((a,b)=>a+b,0) / validAvgs.length;
                const { min, max, padX, padY, chartH, chartW } = { min:Math.min(...validAvgs), max:Math.max(...validAvgs), padX:8, padY:14, chartH:70, chartW:280 };
                const span = Math.max(max-min, 0.5);
                const y = padY + (chartH - padY*2) * (1 - (avgVal - min) / span);
                return <line x1={padX} x2={chartW-padX} y1={y} y2={y} stroke={Q.cream} strokeWidth="1" strokeDasharray="6,4" opacity="0.55" />;
              })()}
              {points.length>1 && <path d={path} stroke={Q.gold} strokeWidth="1.2" fill="none" />}
              {bfChart.points.length>1 && <path d={bfChart.path} stroke="#C99A7A" strokeWidth="1.2" fill="none" strokeDasharray="3,2" opacity="0.85" />}
              {points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===points.length-1?3.5:2} fill={i===points.length-1?Q.cream:Q.gold}/>)}
              {bfChart.points.map((p,i)=><circle key={`bf${i}`} cx={p.x} cy={p.y} r={i===bfChart.points.length-1?2.5:1.5} fill="#C99A7A" opacity="0.85"/>)}
            </svg>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontFamily:fGaramond,fontStyle:'italic',fontSize:10,color:Q.goldDim,padding:'0 4px'}}>
              {period === 7 && dailyData.map((d,i)=><span key={i} style={{opacity:i===dailyData.length-1?1:0.6}}>{d.date.toLocaleDateString('it-IT',{weekday:'narrow'}).toLowerCase()}</span>)}
              {period === 30 && [0,7,14,21,29].map(i=>{const d=dailyData[i]; return d?<span key={i} style={{opacity:i===29?1:0.6}}>{d.date.toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>:null;})}
              {period === 365 && [0,13,26,39,51].map(i=>{const d=dailyData[i]; return d?<span key={i} style={{opacity:i===51?1:0.6}}>{d.date.toLocaleDateString('it-IT',{month:'short'})}</span>:null;})}
            </div>
            {(() => {
              const validAvgs = dailyData.map(d=>d.avg).filter(v=>v!=null);
              if (validAvgs.length < 2) return null;
              const avgVal = validAvgs.reduce((a,b)=>a+b,0) / validAvgs.length;
              const hasBf = bfChart.points.length > 0;
              return (
                <div style={{display:'flex',justifyContent:'center',gap:18,marginTop:8,fontFamily:fGaramond,fontStyle:'italic',fontSize:10,color:Q.goldDim,flexWrap:'wrap'}}>
                  <span style={{display:'inline-flex',alignItems:'center',gap:5}}><span style={{display:'inline-block',width:14,height:1.5,background:Q.gold}}/>peso</span>
                  <span style={{display:'inline-flex',alignItems:'center',gap:5}}><span style={{display:'inline-block',width:14,height:1.5,backgroundImage:`repeating-linear-gradient(90deg,${Q.cream} 0 4px,transparent 4px 7px)`,opacity:0.7}}/>media {fmt(avgVal,1)} kg</span>
                  {hasBf && <span style={{display:'inline-flex',alignItems:'center',gap:5}}><span style={{display:'inline-block',width:14,height:1.5,backgroundImage:'repeating-linear-gradient(90deg,#C99A7A 0 3px,transparent 3px 5px)'}}/>% grasso</span>}
                </div>
              );
            })()}
            {quality && (
              <div style={{marginTop:10,textAlign:'center',fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:quality.color,padding:'6px 10px',background:`${quality.color}11`,border:`1px solid ${quality.color}33`}}>
                {quality.label}
              </div>
            )}
            {(rate || eta) && (
              <div style={{marginTop:10,padding:'10px 12px',background:`${Q.gold}0A`,border:`1px solid ${Q.gold}22`,display:'flex',flexDirection:'column',gap:6}}>
                {rate && (
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                    <span style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.3em',color:Q.goldDim,textTransform:'uppercase'}}>VELOCITÀ MEDIA · 30 GIORNI</span>
                    <span style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:14,color:rate.perWeek<0?'#A5B889':rate.perWeek>0?'#C99A7A':Q.gold}}>
                      {rate.perWeek<0?'− ':rate.perWeek>0?'+ ':''}{fmt(Math.abs(rate.perWeek),2)} kg/sett.
                    </span>
                  </div>
                )}
                {eta && eta.reached && (
                  <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:'#A5B889',textAlign:'center',marginTop:rate?4:0}}>
                    ✦ obiettivo raggiunto
                  </div>
                )}
                {eta && eta.stalled && (
                  <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:Q.goldDim,textAlign:'center',marginTop:rate?4:0}}>
                    al ritmo attuale non raggiungerai l'obiettivo
                  </div>
                )}
                {eta && eta.date && (
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:rate?4:0}}>
                    <span style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.3em',color:Q.goldDim,textTransform:'uppercase'}}>STIMA OBIETTIVO</span>
                    <span style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:14,color:Q.gold,textAlign:'right'}}>
                      {eta.date.toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}
                      <span style={{color:Q.goldDim,fontSize:11,marginLeft:8}}>~{eta.weeks} sett.</span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{display:'flex',justifyContent:'space-around',marginTop:16}}>
            <Stat label="giorni" value={streak} color={Q.gold} dim={Q.goldDim} />
            <Stat label="totale" value={totalDelta!=null?`${totalDelta<0?'−':'+'}${fmt(Math.abs(totalDelta),1)}`:'—'} color={Q.gold} dim={Q.goldDim} />
            <Stat label="obiettivo" value={goal!=null?fmt(goal):'—'} color={Q.gold} dim={Q.goldDim} onTap={()=>{setDraftGoal(goal!=null?String(goal).replace('.',','):''); setShowGoal(true);}} />
          </div>
          {openStats && weights.length>0 && (
            <div style={{textAlign:'center',marginTop:18}}>
              <button onClick={openStats} style={{background:'transparent',color:Q.gold,border:`1px solid ${Q.gold}66`,fontFamily:fCinzel,fontSize:10,letterSpacing:'0.35em',padding:'10px 18px',cursor:'pointer',textTransform:'uppercase'}}>
                ✦ STATISTICHE COMPLETE
              </button>
            </div>
          )}
          {/* Badge stato abbonamento */}
          {profile && openSub && (() => {
            const trialDays = profile.trial_ends_at ? Math.max(0, Math.ceil((new Date(profile.trial_ends_at) - new Date()) / 86400000)) : 0;
            const isLifetimeFree = !!profile.is_lifetime_free;
            const isTrial = profile.subscription_status === 'trial' && trialDays > 0;
            const isActive = profile.subscription_status === 'active';
            const isPastDue = profile.subscription_status === 'past_due';
            let label = '✦ ABBONAMENTO';
            let color = Q.goldDim;
            if (isLifetimeFree) { label = '✦ ACCESSO LIFETIME'; color = '#C9A876'; }
            else if (isActive) { label = '✦ PREMIUM ATTIVO'; color = '#A5B889'; }
            else if (isTrial) { label = `✦ PROVA: ${trialDays} ${trialDays === 1 ? 'GIORNO' : 'GIORNI'}`; color = Q.gold; }
            else if (isPastDue) { label = '✦ PAGAMENTO IN SOSPESO'; color = '#C99A7A'; }
            return (
              <div style={{textAlign:'center',marginTop:10}}>
                <button onClick={openSub} style={{background:'transparent',color,border:`1px solid ${color}55`,fontFamily:fCinzel,fontSize:9,letterSpacing:'0.3em',padding:'6px 14px',cursor:'pointer',textTransform:'uppercase'}}>
                  {label}
                </button>
              </div>
            );
          })()}
          {(() => {
            // Pesate degli ultimi 7 giorni, raggruppate per giorno (piu' recente in alto)
            const now = new Date();
            const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 6); cutoff.setHours(0,0,0,0);
            const recent = (weights || []).filter(e => new Date(e.ts) >= cutoff).slice().sort((a,b)=>new Date(b.ts)-new Date(a.ts));
            if (recent.length === 0) return null;
            // Raggruppa per dayKey
            const groups = [];
            const seen = new Map();
            for (const e of recent) {
              const d = new Date(e.ts);
              const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
              if (!seen.has(k)) { seen.set(k, groups.length); groups.push({ date: d, entries: [] }); }
              groups[seen.get(k)].entries.push(e);
            }
            const today = new Date();
            const yest = new Date(); yest.setDate(yest.getDate()-1);
            const dayLabel = (d) => {
              if (sameDay(d, today)) return 'OGGI';
              if (sameDay(d, yest)) return 'IERI';
              return d.toLocaleDateString('it-IT',{weekday:'long', day:'numeric', month:'short'}).toUpperCase();
            };
            return (
              <div style={{marginTop:22}}>
                <div style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.4em',color:Q.goldDim,textAlign:'center',textTransform:'uppercase',marginBottom:10}}>ULTIME PESATE</div>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  {groups.map((g,gi) => (
                    <div key={gi}>
                      <div style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.3em',color:Q.gold,marginBottom:6,paddingLeft:2}}>{dayLabel(g.date)}</div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {g.entries.map(e=>{const d=new Date(e.ts); return (
                          <button key={e.id} onClick={()=>openEdit(e)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:`${Q.gold}0D`,border:`1px solid ${Q.gold}1F`,cursor:'pointer',textAlign:'left',width:'100%',borderRadius:0}}>
                            <div>
                              <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:18,color:Q.cream}}>{fmt(e.weight)} <span style={{fontSize:11,color:Q.goldDim,fontFamily:fCinzel,letterSpacing:'0.2em',fontStyle:'normal'}}>KG</span>{e.bodyFat!=null && <span style={{fontSize:12,color:Q.goldDim,marginLeft:10}}>· {fmt(e.bodyFat)}% grasso</span>}</div>
                              <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:Q.goldDim,marginTop:2}}>{d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})} · {timeOfDay(d)}</div>
                            </div>
                            <span style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:Q.goldDim}}>modifica ›</span>
                          </button>
                        );})}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <div style={{textAlign:'center',marginTop:24}}>
            <button onClick={openNew} style={btnSolid(Q.gold,Q.ink)}>+ REGISTRA PESO</button>
          </div>

          {/* Diario fotografico dei pasti — raggruppato per data, ultimi 30 giorni */}
          <div style={{marginTop:28,paddingTop:18,borderTop:`1px solid ${Q.gold}33`}}>
            <div style={{textAlign:'center',marginBottom:14}}>
              <div style={{fontFamily:fCinzel,fontSize:10,letterSpacing:'0.4em',color:Q.gold,textTransform:'uppercase',marginBottom:4}}>✦ DIARIO FOTOGRAFICO</div>
              <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:Q.goldDim}}>{mealsWithPhotos.length>0?'i pasti che hai immortalato · tocca per ingrandire':'aggiungi foto dei tuoi pasti, anche senza dettagli'}</div>
            </div>
            <input ref={photoFileRef} type="file" accept="image/*" onChange={uploadMealPhoto} style={{display:'none'}} />

            {/* Tile aggiungi foto sempre visibile in alto */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:6,marginBottom:18}}>
              <button onClick={()=>photoFileRef.current?.click()} disabled={uploadingPhoto} style={{aspectRatio:'1',padding:0,border:`1px dashed ${Q.gold}66`,background:`${Q.gold}0D`,cursor:uploadingPhoto?'default':'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:Q.gold,fontFamily:fGaramond,fontStyle:'italic',fontSize:11,borderRadius:2,opacity:uploadingPhoto?0.5:1}}>
                {uploadingPhoto ? '⋯' : (<><span style={{fontSize:24,lineHeight:1,marginBottom:2}}>+</span><span style={{fontSize:9,letterSpacing:'0.15em',textTransform:'uppercase',fontFamily:fCinzel,fontStyle:'normal'}}>foto</span></>)}
              </button>
            </div>

            {(() => {
              if (mealsWithPhotos.length === 0) return (
                <div style={{textAlign:'center',marginTop:10,fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:Q.goldDim,opacity:0.7}}>Le foto del Refettorio compariranno qui</div>
              );
              const now = new Date();
              const todayKey = dayKey(now);
              const yesterday = new Date(now); yesterday.setDate(yesterday.getDate()-1);
              const yesterdayKey = dayKey(yesterday);
              const weekAgo = now.getTime() - 7*86400000;
              const monthAgo = now.getTime() - 30*86400000;

              const groups = { today: [], yesterday: [], thisWeek: [], thisMonth: [], older: [] };
              for (const m of mealsWithPhotos) {
                const ts = new Date(m.ts).getTime();
                const dk = dayKey(new Date(m.ts));
                if (dk === todayKey) groups.today.push(m);
                else if (dk === yesterdayKey) groups.yesterday.push(m);
                else if (ts > weekAgo) groups.thisWeek.push(m);
                else if (ts > monthAgo) groups.thisMonth.push(m);
                else groups.older.push(m);
              }

              const recentGroups = [
                { key:'today', label:'OGGI', items: groups.today },
                { key:'yesterday', label:'IERI', items: groups.yesterday },
                { key:'thisWeek', label:'QUESTA SETTIMANA', items: groups.thisWeek },
                { key:'thisMonth', label:'QUESTO MESE', items: groups.thisMonth },
              ].filter(g => g.items.length > 0);

              const renderGrid = (items) => (
                <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:6}}>
                  {items.map(m=>(
                    <button key={m.id} onClick={()=>setPhotoView(m)} style={{aspectRatio:'1',padding:0,border:`1px solid ${Q.gold}33`,background:'transparent',cursor:'pointer',position:'relative',overflow:'hidden',borderRadius:2}}>
                      <img src={m.photo_url || m.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} loading="lazy" />
                    </button>
                  ))}
                </div>
              );

              return (<>
                {recentGroups.map(g => (
                  <div key={g.key} style={{marginBottom:18}}>
                    <div style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.4em',color:Q.goldDim,textTransform:'uppercase',marginBottom:8}}>{g.label} · <span style={{color:Q.gold}}>{g.items.length}</span></div>
                    {renderGrid(g.items)}
                  </div>
                ))}
                {groups.older.length > 0 && (
                  <div style={{marginTop:8}}>
                    {!showAllPhotos ? (
                      <div style={{textAlign:'center',padding:'10px 0'}}>
                        <button onClick={()=>setShowAllPhotos(true)} style={{background:'transparent',border:`1px solid ${Q.gold}55`,color:Q.gold,fontFamily:fCinzel,fontSize:9,letterSpacing:'0.3em',padding:'8px 16px',cursor:'pointer',textTransform:'uppercase'}}>
                          ✦ MOSTRA PIÙ VECCHIE ({groups.older.length})
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.4em',color:Q.goldDim,textTransform:'uppercase',marginBottom:8}}>PIÙ VECCHIE · <span style={{color:Q.gold}}>{groups.older.length}</span></div>
                        {renderGrid(groups.older)}
                        <div style={{textAlign:'center',marginTop:10}}>
                          <button onClick={()=>setShowAllPhotos(false)} style={{background:'transparent',border:'none',color:Q.goldDim,fontFamily:fGaramond,fontStyle:'italic',fontSize:12,cursor:'pointer'}}>nascondi più vecchie ‹</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>);
            })()}
          </div>
        </>)}
      </div>

      {/* Visualizzatore foto ingrandita */}
      {photoView && (
        <div onClick={()=>setPhotoView(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:210,display:'flex',alignItems:'center',justifyContent:'center',padding:20,cursor:'pointer'}}>
          <div onClick={e=>e.stopPropagation()} style={{maxWidth:420,width:'100%',cursor:'default'}}>
            <img src={photoView.photo_url || photoView.photo} alt="" style={{width:'100%',maxHeight:'62vh',objectFit:'contain',borderRadius:4,border:`1px solid ${Q.gold}44`}} />
            <div style={{marginTop:14,textAlign:'center'}}>
              <div style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.4em',color:Q.gold,textTransform:'uppercase'}}>
                {MEAL_TYPES.find(t=>t.id===photoView.type)?.name || photoView.type} · {new Date(photoView.ts).toLocaleDateString('it-IT',{day:'numeric',month:'short'})} · {new Date(photoView.ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
              </div>
              {photoView.description && (
                <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:17,color:Q.cream,marginTop:6,lineHeight:1.3}}>{photoView.description}</div>
              )}
              {(photoView.kcal!=null || photoView.qty_g!=null) && (
                <div style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.25em',color:Q.goldDim,marginTop:8,textTransform:'uppercase'}}>
                  {photoView.qty_g?`${fmt0(photoView.qty_g)}g · `:''}{photoView.kcal!=null?`${fmt0(photoView.kcal)} kcal`:''}{photoView.p!=null?` · P ${fmt0(photoView.p)}`:''}{photoView.c!=null?` · C ${fmt0(photoView.c)}`:''}{photoView.g!=null?` · G ${fmt0(photoView.g)}`:''}
                </div>
              )}
              <button onClick={()=>setPhotoView(null)} style={{marginTop:18,background:'transparent',color:Q.cream,border:`1px solid ${Q.cream}66`,fontFamily:fCinzel,fontSize:10,letterSpacing:'0.35em',padding:'10px 22px',cursor:'pointer'}}>CHIUDI</button>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <ModalQ Q={Q} onClose={()=>setEditing(null)} title={editing==='new'?'REGISTRA PESO':'MODIFICA PESO'} subtitle={editing==='new'?new Date().toLocaleString('it-IT',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'aggiorna o elimina'}>
          <InputBig value={draft.w} onChange={v=>{setDraft({...draft,w:v}); setError('');}} onEnter={save} placeholder="74,2" unit="CHILOGRAMMI" Q={Q} />
          {error && <div style={{color:'#C99A7A',fontStyle:'italic',fontSize:13,marginTop:10,textAlign:'center'}}>{error}</div>}
          <button onClick={()=>setExpanded(!expanded)} style={{marginTop:18,background:'transparent',border:'none',color:Q.goldDim,fontFamily:fGaramond,fontStyle:'italic',fontSize:13,cursor:'pointer',width:'100%',textAlign:'center'}}>
            {expanded?'— composizione corporea —':'+ composizione corporea (RENPHO)'}
          </button>
          {expanded && (
            <div style={{marginTop:10,padding:'12px 0',borderTop:`1px solid ${Q.gold}22`,borderBottom:`1px solid ${Q.gold}22`}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                <DarkField label="% grasso" value={draft.bf} onChange={v=>setDraft({...draft,bf:v})} placeholder="22,5" Q={Q} />
                <DarkField label="% muscolo" value={draft.mu} onChange={v=>setDraft({...draft,mu:v})} placeholder="38,1" Q={Q} />
                <DarkField label="% acqua" value={draft.wa} onChange={v=>setDraft({...draft,wa:v})} placeholder="56,3" Q={Q} />
              </div>
              <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:11,color:Q.goldDim,marginTop:8,textAlign:'center'}}>opzionali — copia dalla bilancia</div>
            </div>
          )}
          <EditButtons onCancel={()=>setEditing(null)} onSave={save} onDelete={editing!=='new'?del:null} Q={Q} />
        </ModalQ>
      )}
      {showGoal && (
        <ModalQ Q={Q} onClose={()=>setShowGoal(false)} title="OBIETTIVO" subtitle="il peso che desideri raggiungere">
          <InputBig value={draftGoal} onChange={setDraftGoal} onEnter={saveGoal} placeholder="68,0" unit="CHILOGRAMMI" Q={Q} />
          <EditButtons onCancel={()=>setShowGoal(false)} onSave={saveGoal} Q={Q} />
        </ModalQ>
      )}
    </div>
  );
}

function BodyStat({ label, value, Q }){
  return (
    <div style={{textAlign:'center'}}>
      <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:16,color:Q.cream}}>{value}</div>
      <div style={{fontFamily:fCinzel,fontSize:8,letterSpacing:'0.3em',color:Q.goldDim,textTransform:'uppercase',marginTop:2}}>{label}</div>
    </div>
  );
}
function DarkField({ label, value, onChange, placeholder, Q }){
  return (
    <div>
      <div style={{fontFamily:fCinzel,fontSize:8,letterSpacing:'0.3em',color:Q.goldDim,textTransform:'uppercase',marginBottom:4}}>{label}</div>
      <input type="text" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${Q.gold}66`,color:Q.cream,fontFamily:fGaramond,fontStyle:'italic',fontSize:18,padding:'4px 0',outline:'none',textAlign:'center'}} />
    </div>
  );
}


function ToggleRow({ children, checked, onToggle, ink }){
  return (
    <button onClick={onToggle} style={{display:'flex',alignItems:'center',width:'100%',padding:'10px 0',borderBottom:`1px dashed ${ink}22`,background:'transparent',border:'none',cursor:'pointer',textAlign:'left'}}>
      <span style={{width:20,height:20,borderRadius:'50%',border:`1.5px solid ${ink}`,background:checked?ink:'transparent',flexShrink:0,marginRight:12,display:'flex',alignItems:'center',justifyContent:'center',color:checked?'#fff':'transparent',fontSize:12}}>✓</span>
      <span style={{flex:1,color:ink,opacity:checked?1:0.5}}>{children}</span>
    </button>
  );
}

function PastiPage({ user, theme, loaded, meals, updMeals, notes, weights, goal }){
  // Tema dinamico: shadowing del J globale del modulo
  const J = theme || { bg: '#E5E3D5', dark: '#2D3A2E', sage: '#5C6B4E', light: '#8FA288' };
  const [selectedDay, setSelectedDay] = useState(dayKey(new Date()));
  const [editing, setEditing] = useState(null);
  // Foto pre-caricata da bottone top-level "IA da foto": viene passata al MealModal che la analizza in automatico
  const [photoIaSeed, setPhotoIaSeed] = useState(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const photoIaRef = useRef(null);
  // Bulk stima nutrienti
  const [bulkEstimating, setBulkEstimating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkError, setBulkError] = useState('');

  async function onPhotoIaPick(e){
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPreparingPhoto(true);
    try {
      const b64 = await resizeImage(file, 480, 0.7);
      setPhotoIaSeed(b64);
      setEditing('new'); // apre MealModal in modalità "nuovo"
    } catch (_) {
      // se la lettura fallisce, apriamo comunque il modal vuoto
      setEditing('new');
    } finally {
      setPreparingPhoto(false);
    }
  }

  const isToday = selectedDay===dayKey(new Date());
  // Stima bulk dei nutrienti per i pasti del giorno corrente che hanno descrizione o foto ma mancano kcal
  async function bulkEstimateNutrients(){
    const dayDate = parseDayKey(selectedDay);
    const candidates = meals.filter(m => {
      if (!sameDay(new Date(m.ts), dayDate)) return false;
      const hasPhoto = !!(m.photo || m.photo_url);
      const hasDesc = (m.description||'').trim().length > 0;
      // Candidate se ha foto e manca almeno uno tra: descrizione, quantità, kcal
      if (hasPhoto && (!hasDesc || m.qty_g == null || m.kcal == null)) return true;
      // Oppure: ha solo descrizione (senza foto) ma senza nutrienti — vecchio comportamento
      if (!hasPhoto && hasDesc && m.kcal == null) return true;
      return false;
    });
    if (candidates.length === 0) {
      setBulkError('Nessun pasto da analizzare. Tutti hanno già nome, peso e nutrienti.');
      setTimeout(()=>setBulkError(''), 4000);
      return;
    }
    setBulkError(''); setBulkEstimating(true);
    setBulkProgress({ done: 0, total: candidates.length });

    // Helper: scarica URL come data URL base64
    async function urlToDataUrl(url){
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('fetch foto fallita');
      const blob = await resp.blob();
      return await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error('lettura foto fallita'));
        r.readAsDataURL(blob);
      });
    }

    let updated = [...meals];
    let okCount = 0, errCount = 0;
    for (let i = 0; i < candidates.length; i++) {
      const meal = candidates[i];
      try {
        let photoData = null;
        if (meal.photo && typeof meal.photo === 'string' && meal.photo.startsWith('data:image/')) {
          photoData = meal.photo;
        } else if (meal.photo_url) {
          try { photoData = await urlToDataUrl(meal.photo_url); } catch (_) { photoData = null; }
        }
        const hasDesc = (meal.description||'').trim().length > 0;
        // Se manca descrizione (caso "solo foto"), passo description vuota: l'AI identificherà il piatto
        const r = await estimateMealNutrition({
          description: hasDesc ? meal.description : '',
          qty_g: meal.qty_g,
          photo: photoData,
        });
        if (!r.error) {
          const idx = updated.findIndex(m => m.id === meal.id);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              description: (!hasDesc && r.name) ? r.name : updated[idx].description,
              qty_g: (updated[idx].qty_g == null && r.qty_g != null) ? r.qty_g : updated[idx].qty_g,
              kcal: r.kcal != null ? r.kcal : updated[idx].kcal,
              p: r.p != null ? r.p : updated[idx].p,
              c: r.c != null ? r.c : updated[idx].c,
              g: r.g != null ? r.g : updated[idx].g,
            };
            okCount++;
          }
        } else {
          errCount++;
        }
      } catch (_) {
        errCount++;
      }
      setBulkProgress({ done: i+1, total: candidates.length });
    }

    if (okCount > 0) {
      await updMeals(updated);
    }
    setBulkEstimating(false);
    if (errCount > 0) {
      setBulkError(`Stimati ${okCount}/${candidates.length}. ${errCount} non riusciti.`);
      setTimeout(()=>setBulkError(''), 5000);
    }
  }

  const dayMeals = useMemo(()=>{
    const date=parseDayKey(selectedDay);
    const list=meals.filter(m=>sameDay(new Date(m.ts),date));
    list.sort((a,b)=>{ const oa=MEAL_TYPES.find(t=>t.id===a.type)?.order??99; const ob=MEAL_TYPES.find(t=>t.id===b.type)?.order??99; if(oa!==ob)return oa-ob; return new Date(a.ts)-new Date(b.ts); });
    return list;
  },[meals,selectedDay]);

  const eatenMeals = useMemo(()=>dayMeals.filter(m=>m.status!=='planned'),[dayMeals]);
  const plannedMeals = useMemo(()=>dayMeals.filter(m=>m.status==='planned'),[dayMeals]);

  const totals = useMemo(()=>eatenMeals.reduce((acc,m)=>({kcal:acc.kcal+(m.kcal||0),p:acc.p+(m.p||0),c:acc.c+(m.c||0),g:acc.g+(m.g||0)}),{kcal:0,p:0,c:0,g:0}),[eatenMeals]);
  const plannedTotalKcal = useMemo(()=>plannedMeals.reduce((a,m)=>a+(m.kcal||0),0),[plannedMeals]);

  async function saveMeal(meal){
    // Gestione foto: se c'è una nuova foto base64, uploadla su Storage
    let finalMeal = { ...meal };
    const mealId = editing === 'new' ? newId() : editing;

    if (meal.photo && user?.id) {
      // Nuova foto base64 → upload su Storage
      try {
        const url = await uploadMealPhotoToStorage(user.id, mealId, meal.photo);
        finalMeal.photo_url = url;
        finalMeal.photo = null; // non salvare base64 nel DB
        delete finalMeal.photo_legacy;
      } catch (err) {
        console.warn('[saveMeal] upload Storage fallito, fallback base64', err);
        // Lascia photo come base64 nel DB come fallback
      }
    } else if (meal.photo_legacy && user?.id) {
      // Migrazione: il pasto esistente aveva una foto base64, proviamo a migrare
      try {
        const url = await uploadMealPhotoToStorage(user.id, mealId, meal.photo_legacy);
        finalMeal.photo_url = url;
        finalMeal.photo = null;
        delete finalMeal.photo_legacy;
      } catch (_) {
        finalMeal.photo = meal.photo_legacy;
        delete finalMeal.photo_legacy;
      }
    } else {
      // Nessuna nuova foto: rispetta photo_url esistente, e cancella base64 legacy
      delete finalMeal.photo_legacy;
      if (!finalMeal.photo_url) finalMeal.photo = null;
    }

    if(editing==='new'){
      const ts = selectedDay===dayKey(new Date()) ? new Date() : (()=>{const d=parseDayKey(selectedDay); d.setHours(12,0); return d;})();
      // Pasti in PastiPage sono sempre 'eaten' (i 'planned' si gestiscono nella pagina Menù)
      // Rimuovi il flag tsOverride che non e' una colonna DB
      const { tsOverride: _ignored, ...mealForDb } = finalMeal;
      await updMeals([...meals,{id:mealId,ts:ts.toISOString(),status:'eaten',...mealForDb}]);
    } else {
      // Pasto esistente: applica tsOverride se l'utente ha cambiato data nel modal
      const { tsOverride, ...mealForDb } = finalMeal;
      const patch = tsOverride ? { ...mealForDb, ts: tsOverride } : mealForDb;
      await updMeals(meals.map(m=>m.id===editing?{...m,...patch}:m));
    }
    setEditing(null);
  }
  async function delMeal(){
    // Cancella anche la foto da Storage se c'era
    const meal = meals.find(m=>m.id===editing);
    if (meal && (meal.photo_url || meal.photo) && user?.id) {
      try { await deleteMealPhotoFromStorage(user.id, meal.id); } catch (_) {}
    }
    await updMeals(meals.filter(m=>m.id!==editing));
    setEditing(null);
  }

  const dateLabel = parseDayKey(selectedDay).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});
  const editingMeal = editing && editing!=='new' ? meals.find(m=>m.id===editing) : null;

  return (
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at top, ${J.bg1} 0%, ${J.bg2} 100%)`,color:J.cream,fontFamily:fMarcellus,position:'relative',overflow:'hidden'}}>
      <div aria-hidden style={{position:'absolute',inset:14,border:`1px solid ${J.gold}40`,borderRadius:20,pointerEvents:'none',zIndex:1}} />
      <div aria-hidden style={{position:'absolute',inset:20,border:`1px solid ${J.gold}1A`,borderRadius:16,pointerEvents:'none',zIndex:1}} />
      <div style={{position:'relative',zIndex:2,padding:'32px 28px 28px',maxWidth:480,margin:'0 auto'}}>
        <Header q="PASTI" sub="II" color={J.gold} dim={J.goldDim} mark="✦" />
        {!loaded && <Loading color={J.sage} />}
        {loaded && (<>
          <DayStrip selectedKey={selectedDay} onSelect={setSelectedDay} ink={J.dark} tan={J.sage} count={14} fontA={fMarcellus} fontB={fGaramond} />
          <div style={{marginTop:12,fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:J.sage,textAlign:'center'}}>{dateLabel}</div>
          <div style={{marginTop:18,padding:'14px 0',borderTop:`1px solid ${J.sage}66`,borderBottom:`1px solid ${J.sage}66`,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            <Totale label="kcal" value={fmt0(totals.kcal)} dark={J.dark} sage={J.sage} font={fMarcellus} big={fGaramond} />
            <Totale label="prot." value={fmt0(totals.p)} unit="g" dark={J.dark} sage={J.sage} font={fMarcellus} big={fGaramond} />
            <Totale label="carb." value={fmt0(totals.c)} unit="g" dark={J.dark} sage={J.sage} font={fMarcellus} big={fGaramond} />
            <Totale label="gras." value={fmt0(totals.g)} unit="g" dark={J.dark} sage={J.sage} font={fMarcellus} big={fGaramond} />
          </div>

          {/* PastiPage ora mostra solo i pasti EFFETTIVAMENTE FATTI di oggi (i pianificati stanno nella pagina Menù) */}
          {true && (
            <div style={{marginTop:14}}>
              {MEAL_TYPES.map(type => {
                const mealsOfType = eatenMeals.filter(m => m.type === type.id);
                const typeTotals = mealsOfType.reduce((acc,m)=>({kcal:acc.kcal+(m.kcal||0)}),{kcal:0});
                return (
                  <div key={type.id} style={{marginTop:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'6px 0',borderBottom:`1px solid ${J.dark}`}}>
                      <span style={{fontFamily:fMarcellus,fontSize:11,letterSpacing:'0.35em',color:J.dark,textTransform:'uppercase'}}>{type.name}</span>
                      {mealsOfType.length>0 && <span style={{fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.25em',color:J.sage,textTransform:'uppercase'}}>{fmt0(typeTotals.kcal)} kcal</span>}
                    </div>
                    {mealsOfType.length === 0 ? (
                      <div style={{padding:'10px 4px',fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:J.sage,opacity:0.55}}>—</div>
                    ) : mealsOfType.sort((a,b)=>new Date(a.ts)-new Date(b.ts)).map(m=>{const t=new Date(m.ts); return (
                      <button key={m.id} onClick={()=>setEditing(m.id)} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'10px 0',borderBottom:`1px solid ${J.sage}22`,background:'transparent',border:'none',borderRadius:0,width:'100%',cursor:'pointer',textAlign:'left'}}>
                        {(m.photo_url||m.photo) ? <img src={m.photo_url||m.photo} alt="" loading="lazy" style={{width:52,height:52,objectFit:'cover',borderRadius:'50%',flexShrink:0,border:`2px solid ${J.sage}`}} /> : <div style={{width:52,height:52,borderRadius:'50%',background:`linear-gradient(135deg, ${J.light}, ${J.sage})`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',color:J.bg,fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.25em'}}>{type.abbr}</div>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:15,color:J.dark,lineHeight:1.25}}>{m.description||'(senza descrizione)'}</div>
                          <div style={{fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.2em',color:J.sage,marginTop:4,textTransform:'uppercase'}}>{t.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}{m.qty_g?` · ${fmt0(m.qty_g)}g`:''} · {fmt0(m.kcal)} kcal · P {fmt0(m.p)} · C {fmt0(m.c)} · G {fmt0(m.g)}</div>
                        </div>
                      </button>
                    );})}
                  </div>
                );
              })}

              <div style={{marginTop:28,paddingTop:18,borderTop:`1px solid ${J.sage}33`,textAlign:'center'}}>
                <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:J.sage,marginBottom:14,lineHeight:1.5,maxWidth:340,margin:'0 auto 14px'}}>Scatta o carica una foto del piatto: l'IA identifica cosa è, stima la porzione e calcola i macronutrienti.</div>
                <input ref={photoIaRef} type="file" accept="image/*" onChange={onPhotoIaPick} style={{display:'none'}} />
                <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'center'}}>
                  <button onClick={()=>photoIaRef.current?.click()} disabled={preparingPhoto} style={{background:J.sage,color:J.bg,border:`1px solid ${J.sage}`,fontFamily:fMarcellus,fontSize:11,letterSpacing:'0.4em',padding:'14px 30px',cursor:preparingPhoto?'default':'pointer',opacity:preparingPhoto?0.6:1,textTransform:'uppercase'}}>{preparingPhoto?'⋯ apro foto':'✦ IA · pasto da foto'}</button>
                  <button onClick={()=>setEditing('new')} style={{background:'transparent',color:J.dark,border:`1px solid ${J.dark}66`,fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.35em',padding:'10px 22px',cursor:'pointer',textTransform:'uppercase'}}>+ nuovo pasto a mano</button>
                </div>
                {/* Bulk: analizza con IA i pasti del giorno che hanno foto ma campi incompleti (nome / peso / nutrienti) */}
                {(() => {
                  const missing = eatenMeals.filter(m => {
                    const hasPhoto = !!(m.photo || m.photo_url);
                    const hasDesc = (m.description||'').trim().length > 0;
                    if (hasPhoto && (!hasDesc || m.qty_g == null || m.kcal == null)) return true;
                    if (!hasPhoto && hasDesc && m.kcal == null) return true;
                    return false;
                  });
                  const nothingToAnalyze = missing.length === 0 && !bulkEstimating;
                  return (
                    <div style={{marginTop:22,paddingTop:14,borderTop:`1px dashed ${J.sage}33`}}>
                      <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:J.sage,marginBottom:10,lineHeight:1.4}}>
                        {bulkEstimating
                          ? `Analizzando... ${bulkProgress.done}/${bulkProgress.total}`
                          : nothingToAnalyze
                            ? `${eatenMeals.length === 0 ? 'Nessun pasto registrato' : 'Tutti i pasti di ' + (isToday?'oggi':'questo giorno') + ' hanno nome, peso e calorie'} · Il bottone si attiva quando ci sono foto da analizzare.`
                            : `${missing.length} ${missing.length===1?'pasto':'pasti'} di ${isToday?'oggi':'questo giorno'} ${missing.length===1?'ha':'hanno'} la foto ma ${missing.length===1?'manca':'mancano'} nome, peso o nutrienti.`}
                      </div>
                      <button
                        onClick={bulkEstimateNutrients}
                        disabled={bulkEstimating || nothingToAnalyze}
                        style={{
                          background:bulkEstimating||nothingToAnalyze?'transparent':J.sage,
                          color:bulkEstimating||nothingToAnalyze?J.sage:J.bg,
                          border:`1px solid ${J.sage}${nothingToAnalyze?'55':''}`,
                          fontFamily:fMarcellus,
                          fontSize:11,
                          letterSpacing:'0.3em',
                          padding:'10px 22px',
                          cursor:bulkEstimating||nothingToAnalyze?'default':'pointer',
                          opacity:nothingToAnalyze?0.5:1,
                          textTransform:'uppercase',
                        }}>
                        {bulkEstimating ? `⋯ ${bulkProgress.done}/${bulkProgress.total}` : '✦ analizza foto con ia'}
                      </button>
                      {bulkError && <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:'#A04848',marginTop:10}}>{bulkError}</div>}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

        </>)}
      </div>
      {editing && <MealModal J={J} existing={editingMeal} seedPhoto={editing==='new'?photoIaSeed:null} onClose={()=>{setEditing(null); setPhotoIaSeed(null);}} onSave={saveMeal} onDelete={editing!=='new'?delMeal:null} />}
    </div>
  );
}

// === Utility: calcolo dei target nutrizionali (Zona 40/30/30 per dimagrimento) ===
// Priorità: 1) profilo personalizzato · 2) Mifflin-St Jeor con deficit · 3) peso obiettivo×27 · 4) peso corrente×20
function computeNutritionTarget(profile, weights, goal) {
  if (profile?.daily_kcal_goal != null) {
    const kcal = Number(profile.daily_kcal_goal);
    return {
      kcal,
      protein: profile.daily_protein_g != null ? Number(profile.daily_protein_g) : Math.round((kcal * 0.30) / 4),
      carbs:   profile.daily_carbs_g   != null ? Number(profile.daily_carbs_g)   : Math.round((kcal * 0.40) / 4),
      fat:     profile.daily_fat_g     != null ? Number(profile.daily_fat_g)     : Math.round((kcal * 0.30) / 9),
      source: 'custom',
    };
  }
  const sortedW = [...(weights||[])].sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  const latestW = sortedW[0]?.weight || 70;
  const goalW = goal != null ? Number(goal) : null;
  const height = profile?.height_cm != null ? Number(profile.height_cm) : null;
  const birth = profile?.birth_year != null ? Number(profile.birth_year) : null;
  const age = birth ? (new Date().getFullYear() - birth) : null;
  const sex = (profile?.sex || '').toLowerCase() || null;

  let kcal, source;
  if (height && age && sex) {
    const bmr = sex === 'm'
      ? 10*latestW + 6.25*height - 5*age + 5
      : 10*latestW + 6.25*height - 5*age - 161;
    const tdee = bmr * 1.4;
    kcal = Math.round(tdee - 500);
    const floor = sex === 'm' ? 1400 : 1200;
    if (kcal < floor) kcal = floor;
    source = 'mifflin';
  } else if (goalW) {
    kcal = Math.round(goalW * 27);
    source = 'goal';
  } else {
    kcal = Math.round(latestW * 20);
    source = 'weight';
  }
  if (kcal < 1200) kcal = 1200;
  if (kcal > 3000) kcal = 3000;
  return {
    kcal,
    protein: Math.round((kcal * 0.30) / 4),
    carbs:   Math.round((kcal * 0.40) / 4),
    fat:     Math.round((kcal * 0.30) / 9),
    source,
  };
}

// === MenuPage: pianificazione del menù giornaliero con proposte IA cliccabili e progress su kcal/macro target ===
function MenuPage({ theme, loaded, meals, updMeals, weights, goal, profile, updProfile }) {
  const J = theme || { bg: '#E5E3D5', dark: '#2D3A2E', sage: '#5C6B4E', light: '#8FA288' };
  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [previousSuggested, setPreviousSuggested] = useState([]);
  // Modal di modifica target nutrizionali
  const [editingTargets, setEditingTargets] = useState(false);

  // Target giornalieri di kcal e macronutrienti (Zona 40/30/30 per dimagrimento)
  const target = useMemo(() => computeNutritionTarget(profile, weights, goal), [profile, weights, goal]);

  // Pasti pianificati di OGGI
  const todayK = dayKey(new Date());
  const plannedMeals = useMemo(() =>
    (meals||[]).filter(m => m.status === 'planned' && sameDay(new Date(m.ts), new Date())),
    [meals]
  );

  // Totali correnti dal menu pianificato
  const totals = useMemo(() => plannedMeals.reduce((acc, m) => ({
    kcal: acc.kcal + (m.kcal||0),
    protein: acc.protein + (m.p||0),
    carbs: acc.carbs + (m.c||0),
    fat: acc.fat + (m.g||0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [plannedMeals]);

  const targetReached = totals.kcal >= target.kcal * 0.95 && totals.kcal <= target.kcal * 1.05;

  async function loadSuggestions(){
    setSuggestLoading(true); setSuggestError('');
    try {
      // Costruisco un summary arricchito con target Zona + macro residui, così l'IA propone pasti che chiudono il gap
      const summary = buildEatingHabitsSummary({ meals, weights, goal })
        + `\n\nTARGET ODIERNO (Dieta a Zona 40/30/30 per dimagrimento):\n`
        + `- Calorie: ${target.kcal} kcal · Proteine: ${target.protein}g · Carb: ${target.carbs}g · Grassi: ${target.fat}g\n`
        + `MENU GIÀ PIANIFICATO OGGI:\n`
        + `- Calorie: ${totals.kcal}/${target.kcal} kcal · Proteine: ${totals.protein}/${target.protein}g · Carb: ${totals.carbs}/${target.carbs}g · Grassi: ${totals.fat}/${target.fat}g\n`
        + `RESIDUI DA COPRIRE: ${Math.max(0,target.kcal-totals.kcal)} kcal · ${Math.max(0,target.protein-totals.protein)}g P · ${Math.max(0,target.carbs-totals.carbs)}g C · ${Math.max(0,target.fat-totals.fat)}g G\n\n`
        + `LINEE GUIDA per i suggerimenti:\n`
        + `- Proponi solo alimenti che favoriscono il dimagrimento (alta sazietà, indice glicemico basso/medio, ricchi di nutrienti).\n`
        + `- PRIVILEGIA: pesce azzurro/magro, carni bianche magre, uova, legumi, verdure di stagione, frutti di bosco, agrumi, mela, pera, frutta secca a porzioni controllate, cereali integrali (avena, farro, quinoa, riso integrale), latticini magri (greco, ricotta), olio extravergine.\n`
        + `- EVITA: zuccheri raffinati, dolci industriali, bibite zuccherate, alcolici, fritti, salumi grassi, pane bianco, pasta raffinata in eccesso, succhi confezionati.\n`
        + `- Bilancia ogni piatto verso la Zona 40/30/30 quando possibile (in particolare il pranzo e la cena).\n`
        + `- Dai precedenza ai macro residui (se mancano molte proteine, proponi pasti proteici; se mancano carb, proponi cereali integrali; ecc.).\n`;
      const r = await suggestMeals(summary, previousSuggested);
      if (r.error) setSuggestError('IA: ' + (r.error || 'errore sconosciuto'));
      else if (!r.meals || r.meals.length === 0) setSuggestError('Nessun suggerimento ricevuto.');
      else {
        setSuggestions(r.meals);
        setPreviousSuggested(prev => [...prev, ...r.meals.map(m=>m.description)].slice(-40));
      }
    } catch (e) { setSuggestError('Errore'); }
    finally { setSuggestLoading(false); }
  }

  async function addSuggestion(m){
    const ts = new Date();
    await updMeals([...(meals||[]), {
      id: newId(),
      ts: ts.toISOString(),
      type: m.type,
      description: m.description,
      qty_g: m.qty_g,
      kcal: m.kcal,
      p: m.p, c: m.c, g: m.g,
      photo: null,
      status: 'planned',
    }]);
  }

  async function markAsEaten(mealId){
    await updMeals((meals||[]).map(m => m.id===mealId ? { ...m, status: 'eaten', ts: new Date().toISOString() } : m));
  }

  async function removeFromMenu(mealId){
    await updMeals((meals||[]).filter(m => m.id !== mealId));
  }

  // Componenti helper per progress bar
  function ProgressRow({ label, current, target, unit, color }) {
    const pct = target > 0 ? Math.min(150, (current / target) * 100) : 0;
    const over = pct > 105;
    const ok = pct >= 95 && pct <= 105;
    const barColor = over ? '#C8763C' : (ok ? '#A5B889' : color || J.sage);
    return (
      <div style={{marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
          <span style={{fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.3em',color:J.dark,textTransform:'uppercase'}}>{label}</span>
          <span style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:14,color:over?'#C8763C':(ok?'#6B8060':J.dark)}}>
            {fmt0(current)}<span style={{fontSize:11,color:J.sage,opacity:0.7}}> / {fmt0(target)} {unit}</span>
          </span>
        </div>
        <div style={{height:5,background:`${J.sage}22`,borderRadius:2,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${Math.min(100,pct)}%`,background:barColor,transition:'width 0.3s ease'}} />
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at top, ${J.bg||'#E5E3D5'} 0%, ${J.bg2||'#CFCDB7'} 100%)`,color:J.dark,fontFamily:fGaramond,position:'relative',overflow:'hidden'}}>
      <div aria-hidden style={{position:'absolute',inset:14,border:`1px solid ${J.dark}25`,borderRadius:20,pointerEvents:'none',zIndex:1}} />
      <div aria-hidden style={{position:'absolute',inset:20,border:`1px solid ${J.dark}10`,borderRadius:16,pointerEvents:'none',zIndex:1}} />
      <div style={{position:'relative',zIndex:2,padding:'32px 28px 28px',maxWidth:480,margin:'0 auto'}}>
        <Header q="MENÙ" sub="III" color={J.dark} dim={J.sage} mark="✦" />

        {!loaded && <Loading color={J.sage} />}

        {loaded && (<>
          {/* === SEZIONE TOTALI / TARGET — cliccabile per modificare === */}
          <div onClick={()=>setEditingTargets(true)} style={{marginTop:22,padding:'14px 14px 8px',background:`${J.sage}10`,border:`1px solid ${J.sage}33`,cursor:'pointer',position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.4em',color:J.sage,textTransform:'uppercase'}}>obiettivo del giorno · zona 40/30/30</div>
              <span style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:11,color:J.sage,opacity:0.75}}>tocca per modificare ›</span>
            </div>
            <ProgressRow label="calorie" current={totals.kcal} target={target.kcal} unit="kcal" />
            <ProgressRow label="proteine · 30%" current={totals.protein} target={target.protein} unit="g" />
            <ProgressRow label="carboidrati · 40%" current={totals.carbs} target={target.carbs} unit="g" />
            <ProgressRow label="grassi · 30%" current={totals.fat} target={target.fat} unit="g" />
            {targetReached && (
              <div style={{marginTop:6,padding:'8px 10px',background:`#A5B88922`,border:`1px solid #A5B889`,fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:'#6B8060',textAlign:'center'}}>
                ✓ obiettivo del giorno raggiunto
              </div>
            )}
          </div>

          {/* === IL MIO MENÙ === */}
          <div style={{marginTop:24}}>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
              <div style={{flex:1,height:1,background:`linear-gradient(90deg, transparent, ${J.dark}55)`}} />
              <span style={{fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.4em',color:J.dark,textTransform:'uppercase'}}>il mio menù</span>
              <div style={{flex:1,height:1,background:`linear-gradient(90deg, ${J.dark}55, transparent)`}} />
            </div>
            {plannedMeals.length === 0 ? (
              <div style={{textAlign:'center',fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:J.sage,padding:'10px 4px 0',lineHeight:1.5,opacity:0.85}}>
                Nessun pasto pianificato. Tocca un suggerimento qui sotto per aggiungerlo.
              </div>
            ) : MEAL_TYPES.map(type => {
              const mealsOfType = plannedMeals.filter(m => m.type === type.id);
              if (mealsOfType.length === 0) return null;
              const amber = '#B89548', amberBg = '#F2E8D0';
              return (
                <div key={type.id} style={{marginTop:14}}>
                  <div style={{padding:'6px 0',borderBottom:`1px solid ${amber}55`}}>
                    <span style={{fontFamily:fMarcellus,fontSize:11,letterSpacing:'0.35em',color:amber,textTransform:'uppercase'}}>{type.name}</span>
                  </div>
                  {mealsOfType.map(m => (
                    <div key={m.id} style={{display:'flex',gap:8,alignItems:'stretch',marginTop:8}}>
                      <button onClick={()=>markAsEaten(m.id)} style={{flex:1,display:'flex',gap:10,alignItems:'flex-start',padding:'12px 14px',background:amberBg,border:`1px solid ${amber}`,borderLeft:`3px solid ${amber}`,color:amber,cursor:'pointer',textAlign:'left',borderRadius:0}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:15,color:J.dark,lineHeight:1.25}}>{m.description||'(senza descrizione)'}</div>
                          <div style={{fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.2em',marginTop:4,textTransform:'uppercase',opacity:0.9}}>{m.qty_g?`${fmt0(m.qty_g)}g · `:''}{fmt0(m.kcal)} kcal · P {fmt0(m.p)} · C {fmt0(m.c)} · G {fmt0(m.g)}</div>
                          <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:11,marginTop:4,opacity:0.7}}>↳ tocca quando l'hai mangiato</div>
                        </div>
                      </button>
                      <button onClick={()=>removeFromMenu(m.id)} style={{padding:'0 12px',background:'transparent',border:`1px solid ${amber}55`,color:amber,fontFamily:fMarcellus,fontSize:14,cursor:'pointer'}} title="rimuovi dal menù">×</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* === PROPOSTE IA — sempre visibili e cliccabili === */}
          <div style={{marginTop:30}}>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
              <div style={{flex:1,height:1,background:`linear-gradient(90deg, transparent, #C8763C66)`}} />
              <span style={{fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.4em',color:'#C8763C',textTransform:'uppercase'}}>proposte ia</span>
              <div style={{flex:1,height:1,background:`linear-gradient(90deg, #C8763C66, transparent)`}} />
            </div>

            {!suggestions && !suggestLoading && !suggestError && (
              <div style={{textAlign:'center'}}>
                <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:J.sage,marginBottom:12,lineHeight:1.5,maxWidth:340,margin:'0 auto 12px'}}>L'IA propone pasti bilanciati Zona 40/30/30 con alimenti che favoriscono il dimagrimento, in base ai macro che ti mancano.</div>
                <button onClick={loadSuggestions} style={{background:'transparent',color:'#C8763C',border:`1px solid #C8763C`,fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.35em',padding:'12px 24px',cursor:'pointer',textTransform:'uppercase'}}>chiedi suggerimenti</button>
              </div>
            )}
            {suggestLoading && <div style={{textAlign:'center',padding:'14px 0',fontFamily:fGaramond,fontStyle:'italic',fontSize:14,color:J.sage}}>⋯ sto pensando ai tuoi pasti</div>}
            {suggestError && !suggestLoading && (
              <div style={{textAlign:'center'}}>
                <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:'#A04848',marginBottom:8}}>{suggestError}</div>
                <button onClick={loadSuggestions} style={{background:'transparent',color:J.sage,border:`1px solid ${J.sage}66`,fontFamily:fGaramond,fontStyle:'italic',fontSize:13,padding:'6px 16px',cursor:'pointer'}}>riprova</button>
              </div>
            )}
            {suggestions && suggestions.length > 0 && (
              <>
                <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:'#A8623E',textAlign:'center',marginBottom:10}}>tocca un piatto per aggiungerlo al menù · i totali si aggiornano</div>
                <div>
                  {suggestions.map((m, i) => {
                    const tName = MEAL_TYPES.find(t=>t.id===m.type)?.name || m.type;
                    const orange = '#C8763C', orangeBg = '#F2E0CC';
                    return (
                      <button key={i} onClick={()=>addSuggestion(m)} style={{width:'100%',display:'flex',gap:10,alignItems:'flex-start',padding:'12px 14px',marginBottom:8,background:orangeBg,border:`1px solid ${orange}`,borderLeft:`3px solid ${orange}`,color:orange,cursor:'pointer',textAlign:'left',borderRadius:0}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.35em',textTransform:'uppercase',opacity:0.9}}>{tName}{m.qty_g?` · ${fmt0(m.qty_g)}g`:''}</div>
                          <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:15,marginTop:3,lineHeight:1.25,color:J.dark}}>{m.description}</div>
                          <div style={{fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.2em',marginTop:3,textTransform:'uppercase',opacity:0.85}}>{fmt0(m.kcal)} kcal · P {fmt0(m.p)} · C {fmt0(m.c)} · G {fmt0(m.g)}</div>
                          {m.perche && <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:12,marginTop:4,lineHeight:1.4,opacity:0.85}}>· {m.perche}</div>}
                        </div>
                        <span style={{fontFamily:fMarcellus,fontSize:18,opacity:0.7,marginLeft:8}}>+</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{textAlign:'center',marginTop:12}}>
                  <button onClick={loadSuggestions} style={{background:'transparent',color:J.sage,border:`1px solid ${J.sage}66`,fontFamily:fGaramond,fontStyle:'italic',fontSize:12,padding:'6px 14px',cursor:'pointer'}}>altri suggerimenti</button>
                </div>
              </>
            )}
          </div>
        </>)}
      </div>

      {editingTargets && <TargetsModal J={J} target={target} updProfile={updProfile} onClose={()=>setEditingTargets(false)} />}
    </div>
  );
}

// Modal per modificare i target nutrizionali. Mostra anche un bottone "Riapplica Zona 40/30/30" che ricalcola da kcal.
function TargetsModal({ J, target, updProfile, onClose }) {
  const [kcalStr, setKcalStr] = useState(String(target.kcal));
  const [pStr, setPStr] = useState(String(target.protein));
  const [cStr, setCStr] = useState(String(target.carbs));
  const [gStr, setGStr] = useState(String(target.fat));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function applyZone(){
    const kcal = parseInt(kcalStr); if (isNaN(kcal) || kcal <= 0) return;
    setPStr(String(Math.round((kcal * 0.30) / 4)));
    setCStr(String(Math.round((kcal * 0.40) / 4)));
    setGStr(String(Math.round((kcal * 0.30) / 9)));
  }

  async function save(){
    const kcal = parseInt(kcalStr);
    const p = parseInt(pStr);
    const c = parseInt(cStr);
    const g = parseInt(gStr);
    if (isNaN(kcal) || kcal <= 0) { setErr('Calorie non valide'); return; }
    if (isNaN(p) || isNaN(c) || isNaN(g) || p<0 || c<0 || g<0) { setErr('Macronutrienti non validi'); return; }
    setSaving(true); setErr('');
    try {
      await updProfile({ daily_kcal_goal: kcal, daily_protein_g: p, daily_carbs_g: c, daily_fat_g: g });
      onClose();
    } catch (e) {
      setErr('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  }

  async function resetToZone(){
    setSaving(true); setErr('');
    try {
      await updProfile({ daily_kcal_goal: null, daily_protein_g: null, daily_carbs_g: null, daily_fat_g: null });
      onClose();
    } catch (e) {
      setErr('Errore');
    } finally {
      setSaving(false);
    }
  }

  // Live check: la somma kcal dai macro deve rispettare il totale (entro 5%)
  const kcalFromMacros = (parseInt(pStr)||0)*4 + (parseInt(cStr)||0)*4 + (parseInt(gStr)||0)*9;
  const kcalNum = parseInt(kcalStr) || 0;
  const diff = kcalFromMacros - kcalNum;
  const diffPct = kcalNum > 0 ? (diff / kcalNum) * 100 : 0;
  const balanced = Math.abs(diffPct) <= 5;

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:J.bg||'#E5E3D5',border:`1px solid ${J.dark}55`,padding:'22px 20px',maxWidth:380,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{fontFamily:fMarcellus,fontSize:12,letterSpacing:'0.4em',color:J.dark,textAlign:'center',marginBottom:6,textTransform:'uppercase'}}>obiettivo del giorno</div>
        <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:J.sage,textAlign:'center',marginBottom:18,lineHeight:1.4}}>Dieta a Zona 40/30/30 per dimagrimento: <b>40% carboidrati · 30% proteine · 30% grassi</b>.</div>

        <div style={{marginBottom:14}}>
          <div style={{fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.4em',color:J.sage,textTransform:'uppercase',marginBottom:4}}>calorie / giorno</div>
          <input type="text" inputMode="numeric" value={kcalStr} onChange={e=>setKcalStr(e.target.value.replace(/[^0-9]/g,''))} style={fieldInput(J)} />
        </div>

        <div style={{textAlign:'center',marginBottom:14}}>
          <button onClick={applyZone} style={{background:'transparent',color:J.sage,border:`1px solid ${J.sage}66`,fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.3em',padding:'7px 14px',cursor:'pointer',textTransform:'uppercase'}}>↻ ricalcola macro da kcal (zona 40/30/30)</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
          <div>
            <div style={{fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.3em',color:J.sage,textTransform:'uppercase',marginBottom:4}}>prot · g</div>
            <input type="text" inputMode="numeric" value={pStr} onChange={e=>setPStr(e.target.value.replace(/[^0-9]/g,''))} style={fieldInput(J)} />
          </div>
          <div>
            <div style={{fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.3em',color:J.sage,textTransform:'uppercase',marginBottom:4}}>carb · g</div>
            <input type="text" inputMode="numeric" value={cStr} onChange={e=>setCStr(e.target.value.replace(/[^0-9]/g,''))} style={fieldInput(J)} />
          </div>
          <div>
            <div style={{fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.3em',color:J.sage,textTransform:'uppercase',marginBottom:4}}>gras · g</div>
            <input type="text" inputMode="numeric" value={gStr} onChange={e=>setGStr(e.target.value.replace(/[^0-9]/g,''))} style={fieldInput(J)} />
          </div>
        </div>

        <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:11,textAlign:'center',marginBottom:14,color:balanced?'#6B8060':'#C8763C',padding:'6px 10px',background:`${balanced?'#A5B889':'#C8763C'}11`,border:`1px solid ${balanced?'#A5B889':'#C8763C'}33`}}>
          kcal da macro: {fmt0(kcalFromMacros)} ({diff>0?'+':''}{fmt0(diff)} dal target {diffPct>0?'+':''}{Math.round(diffPct)}%){balanced?' · ok':''}
        </div>

        {err && <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:'#A04848',textAlign:'center',marginBottom:10}}>{err}</div>}

        <div style={{display:'flex',gap:8,justifyContent:'space-between',flexWrap:'wrap'}}>
          <button onClick={resetToZone} disabled={saving} style={{background:'transparent',color:J.sage,border:`1px solid ${J.sage}66`,fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.3em',padding:'8px 12px',cursor:saving?'default':'pointer',textTransform:'uppercase'}}>auto (da peso)</button>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} disabled={saving} style={{background:'transparent',color:J.sage,border:`1px solid ${J.sage}66`,fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.3em',padding:'8px 14px',cursor:saving?'default':'pointer',textTransform:'uppercase'}}>annulla</button>
            <button onClick={save} disabled={saving} style={{background:J.dark,color:J.bg,border:`1px solid ${J.dark}`,fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.3em',padding:'8px 18px',cursor:saving?'default':'pointer',textTransform:'uppercase',opacity:saving?0.6:1}}>{saving?'⋯':'salva'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MealModal({ existing, onClose, onSave, onDelete, J, seedPhoto }){
  const [type, setType] = useState(existing?.type || 'colazione');
  const [description, setDescription] = useState(existing?.description || '');
  const [qty, setQty] = useState(existing?.qty_g!=null ? String(existing.qty_g) : '');
  // Unita' di misura per la quantita': 'g' (default) o 'ml'. E' cosmetica: il valore va sempre in qty_g.
  const [qtyUnit, setQtyUnit] = useState('g');
  const [kcal, setKcal] = useState(existing?.kcal!=null ? String(existing.kcal) : '');
  const [p, setP] = useState(existing?.p!=null ? String(existing.p) : '');
  const [c, setC] = useState(existing?.c!=null ? String(existing.c) : '');
  const [g, setG] = useState(existing?.g!=null ? String(existing.g) : '');
  // Scelta data: solo per modifica di pasto esistente. null = mantieni, 'oggi' o 'ieri' = sposta a quel giorno (ora preservata)
  const isExistingToday = existing?.ts ? sameDay(new Date(existing.ts), new Date()) : false;
  const isExistingYesterday = existing?.ts ? sameDay(new Date(existing.ts), new Date(Date.now() - 86400000)) : false;
  const [dateChoice, setDateChoice] = useState(isExistingToday ? 'oggi' : (isExistingYesterday ? 'ieri' : null));
  // photo (base64) = nuova foto appena scelta; photoUrl = url Storage esistente
  // se l'utente carica nuova foto, photo viene riempito e photoUrl ignorato
  // seedPhoto (base64) viene da bottone "IA da foto" in PastiPage: la pre-carichiamo qui
  const [photo, setPhoto] = useState(seedPhoto || null);
  const [photoUrl, setPhotoUrl] = useState(existing?.photo_url || null);
  const [legacyPhoto, setLegacyPhoto] = useState(existing?.photo_url ? null : (existing?.photo || null));
  const [busy, setBusy] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const [estimateNote, setEstimateNote] = useState('');
  const [autoTriggered, setAutoTriggered] = useState(false);
  const fileRef = useRef(null);

  // L'immagine da mostrare a schermo
  const displayPhoto = photo || photoUrl || legacyPhoto;

  async function pickPhoto(e){
    const file=e.target.files?.[0]; if(!file)return;
    setBusy(true);
    try{
      const b64=await resizeImage(file,480,0.7);
      setPhoto(b64);
      // L'utente sta sostituendo la foto: invalidiamo le precedenti
      setPhotoUrl(null);
      setLegacyPhoto(null);
    } catch(_) {}
    finally{setBusy(false);}
    e.target.value='';
  }

  function removePhoto(){
    setPhoto(null); setPhotoUrl(null); setLegacyPhoto(null);
  }

  function save(){
    // Se l'utente ha scelto una data diversa da quella esistente, calcolo il nuovo ts
    // mantenendo l'ora del ts esistente (o ora corrente se nuovo).
    let tsOverride = null;
    if (dateChoice && existing?.ts) {
      const wasToday = sameDay(new Date(existing.ts), new Date());
      const wasYesterday = sameDay(new Date(existing.ts), new Date(Date.now() - 86400000));
      const changed = (dateChoice === 'oggi' && !wasToday) || (dateChoice === 'ieri' && !wasYesterday);
      if (changed) {
        const base = dateChoice === 'oggi' ? new Date() : new Date(Date.now() - 86400000);
        const existingDate = new Date(existing.ts);
        base.setHours(existingDate.getHours(), existingDate.getMinutes(), existingDate.getSeconds(), 0);
        tsOverride = base.toISOString();
      }
    }
    // Passa al parent: nuova foto base64 (se caricata), oppure URL esistente, oppure null
    onSave({
      type,
      description:description.trim(),
      qty_g:parseNum(qty,1,5000),
      kcal:parseNum(kcal,0,10000),
      p:parseNum(p,0,1000),
      c:parseNum(c,0,1000),
      g:parseNum(g,0,1000),
      photo: photo || null,                  // base64 nuovo (da caricare)
      photo_url: photo ? null : photoUrl,    // url esistente da preservare
      photo_legacy: photo || photoUrl ? null : legacyPhoto,  // base64 legacy da migrare
      tsOverride,
    });
  }

  async function estimateNutrition(){
    setEstimateError(''); setEstimateNote(''); setEstimating(true);
    try {
      const qtyNum = qty ? parseNum(qty,1,5000) : null;
      const r = await estimateMealNutrition({ description: description.trim(), qty_g: qtyNum, photo: photo || legacyPhoto });
      if (r.error) { setEstimateError(r.error); return; }
      // Se l'AI ha identificato il nome (caso solo foto), popolo description se vuoto
      if (r.name && !description.trim()) setDescription(r.name);
      // Se l'AI ha stimato la quantità e l'utente non l'ha specificata, la popolo
      if (r.qty_g != null && !qty) setQty(String(r.qty_g));
      if (r.kcal != null) setKcal(String(r.kcal));
      if (r.p != null) setP(String(r.p));
      if (r.c != null) setC(String(r.c));
      if (r.g != null) setG(String(r.g));
      if (r.note) setEstimateNote(r.note);
    } finally {
      setEstimating(false);
    }
  }

  // Se il modal è stato aperto con una foto pre-caricata dal bottone "IA da foto" della PastiPage,
  // avvia automaticamente l'analisi una sola volta.
  useEffect(() => {
    if (seedPhoto && !autoTriggered && !estimating && !description.trim() && !kcal) {
      setAutoTriggered(true);
      estimateNutrition();
    }
    // eslint-disable-next-line
  }, [seedPhoto]);

  const canEstimate = !estimating && (description.trim().length > 0 || !!displayPhoto);

  return (
    <SimpleModal onClose={onClose} bg={J.bg} border={J.dark} wide>
      <h2 style={{fontFamily:fMarcellus,fontSize:16,letterSpacing:'0.3em',color:J.dark,textAlign:'center',margin:0}}>{existing?'MODIFICA PASTO':'NUOVO PASTO'}</h2>
      <div style={{marginTop:16,textAlign:'center'}}>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} style={{display:'none'}} />
        {displayPhoto ? (
          <button onClick={()=>fileRef.current?.click()} style={{background:'transparent',border:'none',cursor:'pointer',padding:0}}>
            <img src={displayPhoto} alt="" loading="lazy" style={{width:100,height:100,objectFit:'cover',borderRadius:'50%',border:`2px solid ${J.sage}`}} />
          </button>
        ) : (
          <button onClick={()=>fileRef.current?.click()} disabled={busy} style={{width:100,height:100,borderRadius:'50%',background:`${J.sage}1F`,border:`2px dashed ${J.sage}`,cursor:'pointer',fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:J.sage}}>{busy?'…':'+ foto'}</button>
        )}
        {displayPhoto && <div><button onClick={removePhoto} style={{background:'transparent',border:'none',color:J.sage,fontFamily:fGaramond,fontStyle:'italic',fontSize:12,cursor:'pointer',marginTop:4}}>rimuovi foto</button></div>}
      </div>
      <div style={{marginTop:18}}>
        <FieldLabel>tipo di pasto</FieldLabel>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>
          {MEAL_TYPES.map(t=><button key={t.id} onClick={()=>setType(t.id)} style={{padding:'6px 12px',fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',background:type===t.id?J.dark:'transparent',color:type===t.id?J.bg:J.dark,border:`1px solid ${J.dark}`,cursor:'pointer',borderRadius:0}}>{t.name}</button>)}
        </div>
      </div>
      <div style={{marginTop:14}}>
        <FieldLabel>descrizione</FieldLabel>
        <input type="text" value={description} onChange={e=>setDescription(e.target.value)} placeholder="es. pasta al pomodoro" autoFocus style={fieldInput(J)} />
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:14}}>
        <div>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:4}}>
            <FieldLabel>quantità</FieldLabel>
            <div style={{display:'flex',gap:0}}>
              <button type="button" onClick={()=>setQtyUnit('g')} style={{padding:'2px 8px',fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.15em',background:qtyUnit==='g'?J.dark:'transparent',color:qtyUnit==='g'?J.bg:J.sage,border:`1px solid ${J.dark}66`,cursor:'pointer',borderRadius:0}}>G</button>
              <button type="button" onClick={()=>setQtyUnit('ml')} style={{padding:'2px 8px',fontFamily:fMarcellus,fontSize:9,letterSpacing:'0.15em',background:qtyUnit==='ml'?J.dark:'transparent',color:qtyUnit==='ml'?J.bg:J.sage,border:`1px solid ${J.dark}66`,borderLeft:'none',cursor:'pointer',borderRadius:0}}>ML</button>
            </div>
          </div>
          <input type="text" inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value)} placeholder={qtyUnit==='ml'?'330':'250'} style={fieldInput(J)} />
        </div>
        <div><FieldLabel>kcal</FieldLabel><input type="text" inputMode="numeric" value={kcal} onChange={e=>setKcal(e.target.value)} placeholder="450" style={fieldInput(J)} /></div>
      </div>

      {/* Selettore data: solo per modifica di pasto esistente di oggi o ieri */}
      {existing && (isExistingToday || isExistingYesterday) && (
        <div style={{marginTop:14}}>
          <FieldLabel>data</FieldLabel>
          <div style={{display:'flex',gap:6,marginTop:6}}>
            <button type="button" onClick={()=>setDateChoice('oggi')} style={{flex:1,padding:'8px 12px',fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',background:dateChoice==='oggi'?J.dark:'transparent',color:dateChoice==='oggi'?J.bg:J.dark,border:`1px solid ${J.dark}`,cursor:'pointer',borderRadius:0}}>OGGI</button>
            <button type="button" onClick={()=>setDateChoice('ieri')} style={{flex:1,padding:'8px 12px',fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',background:dateChoice==='ieri'?J.dark:'transparent',color:dateChoice==='ieri'?J.bg:J.dark,border:`1px solid ${J.dark}`,cursor:'pointer',borderRadius:0}}>IERI</button>
          </div>
        </div>
      )}

      {/* Stima nutrienti con IA */}
      <div style={{marginTop:14,padding:'12px 14px',border:`1px dashed ${J.sage}66`,background:`${J.sage}0A`}}>
        <button onClick={estimateNutrition} disabled={!canEstimate} style={{width:'100%',background:canEstimate?J.sage:'transparent',color:canEstimate?J.bg:J.sage,border:`1px solid ${J.sage}`,fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.3em',padding:'10px 14px',cursor:canEstimate?'pointer':'not-allowed',textTransform:'uppercase',opacity:canEstimate?1:0.5}}>
          {estimating ? '⋯ ANALIZZO' : (!!displayPhoto && !description.trim() ? '✦ IDENTIFICA DALLA FOTO' : '✦ STIMA NUTRIENTI CON IA')}
        </button>
        <div style={{marginTop:8,fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:J.sage,textAlign:'center',lineHeight:1.4}}>
          {!description.trim() && !displayPhoto
            ? 'scrivi la descrizione (o aggiungi una foto) per attivare la stima'
            : (!!displayPhoto && !description.trim()
              ? 'l\'IA riconosce il piatto dalla foto, ne stima quantità e macronutrienti · puoi sempre correggere'
              : 'l\'IA stima kcal, proteine, carboidrati e grassi da descrizione e quantità · puoi sempre correggere')}
        </div>
        {estimateNote && <div style={{marginTop:6,fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:J.dark,textAlign:'center'}}>✓ {estimateNote}</div>}
        {estimateError && <div style={{marginTop:6,fontFamily:fGaramond,fontStyle:'italic',fontSize:12,color:'#A04848',textAlign:'center'}}>{estimateError}</div>}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:14}}>
        <div><FieldLabel>prot. (g)</FieldLabel><input type="text" inputMode="decimal" value={p} onChange={e=>setP(e.target.value)} placeholder="20" style={fieldInput(J)} /></div>
        <div><FieldLabel>carb. (g)</FieldLabel><input type="text" inputMode="decimal" value={c} onChange={e=>setC(e.target.value)} placeholder="60" style={fieldInput(J)} /></div>
        <div><FieldLabel>gras. (g)</FieldLabel><input type="text" inputMode="decimal" value={g} onChange={e=>setG(e.target.value)} placeholder="12" style={fieldInput(J)} /></div>
      </div>
      <div style={{display:'flex',gap:8,marginTop:22,justifyContent:'space-between',alignItems:'center'}}>
        {onDelete ? <button onClick={onDelete} style={{background:'transparent',color:'#A04848',border:`1px solid #A0484866`,fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.2em',padding:'10px 16px',cursor:'pointer'}}>ELIMINA</button> : <span />}
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={btnOutlineMini(J.sage,fMarcellus)}>annulla</button>
          <button onClick={save} style={{background:J.dark,color:J.bg,border:'none',fontFamily:fMarcellus,fontSize:10,letterSpacing:'0.3em',padding:'10px 22px',cursor:'pointer'}}>SALVA</button>
        </div>
      </div>
    </SimpleModal>
  );
}

function AllenaPage({ theme, loaded, workouts, types, updWorkouts, updTypes }){
  const T = theme || { bg: '#F2EBDC', ink: '#1F1A12', dim: '#6B5D45' };
  // Alias per shadow delle var globali del modulo (Allena originariamente usava A=Alba)
  const A = T;
  const [detailTypeId, setDetailTypeId] = useState(null);
  const [editingType, setEditingType] = useState(null);

  async function saveType(data){
    if(editingType==='new') await updTypes([...types,{id:newId(),name:data.name,unit:data.unit}]);
    else await updTypes(types.map(t=>t.id===editingType?{...t,name:data.name,unit:data.unit}:t));
    setEditingType(null);
  }
  async function delType(){
    if(workouts.some(w=>w.typeId===editingType)) await updWorkouts(workouts.filter(w=>w.typeId!==editingType));
    await updTypes(types.filter(t=>t.id!==editingType));
    setEditingType(null);
  }

  const editingT = editingType && editingType!=='new' ? types.find(t=>t.id===editingType) : null;
  const detailType = detailTypeId ? types.find(t=>t.id===detailTypeId) : null;

  return (
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at top, ${A.bg1} 0%, ${A.bg2} 100%)`,color:A.cream,fontFamily:fBodoni,position:'relative',overflow:'hidden'}}>
      <div aria-hidden style={{position:'absolute',inset:14,border:`1px solid ${A.gold}40`,borderRadius:20,pointerEvents:'none',zIndex:1}} />
      <div aria-hidden style={{position:'absolute',inset:20,border:`1px solid ${A.gold}1A`,borderRadius:16,pointerEvents:'none',zIndex:1}} />
      <div style={{position:'relative',zIndex:2,padding:'32px 28px 28px',maxWidth:480,margin:'0 auto'}}>
        <Header q="ALLENA" sub="V" color={A.gold} dim={A.goldDim} mark="✦" font={fBodoni} />

        {!loaded && <Loading color={A.sage} />}

        {loaded && (<>
          <div style={{marginTop:22,padding:'12px 0',borderTop:`1px solid ${A.ink}`,display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
            <span style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.35em',color:A.sage,textTransform:'uppercase'}}>tipo · 30 g.</span>
            <span style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.35em',color:A.sage,textTransform:'uppercase'}}>tendenza</span>
          </div>

          <div>
            {types.length===0 ? (
              <div style={{textAlign:'center',padding:'24px 0',fontFamily:fBodoni,fontStyle:'italic',fontSize:14,color:A.sage}}>Nessun tipo di allenamento.</div>
            ) : types.map(t=>{
              const tw = workouts.filter(w=>w.typeId===t.id);
              const last30 = tw.filter(w=>(Date.now()-new Date(w.ts).getTime()) < 30*86400000);
              const totalQty = last30.reduce((a,w)=>a+(w.qty||0),0);
              const today=new Date(); const sparkVals=[];
              for(let i=29;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); const dk=dayKey(d); const sum=tw.filter(w=>dayKey(new Date(w.ts))===dk).reduce((a,w)=>a+(w.qty||0),0); sparkVals.push(sum>0?sum:null); }
              const spark = buildLineChart(sparkVals,90,30);
              return (
                <button key={t.id} onClick={()=>setDetailTypeId(t.id)} style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'14px 4px',background:'transparent',border:'none',borderBottom:`1px solid ${A.ink}1A`,cursor:'pointer',textAlign:'left'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:19,color:A.ink}}>{t.name}</div>
                    <div style={{fontFamily:fDmSans,fontSize:10,letterSpacing:'0.15em',color:A.sage,marginTop:2}}>{last30.length} sessioni · {fmt0(totalQty)} {t.unit}</div>
                  </div>
                  <svg viewBox="0 0 90 30" width="90" height="30" style={{flexShrink:0}}>
                    {spark.points.length>1 && <path d={spark.path} stroke={A.sage} strokeWidth="1.4" fill="none" />}
                    {spark.points.length>0 && <circle cx={spark.points[spark.points.length-1].x} cy={spark.points[spark.points.length-1].y} r="2.2" fill={A.sage} />}
                    {spark.points.length===0 && <line x1="0" y1="15" x2="90" y2="15" stroke={A.sage} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.3" />}
                  </svg>
                  <span style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:14,color:A.sage,marginLeft:8}}>›</span>
                </button>
              );
            })}
          </div>

          <div style={{textAlign:'center',marginTop:18}}>
            <button onClick={()=>setEditingType('new')} style={{background:'transparent',color:A.sage,border:`1px dashed ${A.sage}`,fontFamily:fDmSans,fontSize:10,letterSpacing:'0.35em',padding:'10px 22px',cursor:'pointer',textTransform:'uppercase'}}>+ nuovo tipo</button>
          </div>

          <div style={{marginTop:22,padding:12,fontFamily:fBodoni,fontStyle:'italic',fontSize:12,color:A.sage,lineHeight:1.5,background:`${A.sage}0D`,border:`1px solid ${A.sage}22`}}>
            <div style={{fontFamily:fDmSans,fontStyle:'normal',fontSize:9,letterSpacing:'0.4em',color:A.ink,textTransform:'uppercase',marginBottom:4}}>→ Correlazione IA</div>
            In arrivo: l'IA analizzerà quale tipo di allenamento ha più impatto sulla perdita di peso. Servono 20-30 giorni di dati incrociati.
          </div>
        </>)}
      </div>

      {detailType && <TypeDetailModal type={detailType} workouts={workouts} onClose={()=>setDetailTypeId(null)} updWorkouts={updWorkouts} onEditType={()=>{setDetailTypeId(null); setEditingType(detailType.id);}} />}
      {editingType && <TypeModal existing={editingT} onClose={()=>setEditingType(null)} onSave={saveType} onDelete={editingType!=='new'?delType:null} />}
    </div>
  );
}

function TypeDetailModal({ type, workouts, onClose, updWorkouts, onEditType }){
  const [editing, setEditing] = useState(null);

  const tw = useMemo(()=>workouts.filter(w=>w.typeId===type.id).sort((a,b)=>new Date(a.ts)-new Date(b.ts)),[workouts,type.id]);
  const last30 = tw.filter(w=>(Date.now()-new Date(w.ts).getTime()) < 30*86400000);
  const totalQty = last30.reduce((a,w)=>a+(w.qty||0),0);

  const chartData = useMemo(()=>{
    const map={};
    tw.forEach(w=>{const k=dayKey(new Date(w.ts)); map[k]=(map[k]||0)+(w.qty||0);});
    const out=[]; const today=new Date();
    for(let i=29;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); out.push({date:d,val:map[dayKey(d)]??null}); }
    return out;
  },[tw]);

  const { path, area, points } = buildLineChart(chartData.map(d=>d.val),280,70);

  async function saveWorkout(data){
    if(editing==='new') await updWorkouts([...workouts,{id:newId(),ts:new Date().toISOString(),typeId:type.id,qty:data.qty,notes:data.notes}]);
    else await updWorkouts(workouts.map(w=>w.id===editing?{...w,qty:data.qty,notes:data.notes}:w));
    setEditing(null);
  }
  async function delWorkout(){ await updWorkouts(workouts.filter(w=>w.id!==editing)); setEditing(null); }
  const editingW = editing && editing!=='new' ? workouts.find(w=>w.id===editing) : null;

  return (
    <SimpleModal onClose={onClose} bg={A.bg1} border={A.ink} wide>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:4}}>
        <h2 style={{fontFamily:fBodoni,fontStyle:'italic',fontWeight:500,fontSize:26,color:A.ink,margin:0}}>{type.name}</h2>
        <button onClick={onEditType} style={{background:'transparent',border:'none',color:A.sage,fontFamily:fBodoni,fontStyle:'italic',fontSize:12,cursor:'pointer'}}>modifica tipo ›</button>
      </div>
      <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.35em',color:A.sage,textTransform:'uppercase'}}>30 giorni · totale</div>
      <div style={{fontFamily:fBodoni,fontWeight:500,fontSize:36,letterSpacing:'-0.03em',lineHeight:1,marginTop:4}}>{fmt0(totalQty)}<span style={{fontFamily:fDmSans,fontSize:11,letterSpacing:'0.2em',color:A.sage,marginLeft:4}}>{type.unit}</span></div>
      <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:13,color:A.sage,marginTop:2}}>{last30.length} sessioni</div>
      <svg viewBox="0 0 280 70" width="100%" height={70} style={{display:'block',marginTop:14}}>
        <defs><linearGradient id="ad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={A.sage} stopOpacity="0.18"/><stop offset="100%" stopColor={A.sage} stopOpacity="0"/></linearGradient></defs>
        {points.length>1 && <path d={area} fill="url(#ad)" />}
        {points.length>1 && <path d={path} stroke={A.sage} strokeWidth="1.2" fill="none" />}
        {points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===points.length-1?3:1.8} fill={A.sage} />)}
      </svg>
      <div style={{marginTop:10,maxHeight:180,overflowY:'auto'}}>
        {tw.length===0 ? (
          <div style={{textAlign:'center',padding:'12px 0',fontFamily:fBodoni,fontStyle:'italic',fontSize:13,color:A.sage}}>Nessuna sessione.</div>
        ) : tw.slice().reverse().slice(0,15).map(w=>{const d=new Date(w.ts); return (
          <button key={w.id} onClick={()=>setEditing(w.id)} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',background:'transparent',border:'none',borderBottom:`1px solid ${A.ink}11`,cursor:'pointer',textAlign:'left'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:15,color:A.ink}}>{fmt(w.qty)} <span style={{fontFamily:fDmSans,fontStyle:'normal',fontSize:10,letterSpacing:'0.2em',color:A.sage}}>{type.unit}</span></div>
              <div style={{fontFamily:fDmSans,fontSize:10,letterSpacing:'0.15em',color:A.sage,marginTop:1}}>{d.toLocaleDateString('it-IT',{day:'numeric',month:'short'})}{w.notes?` · ${w.notes}`:''}</div>
            </div>
            <span style={{color:A.sage,fontSize:13}}>›</span>
          </button>
        );})}
      </div>
      <div style={{textAlign:'center',marginTop:16}}>
        <button onClick={()=>setEditing('new')} style={{background:A.ink,color:A.bg1,border:'none',fontFamily:fDmSans,fontSize:10,letterSpacing:'0.35em',padding:'11px 26px',cursor:'pointer',textTransform:'uppercase'}}>+ nuova sessione</button>
      </div>
      {editing && <WorkoutModal existing={editingW} unit={type.unit} typeName={type.name} onClose={()=>setEditing(null)} onSave={saveWorkout} onDelete={editing!=='new'?delWorkout:null} />}
    </SimpleModal>
  );
}

function WorkoutModal({ existing, unit, typeName, onClose, onSave, onDelete }){
  const [qty, setQty] = useState(existing?.qty!=null ? String(existing.qty).replace('.',',') : '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [err, setErr] = useState('');
  function save(){ const q=parseNum(qty,0,100000); if(q==null){setErr('quantità non valida'); return;} onSave({qty:q,notes:notes.trim()}); }
  return (
    <SimpleModal onClose={onClose} bg={A.bg1} border={A.ink}>
      <h2 style={{fontFamily:fDmSans,fontSize:10,letterSpacing:'0.4em',color:A.sage,textAlign:'center',margin:0,textTransform:'uppercase'}}>{typeName}</h2>
      <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:14,color:A.ink,textAlign:'center',marginTop:4}}>{existing?'modifica sessione':'nuova sessione'}</div>
      <div style={{marginTop:18}}>
        <FieldLabel>quantità ({unit})</FieldLabel>
        <input type="text" inputMode="decimal" value={qty} onChange={e=>{setQty(e.target.value); setErr('');}} onKeyDown={e=>{if(e.key==='Enter')save();}} autoFocus placeholder={unit==='km'?'5,2':'30'} style={fieldInput(A)} />
        {err && <div style={{color:'#A04848',fontFamily:fBodoni,fontStyle:'italic',fontSize:12,marginTop:4}}>{err}</div>}
      </div>
      <div style={{marginTop:14}}>
        <FieldLabel>note (opzionale)</FieldLabel>
        <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="parco del castello" style={fieldInput(A)} />
      </div>
      <div style={{display:'flex',gap:8,marginTop:22,justifyContent:'space-between',alignItems:'center'}}>
        {onDelete ? <button onClick={onDelete} style={{background:'transparent',color:'#A04848',border:`1px solid #A0484866`,fontFamily:fDmSans,fontSize:9,letterSpacing:'0.3em',padding:'10px 14px',cursor:'pointer',textTransform:'uppercase'}}>elimina</button> : <span />}
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={btnOutlineMini(A.sage,fDmSans)}>annulla</button>
          <button onClick={save} style={{background:A.ink,color:A.bg1,border:'none',fontFamily:fDmSans,fontSize:10,letterSpacing:'0.35em',padding:'10px 22px',cursor:'pointer'}}>SALVA</button>
        </div>
      </div>
    </SimpleModal>
  );
}

function TypeModal({ existing, onClose, onSave, onDelete }){
  const [name, setName] = useState(existing?.name || '');
  const [unit, setUnit] = useState(existing?.unit || 'min');
  function save(){ const n=name.trim(); if(!n)return; onSave({name:n,unit}); }
  return (
    <SimpleModal onClose={onClose} bg={A.bg1} border={A.ink}>
      <h2 style={{fontFamily:fDmSans,fontSize:10,letterSpacing:'0.4em',color:A.sage,textAlign:'center',margin:0,textTransform:'uppercase'}}>{existing?'modifica tipo':'nuovo tipo'}</h2>
      <div style={{marginTop:18}}>
        <FieldLabel>nome</FieldLabel>
        <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="es. Bicicletta" autoFocus style={fieldInput(A)} />
      </div>
      <div style={{marginTop:14}}>
        <FieldLabel>unità di misura</FieldLabel>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>
          {UNITS.map(u=><button key={u} onClick={()=>setUnit(u)} style={{padding:'8px 14px',fontFamily:fDmSans,fontSize:11,letterSpacing:'0.15em',background:u===unit?A.ink:'transparent',color:u===unit?A.bg1:A.ink,border:`1px solid ${A.ink}`,cursor:'pointer',textTransform:'uppercase'}}>{u}</button>)}
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginTop:22,justifyContent:'space-between'}}>
        {onDelete ? <button onClick={onDelete} style={{background:'transparent',color:'#A04848',border:`1px solid #A0484866`,fontFamily:fDmSans,fontSize:9,letterSpacing:'0.3em',padding:'10px 14px',cursor:'pointer',textTransform:'uppercase'}}>elimina</button> : <span />}
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={btnOutlineMini(A.sage,fDmSans)}>annulla</button>
          <button onClick={save} style={{background:A.ink,color:A.bg1,border:'none',fontFamily:fDmSans,fontSize:10,letterSpacing:'0.35em',padding:'10px 22px',cursor:'pointer'}}>SALVA</button>
        </div>
      </div>
    </SimpleModal>
  );
}

function IntegraPage({ theme, loaded, supps, taken, updSupps, updTaken }){
  // Originariamente questa pagina usava T (palette Cuoio globale).
  // Shadow di T con il theme attivo passato come prop.
  const T = theme || { bg: '#F2EBDC', ink: '#1F1A12', dim: '#6B5D45' };
  const [editingSupp, setEditingSupp] = useState(null);
  const [editingDay, setEditingDay] = useState(null);
  const [name, setName] = useState('');

  const today = new Date(); const todayK = dayKey(today);
  const days = [];
  for(let i=27;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); days.push(d); }

  const suppsWithColor = useMemo(()=>supps.map((s,i)=>({...s, color:s.color||SUPP_COLORS[i%SUPP_COLORS.length]})),[supps]);

  async function saveSupp(){
    const n=name.trim(); if(!n)return;
    if(editingSupp==='new'){ await updSupps([...supps,{id:newId(),name:n,color:SUPP_COLORS[supps.length%SUPP_COLORS.length]}]); }
    else { await updSupps(supps.map(s=>s.id===editingSupp?{...s,name:n}:s)); }
    setEditingSupp(null); setName('');
  }
  async function delSupp(){
    const id=editingSupp;
    await updSupps(supps.filter(s=>s.id!==id));
    const next={...taken}; for(const k in next) next[k]=(next[k]||[]).filter(x=>x!==id);
    await updTaken(next);
    setEditingSupp(null); setName('');
  }
  function openEditSupp(s){ setEditingSupp(s.id); setName(s.name); }
  async function toggleDaySupp(suppId, dKey){
    const list = taken[dKey] || [];
    const next = {...taken, [dKey]: list.includes(suppId) ? list.filter(x=>x!==suppId) : [...list,suppId]};
    await updTaken(next);
  }
  function consistency(suppId){ let c=0; days.forEach(d=>{if((taken[dayKey(d)]||[]).includes(suppId)) c++;}); return Math.round((c/28)*100); }

  return (
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at top, ${T.bg1} 0%, ${T.bg2} 100%)`,color:T.cream,fontFamily:fCormorant,position:'relative',overflow:'hidden'}}>
      <div aria-hidden style={{position:'absolute',inset:14,border:`1px solid ${T.gold}40`,borderRadius:20,pointerEvents:'none',zIndex:1}} />
      <div aria-hidden style={{position:'absolute',inset:20,border:`1px solid ${T.gold}1A`,borderRadius:16,pointerEvents:'none',zIndex:1}} />
      <div style={{position:'relative',zIndex:2,padding:'32px 28px 28px',maxWidth:480,margin:'0 auto'}}>
        <Header q="INTEGRA" sub="V" color={T.gold} dim={T.goldDim} mark="✦" font={fCormorant} />

        {!loaded && <Loading color={T.dim} />}

        {loaded && (<>
          <div style={{marginTop:18}}>
            <div style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:14,color:T.dim,textAlign:'center',marginBottom:10}}>tocca un giorno per registrare</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:0}}>
              {days.map(d=>{
                const k = dayKey(d);
                const takenList = taken[k] || [];
                const isToday = k===todayK;
                const maxTracks = Math.min(suppsWithColor.length, 5);
                return (
                  <button key={k} onClick={()=>setEditingDay(k)} style={{aspectRatio:'1',display:'flex',flexDirection:'column',padding:0,background:'transparent',border:'none',cursor:'pointer',position:'relative'}}>
                    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:12,color:T.dim}}>{d.getDate()}</span>
                    </div>
                    {maxTracks>0 && (
                      <div style={{display:'flex',flexDirection:'column',gap:1,paddingBottom:3,paddingLeft:1,paddingRight:1}}>
                        {suppsWithColor.slice(0,maxTracks).map(s=>(
                          <div key={s.id} style={{height:3,background:takenList.includes(s.id)?s.color:`${T.dim}1A`,borderRadius:0}} />
                        ))}
                      </div>
                    )}
                    {isToday && <div style={{position:'absolute',inset:1,border:`1px solid ${T.ink}`,borderRadius:3,pointerEvents:'none'}} />}
                  </button>
                );
              })}
            </div>
          </div>

          {suppsWithColor.length>0 && (
            <div style={{marginTop:20,paddingTop:14,borderTop:`1px solid ${T.ink}1A`}}>
              <div style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:14,color:T.dim,textAlign:'center',marginBottom:10}}>continuità · 28 giorni</div>
              {suppsWithColor.map(s=><ContinuityRow key={s.id} supp={s} days={days} taken={taken} consistency={consistency(s.id)} onOpen={()=>openEditSupp(s)} />)}
            </div>
          )}

          <div style={{textAlign:'center',marginTop:16}}>
            <button onClick={()=>{setEditingSupp('new'); setName('');}} style={btnOutlineThin(T.ink)}>+ aggiungi integratore</button>
          </div>

          <div style={{marginTop:22,padding:14,fontFamily:fCormorant,fontStyle:'italic',fontSize:13,color:T.dim,lineHeight:1.5,background:`${T.ink}08`,border:`1px solid ${T.ink}22`}}>
            <div style={{fontFamily:fCormorant,fontStyle:'normal',fontSize:10,letterSpacing:'0.4em',color:T.ink,textTransform:'uppercase',marginBottom:4}}>⟡ Correlazione IA</div>
            In arrivo: l'IA confronterà ciascun integratore con il tuo peso per dirti se ti aiuta a dimagrire. Servono 20-30 giorni di dati.
          </div>
        </>)}
      </div>

      {editingSupp && (
        <SimpleModal onClose={()=>{setEditingSupp(null); setName('');}} bg={T.bg} border={T.ink}>
          <h2 style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:22,color:T.ink,margin:0,textAlign:'center'}}>{editingSupp==='new'?'Nuovo integratore':'Modifica integratore'}</h2>
          <input type="text" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveSupp();}} autoFocus placeholder="es. Vitamina D" style={{width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${T.ink}66`,fontFamily:fCormorant,fontStyle:'italic',fontSize:20,color:T.ink,padding:'8px 0',marginTop:16,outline:'none',textAlign:'center'}} />
          <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'space-between'}}>
            {editingSupp!=='new' ? <button onClick={delSupp} style={{background:'transparent',color:'#A04848',border:`1px solid #A0484866`,fontFamily:fCormorant,fontStyle:'italic',fontSize:13,padding:'8px 16px',cursor:'pointer'}}>elimina</button> : <span />}
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{setEditingSupp(null); setName('');}} style={btnOutlineThin(T.dim)}>annulla</button>
              <button onClick={saveSupp} style={btnSolid(T.ink,T.bg)}>SALVA</button>
            </div>
          </div>
        </SimpleModal>
      )}

      {editingDay && (
        <SimpleModal onClose={()=>setEditingDay(null)} bg={T.bg} border={T.ink}>
          <h2 style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:22,color:T.ink,margin:0,textAlign:'center'}}>{parseDayKey(editingDay).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}</h2>
          <div style={{fontFamily:fCormorant,fontSize:11,letterSpacing:'0.3em',color:T.dim,textAlign:'center',marginTop:4,textTransform:'uppercase'}}>quali integratori hai preso?</div>
          <div style={{marginTop:18}}>
            {suppsWithColor.length===0 ? (
              <div style={{textAlign:'center',fontFamily:fCormorant,fontStyle:'italic',fontSize:14,color:T.dim,padding:'12px 0'}}>Aggiungi prima i tuoi integratori.</div>
            ) : suppsWithColor.map(s=>{
              const taken_ = (taken[editingDay]||[]).includes(s.id);
              return (
                <button key={s.id} onClick={()=>toggleDaySupp(s.id, editingDay)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',padding:'12px 4px',background:'transparent',border:'none',borderBottom:`1px solid ${T.ink}1A`,cursor:'pointer'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{width:10,height:10,borderRadius:'50%',background:s.color}} />
                    <span style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:17,color:T.ink}}>{s.name}</span>
                  </div>
                  <span style={{width:26,height:26,borderRadius:'50%',background:taken_?s.color:'transparent',border:`1px solid ${s.color}`}} />
                </button>
              );
            })}
          </div>
          <div style={{display:'flex',justifyContent:'center',marginTop:18}}>
            <button onClick={()=>setEditingDay(null)} style={btnSolid(T.ink,T.bg)}>FATTO</button>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}

function ContinuityRow({ supp, days, taken, consistency, onOpen }){
  const dotR = 3.5, gap = 5, stride = 2*dotR+gap;
  const W_ = days.length*stride, H_ = 14;
  const states = days.map(d=>(taken[dayKey(d)]||[]).includes(supp.id));

  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${T.ink}0F`}}>
      <button onClick={onOpen} style={{background:'transparent',border:'none',padding:0,cursor:'pointer',display:'flex',alignItems:'center',gap:8,flexShrink:0,minWidth:70}}>
        <span style={{width:10,height:10,borderRadius:'50%',background:supp.color}} />
        <span style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:14,color:T.ink,textAlign:'left'}}>{supp.name}</span>
      </button>
      <svg viewBox={`0 0 ${W_} ${H_}`} width="100%" preserveAspectRatio="none" style={{flex:1,height:H_,minWidth:0}}>
        {states.map((isTaken,i)=>{ if(!isTaken||i===states.length-1||!states[i+1]) return null; const x1=i*stride+dotR; const x2=(i+1)*stride+dotR; return <line key={`l-${i}`} x1={x1} y1={H_/2} x2={x2} y2={H_/2} stroke={supp.color} strokeWidth="1.5" />; })}
        {states.map((isTaken,i)=><circle key={i} cx={i*stride+dotR} cy={H_/2} r={dotR} fill={isTaken?supp.color:'transparent'} stroke={isTaken?supp.color:T.dim+'66'} strokeWidth="0.8" />)}
      </svg>
      <span style={{fontFamily:fCormorant,fontSize:11,color:T.dim,letterSpacing:'0.1em',flexShrink:0,minWidth:32,textAlign:'right'}}>{consistency}%</span>
    </div>
  );
}

function SonnoPage({ theme, loaded, sleeps, updSleeps }){
  // Sonno usa S internamente (palette Sera viola era originaria). Shadow.
  const S = theme || { bg1: '#1E1A2E', bg2: '#0F0D1A', silver: '#B8B0C9', pale: '#F2E8D0', gold: '#C9A876', dim: '#6B6478' };
  const [editing, setEditing] = useState(null);
  const sorted = useMemo(()=>[...sleeps].sort((a,b)=>a.wakeDate.localeCompare(b.wakeDate)),[sleeps]);
  const today = new Date(); const todayK = dayKey(today);

  const chartData = useMemo(()=>{
    const map={}; sleeps.forEach(s=>{map[s.wakeDate]=durHours(s.bedtime,s.waketime);});
    const out=[];
    for(let i=29;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); out.push({date:d,val:map[dayKey(d)]??null}); }
    return out;
  },[sleeps]);

  const { path, area, points } = buildLineChart(chartData.map(d=>d.val),280,80);
  const last30 = chartData.filter(d=>d.val!=null);
  const avg30 = last30.length>0 ? last30.reduce((a,d)=>a+d.val,0)/last30.length : null;
  const last7 = chartData.slice(-7).filter(d=>d.val!=null);
  const avg7 = last7.length>0 ? last7.reduce((a,d)=>a+d.val,0)/last7.length : null;
  const lastNight = sorted[sorted.length-1] || null;
  const lastNightDur = lastNight ? durHours(lastNight.bedtime,lastNight.waketime) : null;

  async function saveSleep(data){
    if(editing==='new') await updSleeps([...sleeps,{id:newId(),...data}]);
    else await updSleeps(sleeps.map(s=>s.id===editing?{...s,...data}:s));
    setEditing(null);
  }
  async function delSleep(){ await updSleeps(sleeps.filter(s=>s.id!==editing)); setEditing(null); }
  const editingSleep = editing && editing!=='new' ? sleeps.find(s=>s.id===editing) : null;

  return (
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at top, ${S.bg1} 0%, ${S.bg2} 100%)`,color:S.cream,fontFamily:fFraunces,position:'relative',overflow:'hidden'}}>
      <div aria-hidden style={{position:'absolute',inset:14,border:`1px solid ${S.gold}40`,borderRadius:20,pointerEvents:'none',zIndex:1}} />
      <div aria-hidden style={{position:'absolute',inset:20,border:`1px solid ${S.gold}1A`,borderRadius:16,pointerEvents:'none',zIndex:1}} />
      <div style={{position:'relative',zIndex:2,padding:'32px 28px 28px',maxWidth:480,margin:'0 auto'}}>
        <Header q="SONNO" sub="VII" color={S.gold} dim={S.goldDim} mark="✦" font={fFraunces} />

        {!loaded && <Loading color={S.dim} />}

        {loaded && (<>
          <div style={{textAlign:'center',marginTop:28}}>
            <div style={{fontFamily:fFraunces,fontSize:9,letterSpacing:'0.45em',color:S.dim,textTransform:'uppercase'}}>{lastNight?`NOTTE DEL ${parseDayKey(lastNight.wakeDate).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}`:'NESSUNA NOTTE REGISTRATA'}</div>
            <div style={{fontFamily:fFraunces,fontStyle:'italic',fontWeight:300,fontSize:62,lineHeight:1,color:S.pale,marginTop:8}}>{lastNightDur!=null?fmtDur(lastNightDur):'—'}</div>
            {lastNight && (<>
              <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:13,color:S.silver,marginTop:6}}>dalle {lastNight.bedtime} alle {lastNight.waketime}</div>
              <div style={{fontSize:18,letterSpacing:'0.1em',color:S.gold,marginTop:8}}>{'★'.repeat(lastNight.quality)}<span style={{color:S.dim}}>{'★'.repeat(5-lastNight.quality)}</span></div>
            </>)}
          </div>
          <div style={{marginTop:22,padding:'14px 0 8px',borderTop:`1px solid ${S.gold}33`,borderBottom:`1px solid ${S.gold}33`}}>
            <div style={{display:'flex',justifyContent:'space-between',fontFamily:fFraunces,fontSize:9,letterSpacing:'0.4em',color:S.dim,textTransform:'uppercase',marginBottom:8}}>
              <span>30 NOTTI</span>
              <span style={{color:S.pale,fontStyle:'italic',textTransform:'none',letterSpacing:0,fontSize:13}}>{avg30!=null?`media ${fmtDur(avg30)}`:'—'}</span>
            </div>
            <svg viewBox="0 0 280 80" width="100%" height={80} style={{display:'block'}}>
              <defs><linearGradient id="sa" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={S.gold} stopOpacity="0.2"/><stop offset="100%" stopColor={S.gold} stopOpacity="0"/></linearGradient></defs>
              {points.length>1 && <path d={area} fill="url(#sa)" />}
              {points.length>1 && <path d={path} stroke={S.gold} strokeWidth="1.2" fill="none" />}
              {points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===points.length-1?3:1.6} fill={i===points.length-1?S.pale:S.gold} />)}
            </svg>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontFamily:fFraunces,fontSize:9,letterSpacing:'0.15em',color:S.dim}}><span>30 g. fa</span><span>oggi</span></div>
          </div>
          <div style={{display:'flex',justifyContent:'space-around',marginTop:18}}>
            <Stat label="media 7g" value={avg7!=null?fmtDur(avg7):'—'} color={S.gold} dim={S.dim} />
            <Stat label="notti" value={last30.length} color={S.gold} dim={S.dim} />
            <Stat label="media 30g" value={avg30!=null?fmtDur(avg30):'—'} color={S.gold} dim={S.dim} />
          </div>
          <div style={{marginTop:22}}>
            <div style={{fontFamily:fFraunces,fontSize:9,letterSpacing:'0.4em',color:S.dim,textAlign:'center',textTransform:'uppercase',marginBottom:10}}>NOTTI RECENTI</div>
            {sorted.length===0 ? (
              <div style={{textAlign:'center',fontFamily:fFraunces,fontStyle:'italic',fontSize:14,color:S.dim,padding:'12px 0'}}>Nessuna notte registrata.</div>
            ) : sorted.slice().reverse().slice(0,10).map(s=>{const dur=durHours(s.bedtime,s.waketime); return (
              <button key={s.id} onClick={()=>setEditing(s.id)} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 4px',background:'transparent',border:'none',borderBottom:`1px solid ${S.gold}1F`,cursor:'pointer',textAlign:'left'}}>
                <div>
                  <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:17,color:S.pale}}>{fmtDur(dur)}</div>
                  <div style={{fontFamily:fFraunces,fontSize:11,color:S.dim,marginTop:2}}>{parseDayKey(s.wakeDate).toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})} · {s.bedtime} → {s.waketime}</div>
                </div>
                <span style={{fontSize:13,letterSpacing:'0.05em',color:S.gold}}>{'★'.repeat(s.quality)}<span style={{color:S.dim}}>{'★'.repeat(5-s.quality)}</span></span>
              </button>
            );})}
          </div>
          <div style={{textAlign:'center',marginTop:22}}>
            <button onClick={()=>setEditing('new')} style={{background:S.gold,color:S.bg2,border:`1px solid ${S.gold}`,fontFamily:fFraunces,fontSize:11,letterSpacing:'0.35em',padding:'13px 28px',cursor:'pointer',borderRadius:0,textTransform:'uppercase'}}>+ Registra notte</button>
          </div>
          <div style={{marginTop:18,padding:12,fontFamily:fFraunces,fontStyle:'italic',fontSize:12,color:S.silver,lineHeight:1.5,background:`${S.gold}0F`,border:`1px solid ${S.gold}33`}}>
            <div style={{fontFamily:fFraunces,fontStyle:'normal',fontSize:9,letterSpacing:'0.4em',color:S.gold,textTransform:'uppercase',marginBottom:4}}>⟡ Correlazione IA</div>
            In arrivo: analisi della correlazione tra <em>ore di sonno</em>, qualità e peso. Il sonno breve è uno dei fattori più correlati alla difficoltà di dimagrire. Servono 20-30 notti.
          </div>
        </>)}
      </div>

      {editing && <SleepModal existing={editingSleep} todayK={todayK} onClose={()=>setEditing(null)} onSave={saveSleep} onDelete={editing!=='new'?delSleep:null} />}
    </div>
  );
}

function SleepModal({ existing, todayK, onClose, onSave, onDelete }){
  const [wakeDate, setWakeDate] = useState(existing?.wakeDate || todayK);
  const [bedtime, setBedtime] = useState(existing?.bedtime || '23:00');
  const [waketime, setWaketime] = useState(existing?.waketime || '07:00');
  const [quality, setQuality] = useState(existing?.quality || 3);
  const [notes, setNotes] = useState(existing?.notes || '');

  const wakeDateISO = useMemo(()=>{const d=parseDayKey(wakeDate); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},[wakeDate]);
  function save(){ onSave({wakeDate,bedtime,waketime,quality,notes:notes.trim()}); }
  const dur = durHours(bedtime, waketime);

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:`linear-gradient(180deg, ${S.bg1} 0%, ${S.bg2} 100%)`,border:`1px solid ${S.gold}55`,maxWidth:360,width:'100%',padding:'28px 24px',borderRadius:4,maxHeight:'88vh',overflowY:'auto'}}>
        <h2 style={{fontFamily:fFraunces,fontStyle:'italic',fontWeight:300,fontSize:24,color:S.pale,textAlign:'center',margin:0}}>{existing?'Modifica notte':'Nuova notte'}</h2>
        <div style={{marginTop:18}}>
          <FieldLabel light>data del risveglio</FieldLabel>
          <input type="date" value={wakeDateISO} onChange={e=>{const [y,m,d]=e.target.value.split('-').map(Number); setWakeDate(dayKey(new Date(y,m-1,d)));}} style={{...fieldInputDark(S),colorScheme:'dark'}} />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:14}}>
          <div><FieldLabel light>a letto alle</FieldLabel><input type="time" value={bedtime} onChange={e=>setBedtime(e.target.value)} style={{...fieldInputDark(S),colorScheme:'dark'}} /></div>
          <div><FieldLabel light>sveglia alle</FieldLabel><input type="time" value={waketime} onChange={e=>setWaketime(e.target.value)} style={{...fieldInputDark(S),colorScheme:'dark'}} /></div>
        </div>
        <div style={{marginTop:14,textAlign:'center',fontFamily:fFraunces,fontStyle:'italic',fontSize:18,color:S.gold}}>durata: {fmtDur(dur)}</div>
        <div style={{marginTop:14}}>
          <FieldLabel light>qualità</FieldLabel>
          <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:8}}>
            {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setQuality(n)} style={{background:'transparent',border:'none',cursor:'pointer',padding:4,fontSize:28,color:n<=quality?S.gold:S.dim}}>★</button>)}
          </div>
        </div>
        <div style={{marginTop:14}}>
          <FieldLabel light>note (opzionale)</FieldLabel>
          <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="risvegli, sogni..." style={fieldInputDark(S)} />
        </div>
        <div style={{display:'flex',gap:8,marginTop:22,justifyContent:'space-between',alignItems:'center'}}>
          {onDelete ? <button onClick={onDelete} style={{background:'transparent',color:'#C99A7A',border:`1px solid #C99A7A66`,fontFamily:fFraunces,fontSize:11,letterSpacing:'0.2em',padding:'10px 14px',cursor:'pointer',textTransform:'uppercase'}}>elimina</button> : <span />}
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{background:'transparent',color:S.dim,border:`1px solid ${S.dim}66`,fontFamily:fFraunces,fontSize:11,letterSpacing:'0.25em',padding:'10px 16px',cursor:'pointer',textTransform:'uppercase'}}>annulla</button>
            <button onClick={save} style={{background:S.gold,color:S.bg2,border:'none',fontFamily:fFraunces,fontSize:11,letterSpacing:'0.35em',padding:'10px 22px',cursor:'pointer',textTransform:'uppercase'}}>SALVA</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeraPage({ theme, loaded, weights, goal, notes, water, waterGoal, meals, workouts, workoutTypes, supps, taken, sleeps, mindful, updNotes, profile }){
  // Sera usa N internamente (palette Notte blu era originaria). Shadow.
  const N = theme || { bg1: '#2C3340', bg2: '#14171F', cream: '#F2E8D0', dim: '#8A8270', gold: '#C9A876', body: '#DDD3C2' };
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  // Diario (note) — sezione fusa qui dalla ex-pagina Diario
  const [noteInput, setNoteInput] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');

  const todayNotesSorted = (notes||[]).filter(n => sameDay(new Date(n.ts), new Date())).sort((a,b)=>new Date(a.ts)-new Date(b.ts));

  async function addNote(){
    const text = noteInput.trim();
    if (!text || !updNotes) return;
    await updNotes([...(notes||[]), { id: newId(), text, ts: new Date().toISOString() }]);
    setNoteInput('');
  }
  async function saveEditNote(){
    const text = editNoteText.trim();
    if (!text || !updNotes || !editingNote) return;
    await updNotes((notes||[]).map(n => n.id===editingNote ? { ...n, text } : n));
    setEditingNote(null); setEditNoteText('');
  }
  async function deleteNote(id){
    if (!updNotes) return;
    await updNotes((notes||[]).filter(n => n.id !== id));
    if (editingNote === id) { setEditingNote(null); setEditNoteText(''); }
  }

  const todayWeights = weights.filter(e=>sameDay(new Date(e.ts),new Date())).sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  const morning = todayWeights[0];
  const evening = todayWeights[todayWeights.length-1];
  const todayNotes = notes.filter(e=>sameDay(new Date(e.ts),new Date()));
  const todayMeals = meals.filter(e=>sameDay(new Date(e.ts),new Date()) && e.status!=='planned');
  const todayWorkouts = workouts.filter(e=>sameDay(new Date(e.ts),new Date()));
  const todayK = dayKey(new Date());
  const todayWater = water[todayK] || 0;
  const todaySuppIds = (taken[todayK] || []);
  const suppsTakenToday = todaySuppIds.length;
  const totalKcal = todayMeals.reduce((a,m)=>a+(m.kcal||0),0);
  const lastNight = sleeps.find(s=>s.wakeDate===todayK);
  const lastNightDur = lastNight ? durHours(lastNight.bedtime, lastNight.waketime) : null;

  // Dettagli allenamenti di oggi: per tipo, somma qty (es. "Corsa 5km · Pesi 30min")
  const workoutDetails = (() => {
    if (todayWorkouts.length === 0) return null;
    const byType = {};
    todayWorkouts.forEach(w => {
      const t = (workoutTypes||[]).find(x => x.id === w.typeId);
      const name = t ? t.name : 'Altro';
      const unit = t ? t.unit : '';
      if (!byType[name]) byType[name] = { qty: 0, unit };
      byType[name].qty += (w.qty || 0);
    });
    return Object.entries(byType).map(([name, v]) => `${name} ${fmt0(v.qty)}${v.unit}`).join(' · ');
  })();

  // Meditazione di oggi: somma minuti dalle sessioni mindful
  const todayMindful = (mindful || []).filter(s => sameDay(new Date(s.ts), new Date()));
  const totalMindfulMin = todayMindful.reduce((a, s) => a + (s.duration_min || 0), 0);

  // Dettagli integratori presi oggi: nomi separati da ·
  const suppDetails = (() => {
    if (todaySuppIds.length === 0) return null;
    const names = todaySuppIds.map(id => {
      const s = (supps || []).find(x => x.id === id);
      return s ? s.name : null;
    }).filter(Boolean);
    return names.length > 0 ? names.join(' · ') : null;
  })();

  async function runAiAnalysis(){
    setAiAnalyzing(true); setAiError(''); setAiResult(null);
    try {
      // Costruisci il riepilogo dei dati
      const summary = buildWeightLossSummary({ weights, goal, meals, workouts, workoutTypes, supps, taken, sleeps, water });
      const r = await analyzeWeightLoss(summary);
      if (r.error) setAiError('IA: '+(r.error||'errore sconosciuto'));
      else setAiResult(r);
    } catch (e) { setAiError('Errore'); }
    finally { setAiAnalyzing(false); }
  }

  // Target calorico del giorno (Zona 40/30/30 — stessa logica della pagina Menù)
  const kcalTarget = useMemo(() => computeNutritionTarget(profile, weights, goal).kcal, [profile, weights, goal]);

  return (
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at top, ${N.bg1} 0%, ${N.bg2} 100%)`,color:N.cream,fontFamily:fFraunces,position:'relative',overflow:'hidden'}}>
      <div aria-hidden style={{position:'absolute',inset:14,border:`1px solid ${N.gold}40`,borderRadius:20,pointerEvents:'none',zIndex:1}} />
      <div aria-hidden style={{position:'absolute',inset:20,border:`1px solid ${N.gold}1A`,borderRadius:16,pointerEvents:'none',zIndex:1}} />
      <div style={{position:'relative',zIndex:2,padding:'32px 28px 28px',maxWidth:480,margin:'0 auto'}}>
        <Header q="SERA" sub="VIII" color={N.gold} dim={N.goldDim} mark="✦" font={fFraunces} />

        {!loaded && <Loading color={N.dim} />}

        {loaded && (<>
          <div style={{marginTop:26,textAlign:'left'}}>
            <Row theme={N} label="sonno notte scorsa" value={lastNightDur!=null?fmtDur(lastNightDur):'—'} />
            <Row theme={N} label="peso · mattina" value={morning?fmt(morning.weight):'—'} unit="kg" />
            <Row theme={N} label="peso · sera" value={evening&&evening!==morning?fmt(evening.weight):'—'} unit="kg" />
            <Row theme={N} label="calorie" value={`${fmt0(totalKcal)} / ${fmt0(kcalTarget)}`} unit="kcal" />
            <Row theme={N} label="acqua" value={todayWater} unit={`/ ${waterGoal}`} />
            <Row theme={N} label="allenamenti" value={todayWorkouts.length||'—'} details={workoutDetails} />
            <Row theme={N} label="meditazione" value={totalMindfulMin>0?fmt0(totalMindfulMin):'—'} unit={totalMindfulMin>0?'min':''} details={todayMindful.length>1?`${todayMindful.length} sessioni`:null} />
            <Row theme={N} label="integratori" value={supps.length>0?`${suppsTakenToday} / ${supps.length}`:'—'} details={suppDetails} />
          </div>

          {/* === SEZIONE NOTE: solo note manuali (cronologia automatica rimossa) === */}
          <div style={{marginTop:30}}>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
              <div style={{flex:1,height:1,background:`linear-gradient(90deg, transparent, ${N.gold}55)`}} />
              <span style={{fontFamily:fFraunces,fontSize:10,letterSpacing:'0.45em',color:N.gold,textTransform:'uppercase'}}>note</span>
              <div style={{flex:1,height:1,background:`linear-gradient(90deg, ${N.gold}55, transparent)`}} />
            </div>

            {todayNotesSorted.length === 0 ? (
              <div style={{textAlign:'center',fontFamily:fFraunces,fontStyle:'italic',fontSize:13,color:N.dim||N.goldDim,padding:'4px 0 14px',opacity:0.8}}>
                Nessuna nota oggi. Scrivi un pensiero qui sotto.
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
                {todayNotesSorted.map(n => {
                  const time = new Date(n.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                  const isEditing = editingNote === n.id;
                  if (isEditing) {
                    return (
                      <div key={`note-${n.id}`} style={{padding:'10px 12px',background:`${N.gold}0A`,border:`1px solid ${N.gold}44`}}>
                        <textarea value={editNoteText} onChange={e=>setEditNoteText(e.target.value)} rows={3} style={{width:'100%',background:'transparent',border:'none',color:N.cream||N.body,fontFamily:fFraunces,fontStyle:'italic',fontSize:14,resize:'vertical',outline:'none'}} />
                        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                          <button onClick={()=>{setEditingNote(null);setEditNoteText('');}} style={{background:'transparent',color:N.dim||N.goldDim,border:`1px solid ${N.dim||N.goldDim}66`,fontFamily:fFraunces,fontSize:10,letterSpacing:'0.2em',padding:'6px 12px',cursor:'pointer',textTransform:'uppercase'}}>annulla</button>
                          <button onClick={()=>deleteNote(n.id)} style={{background:'transparent',color:'#C99A7A',border:`1px solid #C99A7A66`,fontFamily:fFraunces,fontSize:10,letterSpacing:'0.2em',padding:'6px 12px',cursor:'pointer',textTransform:'uppercase'}}>elimina</button>
                          <button onClick={saveEditNote} style={{background:N.gold,color:N.bg2||'#14171F',border:'none',fontFamily:fFraunces,fontSize:10,letterSpacing:'0.2em',padding:'6px 12px',cursor:'pointer',textTransform:'uppercase'}}>salva</button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={`note-${n.id}`} onClick={()=>{setEditingNote(n.id);setEditNoteText(n.text);}} style={{display:'flex',gap:12,padding:'10px 12px',background:`${N.gold}08`,border:`1px solid ${N.gold}33`,cursor:'pointer'}}>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,minWidth:46,flexShrink:0}}>
                        <span style={{fontSize:14,color:N.gold,lineHeight:1}}>⟡</span>
                        <span style={{fontFamily:fFraunces,fontSize:9,letterSpacing:'0.2em',color:N.dim||N.goldDim}}>{time}</span>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:14,color:N.cream||N.body,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{n.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Input nuova nota */}
            <div style={{marginTop:14}}>
              <textarea value={noteInput} onChange={e=>setNoteInput(e.target.value)} rows={2} placeholder="Un pensiero, un dettaglio, qualcosa da ricordare…" style={{width:'100%',background:`${N.gold}06`,border:`1px solid ${N.gold}33`,color:N.cream||N.body,fontFamily:fFraunces,fontStyle:'italic',fontSize:14,padding:'10px 12px',outline:'none',resize:'vertical',boxSizing:'border-box'}} />
              <div style={{textAlign:'right',marginTop:8}}>
                <button onClick={addNote} disabled={!noteInput.trim()} style={{background:noteInput.trim()?N.gold:'transparent',color:noteInput.trim()?(N.bg2||'#14171F'):N.dim,border:`1px solid ${noteInput.trim()?N.gold:N.dim+'66'}`,fontFamily:fFraunces,fontSize:10,letterSpacing:'0.3em',padding:'8px 18px',cursor:noteInput.trim()?'pointer':'not-allowed',textTransform:'uppercase'}}>aggiungi nota</button>
              </div>
            </div>
          </div>
          {/* === FINE SEZIONE NOTE === */}
          <div style={{marginTop:22,padding:14,background:`${N.gold}0F`,border:`1px solid ${N.gold}33`,borderRadius:2,textAlign:'left'}}>
            <div style={{fontFamily:fFraunces,fontSize:9,letterSpacing:'0.4em',color:N.gold,textTransform:'uppercase'}}>⟡ riflessione</div>
            <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:14,color:N.body,marginTop:6,lineHeight:1.5}}>
              {todayMeals.length===0 && todayWeights.length===0 && !lastNight
                ? "La giornata è ancora silenziosa. Registra qualcosa per ricevere una riflessione."
                : lastNightDur!=null && lastNightDur<6
                ? `Hai dormito ${fmtDur(lastNightDur)} la scorsa notte — poco. Il sonno breve aumenta la fame e rallenta il dimagrimento.`
                : evening && morning && evening!==morning
                ? `Tra mattina e sera il peso è cambiato di ${fmt(Math.abs(evening.weight-morning.weight),1)} kg. È fisiologico — guarda la media settimanale.`
                : todayWater < Math.ceil(waterGoal*0.75)
                ? `Hai bevuto ${todayWater} bicchieri su ${waterGoal}. Domani prova a chiudere il cerchio.`
                : "Le riflessioni dell'IA si arricchiranno man mano che il diario cresce. Servono 20-30 giorni."}
            </div>
          </div>

          {/* Analisi IA per dimagrimento */}
          <div style={{marginTop:22,padding:16,background:`${N.gold}08`,border:`1px solid ${N.gold}55`,borderRadius:2,textAlign:'left'}}>
            <div style={{fontFamily:fFraunces,fontSize:9,letterSpacing:'0.4em',color:N.gold,textTransform:'uppercase',marginBottom:8}}>✦ analisi IA · dimagrimento</div>

            {!aiResult && !aiAnalyzing && !aiError && (
              <>
                <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:13,color:N.body,lineHeight:1.5,marginBottom:14}}>
                  Lascia che l'IA analizzi peso, sonno, alimentazione, allenamenti e integratori per dirti cosa fare per dimagrire.
                </div>
                <div style={{textAlign:'center'}}>
                  <button onClick={runAiAnalysis} style={{background:N.gold,color:N.bg2,border:'none',fontFamily:fFraunces,fontSize:11,letterSpacing:'0.3em',padding:'12px 26px',cursor:'pointer',textTransform:'uppercase'}}>analizza tutto</button>
                </div>
              </>
            )}

            {aiAnalyzing && (
              <div style={{textAlign:'center',padding:'18px 0',fontFamily:fFraunces,fontStyle:'italic',fontSize:14,color:N.dim}}>⋯ sto leggendo i tuoi dati</div>
            )}

            {aiError && !aiAnalyzing && (
              <>
                <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:13,color:'#C99A7A',marginBottom:10}}>{aiError}</div>
                <div style={{textAlign:'center'}}>
                  <button onClick={runAiAnalysis} style={{background:'transparent',color:N.gold,border:`1px solid ${N.gold}66`,fontFamily:fFraunces,fontSize:11,letterSpacing:'0.3em',padding:'10px 22px',cursor:'pointer',textTransform:'uppercase'}}>riprova</button>
                </div>
              </>
            )}

            {aiResult && (
              <>
                {aiResult.stato && (
                  <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:14,color:N.body,lineHeight:1.55,marginBottom:14}}>{aiResult.stato}</div>
                )}

                {aiResult.focus && (
                  <div style={{padding:'10px 12px',background:`${N.gold}15`,borderLeft:`2px solid ${N.gold}`,marginBottom:14}}>
                    <div style={{fontFamily:fFraunces,fontSize:9,letterSpacing:'0.35em',color:N.gold,textTransform:'uppercase',marginBottom:4}}>focus</div>
                    <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:14,color:N.cream}}>{aiResult.focus}</div>
                  </div>
                )}

                {aiResult.azioni && aiResult.azioni.length>0 && (
                  <div style={{marginBottom:14}}>
                    <div style={{fontFamily:fFraunces,fontSize:9,letterSpacing:'0.35em',color:N.gold,textTransform:'uppercase',marginBottom:8}}>azioni</div>
                    {aiResult.azioni.map((a,i)=>(
                      <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:i<aiResult.azioni.length-1?`1px solid ${N.gold}1A`:'none'}}>
                        <span style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:14,color:N.gold,flexShrink:0,minWidth:18}}>{i+1}.</span>
                        <span style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:13,color:N.body,lineHeight:1.5}}>{a}</span>
                      </div>
                    ))}
                  </div>
                )}

                {aiResult.attenzione && (
                  <div style={{padding:'10px 12px',background:'#5C2828',border:'1px solid #C99A7A66',marginBottom:14}}>
                    <div style={{fontFamily:fFraunces,fontSize:9,letterSpacing:'0.35em',color:'#E8B8A0',textTransform:'uppercase',marginBottom:4}}>⚠ attenzione</div>
                    <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:13,color:'#F2D8C8'}}>{aiResult.attenzione}</div>
                  </div>
                )}

                <div style={{textAlign:'center'}}>
                  <button onClick={runAiAnalysis} style={{background:'transparent',color:N.dim,border:`1px solid ${N.dim}66`,fontFamily:fFraunces,fontSize:10,letterSpacing:'0.25em',padding:'8px 18px',cursor:'pointer',textTransform:'uppercase'}}>rianalizza</button>
                </div>
              </>
            )}
          </div>
        </>)}
      </div>
    </div>
  );
}


/* ============================== IV · DIGIUNO ============================== */
const FAST_PRESETS_INTERMITTENT = [
  { id:'16_8', label:'16 : 8', hours:16, desc:'classico · finestra di 8h' },
  { id:'18_6', label:'18 : 6', hours:18, desc:'finestra di 6h' },
  { id:'20_4', label:'20 : 4', hours:20, desc:'guerriero · 4h' },
  { id:'omad', label:'23 : 1 · OMAD', hours:23, desc:'un solo pasto' },
];
const FAST_PRESETS_EXTENDED = [
  { id:'24h', label:'24 ore', hours:24, desc:'1 giorno · digiuno breve' },
  { id:'36h', label:'36 ore', hours:36, desc:'monk fast' },
  { id:'48h', label:'48 ore', hours:48, desc:'2 giorni · autofagia profonda' },
  { id:'72h', label:'72 ore', hours:72, desc:'3 giorni · rigenerazione cellulare' },
];
const FAST_PHASES = [
  { h:0, label:'glucosio', note:'il corpo brucia gli ultimi zuccheri' },
  { h:4, label:'glicogeno', note:'consuma le riserve epatiche' },
  { h:12, label:'lipolisi', note:'inizia a bruciare i grassi' },
  { h:16, label:'autofagia · I', note:'le cellule iniziano la pulizia' },
  { h:24, label:'chetosi', note:'energia dai corpi chetonici' },
  { h:36, label:'autofagia · II', note:'rinnovo cellulare attivo' },
  { h:48, label:'rigenerazione', note:'staminali e antinfiammazione' },
  { h:72, label:'profonda', note:'massimo beneficio metabolico' },
];

function DigiunoPage({ theme, loaded, fasts, updFasts }){
  // Digiuno usa D internamente (palette Notturno ambra era originaria). Shadow.
  const D = theme || { bg1: '#1F2228', bg2: '#0E1115', cream: '#E8E4D5', accent: '#C9A876', amber: '#D4A23E', dim: '#6B6478', active: '#A8826E', danger: '#C99A7A' };
  const [now, setNow] = useState(Date.now());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [category, setCategory] = useState('intermittent');
  const [customHours, setCustomHours] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null); // id digiuno da eliminare

  // Reset auto delle conferme dopo 4s
  useEffect(()=>{
    if (!confirmEnd) return;
    const id = setTimeout(()=>setConfirmEnd(false), 4000);
    return ()=>clearTimeout(id);
  },[confirmEnd]);
  useEffect(()=>{
    if (!confirmDel) return;
    const id = setTimeout(()=>setConfirmDel(null), 4000);
    return ()=>clearTimeout(id);
  },[confirmDel]);

  const active = useMemo(()=>fasts.find(f=>!f.ended_ts) || null,[fasts]);
  const past = useMemo(()=>fasts.filter(f=>f.ended_ts).sort((a,b)=>new Date(b.ended_ts)-new Date(a.ended_ts)),[fasts]);

  useEffect(()=>{
    if(!active) return;
    const id = setInterval(()=>setNow(Date.now()), 15000); // ogni 15s
    return ()=>clearInterval(id);
  },[active]);

  async function startFast(preset, hoursOverride){
    const hours = hoursOverride ?? preset.hours;
    const started = new Date();
    const planned_end = new Date(started.getTime() + hours*3600000);
    await updFasts([...fasts, { id:newId(), started_ts:started.toISOString(), planned_hours:hours, planned_end_ts:planned_end.toISOString(), type:preset?.id||'custom', label:preset?.label||`${hours}h`, ended_ts:null }]);
    setPickerOpen(false);
  }
  async function endFast(){
    if(!active) return;
    await updFasts(fasts.map(f=>f.id===active.id?{...f,ended_ts:new Date().toISOString()}:f));
  }
  async function deleteFast(id){
    await updFasts(fasts.filter(f=>f.id!==id));
  }
  async function startCustom(){
    const h = parseInt(customHours);
    if(isNaN(h)||h<1||h>240) return;
    await startFast({id:'custom',label:`${h}h`,hours:h}, h);
    setCustomHours('');
  }

  const elapsedMs = active ? (now - new Date(active.started_ts).getTime()) : 0;
  const elapsedH = elapsedMs / 3600000;
  const plannedH = active?.planned_hours || 16;
  const progress = Math.min(100, (elapsedH/plannedH)*100);
  const currentPhase = active ? FAST_PHASES.filter(p=>p.h <= elapsedH).slice(-1)[0] : null;
  const nextPhase = active ? FAST_PHASES.find(p=>p.h > elapsedH) : null;

  function fmtElapsed(ms){
    if(ms<=0) return '0h 00m';
    const totalMin = Math.floor(ms/60000);
    const h = Math.floor(totalMin/60);
    const m = totalMin % 60;
    if(h<24) return `${h}h ${String(m).padStart(2,'0')}m`;
    const d = Math.floor(h/24);
    return `${d}g ${h%24}h ${String(m).padStart(2,'0')}m`;
  }

  // Stats totale
  const totalHours = past.reduce((a,f)=>{ const dur=(new Date(f.ended_ts)-new Date(f.started_ts))/3600000; return a+dur; }, 0);
  const longest = past.reduce((a,f)=>{ const dur=(new Date(f.ended_ts)-new Date(f.started_ts))/3600000; return Math.max(a,dur); }, 0);

  return (
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at top, ${D.bg1} 0%, ${D.bg2} 100%)`,color:D.cream,fontFamily:fBodoni,position:'relative',overflow:'hidden'}}>
      <div aria-hidden style={{position:'absolute',inset:14,border:`1px solid ${D.gold}40`,borderRadius:20,pointerEvents:'none',zIndex:1}} />
      <div aria-hidden style={{position:'absolute',inset:20,border:`1px solid ${D.gold}1A`,borderRadius:16,pointerEvents:'none',zIndex:1}} />
      <div style={{position:'relative',zIndex:2,padding:'32px 28px 28px',maxWidth:480,margin:'0 auto'}}>
        <Header q="DIGIUNO" sub="IV" color={D.gold} dim={D.goldDim} mark="✦" font={fBodoni} />

        {!loaded && <Loading color={D.dim} />}

        {loaded && !active && (
          <>
            <div style={{textAlign:'center',marginTop:24,fontFamily:fBodoni,fontStyle:'italic',fontSize:15,color:D.cream,lineHeight:1.5}}>
              Nessun digiuno attivo.<br/>
              <span style={{fontSize:13,color:D.dim}}>Scegli un protocollo e inizia.</span>
            </div>

            {/* Selettore categoria */}
            <div style={{display:'flex',gap:0,marginTop:24,borderBottom:`1px solid ${D.accent}33`}}>
              {[{id:'intermittent',label:'intermittente'},{id:'extended',label:'prolungato'},{id:'custom',label:'personalizzato'}].map(c=>{
                const act = category===c.id;
                return (
                  <button key={c.id} onClick={()=>setCategory(c.id)} style={{flex:1,padding:'12px 4px',background:'transparent',border:'none',borderBottom:`2px solid ${act?D.amber:'transparent'}`,marginBottom:-1,fontFamily:fDmSans,fontSize:10,letterSpacing:'0.25em',textTransform:'uppercase',color:act?D.amber:D.dim,cursor:'pointer'}}>{c.label}</button>
                );
              })}
            </div>

            <div style={{marginTop:18}}>
              {category==='intermittent' && FAST_PRESETS_INTERMITTENT.map(p=>(
                <button key={p.id} onClick={()=>startFast(p)} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',marginBottom:8,background:`${D.accent}0F`,border:`1px solid ${D.accent}33`,borderLeft:`3px solid ${D.amber}`,cursor:'pointer',textAlign:'left',color:D.cream}}>
                  <div>
                    <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:20,lineHeight:1}}>{p.label}</div>
                    <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:12,color:D.dim,marginTop:4}}>{p.desc}</div>
                  </div>
                  <span style={{fontFamily:fDmSans,fontSize:10,letterSpacing:'0.3em',color:D.amber,textTransform:'uppercase'}}>inizia ›</span>
                </button>
              ))}
              {category==='extended' && FAST_PRESETS_EXTENDED.map(p=>(
                <button key={p.id} onClick={()=>startFast(p)} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',marginBottom:8,background:`${D.accent}0F`,border:`1px solid ${D.accent}33`,borderLeft:`3px solid ${D.amber}`,cursor:'pointer',textAlign:'left',color:D.cream}}>
                  <div>
                    <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:20,lineHeight:1}}>{p.label}</div>
                    <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:12,color:D.dim,marginTop:4}}>{p.desc}</div>
                  </div>
                  <span style={{fontFamily:fDmSans,fontSize:10,letterSpacing:'0.3em',color:D.amber,textTransform:'uppercase'}}>inizia ›</span>
                </button>
              ))}
              {category==='custom' && (
                <div style={{padding:'18px 16px',background:`${D.accent}0F`,border:`1px solid ${D.accent}33`,borderLeft:`3px solid ${D.amber}`}}>
                  <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:14,color:D.cream,marginBottom:10}}>Durata in ore (1 – 240)</div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <input type="text" inputMode="numeric" value={customHours} onChange={e=>setCustomHours(e.target.value)} placeholder="es. 36" style={{flex:1,background:'transparent',border:`1px solid ${D.accent}66`,fontFamily:fBodoni,fontStyle:'italic',fontSize:24,color:D.cream,padding:'8px 12px',outline:'none',textAlign:'center'}} />
                    <button onClick={startCustom} disabled={!customHours} style={{background:D.amber,color:D.bg2,border:'none',fontFamily:fDmSans,fontSize:10,letterSpacing:'0.35em',padding:'14px 22px',cursor:customHours?'pointer':'default',opacity:customHours?1:0.4,textTransform:'uppercase'}}>inizia</button>
                  </div>
                </div>
              )}
            </div>

            {past.length>0 && (
              <div style={{marginTop:28,paddingTop:18,borderTop:`1px solid ${D.accent}33`}}>
                <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:D.dim,textAlign:'center',textTransform:'uppercase',marginBottom:10}}>STATISTICHE</div>
                <div style={{display:'flex',justifyContent:'space-around',marginBottom:18}}>
                  <Stat label="digiuni" value={past.length} color={D.amber} dim={D.dim} />
                  <Stat label="tot. ore" value={fmt0(totalHours)} color={D.amber} dim={D.dim} />
                  <Stat label="più lungo" value={`${fmt0(longest)}h`} color={D.amber} dim={D.dim} />
                </div>
                <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:D.dim,textAlign:'center',textTransform:'uppercase',marginBottom:10}}>STORICO</div>
                {past.slice(0,10).map(f=>{
                  const dur = (new Date(f.ended_ts)-new Date(f.started_ts))/3600000;
                  const reached = (dur/f.planned_hours)*100;
                  return (
                    <button key={f.id} onClick={()=>{ if(confirmDel===f.id){ deleteFast(f.id); setConfirmDel(null); } else { setConfirmDel(f.id); } }} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 4px',background:confirmDel===f.id?`${D.danger}1A`:'transparent',border:'none',borderBottom:`1px solid ${D.accent}1F`,cursor:'pointer',textAlign:'left',color:D.cream}}>
                      <div>
                        <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:16}}>{fmtElapsed((new Date(f.ended_ts)-new Date(f.started_ts)))}{' '}<span style={{fontSize:11,color:D.dim}}>· {f.label}</span></div>
                        <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.15em',color:D.dim,marginTop:2,textTransform:'uppercase'}}>{new Date(f.started_ts).toLocaleDateString('it-IT',{day:'numeric',month:'short'})} — {Math.round(reached)}%</div>
                      </div>
                      <span style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:12,color:confirmDel===f.id?D.danger:D.dim}}>{confirmDel===f.id?'tocca ancora ✗':'elimina'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {loaded && active && (
          <>
            <div style={{textAlign:'center',marginTop:20}}>
              <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.45em',color:D.amber,textTransform:'uppercase',marginBottom:6}}>{active.label} · iniziato {new Date(active.started_ts).toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
              <div style={{fontFamily:fBodoni,fontStyle:'italic',fontWeight:400,fontSize:64,lineHeight:1,color:D.cream,letterSpacing:'-0.02em'}}>{fmtElapsed(elapsedMs)}</div>
              <div style={{fontFamily:fDmSans,fontSize:10,letterSpacing:'0.4em',color:D.dim,marginTop:6,textTransform:'uppercase'}}>su {plannedH}h obiettivo</div>
            </div>

            {/* Progress bar */}
            <div style={{marginTop:24,height:8,background:`${D.accent}1F`,position:'relative',borderRadius:0}}>
              <div style={{position:'absolute',top:0,left:0,bottom:0,width:`${progress}%`,background:`linear-gradient(90deg, ${D.active} 0%, ${D.amber} 100%)`,transition:'width 0.5s ease'}} />
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontFamily:fDmSans,fontSize:9,letterSpacing:'0.2em',color:D.dim,textTransform:'uppercase'}}>
              <span>{Math.round(progress)}%</span>
              <span>{progress>=100?'obiettivo raggiunto':`-${fmtElapsed((plannedH-elapsedH)*3600000)}`}</span>
            </div>

            {/* Phase corrente */}
            {currentPhase && (
              <div style={{marginTop:22,padding:14,background:`${D.amber}1F`,borderLeft:`3px solid ${D.amber}`}}>
                <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:D.amber,textTransform:'uppercase',marginBottom:4}}>fase · {currentPhase.h}h+</div>
                <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:20,color:D.cream}}>{currentPhase.label}</div>
                <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:13,color:D.dim,marginTop:4,lineHeight:1.4}}>{currentPhase.note}</div>
              </div>
            )}
            {nextPhase && (
              <div style={{marginTop:10,padding:'10px 14px',fontFamily:fBodoni,fontStyle:'italic',fontSize:12,color:D.dim,background:`${D.accent}0A`}}>
                → prossima fase: <span style={{color:D.accent}}>{nextPhase.label}</span> tra {fmtElapsed((nextPhase.h-elapsedH)*3600000)}
              </div>
            )}

            {/* Phases timeline */}
            <div style={{marginTop:22}}>
              <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:D.dim,textAlign:'center',textTransform:'uppercase',marginBottom:10}}>fasi del digiuno</div>
              {FAST_PHASES.map(p=>{
                const reached = elapsedH >= p.h;
                return (
                  <div key={p.h} style={{display:'flex',alignItems:'baseline',gap:10,padding:'8px 0',borderBottom:`1px solid ${D.accent}11`,opacity:reached?1:0.45}}>
                    <span style={{fontFamily:fDmSans,fontSize:10,letterSpacing:'0.15em',color:reached?D.amber:D.dim,minWidth:40}}>{p.h}h</span>
                    <span style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:14,color:reached?D.cream:D.dim,flex:1}}>{p.label}</span>
                    {reached && <span style={{color:D.amber,fontSize:12}}>✓</span>}
                  </div>
                );
              })}
            </div>

            <div style={{textAlign:'center',marginTop:28}}>
              {!confirmEnd ? (
                <button onClick={()=>setConfirmEnd(true)} style={{background:'transparent',color:D.danger,border:`1px solid ${D.danger}`,fontFamily:fDmSans,fontSize:11,letterSpacing:'0.4em',padding:'14px 30px',cursor:'pointer',textTransform:'uppercase'}}>termina digiuno</button>
              ) : (
                <div style={{padding:'14px',background:`${D.danger}1A`,border:`1px solid ${D.danger}66`}}>
                  <div style={{fontFamily:fBodoni,fontStyle:'italic',fontSize:15,color:D.cream,marginBottom:12}}>Terminare il digiuno ora?</div>
                  <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                    <button onClick={()=>setConfirmEnd(false)} style={{flex:1,background:'transparent',color:D.dim,border:`1px solid ${D.dim}66`,fontFamily:fDmSans,fontSize:10,letterSpacing:'0.35em',padding:'10px 14px',cursor:'pointer',textTransform:'uppercase'}}>annulla</button>
                    <button onClick={()=>{ endFast(); setConfirmEnd(false); }} style={{flex:1,background:D.danger,color:D.bg2,border:'none',fontFamily:fDmSans,fontSize:10,letterSpacing:'0.35em',padding:'10px 14px',cursor:'pointer',textTransform:'uppercase'}}>sì, termina</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


/* ============================== VII · RESPIRO ============================== */
const MINDFUL_TYPES = [
  { id:'meditazione', label:'meditazione', sym:'☯' },
  { id:'respirazione', label:'respirazione', sym:'∞' },
  { id:'camminata', label:'camminata', sym:'⟶' },
  { id:'gratitudine', label:'gratitudine', sym:'✦' },
];

function RespiroPage({ theme, loaded, sessions, updSessions, workouts, types, updWorkouts, updTypes }){
  // Respiro usa M internamente (palette Bosco pastello era originaria). Shadow.
  const M = theme || { bg1: '#EAE6D2', bg2: '#D8D4C0', ink: '#3A4339', accent: '#7A8E78', dim: '#9CA194', cream: '#F4F1E5' };
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [logging, setLogging] = useState(null); // type id while in form
  const [draftMin, setDraftMin] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [cycleMs, setCycleMs] = useState(0);
  const [confirmDelSess, setConfirmDelSess] = useState(null);
  // Sezione movimento (ex Allena, fusa qui)
  const [detailTypeId, setDetailTypeId] = useState(null);
  const [editingType, setEditingType] = useState(null);

  async function saveType(data){
    if(editingType==='new') await updTypes([...(types||[]),{id:newId(),name:data.name,unit:data.unit}]);
    else await updTypes((types||[]).map(t=>t.id===editingType?{...t,name:data.name,unit:data.unit}:t));
    setEditingType(null);
  }
  async function delType(){
    if((workouts||[]).some(w=>w.typeId===editingType)) await updWorkouts((workouts||[]).filter(w=>w.typeId!==editingType));
    await updTypes((types||[]).filter(t=>t.id!==editingType));
    setEditingType(null);
  }
  const editingT = editingType && editingType!=='new' ? (types||[]).find(t=>t.id===editingType) : null;
  const detailType = detailTypeId ? (types||[]).find(t=>t.id===detailTypeId) : null;

  useEffect(()=>{
    if (!confirmDelSess) return;
    const id = setTimeout(()=>setConfirmDelSess(null), 4000);
    return ()=>clearTimeout(id);
  },[confirmDelSess]);

  // Breathing animation cycle: 4-4-4-4 box (16s totali)
  useEffect(()=>{
    if(!breathingOpen) return;
    setCycleMs(0);
    const start = Date.now();
    const id = setInterval(()=>{ setCycleMs((Date.now()-start) % 16000); }, 100);
    return ()=>clearInterval(id);
  },[breathingOpen]);

  const phaseIdx = Math.floor(cycleMs/4000); // 0,1,2,3
  const phaseProgress = (cycleMs % 4000) / 4000;
  const phaseLabel = ['inspira','trattieni','espira','riposa'][phaseIdx] || 'inspira';
  let scale = 0.35;
  if (phaseIdx === 0) scale = 0.35 + 0.65 * phaseProgress;
  else if (phaseIdx === 1) scale = 1.0;
  else if (phaseIdx === 2) scale = 1.0 - 0.65 * phaseProgress;
  else scale = 0.35;

  async function saveSession(){
    const min = parseFloat((draftMin||'').replace(',','.'));
    if (isNaN(min) || min<=0) return;
    await updSessions([...sessions,{ id:newId(), ts:new Date().toISOString(), type:logging, duration_min:min, note:draftNote.trim()||null }]);
    setLogging(null); setDraftMin(''); setDraftNote('');
  }
  async function deleteSession(id){
    await updSessions(sessions.filter(s=>s.id!==id));
    setConfirmDelSess(null);
  }

  // Stats
  const now = new Date();
  const last7 = sessions.filter(s=>(now-new Date(s.ts))<7*86400000);
  const weekMin = last7.reduce((a,s)=>a+(s.duration_min||0),0);
  const todayCount = sessions.filter(s=>sameDay(new Date(s.ts),now)).length;
  // streak: giorni consecutivi con almeno 1 sessione
  let streak = 0;
  const today = new Date(now); today.setHours(0,0,0,0);
  for(let i=0;i<90;i++){
    const d = new Date(today); d.setDate(d.getDate()-i);
    const has = sessions.some(s=>sameDay(new Date(s.ts), d));
    if (has) streak++; else break;
  }
  const recent = [...sessions].sort((a,b)=>new Date(b.ts)-new Date(a.ts)).slice(0,12);

  return (
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at top, ${M.bg1} 0%, ${M.bg2} 100%)`,color:M.cream,fontFamily:fCormorant,position:'relative',overflow:'hidden'}}>
      <div aria-hidden style={{position:'absolute',inset:14,border:`1px solid ${M.gold}40`,borderRadius:20,pointerEvents:'none',zIndex:1}} />
      <div aria-hidden style={{position:'absolute',inset:20,border:`1px solid ${M.gold}1A`,borderRadius:16,pointerEvents:'none',zIndex:1}} />
      <div style={{position:'relative',zIndex:2,padding:'32px 28px 28px',maxWidth:480,margin:'0 auto'}}>
        <Header q="CORPO" sub="VI" color={M.gold} dim={M.goldDim} mark="✦" font={fCormorant} />

        {!loaded && <Loading color={M.dim} />}

        {loaded && (<>
          {/* Stats sessioni mindful */}
          <div style={{display:'flex',justifyContent:'space-around',marginTop:18,padding:'14px 0',borderTop:`1px solid ${M.accent}44`,borderBottom:`1px solid ${M.accent}44`}}>
            <Stat label="oggi" value={todayCount} color={M.accent} dim={M.dim} />
            <Stat label="min · 7g" value={fmt0(weekMin)} color={M.accent} dim={M.dim} />
            <Stat label="streak" value={streak} color={M.accent} dim={M.dim} />
          </div>

          {/* === SEZIONE MOVIMENTO (ex pagina Allena, fusa qui) === */}
          <div style={{marginTop:26}}>
            <div style={{padding:'10px 0',borderBottom:`1px solid ${M.accent}33`,display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
              <span style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:M.accent,textTransform:'uppercase'}}>movimento</span>
              <span style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.35em',color:M.dim,textTransform:'uppercase'}}>30 g · tendenza</span>
            </div>
            <div>
              {(types||[]).length===0 ? (
                <div style={{textAlign:'center',padding:'18px 0',fontFamily:fCormorant,fontStyle:'italic',fontSize:14,color:M.dim}}>Nessun tipo di allenamento.</div>
              ) : (types||[]).map(t=>{
                const tw = (workouts||[]).filter(w=>w.typeId===t.id);
                const last30 = tw.filter(w=>(Date.now()-new Date(w.ts).getTime()) < 30*86400000);
                const totalQty = last30.reduce((a,w)=>a+(w.qty||0),0);
                const today=new Date(); const sparkVals=[];
                for(let i=29;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); const dk=dayKey(d); const sum=tw.filter(w=>dayKey(new Date(w.ts))===dk).reduce((a,w)=>a+(w.qty||0),0); sparkVals.push(sum>0?sum:null); }
                const spark = buildLineChart(sparkVals,90,30);
                return (
                  <button key={t.id} onClick={()=>setDetailTypeId(t.id)} style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'12px 4px',background:'transparent',border:'none',borderBottom:`1px solid ${M.accent}1A`,cursor:'pointer',textAlign:'left'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:18,color:M.ink}}>{t.name}</div>
                      <div style={{fontFamily:fDmSans,fontSize:10,letterSpacing:'0.15em',color:M.dim,marginTop:2}}>{last30.length} sessioni · {fmt0(totalQty)} {t.unit}</div>
                    </div>
                    <svg viewBox="0 0 90 30" width="90" height="30" style={{flexShrink:0}}>
                      {spark.points.length>1 && <path d={spark.path} stroke={M.accent} strokeWidth="1.4" fill="none" />}
                      {spark.points.length>0 && <circle cx={spark.points[spark.points.length-1].x} cy={spark.points[spark.points.length-1].y} r="2.2" fill={M.accent} />}
                      {spark.points.length===0 && <line x1="0" y1="15" x2="90" y2="15" stroke={M.accent} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.3" />}
                    </svg>
                    <span style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:14,color:M.dim,marginLeft:6}}>›</span>
                  </button>
                );
              })}
            </div>
            <div style={{textAlign:'center',marginTop:14}}>
              <button onClick={()=>setEditingType('new')} style={{background:'transparent',color:M.accent,border:`1px dashed ${M.accent}99`,fontFamily:fDmSans,fontSize:10,letterSpacing:'0.35em',padding:'9px 20px',cursor:'pointer',textTransform:'uppercase'}}>+ nuovo tipo</button>
            </div>
          </div>
          {/* === FINE SEZIONE MOVIMENTO === */}

          {/* Divisore decorativo tra MOVIMENTO e RESPIRO */}
          <div style={{display:'flex',alignItems:'center',gap:14,marginTop:36,marginBottom:8}}>
            <div style={{flex:1,height:1,background:`linear-gradient(90deg, transparent, ${M.accent}55)`}} />
            <span style={{fontFamily:fCormorant,fontSize:18,color:M.accent,opacity:0.7}}>✦</span>
            <div style={{flex:1,height:1,background:`linear-gradient(90deg, ${M.accent}55, transparent)`}} />
          </div>

          {/* === SEZIONE RESPIRO === */}
          <div style={{padding:'10px 0 0',display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
            <span style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:M.accent,textTransform:'uppercase'}}>respiro</span>
            <span style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.35em',color:M.dim,textTransform:'uppercase'}}>mente · presenza</span>
          </div>

          {/* Esercizio respiro */}
          <div style={{textAlign:'center',marginTop:6,padding:'18px 14px',background:`${M.accent}1A`,border:`1px solid ${M.accent}33`}}>
            <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:M.accent,textTransform:'uppercase',marginBottom:8}}>respira ora</div>
            <div style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:14,color:M.ink,lineHeight:1.5,marginBottom:14}}>respirazione quadrata · 4 secondi per fase<br/><span style={{fontSize:12,color:M.dim}}>per calmare la mente, anche solo 1 minuto</span></div>
            <button onClick={()=>setBreathingOpen(true)} style={{background:M.gold||M.ink,color:M.bg1||M.cream,border:`1px solid ${M.gold||M.ink}`,fontFamily:fDmSans,fontSize:10,letterSpacing:'0.4em',padding:'12px 24px',cursor:'pointer',textTransform:'uppercase'}}>inizia</button>
          </div>

          {/* Registra sessione */}
          <div style={{marginTop:24}}>
            <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:M.dim,textAlign:'center',textTransform:'uppercase',marginBottom:12}}>registra sessione</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {MINDFUL_TYPES.map(t=>(
                <button key={t.id} onClick={()=>{ setLogging(t.id); setDraftMin(''); setDraftNote(''); }} style={{padding:'14px 10px',background:'transparent',border:`1px solid ${M.accent}55`,color:M.ink,cursor:'pointer',display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                  <span style={{fontSize:18,color:M.accent}}>{t.sym}</span>
                  <span style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:15}}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Storico */}
          {recent.length>0 && (
            <div style={{marginTop:28,paddingTop:18,borderTop:`1px solid ${M.accent}33`}}>
              <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:M.dim,textAlign:'center',textTransform:'uppercase',marginBottom:12}}>sessioni recenti</div>
              {recent.map(s=>{
                const type = MINDFUL_TYPES.find(t=>t.id===s.type) || { label:s.type, sym:'·' };
                return (
                  <button key={s.id} onClick={()=>{ if(confirmDelSess===s.id){ deleteSession(s.id); } else { setConfirmDelSess(s.id); } }} style={{width:'100%',display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:`1px solid ${M.accent}22`,background:confirmDelSess===s.id?`${M.accent}1A`:'transparent',border:'none',cursor:'pointer',textAlign:'left',color:M.ink}}>
                    <span style={{fontSize:18,color:M.accent,minWidth:24,marginTop:2}}>{type.sym}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:15,color:M.ink}}>{type.label} · {fmt(s.duration_min)} min{confirmDelSess===s.id?<span style={{color:'#A04848',marginLeft:8,fontSize:12}}>tocca ancora ✗</span>:null}</div>
                      <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.15em',color:M.dim,marginTop:2,textTransform:'uppercase'}}>{new Date(s.ts).toLocaleDateString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                      {s.note && <div style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:13,color:M.dim,marginTop:3,lineHeight:1.3}}>{s.note}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>)}
      </div>

      {/* Modal registra sessione */}
      {logging && (
        <SimpleModal onClose={()=>setLogging(null)} bg={M.cream} border={M.accent}>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.5em',color:M.accent,textTransform:'uppercase',marginBottom:4}}>nuova sessione</div>
            <div style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:22,color:M.ink}}>{MINDFUL_TYPES.find(t=>t.id===logging)?.label}</div>
          </div>
          <div style={{marginTop:18}}>
            <label style={{display:'block',fontFamily:fDmSans,fontSize:9,letterSpacing:'0.3em',color:M.dim,textTransform:'uppercase',marginBottom:6}}>durata (minuti)</label>
            <input autoFocus type="text" inputMode="decimal" value={draftMin} onChange={e=>setDraftMin(e.target.value)} placeholder="es. 15" style={{width:'100%',background:'transparent',border:`1px solid ${M.accent}55`,fontFamily:fCormorant,fontStyle:'italic',fontSize:22,color:M.ink,padding:'10px 14px',outline:'none',boxSizing:'border-box'}} />
          </div>
          <div style={{marginTop:14}}>
            <label style={{display:'block',fontFamily:fDmSans,fontSize:9,letterSpacing:'0.3em',color:M.dim,textTransform:'uppercase',marginBottom:6}}>nota (opzionale)</label>
            <textarea value={draftNote} onChange={e=>setDraftNote(e.target.value)} placeholder="come ti sei sentito…" rows={3} style={{width:'100%',background:'transparent',border:`1px solid ${M.accent}55`,fontFamily:fCormorant,fontStyle:'italic',fontSize:14,color:M.ink,padding:'10px 14px',outline:'none',boxSizing:'border-box',resize:'none'}} />
          </div>
          <div style={{display:'flex',gap:8,marginTop:18}}>
            <button onClick={()=>setLogging(null)} style={{flex:1,background:'transparent',color:M.dim,border:`1px solid ${M.dim}66`,fontFamily:fDmSans,fontSize:10,letterSpacing:'0.3em',padding:'12px',cursor:'pointer',textTransform:'uppercase'}}>annulla</button>
            <button onClick={saveSession} disabled={!draftMin} style={{flex:1,background:M.ink,color:M.cream,border:'none',fontFamily:fDmSans,fontSize:10,letterSpacing:'0.3em',padding:'12px',cursor:draftMin?'pointer':'default',opacity:draftMin?1:0.5,textTransform:'uppercase'}}>salva</button>
          </div>
        </SimpleModal>
      )}

      {/* Modal respirazione */}
      {breathingOpen && (
        <div onClick={()=>setBreathingOpen(false)} style={{position:'fixed',inset:0,background:`linear-gradient(180deg, ${M.cream} 0%, ${M.bg1} 100%)`,zIndex:210,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,cursor:'pointer'}}>
          <div onClick={e=>e.stopPropagation()} style={{textAlign:'center',cursor:'default'}}>
            <div style={{fontFamily:fDmSans,fontSize:10,letterSpacing:'0.5em',color:M.accent,textTransform:'uppercase',marginBottom:24}}>respirazione quadrata</div>
            <div style={{position:'relative',width:240,height:240,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{position:'absolute',inset:0,border:`1px solid ${M.accent}33`,borderRadius:'50%'}} />
              <div style={{width:'100%',height:'100%',borderRadius:'50%',background:`radial-gradient(circle, ${M.accent}66 0%, ${M.accent}22 70%, ${M.accent}00 100%)`,transform:`scale(${scale})`,transition:'transform 0.1s linear',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontFamily:fCormorant,fontStyle:'italic',fontSize:24,color:M.ink,letterSpacing:'0.05em'}}>{phaseLabel}</span>
              </div>
            </div>
            <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.3em',color:M.dim,marginTop:30,textTransform:'uppercase'}}>4 · 4 · 4 · 4 secondi</div>
            <button onClick={()=>setBreathingOpen(false)} style={{marginTop:24,background:'transparent',color:M.dim,border:`1px solid ${M.dim}66`,fontFamily:fDmSans,fontSize:10,letterSpacing:'0.4em',padding:'10px 22px',cursor:'pointer',textTransform:'uppercase'}}>chiudi</button>
          </div>
        </div>
      )}

      {/* Modal allenamenti (ex pagina Allena) */}
      {detailType && <TypeDetailModal type={detailType} workouts={workouts||[]} onClose={()=>setDetailTypeId(null)} updWorkouts={updWorkouts} onEditType={()=>{setDetailTypeId(null); setEditingType(detailType.id);}} />}
      {editingType && <TypeModal existing={editingT} onClose={()=>setEditingType(null)} onSave={saveType} onDelete={editingType!=='new'?delType:null} />}
    </div>
  );
}

function Header({ q, sub, color, dim, mark, font, subFont }){
  return (
    <div style={{textAlign:'center',marginBottom:8}}>
      <div style={{color,fontSize:22,marginBottom:4}}>❦</div>
      <h1 style={{fontFamily:font||fCinzel,fontWeight:500,fontSize:26,letterSpacing:'0.22em',color,margin:0}}>{q}</h1>
      <div style={{fontFamily:subFont||fGaramond,fontStyle:'italic',fontSize:13,letterSpacing:'0.25em',color:dim,marginTop:6}}>{sub}</div>
      <Ornament color={color} mark={mark} />
    </div>
  );
}
function Ornament({ color, mark }){
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,maxWidth:180,margin:'14px auto 0'}}>
      <div style={{flex:1,height:1,background:color,opacity:0.4}}></div>
      <span style={{color,fontSize:10}}>{mark}</span>
      <div style={{flex:1,height:1,background:color,opacity:0.4}}></div>
    </div>
  );
}
function Loading({ color }){ return <div style={{textAlign:'center',marginTop:60,fontStyle:'italic',fontSize:14,color}}>⋯</div>; }
function Stat({ label, value, color, dim, onTap }){
  return (
    <div onClick={onTap} style={{textAlign:'center',cursor:onTap?'pointer':'default'}}>
      <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:20,color,lineHeight:1}}>{value}</div>
      <div style={{fontFamily:fCinzel,fontSize:9,letterSpacing:'0.3em',color:dim,textTransform:'uppercase',marginTop:6}}>{label}</div>
    </div>
  );
}
function Totale({ label, value, unit, dark, sage, font, big }){
  return (
    <div style={{textAlign:'center'}}>
      <div style={{fontFamily:big,fontStyle:'italic',fontSize:22,color:dark,lineHeight:1}}>{value}{unit && <span style={{fontSize:11,color:sage,marginLeft:2,fontStyle:'normal',fontFamily:font,letterSpacing:'0.15em'}}>{unit}</span>}</div>
      <div style={{fontFamily:font,fontSize:9,letterSpacing:'0.3em',color:sage,textTransform:'uppercase',marginTop:4}}>{label}</div>
    </div>
  );
}
function Row({ label, value, unit, details, theme }){
  const T = theme || N;
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,padding:'10px 0',borderBottom:`1px solid ${T.gold}1F`}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:13,color:T.dim||T.goldDim}}>{label}</div>
        {details && <div style={{fontFamily:fFraunces,fontSize:11,color:T.dim||T.goldDim,opacity:0.75,marginTop:3,lineHeight:1.4}}>{details}</div>}
      </div>
      <span style={{fontFamily:fFraunces,fontWeight:400,fontSize:20,color:T.gold,whiteSpace:'nowrap'}}>{value}{unit && <span style={{fontSize:11,color:T.dim||T.goldDim,marginLeft:4,fontWeight:300}}>{unit}</span>}</span>
    </div>
  );
}
function FieldLabel({ children, light }){ return <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:light?S.dim:'#888',textTransform:'uppercase',marginBottom:4}}>{children}</div>; }
function fieldInput(theme){ return { width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${(theme.ink||theme.dark)}66`,fontFamily:fGaramond,fontStyle:'italic',fontSize:18,color:theme.ink||theme.dark,padding:'6px 0 4px',outline:'none' }; }
function fieldInputDark(theme){ return { width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${theme.gold}66`,fontFamily:fFraunces,fontStyle:'italic',fontSize:18,color:theme.pale,padding:'6px 0 4px',outline:'none' }; }
function btnSolid(bg, fg){ return { marginTop:22,background:bg,color:fg,border:`1px solid ${bg}`,fontFamily:fCinzel,fontSize:10,letterSpacing:'0.4em',padding:'14px 32px',cursor:'pointer',borderRadius:0 }; }
function btnOutline(c, font){ return { background:'transparent',color:c,border:`1px solid ${c}`,fontFamily:font||fMarcellus,fontSize:11,letterSpacing:'0.4em',padding:'12px 28px',cursor:'pointer',borderRadius:0 }; }
function btnOutlineThin(c){ return { background:'transparent',color:c,border:`1px solid ${c}66`,fontFamily:fCormorant,fontStyle:'italic',fontSize:14,padding:'8px 18px',cursor:'pointer',borderRadius:0 }; }
function btnOutlineMini(c, font){ return { background:'transparent',color:c,border:`1px solid ${c}66`,fontFamily:font||fDmSans,fontSize:10,letterSpacing:'0.3em',padding:'10px 16px',cursor:'pointer',borderRadius:0,textTransform:'uppercase' }; }

function DayStrip({ selectedKey, onSelect, ink, tan, count, fontA, fontB }){
  const days = []; const today = new Date();
  for(let i=count-1;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); days.push(d); }
  return (
    <div style={{display:'flex',gap:4,overflowX:'auto',padding:'10px 0',marginTop:8}}>
      {days.map(d=>{
        const k = dayKey(d);
        const selected = k===selectedKey;
        const isToday = k===dayKey(new Date());
        return (
          <button key={k} onClick={()=>onSelect(k)} style={{flexShrink:0,minWidth:44,padding:'6px 8px',textAlign:'center',background:selected?ink:'transparent',color:selected?(ink===W.ink?W.bg:'#fff'):ink,border:`1px solid ${selected?ink:ink+'33'}`,cursor:'pointer',borderRadius:0}}>
            <div style={{fontFamily:fontB,fontStyle:'italic',fontSize:10,letterSpacing:'0.05em',opacity:selected?0.8:0.6}}>{d.toLocaleDateString('it-IT',{weekday:'short'})}</div>
            <div style={{fontFamily:fontA,fontSize:16,marginTop:1}}>{d.getDate()}</div>
            {isToday && !selected && <div style={{width:4,height:4,borderRadius:'50%',background:tan,margin:'2px auto 0'}} />}
          </button>
        );
      })}
    </div>
  );
}

function SimpleModal({ children, onClose, bg, border, wide }){
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:bg,border:`1px solid ${border}33`,maxWidth:wide?400:340,width:'100%',padding:'24px 22px',position:'relative',borderRadius:4,maxHeight:'88vh',overflowY:'auto'}}>{children}</div>
    </div>
  );
}

function ModalQ({ children, onClose, title, subtitle, Q }){
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(10,6,2,0.78)',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:`linear-gradient(180deg, ${Q.bg1} 0%, ${Q.bg2} 100%)`,border:`1px solid ${Q.gold}55`,maxWidth:380,width:'100%',padding:'28px 24px',position:'relative',borderRadius:4,maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{position:'absolute',inset:8,border:`1px solid ${Q.gold}22`,pointerEvents:'none',borderRadius:2}} />
        <div style={{position:'relative'}}>
          <div style={{color:Q.gold,fontSize:22,textAlign:'center',marginBottom:4}}>❦</div>
          <h2 style={{fontFamily:fCinzel,fontSize:14,letterSpacing:'0.3em',color:Q.gold,textAlign:'center',margin:0,fontWeight:500}}>{title}</h2>
          <div style={{fontFamily:fGaramond,fontStyle:'italic',fontSize:13,color:Q.goldDim,textAlign:'center',marginTop:6}}>{subtitle}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

function InputBig({ value, onChange, onEnter, placeholder, unit, Q }){
  return (
    <div style={{marginTop:24,textAlign:'center'}}>
      <input type="text" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onEnter();}} autoFocus placeholder={placeholder} style={{width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${Q.gold}66`,color:Q.cream,fontFamily:fGaramond,fontStyle:'italic',fontSize:54,textAlign:'center',padding:'4px 0 8px',outline:'none'}} />
      <div style={{fontFamily:fCinzel,fontSize:10,letterSpacing:'0.4em',color:Q.goldDim,marginTop:4}}>{unit}</div>
    </div>
  );
}

function EditButtons({ onCancel, onSave, onDelete, Q }){
  return (
    <div style={{display:'flex',gap:10,marginTop:32,justifyContent:'space-between',alignItems:'center'}}>
      {onDelete ? <button onClick={onDelete} style={{background:'transparent',color:'#C99A7A',border:`1px solid #C99A7A66`,fontFamily:fCinzel,fontSize:10,letterSpacing:'0.3em',padding:'12px 16px',cursor:'pointer',borderRadius:0}}>ELIMINA</button> : <span />}
      <div style={{display:'flex',gap:10}}>
        <button onClick={onCancel} style={{background:'transparent',color:Q.goldDim,border:`1px solid ${Q.goldDim}66`,fontFamily:fCinzel,fontSize:10,letterSpacing:'0.35em',padding:'12px 18px',cursor:'pointer',borderRadius:0}}>ANNULLA</button>
        <button onClick={onSave} style={{background:Q.gold,color:Q.ink,border:`1px solid ${Q.gold}`,fontFamily:fCinzel,fontSize:10,letterSpacing:'0.35em',padding:'12px 24px',cursor:'pointer',borderRadius:0}}>SALVA</button>
      </div>
    </div>
  );
}
