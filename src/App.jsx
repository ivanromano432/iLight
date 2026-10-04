import { useState, useEffect, useMemo, useRef, lazy } from 'react';
import { Home, Scale, Salad, ClipboardList, Hourglass, Pill, Activity, Moon, NotebookPen, MessageCircle, ListChecks, Camera, Utensils, ChartColumn, Send, Check, Image as ImageIcon, FolderOpen, Mic, ImagePlus } from 'lucide-react';
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
const MemoriaPage = lazy(() => import('./MemoriaPage.jsx'));
const CollegamentiPage = lazy(() => import('./CollegamentiPage.jsx'));
const ProfilePage = lazy(() => import('./ProfilePage.jsx'));
// Onboarding componente lazy; le helper sincrone arrivano da un file dedicato (vedi onboardingHelpers.js)
const Onboarding = lazy(() => import('./Onboarding.jsx'));
import { hasSeenOnboarding, markOnboardingSeen } from './onboardingHelpers.js';
import { uploadMealPhoto as uploadMealPhotoToStorage, deleteMealPhoto as deleteMealPhotoFromStorage } from './photoStorage.js';
import { getTheme } from './themes.js';
import ThemeStyles from './ThemeStyles.jsx';
import { supabase } from './supabase.js';
import { aiFetch } from './ai.js';
import { whoopCall, loadWhoopDaily, mergeWhoop } from './whoop.js';
import { COACH_TOOLS, buildMealRefs, planActions } from './coachActions.js';
import { loadMemory, addMemory, memoryToText, extractMemoryTags, MEMORY_MAX } from './coachMemory.js';

const Q = { bg1: '#3A2818', bg2: '#1F140C', gold: '#C9A876', goldDim: '#8B7355', cream: '#E8D8B8', ink: '#1F140C' };
const W = { bg: '#E8E0D2', ink: '#3C3329', tan: '#8C6A4E' };
const J = { bg: '#E5E3D5', dark: '#2D3A2E', sage: '#5C6B4E', light: '#8FA288' };
const A = { bg1: '#142A4C', bg2: '#0E2240', ink: '#F4EFE2', sage: '#C9A55A' };
const T = { bg: '#F2EBDC', ink: '#1F1A12', dim: '#6B5D45' };
const S = { bg1: '#142A4C', bg2: '#0E2240', silver: '#B4BFCC', pale: '#F4EFE2', gold: '#C9A55A', dim: '#B4BFCC' };
const N = { bg1: '#2C3340', bg2: '#14171F', cream: '#F2E8D0', dim: '#8A8270', gold: '#C9A876', body: '#DDD3C2' };
const NAV = { bg: '#1A1108', border: '#3A2818', dim: '#6B5D45', gold: '#C9A876', cream: '#E8D8B8' };
const M = { bg1: '#EAE6D2', bg2: '#D8D4C0', ink: '#3A4339', accent: '#7A8E78', dim: '#9CA194', cream: '#F4F1E5' };
const D = { bg1: '#1F2228', bg2: '#0E1115', cream: '#E8E4D5', accent: '#C9A876', amber: '#D4A23E', dim: '#6B6478', active: '#A8826E', danger: '#C99A7A' };
const SUPP_COLORS = ['#4A5C4D','#A0524C','#C9A876','#5C6B7E','#8B5E83','#7A8C5E','#A8826E','#6B4A3D'];
// Palette integratori dashboard: armonizzata coi colori GoalFit (turchese+lime come ancore),
// estesa con tinte coordinate ma nettamente distinte. Vivaci ma non neon, buone su bianco.
const SUPP_COLORS_DASH = ['#3F95A1','#9CC756','#2EC4B6','#4C8DD6','#E0A33E','#6CC24A','#8E6FD6','#E0746A'];

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
    const res = await aiFetch({ model:"claude-sonnet-4-6", max_tokens:2500, system:"Sei un nutrizionista italiano creativo. Rispondi SEMPRE e SOLO con JSON valido. Proponi sempre pasti vari e diversi tra richieste.", messages:[{role:"user",content:prompt}] }, 'altro');
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
    const res = await aiFetch({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: 'Sei un nutrizionista italiano. Rispondi SEMPRE e SOLO con JSON valido. Niente testo extra.',
        messages: [{ role: 'user', content }],
      }, 'foto');
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

// Analizza i dati dell'utente e ritorna un piano d'azione strutturato per il dimagrimento.
// Input: summary testuale generato da buildWeightLossSummary().
// Output: { stato, focus, azioni[], attenzione } oppure { error }.
async function analyzeWeightLoss(summary) {
  const prompt = `Sei un coach italiano esperto di dimagrimento sano, alimentazione (Dieta a Zona 40/30/30), sonno e movimento. Analizza il riepilogo dei dati dell'utente qui sotto e proponi una valutazione concreta + un piano di azioni semplici e fattibili in italiano.

RIEPILOGO DATI:
${summary}

Devi rispondere SOLO con un JSON valido in questa forma esatta (niente testo prima o dopo, niente Markdown, niente backtick):
{
  "stato": "<frase di 1-2 righe sulla valutazione generale del momento: il peso sta calando/stabile/sale, cosa funziona, cosa no — tono empatico ma onesto, max 200 caratteri>",
  "focus": "<l'UNICA priorità su cui concentrarsi nei prossimi 7 giorni, frase breve di max 100 caratteri>",
  "azioni": ["<azione concreta 1>", "<azione concreta 2>", "<azione concreta 3>"],
  "attenzione": "<eventuale warning se vedi qualcosa di rischioso (es. calorie troppo basse, sonno cronicamente <6h, nessuna attività). Stringa vuota se tutto ok>"
}

LINEE GUIDA per le azioni:
- Sempre 3 azioni, mai più mai meno.
- Concrete e misurabili (es. "Bere 2 bicchieri d'acqua in più al giorno", "Camminata 30 min 4 volte a settimana"), NON generiche (es. "Mangia meglio").
- Basate sui dati reali del riepilogo: se l'utente mangia poche proteine, suggerisci di aumentarle; se dorme poco, suggerisci di anticipare l'ora di andare a letto.
- Per la Dieta a Zona target è 30% proteine, 40% carboidrati, 30% grassi.
- Tono caldo, motivante, mai giudicante.

ATTENZIONE: se i dati sono scarsi (es. meno di 3 giorni con dati), nello "stato" segnala che servono più dati per un'analisi affidabile, ma proponi comunque 3 azioni di partenza utili.`;

  try {
    const res = await aiFetch({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: 'Sei un coach nutrizionale italiano. Rispondi SEMPRE e SOLO con JSON valido, niente testo prima o dopo.',
        messages: [{ role: 'user', content: prompt }],
      }, 'altro');
    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = j?.error?.message || (typeof j?.error === 'string' ? j.error : null) || j?.message || JSON.stringify(j);
      } catch (_) { detail = await res.text().catch(() => ''); }
      throw new Error('HTTP ' + res.status + ' ' + (detail || 'unknown'));
    }
    const data = await res.json();
    const txt = data.content?.find(c => c.type === 'text')?.text || '';
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('Risposta IA non valida (JSON mancante)');
    const p = JSON.parse(txt.slice(a, b + 1));
    return {
      stato: typeof p.stato === 'string' ? p.stato : '',
      focus: typeof p.focus === 'string' ? p.focus : '',
      azioni: Array.isArray(p.azioni) ? p.azioni.map(x => String(x)).filter(Boolean) : [],
      attenzione: typeof p.attenzione === 'string' && p.attenzione.trim() ? p.attenzione : null,
    };
  } catch (e) {
    return { error: e.message || 'Errore sconosciuto' };
  }
}

const PAGES = [
  { id:'peso', label:'peso', roman:'I', Icon:Scale },
  { id:'pasti', label:'pasti', roman:'II', Icon:Salad },
  { id:'menu', label:'menù', roman:'III', Icon:ClipboardList },
  { id:'digiuno', label:'digiuno', roman:'IV', Icon:Hourglass },
  { id:'integra', label:'rituale', roman:'V', Icon:Pill },
  { id:'respiro', label:'corpo', roman:'VI', Icon:Activity },
  { id:'sonno', label:'sonno', roman:'VII', Icon:Moon },
  { id:'sera', label:'diario', roman:'VIII', Icon:NotebookPen },
  { id:'coach', label:'coach', roman:'', Icon:MessageCircle },
  { id:'aggiorna', label:'aggiorna', roman:'', Icon:ListChecks },
  { id:'foto', label:'foto', roman:'', Icon:Camera },
  { id:'stats', label:'statistiche', roman:'', Icon:ChartColumn },
  { id:'allena', label:'allenamenti', roman:'', Icon:Activity },
];
// Barra in basso: solo 5 voci. 'stats' apre la pagina Statistiche; tutte le altre pagine stanno nel menu del profilo.
const NAV_ITEMS = [
  { id:'coach', label:'coach', Icon:MessageCircle },
  { id:'aggiorna', label:'aggiorna', Icon:ListChecks },
  { id:'foto', label:'foto', Icon:Camera, center:true },
  { id:'pasti', label:'pasti', Icon:Utensils },
  { id:'stats', label:'statistiche', Icon:ChartColumn },
];
const MENU_PAGE_IDS = ['peso','menu','digiuno','integra','allena','respiro','sonno','sera'];
const MENU_PAGE_LABELS = { oggi:'Home', peso:'Peso', menu:'Menù', digiuno:'Digiuno', integra:'Integrazione', allena:'Allenamenti', respiro:'Respiro', sonno:'Sonno', sera:'Diario' };
const DEF_TYPES = [
  { id:'corsa', name:'Corsa', unit:'km' },
  { id:'camminata', name:'Camminata', unit:'km' },
  { id:'pesi', name:'Pesi', unit:'min' },
  { id:'yoga', name:'Yoga', unit:'min' },
];
const UNITS = ['km','min','kg','reps','m'];
// Tipo di pasto dedotto dall'ora in cui viene registrato
function mealTypeFromHour(d){
  const h = (d || new Date()).getHours();
  if (h >= 5 && h < 10) return 'colazione';
  if (h >= 10 && h < 12) return 'spuntino_m';
  if (h >= 12 && h < 15) return 'pranzo';
  if (h >= 15 && h < 18) return 'merenda';
  if (h >= 18 && h < 22) return 'cena';
  return 'spuntino_s';
}
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
  const [pageIdx, setPageIdx] = useState(() => Math.max(0, PAGES.findIndex(p => p.id === 'coach')));
  const [photoSeed, setPhotoSeed] = useState(null);
  // Foto del pasto scattata dalla barra: si analizza e si registra restando sulla pagina in cui si è
  const [shot, setShot] = useState(null); // { state:'busy'|'ok'|'err', text, photo }
  const mealsLive = useRef([]);
  // Scroll automatico in cima quando si cambia tab della nav
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { try { window.scrollTo(0, 0); } catch (__) {} }
  }, [pageIdx]);
  const [showStats, setShowStats] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [showGuida, setShowGuida] = useState(false);
  const [showMemoria, setShowMemoria] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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
    // Dopo l'onboarding, mostro ProfileSetup SOLO se non è mai stato completato.
    // I dati mancanti (sex/height_cm/birth_year) si compilano liberamente dal Profilo,
    // non vogliamo forzare gli utenti esistenti a rifare il questionario.
    const isOnboardedServer = !!profile?.onboarded;
    const isOnboardedLocal = hasSeenOnboarding(user.id);
    const setupDone = !!profile?.setup_completed;
    if (!isOnboardedServer && !isOnboardedLocal) {
      setShowOnboarding(true);
    } else {
      if (isOnboardedServer && !isOnboardedLocal) {
        try { markOnboardingSeen(user.id); } catch (_) {}
      }
      if (!setupDone) {
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

  mealsLive.current = meals;
  // WHOOP: stato del collegamento, dati del giorno per il coach, aggiornamento automatico all'apertura
  const [whoop, setWhoop] = useState(null);
  const [whoopDaily, setWhoopDaily] = useState([]);
  const [linksMsg, setLinksMsg] = useState('');
  const liveData = useRef({});
  liveData.current = { sleeps, workouts, workoutTypes };
  const syncWhoop = async () => {
    const r = await whoopCall('sync');
    if (r.error) { if (r.reconnect) setWhoop(w => ({ ...(w || {}), connected: false })); return r.error; }
    const m = mergeWhoop(r, liveData.current, newId);
    if (m.workoutTypes) await updWorkoutTypes(m.workoutTypes);
    if (m.workouts) await updWorkouts(m.workouts);
    if (m.sleeps) await updSleeps(m.sleeps);
    setWhoop(w => ({ ...(w || {}), connected: true, last_sync_at: r.last_sync_at }));
    setWhoopDaily(await loadWhoopDaily());
    return (m.nights || m.sessions) ? `Aggiunte ${m.nights} ${m.nights === 1 ? 'notte' : 'notti'} e ${m.sessions} ${m.sessions === 1 ? 'allenamento' : 'allenamenti'}.` : 'Tutto aggiornato: niente di nuovo da aggiungere.';
  };
  const whoopBoot = useRef(false);
  useEffect(() => {
    if (!loaded || !user?.id || whoopBoot.current) return;
    whoopBoot.current = true;
    (async () => {
      let ret = null;
      try { const q = new URLSearchParams(window.location.search); ret = q.get('whoop'); if (ret) { q.delete('whoop'); window.history.replaceState({}, '', window.location.pathname + (q.toString() ? '?' + q : '')); } } catch (_) {}
      const st = await whoopCall('status');
      if (st.error) return;
      setWhoop(st);
      if (ret) {
        setShowLinks(true);
        if (ret !== 'ok') { setLinksMsg(ret === 'annullato' ? 'Collegamento annullato.' : 'Non sono riuscito a collegare WHOOP. Riprova.'); return; }
        setLinksMsg('WHOOP collegato. Porto dentro le ultime tre settimane…');
        setLinksMsg('WHOOP collegato. ' + await syncWhoop());
        return;
      }
      if (!st.connected) return;
      setWhoopDaily(await loadWhoopDaily());
      if (!st.last_sync_at || Date.now() - new Date(st.last_sync_at).getTime() > 3 * 3600000) { try { await syncWhoop(); } catch (e) { console.error('[whoop] sync', e); } }
    })();
    // eslint-disable-next-line
  }, [loaded, user?.id]);
  // Il punto della settimana: una volta ogni 7 giorni il coach scrive di sua iniziativa nella chat
  const [coachUnread, setCoachUnread] = useState(() => { try { return localStorage.getItem('goalfit_coach_unread') === '1'; } catch (_) { return false; } });
  const markCoach = (v) => { setCoachUnread(v); try { if (v) localStorage.setItem('goalfit_coach_unread', '1'); else localStorage.removeItem('goalfit_coach_unread'); } catch (_) {} };
  const checkinDone = useRef(false);
  const [coachRefresh, setCoachRefresh] = useState(0);
  const pageNow = useRef('coach');
  useEffect(() => {
    if (!loaded || !user?.id || !profile || checkinDone.current) return;
    if (profile.coach_checkin === false) return;
    const last = profile.coach_checkin_at ? new Date(profile.coach_checkin_at).getTime() : 0;
    if (Date.now() - last < 7 * 86400000) return;
    const active = profile.subscription_status === 'active' || profile.is_lifetime_free || !profile.trial_ends_at || new Date(profile.trial_ends_at) >= new Date();
    if (!active) return;
    const wk = Date.now() - 7 * 86400000;
    const mealDays = new Set((meals || []).filter(m => m.status !== 'planned' && new Date(m.ts).getTime() >= wk).map(m => dayKey(new Date(m.ts)))).size;
    const wCount = (weights || []).filter(w => new Date(w.ts).getTime() >= wk).length;
    if (mealDays < 3 && wCount < 2) return; // troppo pochi dati per dire qualcosa di utile
    checkinDone.current = true;
    (async () => {
      try {
        await updProfile({ coach_checkin_at: new Date().toISOString() });
        const mem = memoryToText(await loadMemory());
        const system = 'Sei il coach di GoalFit, un\'app italiana per il controllo del peso. Parli in italiano, in modo diretto, caldo e concreto. Non fai diagnosi e non sostituisci medico o nutrizionista.\n\n'
          + 'DATI DELL\'UTENTE (ultimi 30 giorni):\n' + buildCoachContext({ profile, weights, goal, meals, water: waterByDay, waterGoal, workouts, workoutTypes, sleeps, fasts, supps: supplements, taken: suppTaken, notes: foodNotes, mindful: mindfulSessions, whoopDaily })
          + '\n\nMEMORIA (cose stabili sull\'utente, da rispettare):\n' + (mem || '(vuota)');
        const res = await aiFetch({ model: 'claude-sonnet-4-6', max_tokens: 500, system, messages: [{ role: 'user', content: 'Scrivimi di tua iniziativa il punto della settimana appena passata, guardando solo i dati degli ultimi 7 giorni. Massimo 5 frasi, senza elenchi e senza titolo: una cosa che è andata bene (con il numero), una cosa che hai notato e che forse non ho visto, e una sola proposta concreta per i prossimi giorni. Chiudi con una domanda breve.' }] }, 'coach');
        if (!res.ok) return;
        const data = await res.json();
        const txt = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
        if (!txt) return;
        const { error } = await supabase.from('coach_messages').insert({ id: newId(), user_id: user.id, role: 'assistant', content: 'Il punto della settimana\n\n' + txt, ts: new Date().toISOString() });
        if (!error) { if (pageNow.current === 'coach') setCoachRefresh(n => n + 1); else markCoach(true); }
      } catch (e) { console.error('[coach] punto della settimana', e); }
    })();
    // eslint-disable-next-line
  }, [loaded, user?.id, profile?.coach_checkin_at, profile?.coach_checkin]);
  const shootMeal = async (file) => {
    if (shot?.state === 'busy') return;
    let b64 = null;
    try { b64 = await resizeImage(file, 480, 0.7); } catch (_) {}
    if (!b64) { setShot({ state:'err', text:'Non sono riuscito a leggere la foto. Riprova.' }); setTimeout(() => setShot(null), 5000); return; }
    setShot({ state:'busy', text:'analizzo la foto e registro il pasto…', photo:b64 });
    let done = { state:'err', text:'Qualcosa non ha funzionato: la foto non è stata salvata. Riprova.', photo:b64 };
    try {
      const now = new Date();
      const type = mealTypeFromHour(now);
      const r = await estimateMealNutrition({ description:'', qty_g:null, photo:b64 });
      const ok = r && !r.error;
      const mealId = newId();
      const meal = { id:mealId, ts:now.toISOString(), status:'eaten', type,
        description: ok ? (r.name || '') : '', qty_g: ok ? (r.qty_g ?? null) : null, kcal: ok ? (r.kcal ?? null) : null,
        p: ok ? (r.p ?? null) : null, c: ok ? (r.c ?? null) : null, g: ok ? (r.g ?? null) : null, photo:b64, photo_url:null };
      if (user?.id) {
        try { meal.photo_url = await uploadMealPhotoToStorage(user.id, mealId, b64); meal.photo = null; }
        catch (err) { console.warn('[shootMeal] upload Storage fallito, fallback base64', err); }
      }
      await updMeals([...mealsLive.current, meal]);
      const tName = MEAL_TYPES.find(t => t.id === type)?.name || 'Pasto';
      done = ok
        ? { state:'ok', text:`✓ ${tName} registrato: ${r.name || 'piatto'}${r.kcal != null ? ' · ' + Math.round(r.kcal) + ' kcal' : ''}`, photo:b64 }
        : { state:'err', text:`Foto salvata come ${tName.toLowerCase()}, ma non sono riuscito ad analizzarla${typeof r?.error === 'string' && r.error.includes('limite di oggi') ? ' perché hai raggiunto il limite di analisi di oggi' : ''}. Completala da Pasti.`, photo:b64 };
    } catch (e) { console.error('[shootMeal]', e); }
    setShot(done);
    setTimeout(() => setShot(cur => cur === done ? null : cur), done.state === 'ok' ? 4500 : 8000);
  };

  const page = PAGES[pageIdx].id;
  pageNow.current = page;
  useEffect(() => { if (page === 'coach' && coachUnread) markCoach(false); }, [page, coachUnread]);
  // Navigazione per id: chiude le pagine a tutto schermo e apre la pagina richiesta ('stats' = Statistiche)
  const goPage = (id) => {
    setShowAccountMenu(false); setShowSub(false); setShowGuida(false); setShowMemoria(false); setShowLinks(false); setShowProfile(false);
    setShowStats(false);
    const idx = PAGES.findIndex(p => p.id === id);
    if (idx >= 0) setPageIdx(idx);
  };

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
          // Dopo l'onboarding, mostra il setup solo se non è mai stato completato
          if (!profile?.setup_completed) setShowProfileSetup(true);
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

  if (showLinks) {
    return <CollegamentiPage whoop={whoop} initialMsg={linksMsg} onClose={() => { setShowLinks(false); setLinksMsg(''); }}
      onConnect={async () => { const r = await whoopCall('start'); if (r.url) { window.location.href = r.url; return ''; } return r.error || 'Non sono riuscito ad aprire WHOOP.'; }}
      onSync={() => syncWhoop()}
      onDisconnect={async () => { await whoopCall('disconnect'); setWhoop(w => ({ ...(w || {}), connected: false, last_sync_at: null })); setWhoopDaily([]); return 'WHOOP scollegato. Notti e allenamenti già importati restano nell’app.'; }} />;
  }

  if (showMemoria) {
    return <MemoriaPage profile={profile} updProfile={updProfile} onClose={() => setShowMemoria(false)} />;
  }

  if (showGuida) {
    return <GuidaPage profile={profile} onClose={() => setShowGuida(false)} />;
  }

  if (showProfile) {
    return <ProfilePage user={user} profile={profile} updProfile={updProfile} onClose={() => setShowProfile(false)} />;
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
  const renderAccountMenu = () => {
    // Il menu eredita la palette del tema attivo, così su Cruscotto è bianco/turchese,
    // su Foglio Bianco è bianco/serif, sui temi scuri (Refettorio, Notte blu...) si scurisce di conseguenza.
    const Q = getTheme(profile?.theme);
    const isDashboard = Q.structuralVariant === 'dashboard';
    const fontFamily = Q.fontText || "'Cardo', serif";
    const labelStyle = isDashboard ? 'normal' : 'italic';
    const surface    = Q.bg1 || '#E8E0D2';
    const ink        = Q.ink || Q.cream || '#3C3329';
    const accent     = Q.gold || '#8C6A4E';
    const accentSoft = Q.goldDim || Q.dim || accent;
    const radius     = isDashboard ? 14 : 0;
    const btnRadius  = isDashboard ? 10 : 0;
    const btnBorder  = isDashboard ? `1px solid ${accent}40` : `1px solid ${ink}40`;
    const btnFontWeight = isDashboard ? 600 : 400;
    // Pulsante esci: pill turchese su dashboard, "ink-block" su tipografici
    const exitBg     = isDashboard ? accent : ink;
    const exitColor  = isDashboard ? '#FFFFFF' : surface;
    // CTA primario abbonamento: lime su dashboard, gold su tipografici
    const ctaBg      = isDashboard ? (Q.amber || '#9CC756') : '#C9A876';
    const ctaColor   = isDashboard ? '#2A3942' : '#1F140C';
    // Colore badge stato abbonamento derivato dal tone, agganciato alla palette del tema
    // (semaforico su Cruscotto, fallback ai toni caldi sui temi classici).
    const badgeColor = {
      active:   Q.okColor   || '#6B8E5C',
      trial:    Q.infoColor || Q.gold || '#8C6A4E',
      lifetime: Q.infoColor || Q.gold || '#8C6A4E',
      neutral:  Q.dim || Q.goldDim || '#8C6A4E',
      past_due: Q.warnColor || '#C99A7A',
      expired:  Q.badColor  || '#C99A7A',
    }[subState.tone] || (Q.gold || '#8C6A4E');
    return (
      <>
        <div style={{ position: 'fixed', top: 'calc(18px + env(safe-area-inset-top, 0px))', right: 16, zIndex: 9000 }}>
          <button onClick={() => setShowAccountMenu(!showAccountMenu)} aria-label="account"
            style={{ width: 44, height: 44, borderRadius: '50%', background: avatarSrc ? 'transparent' : `${surface}D9`, border: `1px solid ${accent}40`, color: ink, fontFamily, fontSize: 16, fontStyle: labelStyle, fontWeight: isDashboard ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 0 }}>
            {avatarSrc ? <img src={avatarSrc} alt="profilo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : accountInitial}
          </button>
          {showAccountMenu && (
            <div style={{ position: 'absolute', top: 54, right: 0, width: 'min(300px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', boxSizing: 'border-box', background: '#142A4C', border: '1px solid #34506F', borderRadius: 24, padding: '18px 16px 12px', fontFamily: fDmSans, color: ink, boxShadow: '0 12px 32px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '0 4px' }}>
                <div style={{ fontFamily: fGaramond, fontSize: 26, fontWeight: 500, lineHeight: 1.1, wordBreak: 'break-word' }}>{displayName || accountEmail}</div>
                <div style={{ fontSize: 12, color: badgeColor, marginTop: 4 }}>{subState.label}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {MENU_PAGE_IDS.map(id => { const on = !showStats && page === id; return (
                  <button key={id} onClick={() => goPage(id)}
                    style={{ minHeight: 52, padding: '0 14px', borderRadius: 14, background: '#0E2240', border: `1px solid ${on ? accent : '#34506F'}`, color: on ? accent : ink, fontFamily: fDmSans, fontSize: 15, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>
                    {MENU_PAGE_LABELS[id]}
                  </button>
                ); })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  ['Profilo', () => { setShowAccountMenu(false); setShowProfile(true); }],
                  ['Memoria del coach', () => { setShowAccountMenu(false); setShowMemoria(true); }],
                  ['Collegamenti', () => { setShowAccountMenu(false); setShowLinks(true); }],
                  ['Guida', () => { setShowAccountMenu(false); setShowGuida(true); }],
                  ['Abbonamento', () => { setShowAccountMenu(false); setShowSub(true); }, subState.ctaPrimary],
                  ['__versione__'],
                  ['Esci', () => { setShowAccountMenu(false); onLogout && onLogout(); }],
                ].map(([label, fn, strong], i, arr) => label === '__versione__' ? (
                  <div key={i} style={{ minHeight: 40, padding: '0 6px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #34506F', color: ink, opacity: 0.7, fontFamily: fDmSans, fontSize: 13 }}>
                    {__APP_VERSION__ ? `versione ${__APP_VERSION__} · ${__APP_BUILT__}` : `versione del ${__APP_BUILT__}`}
                  </div>
                ) : (
                  <button key={i} onClick={fn}
                    style={{ minHeight: 46, padding: '0 6px', background: 'transparent', border: 'none', borderBottom: i < arr.length - 1 ? '1px solid #34506F' : 'none', color: strong ? accent : ink, fontFamily: fDmSans, fontSize: 15, fontWeight: strong ? 700 : 400, textAlign: 'left', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {showAccountMenu && <div onClick={() => setShowAccountMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 8999, background: 'rgba(4,12,28,0.6)' }} />}
      </>
    );
  };

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
        <div style={{paddingBottom:'calc(96px + env(safe-area-inset-bottom, 0px))'}}>
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
        </div>
        <BottomNav theme={getTheme(profile?.theme)} currentId="stats" onGo={goPage} />
        {renderAccountMenu()}
      </>
    );
  }
  return (
    <div style={{minHeight:'100vh', background:getTheme(profile?.theme).bg2, position:'relative'}}>
      <div style={{paddingBottom:'calc(96px + env(safe-area-inset-bottom, 0px))'}}>
        {(() => { const __theme = getTheme(profile?.theme); return (<>
        <ThemeStyles theme={__theme} />
        {page==='peso' && <PesoPage theme={__theme} loaded={loaded} weights={weights} goal={goal} updWeights={updWeights} updGoal={updGoal} meals={meals} updMeals={updMeals} openStats={() => setShowStats(true)} profile={profile} openSub={() => setShowSub(true)} />}
        {page==='stats' && <StatsPage theme={__theme} loaded={loaded} weights={weights} goal={goal} meals={meals} profile={profile} openFull={() => { setShowStats(true); try { window.scrollTo(0, 0); } catch (_) {} }} />}
        {page==='coach' && <CoachPage refreshKey={coachRefresh} whoopDaily={whoopDaily} user={user} theme={__theme} loaded={loaded} profile={profile} weights={weights} goal={goal} meals={meals} water={waterByDay} waterGoal={waterGoal} workouts={workouts} workoutTypes={workoutTypes} sleeps={sleeps} fasts={fasts} supps={supplements} taken={suppTaken} notes={foodNotes} mindful={mindfulSessions} updMeals={updMeals} updSleeps={updSleeps} updWeights={updWeights} updGoal={updGoal} updWater={updWater} updWorkouts={updWorkouts} updWorkoutTypes={updWorkoutTypes} updFasts={updFasts} updProfile={updProfile} updSupps={updSupps} updTaken={updTaken} updNotes={updFoodNotes} />}
        {page==='aggiorna' && <AggiornaPage theme={__theme} loaded={loaded} weights={weights} updWeights={updWeights} supps={supplements} taken={suppTaken} updTaken={updTaken} water={waterByDay} waterGoal={waterGoal} updWater={updWater} workouts={workouts} fasts={fasts} sleeps={sleeps} meals={meals} go={goPage} />}
        {page==='foto' && <FotoPage theme={__theme} loaded={loaded} meals={meals} />}
        {page==='pasti' && <PastiPage profile={profile} seedPhotoInit={photoSeed} clearSeedPhoto={() => setPhotoSeed(null)} user={user} theme={__theme} loaded={loaded} meals={meals} updMeals={updMeals} notes={foodNotes} weights={weights} goal={goal} />}
        {page==='menu' && <MenuPage theme={__theme} loaded={loaded} meals={meals} updMeals={updMeals} weights={weights} goal={goal} profile={profile} updProfile={updProfile} />}
        {page==='allena' && <AllenaPage theme={__theme} loaded={loaded} workouts={workouts} types={workoutTypes} updWorkouts={updWorkouts} updTypes={updWorkoutTypes} />}
        {page==='integra' && <IntegraPage theme={__theme} loaded={loaded} supps={supplements} taken={suppTaken} updSupps={updSupps} updTaken={updTaken} />}
        {page==='digiuno' && <DigiunoPage theme={__theme} loaded={loaded} fasts={fasts} updFasts={updFasts} />}
        {page==='respiro' && <RespiroPage theme={__theme} loaded={loaded} sessions={mindfulSessions} updSessions={updMindful} workouts={workouts} types={workoutTypes} updWorkouts={updWorkouts} updTypes={updWorkoutTypes} />}
        {page==='sonno' && <SonnoPage theme={__theme} loaded={loaded} sleeps={sleeps} updSleeps={updSleeps} />}
        {page==='sera' && <SeraPage theme={__theme} loaded={loaded} weights={weights} goal={goal} notes={foodNotes} water={waterByDay} waterGoal={waterGoal} meals={meals} workouts={workouts} workoutTypes={workoutTypes} supps={supplements} taken={suppTaken} sleeps={sleeps} mindful={mindfulSessions} updNotes={updFoodNotes} profile={profile} />}
        </>); })()}
      </div>
      <BottomNav theme={getTheme(profile?.theme)} currentId={page} onGo={goPage} onShoot={shootMeal} coachDot={coachUnread} />
      {shot && (
        <div role="status" aria-live="polite" onClick={() => { if (shot.state !== 'busy') setShot(null); }}
          style={{ position:'fixed', top:'calc(14px + env(safe-area-inset-top, 0px))', left:16, right:16, zIndex:300, display:'flex', justifyContent:'center', pointerEvents: shot.state==='busy' ? 'none' : 'auto' }}>
          <div style={{ maxWidth:420, width:'100%', boxSizing:'border-box', display:'flex', alignItems:'center', gap:12, padding:'10px 14px 10px 10px', borderRadius:20, background:'#142A4C', border:`1px solid ${shot.state==='err' ? '#F0B9A0' : '#C9A55A'}`, color:'#F4EFE2', fontFamily:fDmSans, fontSize:14, lineHeight:1.35, boxShadow:'0 8px 24px rgba(0,0,0,0.45)' }}>
            {shot.photo && <img src={shot.photo} alt="" style={{ width:44, height:44, borderRadius:12, objectFit:'cover', flexShrink:0 }} />}
            <span style={{ minWidth:0, wordBreak:'break-word' }}>{shot.text}</span>
          </div>
        </div>
      )}
      {renderAccountMenu()}
    </div>
  );
}

function BottomNav({ theme, currentId, onGo, onShoot, coachDot }){
  // Tema dinamico: bottom nav usa colori del tema attivo
  const NAV = theme ? { bg: theme.bg2, border: theme.border, dim: theme.dim, gold: theme.gold, cream: theme.cream } : { bg: '#1A1108', border: '#3A2818', dim: '#6B5D45', gold: '#C9A876', cream: '#E8D8B8' };
  // Secondo tocco sulla fotocamera: si aprono 3 icone (scatta, libreria, file)
  const [fan, setFan] = useState(false);
  const camRef = useRef(null), libRef = useRef(null), fileRef = useRef(null);
  const picked = e => { const f = e.target.files?.[0]; e.target.value = ''; setFan(false); if (f && onShoot) onShoot(f); };
  const fanBtn = (label, Ic, ref, dx, dy) => (
    <button onClick={()=>ref.current?.click()} aria-label={label} style={{position:'absolute',left:'50%',bottom:dy,marginLeft:dx-27,width:54,height:54,borderRadius:'50%',background:NAV.bg,border:`1.5px solid ${NAV.gold}`,boxShadow:'0 6px 18px rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:0}}>
      <Ic size={24} strokeWidth={1.9} color={NAV.gold} />
    </button>
  );
  return (
    <>
    {fan && <div onClick={()=>setFan(false)} style={{position:'fixed',inset:0,zIndex:49,background:'rgba(4,12,28,0.55)'}} />}
    <nav aria-label="navigazione principale" style={{position:'fixed',left:0,right:0,bottom:0,background:NAV.bg,borderTop:`1px solid ${NAV.border}55`,display:'flex',justifyContent:'space-around',alignItems:'flex-start',paddingTop:8,paddingBottom:'calc(10px + env(safe-area-inset-bottom, 0px))',zIndex:50}}>
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={picked} />
      <input ref={libRef} type="file" accept="image/*" style={{display:'none'}} onChange={picked} />
      <input ref={fileRef} type="file" accept="image/*,.heic,.heif" style={{display:'none'}} onChange={picked} />
      {fan && (
        <div style={{position:'absolute',left:0,right:0,top:0,height:0}}>
          {fanBtn('scatta una foto', Camera, camRef, -74, 34)}
          {fanBtn('scegli dalla libreria foto', ImageIcon, libRef, 0, 72)}
          {fanBtn('scegli un file', FolderOpen, fileRef, 74, 34)}
        </div>
      )}
      {NAV_ITEMS.map(p=>{const active=p.id===currentId; const Ic=p.Icon;
        if (p.center) return (
          <button key={p.id} onClick={()=>{ if (active && onShoot) setFan(v=>!v); else { setFan(false); onGo(p.id); } }} aria-label={active ? 'fotografa il pasto' : 'diario fotografico dei pasti'} aria-expanded={fan} style={{width:62,height:62,marginTop:-30,borderRadius:'50%',background:NAV.gold,border:`4px solid ${NAV.bg}`,boxShadow:active?`0 0 0 2px ${NAV.gold}`:'0 2px 8px rgba(0,0,0,0.25)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0}}>
            <Ic size={27} strokeWidth={2} color={NAV.bg} />
          </button>
        );
        return (
          <button key={p.id} onClick={()=>{ setFan(false); onGo(p.id); }} style={{background:'transparent',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'4px 2px',minWidth:58,minHeight:46,flex:'1 1 0'}}>
            <span style={{position:'relative',display:'flex'}}>
              <Ic size={23} strokeWidth={active?2.4:1.7} color={active?NAV.gold:NAV.cream} style={{opacity:active?1:0.7}} />
              {p.id==='coach' && coachDot && !active && <span aria-label="nuovo messaggio del coach" style={{position:'absolute',top:-3,right:-5,width:10,height:10,borderRadius:'50%',background:'#F0B9A0',border:`2px solid ${NAV.bg}`}} />}
            </span>
            <span style={{fontFamily:fDmSans,fontSize:10.5,fontWeight:active?700:500,color:active?NAV.gold:NAV.cream,opacity:active?1:0.75}}>{p.label}</span>
          </button>
        );
      })}
    </nav>
    </>
  );
}

// ============================================================================
// NUOVA NAVIGAZIONE — pagine della barra a 5 voci: Coach · Aggiorna · Foto
// (Pasti e Statistiche riusano le pagine esistenti)
// ============================================================================
function NavShell({ T, kicker, title, children }){
  const fTitle = T.fontText || fGaramond;
  return (
    <div style={{minHeight:'100vh',background:T.pageBg || `radial-gradient(ellipse at top, ${T.bg1} 0%, ${T.bg2} 100%)`,color:T.cream,fontFamily:fDmSans,position:'relative'}}>
      <div style={{padding:'30px 22px 28px',maxWidth:480,margin:'0 auto'}}>
        <div style={{paddingRight:56,marginBottom:14}}>
          <div style={{fontSize:11,letterSpacing:'0.14em',textTransform:'uppercase',color:T.gold,fontWeight:600}}>{kicker}</div>
          <h1 style={{margin:'4px 0 0',fontFamily:fTitle,fontSize:36,fontWeight:500,lineHeight:1.05,color:T.cream}}>{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
const navCard = (T) => ({ background:`${T.cream}0D`, border:`1px solid ${T.gold}40`, borderRadius:16 });

// ---------- Elementi condivisi del nuovo stile (anello, numeri in riga, tappe, pulsanti) ----------
function NavRing({ T, p, size=250, sw=14, children }){
  const r=(size-sw)/2, c=2*Math.PI*r, h=size/2, pp=Math.max(0,Math.min(1,p||0));
  return (
    <div style={{position:'relative',width:size,height:size,margin:'0 auto'}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
        <circle cx={h} cy={h} r={r} stroke={`${T.cream}22`} strokeWidth={sw} />
        <circle cx={h} cy={h} r={r} stroke={T.gold} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${c*pp} ${c}`} transform={`rotate(-90 ${h} ${h})`} />
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,textAlign:'center'}}>{children}</div>
    </div>
  );
}
function NavStats({ T, items }){
  return (
    <div style={{display:'flex',padding:'6px 0'}}>
      {items.map(([v,l],i)=>(
        <div key={i} style={{flex:'1 1 0',minWidth:0,display:'flex',flexDirection:'column',alignItems:'center',gap:2,borderLeft:i?`1px solid ${T.cream}22`:'none',padding:'0 4px',textAlign:'center'}}>
          <span style={{fontFamily:T.fontText||fGaramond,fontSize:24,fontWeight:500,lineHeight:1.1}}>{v}</span>
          <span style={{fontSize:12,opacity:0.7}}>{l}</span>
        </div>
      ))}
    </div>
  );
}
function NavStep({ T, time, title, desc, state='done', last, onTap }){
  const on = state!=='todo';
  const inner = (<>
    <div style={{width:22,flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <span style={{width:22,height:22,borderRadius:'50%',background:on?T.gold:'transparent',border:`2px solid ${on?T.gold:`${T.cream}44`}`,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{state==='done' && <Check size={13} strokeWidth={3.2} color={T.bg2} />}</span>
      <span style={{width:2,flexGrow:1,minHeight:10,background:last?'transparent':`${T.cream}2E`}} />
    </div>
    <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2,paddingBottom:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
        <span style={{fontFamily:T.fontText||fGaramond,fontSize:state==='now'?24:20,fontWeight:500,lineHeight:1.15,opacity:on?1:0.7}}>{title}</span>
        <span style={{fontSize:12,opacity:0.7,whiteSpace:'nowrap'}}>{time}</span>
      </div>
      {desc && <span style={{fontSize:13,opacity:0.75,lineHeight:1.4}}>{desc}</span>}
    </div>
  </>);
  const st = {display:'flex',gap:14,width:'100%',textAlign:'left',color:T.cream,fontFamily:fDmSans,background:'transparent',border:'none',padding:0};
  return onTap ? <button onClick={onTap} style={{...st,cursor:'pointer'}}>{inner}</button> : <div style={st}>{inner}</div>;
}
const navBtn = (T, primary=true) => ({ minHeight:50, borderRadius:25, background:primary?T.gold:'transparent', border:`1px solid ${T.gold}`, color:primary?T.bg2:T.cream, fontFamily:fDmSans, fontSize:15, fontWeight:primary?700:500, cursor:'pointer', width:'100%' });
const navChip = (T, on) => ({ minHeight:44, padding:'0 6px', borderRadius:22, background:on?T.gold:'transparent', border:`1px solid ${on?T.gold:`${T.cream}33`}`, color:on?T.bg2:T.cream, fontFamily:fDmSans, fontSize:14, fontWeight:600, cursor:'pointer' });
const navKicker = { fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', opacity:0.7, fontWeight:600, padding:'0 2px 8px' };

// ---------- Finestre (pop-up) nel nuovo stile: sfondo sfumato petrolio → blu notte ----------
const C_CREAM = '#F4EFE2', C_GOLD = '#C9A55A', C_NAVY = '#0E2240', C_SAL = '#F0B9A0';
const MODAL_BG = 'linear-gradient(180deg, #4A6A62 0%, #2A4A5C 28%, #16304F 62%, #122849 100%)';
const MODAL_CARD = { background: MODAL_BG, border: '1px solid #5F8079', borderRadius: 24, boxShadow: '0 12px 32px rgba(0,0,0,0.45)', color: C_CREAM, fontFamily: fDmSans, boxSizing: 'border-box' };
function NavModal({ title, sub, onClose, children, z=200, wide }){
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(4,12,28,0.72)',zIndex:z,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title} style={{...MODAL_CARD,width:'100%',maxWidth:wide?420:380,maxHeight:'90vh',overflowY:'auto',padding:22,display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <h2 style={{fontFamily:fGaramond,fontSize:26,fontWeight:500,lineHeight:1.1,margin:0}}>{title}</h2>
          {sub && <span style={{fontSize:13,opacity:0.8,lineHeight:1.4}}>{sub}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}
function NavField({ label, unit, size=24, right, ...inputProps }){
  return (
    <label style={{display:'flex',flexDirection:'column',gap:2,minWidth:0}}>
      <span style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,fontSize:12,opacity:0.8,minHeight:18}}><span>{label}</span>{right}</span>
      <span style={{display:'flex',alignItems:'baseline',gap:6,borderBottom:`2px solid ${C_GOLD}`,padding:'2px 0 4px'}}>
        <input {...inputProps} style={{flex:1,minWidth:0,width:'100%',background:'transparent',border:'none',outline:'none',color:C_CREAM,fontFamily:fGaramond,fontSize:size,fontWeight:500,lineHeight:1.15,padding:0,colorScheme:'dark'}} />
        {unit && <span style={{fontSize:13,opacity:0.8}}>{unit}</span>}
      </span>
    </label>
  );
}
const pillBtn = (kind) => ({ minHeight:46, padding:'0 18px', borderRadius:23, fontFamily:fDmSans, fontSize:15, cursor:'pointer',
  ...(kind==='p' ? { background:C_GOLD, border:`1px solid ${C_GOLD}`, color:C_NAVY, fontWeight:700 }
    : kind==='d' ? { background:'transparent', border:`1px solid ${C_SAL}`, color:C_SAL }
    : kind==='g' ? { background:'transparent', border:`1px solid ${C_GOLD}`, color:C_CREAM, fontWeight:600 }
    : { background:'transparent', border:`1px solid ${C_CREAM}88`, color:C_CREAM }) });
const pillChip = (on) => ({ minHeight:44, padding:'0 8px', borderRadius:22, background:on?C_GOLD:'transparent', border:`1px solid ${on?C_GOLD:`${C_CREAM}55`}`, color:on?C_NAVY:C_CREAM, fontFamily:fDmSans, fontSize:13, fontWeight:600, cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' });
const modalLink = { background:'transparent', border:'none', color:C_CREAM, fontFamily:fDmSans, fontSize:13, textDecoration:'underline', textUnderlineOffset:3, cursor:'pointer', padding:'8px 0', minHeight:36 };
function NavButtons({ onDelete, onCancel, onSave, saveLabel='salva', deleteLabel='elimina', disabled }){
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap',paddingTop:4}}>
      {onDelete ? <button onClick={onDelete} style={pillBtn('d')}>{deleteLabel}</button> : <span />}
      <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
        <button onClick={onCancel} style={pillBtn('o')}>annulla</button>
        <button onClick={onSave} disabled={disabled} style={{...pillBtn('p'),opacity:disabled?0.5:1}}>{saveLabel}</button>
      </div>
    </div>
  );
}

// ---------- AGGIORNA: elenco delle cose da fare oggi, un tocco per registrare ----------
function AggiornaPage({ theme, loaded, weights, updWeights, supps, taken, updTaken, water, waterGoal, updWater, workouts, fasts, sleeps, meals, go }){
  const T = theme;
  const now = new Date();
  const tk = dayKey(now);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightVal, setWeightVal] = useState('');
  const [saving, setSaving] = useState(false);

  const todayWeights = (weights||[]).filter(w=>sameDay(new Date(w.ts), now)).sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  const takenToday = (taken||{})[tk] || [];
  const todayWater = (water||{})[tk] || 0;
  const mealsToday = (meals||[]).filter(m=>m.status!=='planned' && sameDay(new Date(m.ts), now)).length;
  const workoutToday = (workouts||[]).some(w=>sameDay(new Date(w.ts), now));
  const activeFast = (fasts||[]).find(f=>!f.ended_ts);
  const fastDoneToday = (fasts||[]).some(f=>f.ended_ts && sameDay(new Date(f.ended_ts), now));
  const sleepToday = (sleeps||[]).some(s=>s.wakeDate===tk);

  async function saveWeight(){
    const n = parseNum(weightVal, 20, 400);
    if (n == null || saving) return;
    setSaving(true);
    try { await updWeights([...(weights||[]), { id:newId(), ts:new Date().toISOString(), weight:n }]); } finally { setSaving(false); }
    setWeightOpen(false); setWeightVal('');
  }
  async function toggleSupp(id){
    const next = { ...(taken||{}), [tk]: takenToday.includes(id) ? takenToday.filter(x=>x!==id) : [...takenToday, id] };
    await updTaken(next);
  }

  const groups = [
    { label:'mattina', items:[
      { id:'peso1', title:'Peso del mattino', sub: todayWeights[0] ? `registrato alle ${new Date(todayWeights[0].ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}` : 'tocca e scrivi il peso', done: todayWeights.length>0, right: todayWeights[0] ? `${fmt(todayWeights[0].weight)} kg` : null, onTap: ()=>setWeightOpen(true) },
      { id:'sonno', title:'Sonno di stanotte', sub: sleepToday ? 'registrato' : 'da registrare', done: sleepToday, onTap: ()=>go('sonno') },
    ]},
    { label:'integratori', items: (supps||[]).map(s=>({ id:'s_'+s.id, title:s.name, sub: takenToday.includes(s.id) ? 'preso' : 'tocca quando lo prendi', done: takenToday.includes(s.id), onTap: ()=>toggleSupp(s.id) })) },
    { label:'giornata', items:[
      { id:'acqua', title:'Acqua', sub:`${todayWater} bicchieri su ${waterGoal}`, done: todayWater>=waterGoal, right:'+1', onTap: ()=>updWater({ ...(water||{}), [tk]: Math.min(100, todayWater+1) }) },
      { id:'pasti', title:'Pasti', sub: mealsToday ? `${mealsToday} ${mealsToday===1?'registrato':'registrati'} oggi` : 'nessuno registrato', done: mealsToday>=3, onTap: ()=>go('pasti') },
      { id:'allena', title:'Allenamento', sub: workoutToday ? 'fatto oggi' : 'da registrare', done: workoutToday, onTap: ()=>go('allena') },
      { id:'digiuno', title:'Digiuno', sub: activeFast ? 'in corso' : fastDoneToday ? 'concluso oggi' : 'nessun digiuno attivo', done: fastDoneToday, onTap: ()=>go('digiuno') },
    ]},
    { label:'sera', items:[
      { id:'peso2', title:'Peso della sera', sub: todayWeights.length>1 ? 'registrato' : 'tocca e scrivi il peso', done: todayWeights.length>1, right: todayWeights.length>1 ? `${fmt(todayWeights[todayWeights.length-1].weight)} kg` : null, onTap: ()=>setWeightOpen(true) },
      { id:'diario', title:'Diario', sub:'riepilogo e note della giornata', done:false, noCheck:true, onTap: ()=>go('sera') },
    ]},
  ].filter(g=>g.items.length>0);
  const all = groups.flatMap(g=>g.items).filter(i=>!i.noCheck);
  const doneN = all.filter(i=>i.done).length;
  const dateLabel = now.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});

  return (
    <NavShell T={T} kicker={`${dateLabel} · ${doneN} di ${all.length} fatti`} title="Oggi">
      {!loaded && <Loading color={T.gold} />}
      {loaded && (<>
        <div style={{height:8,borderRadius:4,background:`${T.cream}22`,marginBottom:6}}>
          <div style={{width:`${all.length?Math.round(doneN/all.length*100):0}%`,height:8,borderRadius:4,background:T.gold,transition:'width .3s'}} />
        </div>
        {groups.map(g=>(
          <div key={g.label} style={{marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:'0.14em',textTransform:'uppercase',color:T.cream,opacity:0.7,fontWeight:600,padding:'0 4px 8px'}}>{g.label}</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {g.items.map(it=>(
                <button key={it.id} onClick={it.onTap} style={{...navCard(T),display:'flex',alignItems:'center',gap:14,padding:'12px 14px',minHeight:62,cursor:'pointer',textAlign:'left',width:'100%',boxSizing:'border-box',color:T.cream,fontFamily:fDmSans,opacity:it.done?0.75:1}}>
                  {!it.noCheck && <span style={{width:28,height:28,borderRadius:'50%',flexShrink:0,background:it.done?T.gold:'transparent',border:`2px solid ${T.gold}`,display:'flex',alignItems:'center',justifyContent:'center'}}>{it.done && <Check size={17} strokeWidth={3} color={T.bg2} />}</span>}
                  <span style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
                    <span style={{fontSize:16,fontWeight:600}}>{it.title}</span>
                    <span style={{fontSize:12,opacity:0.75}}>{it.sub}</span>
                  </span>
                  <span style={{fontSize:14,fontWeight:700,color:it.right?T.cream:T.gold,whiteSpace:'nowrap'}}>{it.right || (it.done ? '' : 'tocca')}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {(supps||[]).length===0 && (
          <button onClick={()=>go('integra')} style={{marginTop:16,background:'transparent',border:`1px dashed ${T.gold}80`,borderRadius:16,padding:'12px 14px',width:'100%',color:T.cream,fontFamily:fDmSans,fontSize:14,cursor:'pointer',textAlign:'left'}}>Aggiungi i tuoi integratori per vederli qui</button>
        )}
      </>)}
      {weightOpen && (
        <div onClick={()=>setWeightOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{...MODAL_CARD,padding:22,width:'100%',maxWidth:320}}>
            <div style={{fontFamily:T.fontText||fGaramond,fontSize:24,marginBottom:12}}>Il tuo peso adesso</div>
            <div style={{display:'flex',alignItems:'baseline',gap:8}}>
              <input autoFocus inputMode="decimal" value={weightVal} onChange={e=>setWeightVal(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') saveWeight(); }} placeholder="0,0" aria-label="peso in kg"
                style={{flex:1,minWidth:0,background:'transparent',border:'none',borderBottom:`2px solid ${T.gold}`,color:T.cream,fontFamily:T.fontText||fGaramond,fontSize:44,outline:'none',padding:'4px 0'}} />
              <span style={{fontSize:18,opacity:0.8}}>kg</span>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button onClick={()=>setWeightOpen(false)} style={{flex:1,minHeight:46,background:'transparent',border:`1px solid ${T.cream}66`,borderRadius:23,color:T.cream,fontFamily:fDmSans,fontSize:15,cursor:'pointer'}}>annulla</button>
              <button onClick={saveWeight} disabled={saving || parseNum(weightVal,20,400)==null} style={{flex:1,minHeight:46,background:T.gold,border:`1px solid ${T.gold}`,borderRadius:23,color:T.bg2,fontFamily:fDmSans,fontSize:15,fontWeight:700,cursor:'pointer',opacity:parseNum(weightVal,20,400)==null?0.5:1}}>{saving?'…':'salva'}</button>
            </div>
          </div>
        </div>
      )}
    </NavShell>
  );
}

// ---------- FOTO: diario fotografico dei pasti, vista griglia o linea del giorno ----------
function FotoPage({ theme, loaded, meals }){
  const T = theme;
  const [view, setView] = useState(()=>{ try { return localStorage.getItem('goalfit_foto_view')==='linea' ? 'linea' : 'griglia'; } catch(_) { return 'griglia'; } });
  const [limit, setLimit] = useState(14);
  const [open, setOpen] = useState(null);
  function pickView(v){ setView(v); try { localStorage.setItem('goalfit_foto_view', v); } catch(_) {} }
  const days = useMemo(()=>{
    const map = {};
    (meals||[]).forEach(m=>{ if(m.status==='planned' || !(m.photo_url||m.photo)) return; const k=dayKey(new Date(m.ts)); (map[k]=map[k]||[]).push(m); });
    return Object.keys(map).sort().reverse().map(k=>({ key:k, list: map[k].sort((a,b)=>new Date(b.ts)-new Date(a.ts)) }));
  },[meals]);
  const shown = days.slice(0, limit);
  const tk = dayKey(new Date());
  const dayLabel = k => k===tk ? 'oggi' : parseDayKey(k).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});
  const hhmm = ts => new Date(ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  const typeName = m => MEAL_TYPES.find(t=>t.id===m.type)?.name || 'Pasto';
  const seg = (id,label) => (
    <button onClick={()=>pickView(id)} style={{flex:1,minHeight:44,borderRadius:22,border:'none',background:view===id?T.gold:'transparent',color:view===id?T.bg2:T.cream,fontFamily:fDmSans,fontSize:14,fontWeight:600,cursor:'pointer'}}>{label}</button>
  );
  return (
    <NavShell T={T} kicker={view==='griglia' ? 'vista a griglia' : 'vista a linea del giorno'} title="Diario foto">
      <div style={{background:'#142A4C',border:'1px solid #34506F',borderRadius:26,padding:4,display:'flex',gap:4,margin:'0 0 4px'}}>{seg('griglia','griglia')}{seg('linea','linea del giorno')}</div>
      {!loaded && <Loading color={T.gold} />}
      {loaded && days.length===0 && <div style={{marginTop:40,textAlign:'center',fontSize:15,opacity:0.8,lineHeight:1.5}}>Ancora nessuna foto.<br/>Tocca di nuovo l'icona della fotocamera qui sotto per aggiungere una foto.</div>}
      {loaded && shown.map(d=>(
        <div key={d.key} style={{marginTop:18}}>
          <div style={{fontSize:11,letterSpacing:'0.14em',textTransform:'uppercase',opacity:0.75,fontWeight:600,padding:'0 4px 8px'}}>{dayLabel(d.key)} · {d.list.length} {d.list.length===1?'pasto':'pasti'}</div>
          {view==='griglia' ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gap:8}}>
              {d.list.map(m=>(
                <button key={m.id} onClick={()=>setOpen(m)} aria-label={`${typeName(m)} delle ${hhmm(m.ts)}`} style={{position:'relative',padding:0,border:'none',background:'transparent',cursor:'pointer',aspectRatio:'1 / 1',borderRadius:12,overflow:'hidden'}}>
                  <img src={m.photo_url||m.photo} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                  <span style={{position:'absolute',left:6,bottom:6,background:'rgba(8,18,36,0.78)',color:'#F4EFE2',fontFamily:fDmSans,fontSize:11,fontWeight:600,padding:'2px 7px',borderRadius:8}}>{hhmm(m.ts)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {d.list.map(m=>(
                <div key={m.id} style={{display:'flex',gap:12}}>
                  <div style={{width:44,flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                    <span style={{fontSize:13,fontWeight:700}}>{hhmm(m.ts)}</span>
                    <span style={{width:2,flexGrow:1,background:`${T.gold}55`}} />
                  </div>
                  <button onClick={()=>setOpen(m)} style={{flex:1,minWidth:0,padding:'0 0 16px',border:'none',background:'transparent',cursor:'pointer',textAlign:'left',color:T.cream}}>
                    <img src={m.photo_url||m.photo} alt="" loading="lazy" style={{width:'100%',height:150,objectFit:'cover',borderRadius:18,display:'block'}} />
                    <span style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,marginTop:6}}>
                      <span style={{fontFamily:T.fontText||fGaramond,fontSize:22,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{typeName(m)}</span>
                      {m.kcal!=null && <span style={{fontFamily:fDmSans,fontSize:13,opacity:0.8,whiteSpace:'nowrap'}}>{fmt0(m.kcal)} kcal</span>}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {loaded && days.length>limit && <button onClick={()=>setLimit(limit+14)} style={{marginTop:20,width:'100%',minHeight:46,background:'transparent',border:`1px solid ${T.gold}80`,borderRadius:23,color:T.cream,fontFamily:fDmSans,fontSize:14,cursor:'pointer'}}>mostra giorni precedenti</button>}
      {open && (
        <div onClick={()=>setOpen(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:210,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,cursor:'pointer'}}>
          <img src={open.photo_url||open.photo} alt="" style={{maxWidth:'100%',maxHeight:'70vh',borderRadius:16}} />
          <div style={{color:'#F4EFE2',fontFamily:fDmSans,fontSize:15,marginTop:14,textAlign:'center',lineHeight:1.5}}>
            <div style={{fontWeight:700}}>{open.description || typeName(open)}</div>
            <div style={{opacity:0.8,fontSize:13}}>{typeName(open)} · {hhmm(open.ts)}{open.kcal!=null?` · ${fmt0(open.kcal)} kcal`:''}</div>
          </div>
        </div>
      )}
    </NavShell>
  );
}

// ---------- STATISTICHE semplici: peso, andamento, obiettivo, calorie della settimana ----------
function StatsPage({ theme, loaded, weights, goal, meals, profile, openFull }){
  const T = theme;
  const fTitle = T.fontText || fGaramond;
  const now = new Date();
  const ws = [...(weights||[])].sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  const latest = ws[ws.length-1] || null;
  const weekAgo = new Date(now.getTime() - 7*86400000);
  const before = [...ws].reverse().find(w=>new Date(w.ts) <= weekAgo) || ws.find(w=>new Date(w.ts) > weekAgo) || null;
  const diff = (latest && before && before.id !== latest.id) ? latest.weight - before.weight : null;
  const monthAgo = new Date(now.getTime() - 30*86400000);
  const perDay = {}; ws.filter(w=>new Date(w.ts) >= monthAgo).forEach(w=>{ perDay[dayKey(new Date(w.ts))] = w.weight; });
  const series = Object.keys(perDay).sort().map(k=>perDay[k]);
  let path = '', lastPt = null;
  if (series.length > 1) {
    const mn = Math.min(...series), mx = Math.max(...series), span = Math.max(mx-mn, 0.5);
    const pts = series.map((v,i)=>({ x: 6 + i*(288/(series.length-1)), y: 10 + 70*(1-(v-mn)/span) }));
    path = pts.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    lastPt = pts[pts.length-1];
  }
  const sentence = diff == null ? 'Registra il peso per qualche giorno e qui vedrai come sta andando.'
    : diff <= -0.2 ? 'Stai scendendo. Continua così.'
    : diff >= 0.2 ? 'Nell\'ultima settimana il peso è salito. Guarda i pasti dei giorni scorsi.'
    : 'Il peso è fermo rispetto a una settimana fa.';
  const toGoal = (latest && goal != null) ? latest.weight - Number(goal) : null;
  const tg = computeNutritionTarget(profile, weights, goal);
  const days = Array.from({length:7},(_,k)=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-(6-k)); return d; });
  const kcalBy = days.map(d=>(meals||[]).filter(m=>m.status!=='planned' && sameDay(new Date(m.ts), d)).reduce((a,m)=>a+(m.kcal||0),0));
  const maxK = Math.max(tg.kcal||0, ...kcalBy, 1);
  const fullDays = days.filter((d,i)=>kcalBy[i] > 0 && ws.some(w=>sameDay(new Date(w.ts), d))).length;
  const tile = (label, value, sub) => (
    <div style={{...navCard(T),borderRadius:18,padding:14,display:'flex',flexDirection:'column',gap:2}}>
      <span style={{fontSize:12,opacity:0.75}}>{label}</span>
      <span style={{fontFamily:fTitle,fontSize:30,lineHeight:1.1}}>{value}</span>
      <span style={{fontSize:12,opacity:0.75}}>{sub}</span>
    </div>
  );
  return (
    <NavShell T={T} kicker="statistiche · ultimi 7 giorni" title="Come stai andando">
      {!loaded && <Loading color={T.gold} />}
      {loaded && (<div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{...navCard(T),borderRadius:22,padding:18,display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:10,flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column'}}>
              <span style={{fontSize:12,opacity:0.75}}>{latest && sameDay(new Date(latest.ts), now) ? 'peso di oggi' : 'ultimo peso'}</span>
              <span style={{fontFamily:fTitle,fontSize:52,lineHeight:1}}>{latest ? fmt(latest.weight) : '—'} <span style={{fontSize:24}}>kg</span></span>
            </div>
            {diff != null && <span style={{background:T.gold,color:T.bg2,fontSize:13,fontWeight:700,padding:'6px 12px',borderRadius:14,whiteSpace:'nowrap'}}>{diff>0?'+':diff<0?'−':''}{fmt(Math.abs(diff))} kg in 7 giorni</span>}
          </div>
          {path && (
            <svg viewBox="0 0 300 90" role="img" aria-label="Andamento del peso negli ultimi 30 giorni" style={{width:'100%',height:'auto',display:'block'}}>
              <path d={path} fill="none" stroke={T.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={lastPt.x} cy={lastPt.y} r="5.5" fill={T.cream} />
            </svg>
          )}
          <span style={{fontSize:14,lineHeight:1.4}}>{sentence}</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',gap:12}}>
          {tile(toGoal != null && toGoal <= 0 ? 'obiettivo' : 'all\'obiettivo mancano', toGoal == null ? '—' : toGoal <= 0 ? 'raggiunto' : `${fmt(toGoal)} kg`, goal != null ? `obiettivo ${fmt(Number(goal))} kg` : 'imposta un obiettivo in Peso')}
          {tile('giorni completi', `${fullDays} su 7`, 'peso e pasti registrati')}
        </div>
        <div style={{...navCard(T),borderRadius:22,padding:'16px 18px',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{opacity:0.75}}>calorie per giorno</span><span style={{opacity:0.75}}>obiettivo {fmt0(tg.kcal)}</span></div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:6}}>
            {days.map((d,i)=>{ const today = i===6; return (
              <div key={i} style={{flex:'1 1 0',display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                <span style={{fontSize:10,opacity:0.75,minHeight:12}}>{kcalBy[i] ? fmt0(kcalBy[i]) : ''}</span>
                <div style={{width:'100%',maxWidth:28,height:90,display:'flex',alignItems:'flex-end'}}>
                  <div style={{width:'100%',height:`${Math.max(3, Math.round(kcalBy[i]/maxK*100))}%`,borderRadius:8,background:today?T.gold:`${T.cream}2E`,border:`1px solid ${T.gold}`,boxSizing:'border-box'}} />
                </div>
                <span style={{fontSize:11,fontWeight:today?700:400,opacity:today?1:0.75}}>{d.toLocaleDateString('it-IT',{weekday:'narrow'})}</span>
              </div>
            ); })}
          </div>
        </div>
        <button onClick={openFull} style={{minHeight:48,borderRadius:24,background:'transparent',border:`1px solid ${T.gold}`,color:T.cream,fontFamily:fDmSans,fontSize:15,cursor:'pointer'}}>tutte le statistiche</button>
      </div>)}
    </NavShell>
  );
}

// ---------- COACH: chat con l'IA che riceve un riepilogo degli ultimi 30 giorni ----------
// Testo del coach: **grassetto** e righe di elenco ("- ") mostrati come tali, senza simboli a vista
function CoachText({ text }){
  const bold = (line, k) => String(line).split(/(\*\*[^*\n]+\*\*)/g).map((part, i) =>
    /^\*\*[^*\n]+\*\*$/.test(part) ? <strong key={k+'-'+i} style={{fontWeight:700}}>{part.slice(2,-2)}</strong> : part.replace(/\*\*/g,''));
  return String(text||'').split('\n').map((raw, i) => {
    const line = raw.replace(/^#{1,4}\s+/, '');
    const m = line.match(/^\s*[-–•]\s+(.*)$/);
    if (m) return <div key={i} style={{display:'flex',gap:8,paddingLeft:2}}><span aria-hidden="true">•</span><span style={{flex:1,minWidth:0}}>{bold(m[1], i)}</span></div>;
    return <div key={i} style={{minHeight: line.trim() ? undefined : 10}}>{bold(line, i)}</div>;
  });
}
function buildCoachContext({ profile, weights, goal, meals, water, waterGoal, workouts, workoutTypes, sleeps, fasts, supps, taken, notes, mindful, whoopDaily }){
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30*86400000);
  const recent = ts => { const d=new Date(ts); return d>=cutoff && d<=now; };
  const dk = ts => dayKey(new Date(ts));
  const L = [];
  L.push(`Data di oggi: ${dayKey(now)}`);
  const p = profile || {};
  L.push(`Profilo: sesso ${p.sex||'n.d.'}, anno di nascita ${p.birth_year||'n.d.'}, altezza ${p.height_cm||'n.d.'} cm, peso obiettivo ${goal!=null?goal+' kg':'n.d.'}`);
  L.push(`Stile alimentare: ${p.diet_style||'n.d.'} · Allergie o intolleranze dichiarate: ${p.allergies||'nessuna dichiarata'} · Livello di attività: ${p.activity_level||'n.d.'}`);
  const t = computeNutritionTarget(profile, weights, goal);
  L.push(`Target giornalieri: ${t.kcal} kcal, proteine ${t.protein} g, carboidrati ${t.carbs} g, grassi ${t.fat} g`);
  const ws = (weights||[]).filter(w=>recent(w.ts)).sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  L.push(`Peso (kg): ${ws.map(w=>`${dk(w.ts)} ${w.weight}`).join('; ') || 'nessun dato'}`);
  const byDay = {};
  (meals||[]).filter(m=>m.status!=='planned' && recent(m.ts)).forEach(m=>{ const k=dk(m.ts); const o=byDay[k]=byDay[k]||{kcal:0,p:0,c:0,g:0,d:[]}; o.kcal+=m.kcal||0; o.p+=m.p||0; o.c+=m.c||0; o.g+=m.g||0; if(m.description) o.d.push(m.description); });
  const weekAgo = dayKey(new Date(now.getTime() - 7*86400000));
  L.push('Pasti per giorno (kcal / proteine / carboidrati / grassi):');
  Object.keys(byDay).sort().forEach(k=>{ const o=byDay[k]; L.push(`  ${k}: ${Math.round(o.kcal)} kcal / ${Math.round(o.p)} / ${Math.round(o.c)} / ${Math.round(o.g)}${k>=weekAgo && o.d.length ? ' — ' + o.d.join(', ').slice(0,300) : ''}`); });
  if (Object.keys(byDay).length===0) L.push('  nessun dato');
  const pl = (meals||[]).filter(m=>m.status==='planned' && dk(m.ts)>=dayKey(now)).sort((a,b)=>new Date(a.ts)-new Date(b.ts)).slice(0,30);
  if (pl.length) L.push('Pasti in piano nel Menù: ' + pl.map(m=>`${dk(m.ts)} ${m.type||''} "${String(m.description||'').slice(0,50)}" ${m.kcal??'?'} kcal`).join('; '));
  const wk = Object.keys(water||{}).filter(k=>k>=dayKey(cutoff)).sort();
  L.push(`Acqua (bicchieri, obiettivo ${waterGoal}): ${wk.map(k=>`${k} ${water[k]}`).join('; ') || 'nessun dato'}`);
  const wo = (workouts||[]).filter(w=>recent(w.ts));
  L.push(`Allenamenti: ${wo.map(w=>{ const ty=(workoutTypes||[]).find(x=>x.id===w.typeId); return `${dk(w.ts)} ${ty?.name||'attività'} ${w.qty??''} ${ty?.unit||''}`.trim(); }).join('; ') || 'nessun dato'}`);
  const sl = (sleeps||[]).filter(s=>s.wakeDate && s.wakeDate>=dayKey(cutoff));
  L.push(`Sonno: ${sl.map(s=>`${s.wakeDate} ${s.bedtime||'?'}-${s.waketime||'?'}${s.quality!=null?' qualità '+s.quality:''}`).join('; ') || 'nessun dato'}`);
  const fs = (fasts||[]).filter(f=>f.started_ts && recent(f.started_ts));
  L.push(`Digiuni: ${fs.map(f=>`${dk(f.started_ts)} ${f.ended_ts ? Math.round((new Date(f.ended_ts)-new Date(f.started_ts))/3600000)+'h' : 'in corso'}${f.planned_hours?' (previste '+f.planned_hours+'h)':''}`).join('; ') || 'nessun dato'}`);
  const suppLine = (supps||[]).map(s=>{ let c=0; Object.keys(taken||{}).forEach(k=>{ if(k>=dayKey(cutoff) && (taken[k]||[]).includes(s.id)) c++; }); return `${s.name} ${c}/30 giorni`; });
  L.push(`Integratori: ${suppLine.join('; ') || 'nessuno'}`);
  if ((whoopDaily||[]).length) L.push('WHOOP per giorno (recupero % / variabilità cardiaca ms / battito a riposo / sforzo 0-21 / passi): ' + whoopDaily.map(d=>`${d.day} ${d.recovery??'?'}% / ${d.hrv??'?'} / ${d.resting_hr??'?'} / ${d.strain??'?'} / ${d.steps??'?'}`).join('; '));
  const mi = (mindful||[]).filter(m=>recent(m.ts));
  L.push(`Respirazione/mindfulness: ${mi.length} sessioni`);
  const nt = (notes||[]).filter(n=>recent(n.ts)).slice(-10);
  if (nt.length) L.push(`Note di diario recenti: ${nt.map(n=>`${dk(n.ts)} "${String(n.text||'').slice(0,200)}"`).join('; ')}`);
  return L.join('\n');
}
function CoachPage(props){
  const T = props.theme;
  const uid = props.user?.id;
  const [msgs, setMsgs] = useState([]);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmNew, setConfirmNew] = useState(false);
  const endRef = useRef(null);
  // Modifiche ai dati proposte dal coach: restano in attesa finché l'utente non le approva nel pop-up
  const [pending, setPending] = useState(null); // { text, cards, next, labels }
  const [undo, setUndo] = useState(null);       // { msgId, snap, labels }
  const [applying, setApplying] = useState(false);
  const propsRef = useRef(props); propsRef.current = props;
  // Foto allegata al messaggio (resta visibile solo in questa sessione) e dettatura vocale
  const [attach, setAttach] = useState(null);
  const [imgs, setImgs] = useState({});
  const photoRef = useRef(null);
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  async function pickAttach(e){
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { setAttach(await resizeImage(f, 1024, 0.8)); } catch (_) { setErr('Non sono riuscito a leggere la foto.'); }
  }
  function toggleMic(){
    if (!SR) return;
    if (listening) { try { recRef.current?.stop(); } catch (_) {} return; }
    try {
      const r = new SR(); recRef.current = r;
      r.lang = 'it-IT'; r.interimResults = false; r.continuous = false;
      r.onresult = ev => { let t = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) t += ev.results[i][0].transcript; if (t) setInput(cur => (cur ? cur.trimEnd() + ' ' : '') + t.trim()); };
      r.onerror = ev => { setListening(false); if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') setErr('Per dettare serve il permesso di usare il microfono.'); };
      r.onend = () => setListening(false);
      setErr(''); setListening(true); r.start();
    } catch (_) { setListening(false); }
  }
  useEffect(() => () => { try { recRef.current?.abort(); } catch (_) {} }, []);
  const mealRefs = useRef({});
  // Scrive nell'app un insieme di dati (una sola chiamata per tipo di dato)
  async function writeData(d){
    const P = propsRef.current;
    if (d.meals !== undefined) await P.updMeals(d.meals);
    if (d.sleeps !== undefined) await P.updSleeps(d.sleeps);
    if (d.weights !== undefined) await P.updWeights(d.weights);
    if (d.goal !== undefined) await P.updGoal(d.goal);
    if (d.water !== undefined) await P.updWater(d.water);
    if (d.workoutTypes !== undefined) await P.updWorkoutTypes(d.workoutTypes);
    if (d.workouts !== undefined) await P.updWorkouts(d.workouts);
    if (d.fasts !== undefined) await P.updFasts(d.fasts);
    if (d.supps !== undefined) await P.updSupps(d.supps);
    if (d.taken !== undefined) await P.updTaken(d.taken);
    if (d.notes !== undefined) await P.updNotes(d.notes);
    if (d.targets !== undefined) await P.updProfile(d.targets);
  }
  function addReply(content){
    const reply = { id:newId(), role:'assistant', content, ts:new Date().toISOString() };
    setMsgs(cur=>[...cur, reply]); persist(reply);
    return reply;
  }
  async function decide(ok){
    const pd = pending; if (!pd || applying) return;
    if (!ok) { setPending(null); addReply(pd.text + '\n\n✗ non applicato: ' + pd.labels.join('; ')); return; }
    setApplying(true);
    try {
      const P = propsRef.current;
      // fotografia dei dati di prima, per poter annullare
      const snap = {};
      Object.keys(pd.next).forEach(k => { snap[k] = k==='targets' ? { daily_kcal_goal:P.profile?.daily_kcal_goal ?? null, daily_protein_g:P.profile?.daily_protein_g ?? null, daily_carbs_g:P.profile?.daily_carbs_g ?? null, daily_fat_g:P.profile?.daily_fat_g ?? null } : P[k]; });
      await writeData(pd.next);
      const r = addReply(pd.text + '\n\n✓ modificato: ' + pd.labels.join('; '));
      setUndo({ msgId:r.id, snap, labels:pd.labels });
    } catch (e) { setErr('Non sono riuscito ad applicare la modifica. (' + (e?.message||'errore') + ')'); }
    finally { setApplying(false); setPending(null); }
  }
  async function undoLast(){
    const u = undo; if (!u || applying) return;
    setApplying(true);
    try { await writeData(u.snap); addReply('↩ modifica annullata: ' + u.labels.join('; ')); }
    catch (e) { setErr('Non sono riuscito ad annullare. (' + (e?.message||'errore') + ')'); }
    finally { setApplying(false); setUndo(null); }
  }
  // La conversazione è salvata nel database (tabella coach_messages) e si ricarica a ogni apertura
  useEffect(()=>{
    let alive = true;
    (async()=>{
      if (!uid) { setReady(true); return; }
      const { data, error } = await supabase.from('coach_messages').select('id,role,content,ts').eq('user_id', uid).order('ts', { ascending:false }).limit(200);
      if (!alive) return;
      if (error) console.error('[coach] load error', error.message);
      setMsgs((data||[]).slice().reverse());
      setReady(true);
    })();
    return ()=>{ alive = false; };
  },[uid, props.refreshKey]);
  useEffect(()=>{ try { endRef.current?.scrollIntoView({ block:'end' }); } catch(_) {} }, [msgs, busy, ready]);
  useEffect(()=>{ if (!confirmNew) return; const id = setTimeout(()=>setConfirmNew(false), 4000); return ()=>clearTimeout(id); }, [confirmNew]);
  async function persist(m){
    if (!uid) return;
    const { error } = await supabase.from('coach_messages').insert({ id:m.id, user_id:uid, role:m.role, content:m.content, ts:m.ts });
    if (error) console.error('[coach] save error', error.message);
  }
  async function newChat(){
    if (!confirmNew) { setConfirmNew(true); return; }
    setConfirmNew(false); setMsgs([]); setErr('');
    if (uid) { const { error } = await supabase.from('coach_messages').delete().eq('user_id', uid); if (error) console.error('[coach] delete error', error.message); }
  }
  async function send(text){
    const photo = text == null ? attach : null;
    const q = (text ?? input).trim() || (photo ? 'Guarda questa foto: cosa mi consigli?' : '');
    if (!q || busy || pending) return;
    setUndo(null);
    if (listening) { try { recRef.current?.stop(); } catch (_) {} }
    const mine = { id:newId(), role:'user', content:(photo ? '📷 ' : '') + q, ts:new Date().toISOString() };
    const next = [...msgs, mine];
    if (photo) setImgs(cur => ({ ...cur, [mine.id]: photo }));
    setMsgs(next); setInput(''); setAttach(null); setErr(''); setBusy(true);
    persist(mine);
    try {
      const learn = props.profile?.coach_learn !== false;
      const memText = memoryToText(await loadMemory());
      const mr = buildMealRefs(props.meals); mealRefs.current = mr.refs;
      const system = 'Sei il coach di GoalFit, un\'app italiana per il controllo del peso. Parli in italiano, in modo diretto, caldo e concreto, con risposte brevi (massimo 6-8 frasi, niente elenchi lunghi). '
        + 'Dai consigli generali su alimentazione, peso e abitudini basandoti sui dati reali dell\'utente riportati qui sotto: citali quando servono e non inventare dati che non ci sono. '
        + 'Non fai diagnosi e non sostituisci medico o nutrizionista: per problemi di salute, farmaci, gravidanza o obiettivi di peso estremi invita a rivolgersi a un professionista.\n\n'
        + 'DATI DELL\'UTENTE (ultimi 30 giorni):\n' + buildCoachContext(props)
        + '\n\nFOTO: i messaggi che iniziano con 📷 avevano una foto allegata. Se nell\'ultimo messaggio c\'è una foto (un piatto, il menu di un ristorante, un\'etichetta, la bilancia) guardala e rispondi su quella; se è un pasto che l\'utente dice di aver mangiato, proponi di registrarlo. Delle foto dei messaggi precedenti vedi solo il testo.'
        + '\n\nPASTI RECENTI CON CODICE (per modificarli o eliminarli):\n' + mr.text + '\nI codici (P1, P2…) servono solo a te per gli strumenti: non scriverli MAI nelle risposte, i pasti chiamali con il loro nome e l\'orario.'
        + '\n\nFORMATO: testo semplice. Puoi usare **grassetto** per due o tre parole chiave e righe che iniziano con "- " per un elenco breve; niente titoli, tabelle o altri simboli.'
        + '\n\nMODIFICARE I DATI DELL\'APP: hai strumenti per registrare o correggere pasti, sonno, peso, acqua, allenamenti, digiuno, integratori, note di diario e obiettivi, e per mettere in piano i pasti nel Menù (oggi e prossimi 7 giorni, rispettando memoria, allergie e obiettivi giornalieri). Usali quando l\'utente ti racconta un dato da registrare ("a pranzo ho mangiato...", "stanotte ho dormito dalle... alle...", "stamattina pesavo...") o ti chiede una modifica. '
        + 'Ogni modifica viene mostrata all\'utente in una finestra di conferma e si applica solo se approva: quindi scrivi SEMPRE anche una frase breve che dice cosa proponi, senza dire che è già fatto. Non usare gli strumenti per semplici domande o ipotesi, e non inventare dati che l\'utente non ha detto (per i pasti puoi stimare quantità e nutrienti). Se manca un\'informazione indispensabile, chiedila invece di usare lo strumento.'
        + '\n\nMEMORIA (cose stabili che l\'utente ti ha detto di sé; rispettale sempre, quelle a PRIORITÀ ALTA sono vincolanti):\n' + (memText || '(ancora vuota)')
        + (learn ? '\n\nAGGIORNARE LA MEMORIA: se nell\'ultimo messaggio l\'utente ti dice un fatto stabile su di sé che non è già in memoria e che serve per i consigli futuri (cibi esclusi o non graditi, intolleranze, orari, vincoli, infortuni, obiettivi, decisioni prese, come vuole che gli parli), aggiungi IN FONDO alla risposta, su una riga a parte, esattamente: [[MEMORIA: categoria | priorità | testo]]. '
          + 'categoria è una tra: obiettivi, alimentazione, allenamenti, routine, vincoli, coach, altro. priorità è alta (cibi da escludere, intolleranze, vincoli fisici o di salute, cose che non si possono mai ignorare) oppure normale. testo è una frase breve in terza persona, massimo 12 parole (es. "Non mangia latticini"). '
          + 'Non salvare cose passeggere (cosa ha mangiato oggi, umore del momento), né dati già presenti nell\'app (peso, pasti, sonno registrati). Al massimo 2 righe per risposta, e solo se servono davvero. Non nominare questo meccanismo.' : '');
      // All'IA vanno gli ultimi 30 messaggi: la cronologia completa resta a schermo
      let recent = next.slice(-30).map(m=>({ role:m.role, content:m.content }));
      while (recent.length && recent[0].role !== 'user') recent = recent.slice(1);
      // La foto va all'IA solo con il messaggio in cui è allegata
      const pm = photo && photo.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (pm && recent.length) recent[recent.length-1] = { role:'user', content:[{ type:'image', source:{ type:'base64', media_type:pm[1], data:pm[2] } }, { type:'text', text:q }] };
      const res = await aiFetch({ model:'claude-sonnet-4-6', max_tokens:1200, system, messages: recent, tools: COACH_TOOLS }, 'coach');
      if (!res.ok) { let d=''; try { const j=await res.json(); d=j?.error?.message||j?.error||''; } catch(_) {} if ([401,402,429].includes(res.status) && typeof d==='string' && d) { setErr(d); return; } throw new Error('HTTP '+res.status+(d?' '+(typeof d==='string'?d:JSON.stringify(d)):'')); }
      const data = await res.json();
      const uses = (data.content||[]).filter(c=>c.type==='tool_use');
      const plan = uses.length ? planActions(uses, { meals:props.meals||[], sleeps:props.sleeps||[], weights:props.weights||[], goal:props.goal, water:props.water||{}, workouts:props.workouts||[], workoutTypes:props.workoutTypes||[], fasts:props.fasts||[], supps:props.supps||[], taken:props.taken||{}, notes:props.notes||[], profile:props.profile, target:computeNutritionTarget(props.profile, props.weights, props.goal) }, mealRefs.current, newId) : null;
      const raw = (data.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n').trim() || (plan?.cards.length ? 'Ecco la modifica che ti propongo.' : (uses.length ? 'Non sono riuscito a preparare la modifica: mi ridici il dato con giorno e valori?' : ''));
      if (!raw) throw new Error('risposta vuota');
      // Il coach può chiudere la risposta con voci da salvare in memoria: le tolgo dal testo e le salvo
      const { clean, found } = extractMemoryTags(raw);
      let txt = clean || 'Fatto.';
      if (learn && found.length) {
        const notes = [];
        for (const f of found.slice(0, 2)) {
          const r = await addMemory({ ...f, source:'chat' });
          if (r && !r.error) notes.push('✓ aggiunto alla memoria: ' + r.content);
          else if (r?.error === 'memoria piena') notes.push('La memoria è piena (' + MEMORY_MAX + ' voci): non ho salvato "' + f.content + '". Puoi fare spazio dal menu, in Memoria del coach.');
        }
        if (notes.length) txt += '\n\n' + notes.join('\n');
      }
      if (plan && plan.cards.length) { setPending({ text:txt, cards:plan.cards, next:plan.next, labels:plan.labels }); return; }
      const reply = { id:newId(), role:'assistant', content:txt, ts:new Date().toISOString() };
      setMsgs(cur=>[...cur, reply]);
      persist(reply);
    } catch (e) {
      setErr('Il coach non ha risposto. Riprova tra poco. (' + (e?.message||'errore') + ')');
    } finally { setBusy(false); }
  }
  const chips = ['Come sta andando il mio peso?', 'Cosa mangio stasera?', 'Dove posso migliorare questa settimana?'];
  const tk = dayKey(new Date()), yk = dayKey(new Date(Date.now()-86400000));
  const dayLabel = k => k===tk ? 'oggi' : k===yk ? 'ieri' : parseDayKey(k).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});
  let lastDay = null;
  return (
    <NavShell T={T} kicker="vede i tuoi dati degli ultimi 30 giorni" title="Coach">
      <div style={{display:'flex',flexDirection:'column',gap:10,paddingBottom:120}}>
        {!ready && <Loading color={T.gold} />}
        {ready && msgs.length>0 && (
          <button onClick={newChat} style={{alignSelf:'flex-start',minHeight:44,padding:'0 16px',borderRadius:22,background:'transparent',border:`1px solid ${confirmNew?'#F0B9A0':`${T.cream}55`}`,color:confirmNew?'#F0B9A0':T.cream,fontFamily:fDmSans,fontSize:13,cursor:'pointer'}}>{confirmNew ? 'tocca ancora per cancellare la conversazione' : 'nuova conversazione'}</button>
        )}
        {ready && msgs.length===0 && (
          <div style={{...navCard(T),padding:'14px 16px',fontSize:15,lineHeight:1.5}}>Chiedimi del tuo peso, dei pasti o di cosa migliorare. Rispondo guardando quello che hai registrato nell'app, e la conversazione resta salvata. Le cose importanti che mi dici di te le tengo in memoria: le trovi nel menu, in Memoria del coach. Sono consigli generali: non sostituiscono medico o nutrizionista.</div>
        )}
        {msgs.map((m,i)=>{ const k = dayKey(new Date(m.ts||Date.now())); const sep = k!==lastDay; lastDay = k; return (
          <div key={m.id||i} style={{display:'flex',flexDirection:'column',gap:10}}>
            {sep && <div style={{alignSelf:'center',fontSize:11,letterSpacing:'0.14em',textTransform:'uppercase',opacity:0.7,fontWeight:600,padding:'6px 0 0'}}>{dayLabel(k)}</div>}
            <div style={{alignSelf:m.role==='user'?'flex-end':'flex-start',maxWidth:'86%',padding:'11px 14px',borderRadius:18,background:m.role==='user'?T.gold:`${T.cream}14`,border:m.role==='user'?'none':`1px solid ${T.gold}33`,color:m.role==='user'?T.bg2:T.cream,fontSize:15,lineHeight:1.45,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{imgs[m.id] && <img src={imgs[m.id]} alt="foto allegata" style={{display:'block',width:'100%',maxWidth:220,borderRadius:12,marginBottom:8}} />}{m.role==='user' ? m.content : <CoachText text={m.content} />}</div>
            {undo && undo.msgId===m.id && <button onClick={undoLast} disabled={applying} style={{alignSelf:'flex-start',minHeight:44,padding:'0 4px',background:'transparent',border:'none',color:T.gold,fontFamily:fDmSans,fontSize:13,textDecoration:'underline',textUnderlineOffset:3,cursor:'pointer'}}>{applying ? 'annullo…' : 'annulla la modifica'}</button>}
          </div>
        ); })}
        {busy && <div style={{alignSelf:'flex-start',padding:'11px 14px',borderRadius:18,background:`${T.cream}14`,fontSize:15,opacity:0.8}}>sto guardando i tuoi dati…</div>}
        {err && <div style={{fontSize:13,color:'#F0B9A0'}}>{err}</div>}
        {ready && msgs.length===0 && (
          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:6}}>
            {chips.map(c=>(<button key={c} onClick={()=>send(c)} disabled={busy||!props.loaded} style={{minHeight:46,padding:'0 16px',borderRadius:23,background:'transparent',border:`1px solid ${T.gold}`,color:T.cream,fontFamily:fDmSans,fontSize:14,textAlign:'left',cursor:'pointer'}}>{c}</button>))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      {pending && (
        <NavModal onClose={()=>decide(false)} title={pending.cards.length>1 ? `Applico ${pending.cards.length} modifiche?` : pending.cards[0].title + '?'} sub={pending.cards.length>1 ? 'proposte dal coach' : pending.cards[0].sub}>
          {pending.cards.map((cd,ci)=>(
            <div key={ci} style={{display:'flex',flexDirection:'column'}}>
              {pending.cards.length>1 && <div style={{fontSize:12,letterSpacing:'0.1em',textTransform:'uppercase',color:cd.danger?C_SAL:C_GOLD,fontWeight:600,paddingTop:4}}>{cd.title} · {cd.sub}</div>}
              {cd.rows.map((r,ri)=>(
                <div key={ri} style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12,padding:'11px 0',borderBottom:`1px solid ${C_CREAM}26`}}>
                  <span style={{fontSize:13,opacity:0.75,flexShrink:0}}>{r.l}</span>
                  <span style={{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap',justifyContent:'flex-end',minWidth:0}}>
                    {r.a!=null && <span style={{fontSize:14,opacity:0.6,textDecoration:'line-through'}}>{r.a}</span>}
                    <span style={{fontFamily:fGaramond,fontSize:21,fontWeight:600,lineHeight:1.15,textAlign:'right',wordBreak:'break-word',color:cd.danger?C_SAL:C_CREAM}}>{r.b}</span>
                  </span>
                </div>
              ))}
              {cd.note && <span style={{fontSize:13,opacity:0.75,lineHeight:1.4,paddingTop:10}}>{cd.note}</span>}
            </div>
          ))}
          <div style={{display:'flex',gap:8,paddingTop:4}}>
            <button onClick={()=>decide(false)} disabled={applying} style={pillBtn('o')}>annulla</button>
            <button onClick={()=>decide(true)} disabled={applying} style={{...pillBtn('p'),flex:1}}>{applying ? 'applico…' : 'applica'}</button>
          </div>
        </NavModal>
      )}
      <div style={{position:'fixed',left:0,right:0,bottom:0,zIndex:40,padding:'22px 16px calc(98px + env(safe-area-inset-bottom, 0px))',background:`linear-gradient(180deg, ${T.bg2}00 0px, ${T.bg2} 22px)`,pointerEvents:'none'}}>
        <div style={{pointerEvents:'auto'}}>
        <input ref={photoRef} type="file" accept="image/*" onChange={pickAttach} style={{display:'none'}} />
        {attach && (
          <div style={{maxWidth:448,margin:'0 auto 8px',display:'flex',alignItems:'center',gap:10,background:T.bg2,border:`1px solid ${T.gold}80`,borderRadius:18,padding:6}}>
            <img src={attach} alt="foto da inviare" style={{width:52,height:52,borderRadius:12,objectFit:'cover'}} />
            <span style={{flex:1,fontSize:13,opacity:0.8}}>foto pronta: scrivi la domanda o invia</span>
            <button onClick={()=>setAttach(null)} aria-label="togli la foto" style={{width:44,height:44,borderRadius:'50%',background:'transparent',border:'none',color:T.cream,fontSize:20,cursor:'pointer'}}>×</button>
          </div>
        )}
        <div style={{maxWidth:448,margin:'0 auto',display:'flex',alignItems:'center',gap:2,background:T.bg2,border:`1px solid ${T.gold}80`,borderRadius:26,padding:4,boxShadow:'0 4px 16px rgba(0,0,0,0.25)'}}>
          <button onClick={()=>photoRef.current?.click()} disabled={busy} aria-label="allega una foto" style={{width:44,height:44,borderRadius:'50%',background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,padding:0}}>
            <ImagePlus size={21} strokeWidth={1.8} color={T.gold} />
          </button>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') send(); }} placeholder={listening ? 'ti ascolto…' : 'Scrivi al coach…'} aria-label="Scrivi al coach"
            style={{flex:1,minWidth:0,border:'none',background:'transparent',fontFamily:fDmSans,fontSize:16,color:T.cream,outline:'none',height:44}} />
          {SR && <button onClick={toggleMic} disabled={busy} aria-label={listening ? 'ferma la dettatura' : 'detta il messaggio'} aria-pressed={listening} style={{width:44,height:44,borderRadius:'50%',background:listening?'#F0B9A0':'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,padding:0}}>
            <Mic size={20} strokeWidth={1.9} color={listening?T.bg2:T.gold} />
          </button>}
          <button onClick={()=>send()} disabled={busy||(!input.trim()&&!attach)||!props.loaded} aria-label="Invia" style={{width:44,height:44,borderRadius:'50%',background:T.gold,border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,opacity:(busy||(!input.trim()&&!attach))?0.5:1}}>
            <Send size={19} strokeWidth={2.2} color={T.bg2} />
          </button>
        </div>
        </div>
      </div>
    </NavShell>
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

function PesoPage({ theme, loaded, weights, goal, updWeights, updGoal, meals, updMeals, openStats, profile, openSub }){
  // Tema dinamico: shadowing del Q globale del modulo per usare il tema attivo
  const Q = theme || { bg1: '#3A2818', bg2: '#1F140C', gold: '#C9A876', goldDim: '#8B7355', cream: '#E8D8B8', ink: '#1F140C' };
  const isDashboard = Q.structuralVariant === 'dashboard';
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

  // --- Render nuovo stile: anello verso l'obiettivo, percorso a tappe, grafico, composizione, pesate ---
  const T = Q;
  const fTitle = T.fontText || fGaramond;
  const start = sorted[0] || null;
  const goalN = goal != null ? Number(goal) : null;
  const losing = start && goalN != null ? goalN <= start.weight : true;
  const total = start && goalN != null ? Math.abs(start.weight - goalN) : 0;
  const done = start && latest ? (losing ? start.weight - latest.weight : latest.weight - start.weight) : 0;
  const ringP = total > 0 ? done / total : 0;
  const remaining = latest && goalN != null ? Math.abs(latest.weight - goalN) : null;
  const goalReached = latest && goalN != null && (losing ? latest.weight <= goalN + 0.05 : latest.weight >= goalN - 0.05);
  const changeIn = (days) => { if (!latest) return null; const cut = Date.now() - days*86400000; const base = [...sorted].reverse().find(e => new Date(e.ts).getTime() <= cut) || sorted.find(e => new Date(e.ts).getTime() > cut); return base && base.id !== latest.id ? latest.weight - base.weight : null; };
  const sgn = (v) => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;
  const dShort = (ts) => new Date(ts).toLocaleDateString('it-IT',{day:'numeric',month:'short'});
  // Tappe automatiche ogni 2 kg tra partenza e obiettivo
  const STEP_KG = 2;
  const tappe = [];
  if (start && goalN != null && total > STEP_KG) {
    for (let k = 1; k * STEP_KG < total - 0.01; k++) {
      const w = losing ? start.weight - k*STEP_KG : start.weight + k*STEP_KG;
      const hit = sorted.find(e => losing ? e.weight <= w : e.weight >= w);
      tappe.push({ k, w, hit });
    }
  }
  const reached = tappe.filter(t => t.hit);
  const nextT = tappe.find(t => !t.hit);
  const latestComp = [...sorted].reverse().find(e => e.bodyFat != null || e.muscle != null || e.water != null);
  const recent = [...sorted].reverse();
  const openGoal = () => { setDraftGoal(goal ? String(goal).replace('.',',') : ''); setShowGoal(true); };
  const kicker = !latest ? 'inizia dalla prima pesata' : goalN == null ? 'imposta il tuo obiettivo' : goalReached ? 'obiettivo raggiunto' : `${done > 0.05 ? `${losing ? 'persi' : 'presi'} ${fmt(done)} kg · ` : ''}ne mancano ${fmt(remaining)}`;
  return (
    <div>
    <NavShell T={T} kicker={kicker} title="Peso">
      {!loaded && <Loading color={T.gold} />}
      {loaded && weights.length===0 && (
        <div style={{display:'flex',flexDirection:'column',gap:16,alignItems:'center',paddingTop:30,textAlign:'center'}}>
          <div style={{fontFamily:fTitle,fontSize:26}}>Non hai ancora pesate.</div>
          <div style={{fontSize:14,opacity:0.75,lineHeight:1.5,maxWidth:280}}>Registra la prima: da lì parte il tuo percorso.</div>
          <button onClick={openNew} style={navBtn(T)}>registra il peso</button>
          <button onClick={openGoal} style={navBtn(T,false)}>{goalN!=null?`obiettivo ${fmt(goalN)} kg · modifica`:'imposta obiettivo'}</button>
        </div>
      )}
      {loaded && weights.length>0 && (<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <NavRing T={T} p={goalN!=null ? ringP : 0}>
          <span style={{fontSize:13,opacity:0.75}}>{todayEntries.length>0 ? 'oggi' : `ultima pesata · ${dShort(latest.ts)}`}</span>
          <span style={{fontFamily:fTitle,fontSize:64,fontWeight:500,lineHeight:1}}>{fmt(todayAvg ?? latest.weight)}</span>
          <button onClick={openGoal} style={{background:'transparent',border:'none',color:T.cream,fontFamily:fDmSans,fontSize:13,opacity:0.85,cursor:'pointer',padding:'6px 10px',textDecoration:'underline',textUnderlineOffset:3}}>{goalN!=null ? `kg · obiettivo ${fmt(goalN)}` : 'kg · imposta obiettivo'}</button>
        </NavRing>
        {quality && <div style={{alignSelf:'center',background:T.gold,color:T.bg2,fontSize:13,fontWeight:600,padding:'6px 14px',borderRadius:14,textAlign:'center'}}>{quality.label}</div>}
        <button onClick={openNew} style={navBtn(T)}>registra il peso</button>
        <div style={{paddingTop:6}}>
          <NavStep T={T} time={dShort(start.ts)} title={`Partenza · ${fmt(start.weight)} kg`} state="done" />
          {reached.slice(-2).map(t => (
            <NavStep key={t.k} T={T} time={dShort(t.hit.ts)} title={`Primi ${t.k*STEP_KG} kg`} desc={`${fmt(t.w)} kg raggiunti`} state="done" />
          ))}
          <NavStep T={T} time="adesso" title={`Oggi · ${fmt(latest.weight)} kg`} desc={rate ? `ritmo ${sgn(rate.perWeek)} kg a settimana` : 'servono più pesate per calcolare il ritmo'} state="now" last={goalN==null} />
          {!goalReached && nextT && <NavStep T={T} time="" title={`Prossima tappa · ${fmt(nextT.w)} kg`} desc={`mancano ${fmt(Math.abs(latest.weight - nextT.w))} kg`} state="todo" />}
          {goalN!=null && <NavStep T={T} time={goalReached ? '' : eta?.date ? eta.date.toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'}) : ''} title={`Obiettivo · ${fmt(goalN)} kg`} desc={goalReached ? 'raggiunto' : eta?.stalled ? 'al ritmo attuale non lo raggiungi' : eta?.date ? `data stimata, tra circa ${eta.weeks} settimane` : ''} state={goalReached ? 'done' : 'todo'} last />}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gap:6}}>
          {[[7,'7 giorni'],[30,'30 giorni'],[365,'1 anno']].map(([d,l])=>(<button key={d} onClick={()=>setPeriod(d)} style={navChip(T, period===d)}>{l}</button>))}
        </div>
        {points.length>1 ? (
          <svg viewBox="0 0 280 70" role="img" aria-label="Andamento del peso" style={{width:'100%',height:'auto',display:'block'}}>
            <path d={area} fill={T.gold} fillOpacity="0.12" />
            <path d={path} fill="none" stroke={T.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="4.5" fill={T.cream} />
          </svg>
        ) : <div style={{fontSize:13,opacity:0.7,textAlign:'center',padding:'10px 0'}}>Servono almeno due pesate in questo periodo per disegnare il grafico.</div>}
        <NavStats T={T} items={[[sgn(changeIn(7)),'kg · settimana'],[sgn(changeIn(30)),'kg · mese'],[sgn(totalDelta),'kg · in totale']]} />
        {latestComp && <NavStats T={T} items={[[latestComp.bodyFat!=null?`${fmt(latestComp.bodyFat)}%`:'—','grasso'],[latestComp.muscle!=null?`${fmt(latestComp.muscle)}%`:'—','muscolo'],[latestComp.water!=null?`${fmt(latestComp.water)}%`:'—','acqua']]} />}
        <div>
          <div style={navKicker}>pesate · tocca per correggere</div>
          {(showAllPhotos ? recent : recent.slice(0,5)).map(e => (
            <button key={e.id} onClick={()=>openEdit(e)} style={{display:'flex',alignItems:'baseline',gap:12,padding:'11px 2px',minHeight:44,width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${T.cream}22`,color:T.cream,fontFamily:fDmSans,cursor:'pointer',textAlign:'left'}}>
              <span style={{fontSize:13,fontWeight:700,width:64,flexShrink:0}}>{sameDay(new Date(e.ts),new Date()) ? 'oggi' : dShort(e.ts)}</span>
              <span style={{flex:1,fontSize:15}}>{fmt(e.weight)} kg{e.bodyFat!=null?` · grasso ${fmt(e.bodyFat)}%`:''}</span>
              <span style={{fontSize:13,opacity:0.7}}>{new Date(e.ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})} ›</span>
            </button>
          ))}
          {recent.length>5 && <button onClick={()=>setShowAllPhotos(!showAllPhotos)} style={{...navBtn(T,false),marginTop:12}}>{showAllPhotos ? 'mostra meno' : `mostra tutte (${recent.length})`}</button>}
        </div>
      </div>)}
    </NavShell>

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
          {error && <span style={{color:C_SAL,fontSize:13}}>{error}</span>}
          <span style={{fontSize:12,color:C_GOLD,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase'}}>dalla bilancia · facoltativi</span>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gap:12}}>
            <NavField label="grasso" unit="%" size={22} type="text" inputMode="decimal" value={draft.bf} onChange={e=>setDraft({...draft,bf:e.target.value})} placeholder="22,5" />
            <NavField label="muscolo" unit="%" size={22} type="text" inputMode="decimal" value={draft.mu} onChange={e=>setDraft({...draft,mu:e.target.value})} placeholder="38,1" />
            <NavField label="acqua" unit="%" size={22} type="text" inputMode="decimal" value={draft.wa} onChange={e=>setDraft({...draft,wa:e.target.value})} placeholder="56,3" />
          </div>
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
      <div style={{fontFamily:fDmSans,fontSize:12,color:Q.cream,opacity:0.75,marginBottom:4}}>{label}</div>
      <input type="text" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${Q.gold}66`,color:Q.cream,fontFamily:fGaramond,fontSize:22,padding:'4px 0',outline:'none',textAlign:'center'}} />
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

function PastiPage({ user, theme, loaded, meals, updMeals, notes, weights, goal, profile, seedPhotoInit, clearSeedPhoto }){
  // Tema dinamico: shadowing del J globale del modulo
  const J = theme || { bg: '#E5E3D5', dark: '#2D3A2E', sage: '#5C6B4E', light: '#8FA288' };
  const [selectedDay, setSelectedDay] = useState(dayKey(new Date()));
  const [editing, setEditing] = useState(null);
  // Foto pre-caricata da bottone top-level "IA da foto": viene passata al MealModal che la analizza in automatico
  const [photoIaSeed, setPhotoIaSeed] = useState(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const photoIaRef = useRef(null);
  // Foto scattata dalla pagina Foto (barra in basso): apre subito il MealModal con la foto pronta
  useEffect(() => {
    if (!seedPhotoInit) return;
    if (seedPhotoInit !== 'manual') quickPhotoMeal(seedPhotoInit);
    else setEditing('new');
    clearSeedPhoto && clearSeedPhoto();
  }, [seedPhotoInit]);
  // Pasto da sola foto: l'IA riconosce piatto, quantità e nutrienti, il tipo di pasto viene dall'ora.
  // Si salva da solo, senza aprire la scheda; resta modificabile toccandolo.
  const mealsRef = useRef(meals);
  mealsRef.current = meals;
  const [quickBusy, setQuickBusy] = useState(false);
  async function quickPhotoMeal(b64){
    setQuickBusy(true);
    try {
      const now = new Date();
      setSelectedDay(dayKey(now));
      const r = await estimateMealNutrition({ description: '', qty_g: null, photo: b64 });
      if (!r || r.error) {
        // Analisi non riuscita: apro la scheda con la foto, cosi' si puo' completare a mano
        setPhotoIaSeed(b64);
        setEditing('new');
        return;
      }
      const mealId = newId();
      const meal = { id: mealId, ts: now.toISOString(), status: 'eaten', type: mealTypeFromHour(now),
        description: r.name || '', qty_g: r.qty_g ?? null, kcal: r.kcal ?? null, p: r.p ?? null, c: r.c ?? null, g: r.g ?? null,
        photo: b64, photo_url: null };
      if (user?.id) {
        try { meal.photo_url = await uploadMealPhotoToStorage(user.id, mealId, b64); meal.photo = null; }
        catch (err) { console.warn('[quickPhotoMeal] upload Storage fallito, fallback base64', err); }
      }
      await updMeals([...mealsRef.current, meal]);
    } finally {
      setQuickBusy(false);
    }
  }
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
      setPreparingPhoto(false);
      await quickPhotoMeal(b64);
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

  // --- Render "Il tuo piatto": giorni, copertina, miniature, calorie e nutrienti ---
  const fTitle = J.fontText || fGaramond;
  const last7 = Array.from({length:7},(_,k)=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-(6-k)); return d; });
  const byTime = [...eatenMeals].sort((x,y)=>new Date(x.ts)-new Date(y.ts));
  const hero = [...byTime].reverse().find(m=>m.photo_url||m.photo) || null;
  const tg = computeNutritionTarget(profile, weights, goal);
  const hhmm = ts => new Date(ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  const typeName = m => MEAL_TYPES.find(t=>t.id===m.type)?.name || 'Pasto';
  const missing = eatenMeals.filter(m => { const hasPhoto=!!(m.photo||m.photo_url); const hasDesc=(m.description||'').trim().length>0; if (hasPhoto && (!hasDesc || m.qty_g==null || m.kcal==null)) return true; if (!hasPhoto && hasDesc && m.kcal==null) return true; return false; });
  const macro = (lab,val,tot) => (
    <div key={lab} style={{display:'flex',flexDirection:'column',gap:4}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{opacity:0.75}}>{lab}</span><span style={{fontWeight:700}}>{fmt0(val)} g</span></div>
      <div style={{height:8,borderRadius:4,background:`${J.cream}22`}}><div style={{width:`${Math.min(100, tot ? Math.round(val/tot*100) : 0)}%`,height:8,borderRadius:4,background:J.gold}} /></div>
      <div style={{fontSize:11,opacity:0.6}}>su {fmt0(tot)} g</div>
    </div>
  );
  return (
    <NavShell T={J} kicker={isToday ? 'pasti di oggi' : dateLabel} title="Il tuo piatto">
      <input ref={photoIaRef} type="file" accept="image/*" onChange={onPhotoIaPick} style={{display:'none'}} />
      {!loaded && <Loading color={J.gold} />}
      {quickBusy && <div style={{marginBottom:14,padding:'14px 18px',borderRadius:18,border:`1px solid ${J.gold}`,background:`${J.cream}0D`,color:J.cream,fontFamily:fDmSans,fontSize:14,textAlign:'center'}}>analizzo la foto e registro il pasto…</div>}
      {loaded && (<div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:4}}>
          {last7.map(d=>{ const k=dayKey(d); const on=k===selectedDay; return (
            <button key={k} onClick={()=>setSelectedDay(k)} style={{flex:'1 1 0',maxWidth:48,height:56,borderRadius:14,border:`1px solid ${on?J.gold:`${J.cream}33`}`,background:on?J.gold:'transparent',color:on?J.bg2:J.cream,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,cursor:'pointer',padding:0,fontFamily:fDmSans}}>
              <span style={{fontSize:11}}>{d.toLocaleDateString('it-IT',{weekday:'short'}).replace('.','')}</span>
              <span style={{fontSize:16,fontWeight:700}}>{d.getDate()}</span>
            </button>
          ); })}
        </div>
        {hero ? (
          <button onClick={()=>setEditing(hero.id)} style={{position:'relative',display:'block',width:'100%',padding:0,border:'none',background:'transparent',cursor:'pointer',borderRadius:24,overflow:'hidden'}}>
            <img src={hero.photo_url||hero.photo} alt="" style={{width:'100%',height:270,objectFit:'cover',display:'block'}} />
            <span style={{position:'absolute',left:14,bottom:14,background:'rgba(8,18,36,0.8)',color:'#F4EFE2',padding:'8px 14px',borderRadius:14,textAlign:'left',maxWidth:'80%',display:'flex',flexDirection:'column'}}>
              <span style={{fontFamily:fTitle,fontSize:22,lineHeight:1.15}}>{hero.description || typeName(hero)}</span>
              <span style={{fontFamily:fDmSans,fontSize:12}}>{hhmm(hero.ts)}{hero.kcal!=null?` · ${fmt0(hero.kcal)} kcal`:''}</span>
            </span>
          </button>
        ) : (
          <button onClick={()=>photoIaRef.current?.click()} disabled={preparingPhoto||quickBusy} style={{width:'100%',height:200,borderRadius:24,border:`1px dashed ${J.gold}`,background:`${J.cream}0D`,color:J.cream,fontFamily:fDmSans,fontSize:15,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10}}>
            <Camera size={30} strokeWidth={1.8} color={J.gold} />
            {preparingPhoto ? 'preparo la foto…' : 'Fotografa il primo pasto del giorno'}
          </button>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:8}}>
          {byTime.map(m=>(
            <button key={m.id} onClick={()=>setEditing(m.id)} aria-label={`${typeName(m)} delle ${hhmm(m.ts)}`} style={{padding:0,border:'none',background:'transparent',cursor:'pointer',display:'flex',flexDirection:'column',gap:4,color:J.cream,fontFamily:fDmSans}}>
              {(m.photo_url||m.photo)
                ? <img src={m.photo_url||m.photo} alt="" loading="lazy" style={{width:'100%',aspectRatio:'1 / 1',objectFit:'cover',borderRadius:12,display:'block',border:hero&&hero.id===m.id?`2px solid ${J.gold}`:'2px solid transparent',boxSizing:'border-box'}} />
                : <span style={{width:'100%',aspectRatio:'1 / 1',borderRadius:12,border:`1px solid ${J.gold}66`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,boxSizing:'border-box'}}>{MEAL_TYPES.find(t=>t.id===m.type)?.abbr || '·'}</span>}
              <span style={{fontSize:11,opacity:0.75,textAlign:'center'}}>{hhmm(m.ts)}</span>
            </button>
          ))}
          <button onClick={()=>photoIaRef.current?.click()} disabled={preparingPhoto} aria-label="aggiungi un pasto con foto" style={{padding:0,border:'none',background:'transparent',cursor:'pointer',display:'flex',flexDirection:'column',gap:4,color:J.cream,fontFamily:fDmSans}}>
            <span style={{width:'100%',aspectRatio:'1 / 1',borderRadius:12,border:`1px dashed ${J.gold}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,color:J.gold,boxSizing:'border-box'}}>+</span>
            <span style={{fontSize:11,opacity:0.75,textAlign:'center'}}>{preparingPhoto?'…':'aggiungi'}</span>
          </button>
        </div>
        <div style={{...navCard(J),borderRadius:20,padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
            <span style={{fontFamily:fTitle,fontSize:32,lineHeight:1}}>{fmt0(totals.kcal)} kcal</span>
            <span style={{fontSize:12,opacity:0.75}}>su {fmt0(tg.kcal)} {isToday?'di oggi':'del giorno'}</span>
          </div>
          <div style={{height:10,borderRadius:5,background:`${J.cream}22`}}><div style={{width:`${Math.min(100, tg.kcal ? Math.round(totals.kcal/tg.kcal*100) : 0)}%`,height:10,borderRadius:5,background:totals.kcal>tg.kcal?(J.danger||'#C99A7A'):J.cream}} /></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gap:12}}>
            {macro('proteine',totals.p,tg.protein)}{macro('carboidrati',totals.c,tg.carbs)}{macro('grassi',totals.g,tg.fat)}
          </div>
        </div>
        {byTime.length>0 && (
          <div style={{display:'flex',flexDirection:'column'}}>
            {byTime.map(m=>(
              <button key={m.id} onClick={()=>setEditing(m.id)} style={{display:'flex',alignItems:'baseline',gap:12,padding:'11px 2px',minHeight:44,background:'transparent',border:'none',borderBottom:`1px solid ${J.cream}22`,color:J.cream,fontFamily:fDmSans,cursor:'pointer',textAlign:'left',width:'100%'}}>
                <span style={{fontSize:13,fontWeight:700,width:42,flexShrink:0}}>{hhmm(m.ts)}</span>
                <span style={{flex:1,minWidth:0,fontSize:15,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.description || typeName(m)}</span>
                <span style={{fontSize:13,opacity:0.75,whiteSpace:'nowrap'}}>{m.kcal!=null?`${fmt0(m.kcal)} kcal`:'—'}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {(missing.length>0 || bulkEstimating) && (
            <button onClick={bulkEstimateNutrients} disabled={bulkEstimating} style={{minHeight:46,borderRadius:23,background:J.gold,border:`1px solid ${J.gold}`,color:J.bg2,fontFamily:fDmSans,fontSize:14,fontWeight:700,cursor:'pointer'}}>
              {bulkEstimating ? `analizzo… ${bulkProgress.done}/${bulkProgress.total}` : `calcola calorie di ${missing.length} ${missing.length===1?'pasto':'pasti'} con l'IA`}
            </button>
          )}
          {bulkError && <div style={{fontSize:13,color:J.danger||'#C99A7A'}}>{bulkError}</div>}
          <button onClick={()=>setEditing('new')} style={{minHeight:46,borderRadius:23,background:'transparent',border:`1px solid ${J.cream}55`,color:J.cream,fontFamily:fDmSans,fontSize:14,cursor:'pointer'}}>aggiungi un pasto senza foto</button>
        </div>
      </div>)}
      {editing && <MealModal J={J} existing={editingMeal} seedPhoto={editing==='new'?photoIaSeed:null} onClose={()=>{setEditing(null); setPhotoIaSeed(null);}} onSave={saveMeal} onDelete={editing!=='new'?delMeal:null} />}
    </NavShell>
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
  const isDashboard = J?.structuralVariant === 'dashboard';
  const iaColor = isDashboard ? '#3F95A1' : '#C8763C';
  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [previousSuggested, setPreviousSuggested] = useState([]);
  // Modal di modifica target nutrizionali
  const [editingTargets, setEditingTargets] = useState(false);

  // Target giornalieri di kcal e macronutrienti (Zona 40/30/30 per dimagrimento)
  const target = useMemo(() => computeNutritionTarget(profile, weights, goal), [profile, weights, goal]);

  // Pasti pianificati di OGGI (mostrati nella sezione "il mio menù")
  const todayK = dayKey(new Date());
  const plannedMeals = useMemo(() =>
    (meals||[]).filter(m => m.status === 'planned' && sameDay(new Date(m.ts), new Date())),
    [meals]
  );
  // Tutti i pasti di OGGI (planned + eaten), usati per i totali della giornata.
  // Così i pasti registrati come "mangiati" in Pasti contribuiscono al progresso del menù,
  // e i pasti pianificati che vengono poi marcati "mangiati" NON spariscono dal totale.
  const todayMeals = useMemo(() =>
    (meals||[]).filter(m => sameDay(new Date(m.ts), new Date())),
    [meals]
  );

  // Totali correnti dalla giornata (pianificato + consumato)
  const totals = useMemo(() => todayMeals.reduce((acc, m) => ({
    kcal: acc.kcal + (m.kcal||0),
    protein: acc.protein + (m.p||0),
    carbs: acc.carbs + (m.c||0),
    fat: acc.fat + (m.g||0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [todayMeals]);

  // Breakdown per la riga informativa
  const eatenKcal = useMemo(() => todayMeals.filter(m => m.status === 'eaten').reduce((a,m) => a + (m.kcal||0), 0), [todayMeals]);
  const plannedKcal = useMemo(() => todayMeals.filter(m => m.status === 'planned').reduce((a,m) => a + (m.kcal||0), 0), [todayMeals]);

  const targetReached = totals.kcal >= target.kcal * 0.95 && totals.kcal <= target.kcal * 1.05;

  async function loadSuggestions(){
    setSuggestLoading(true); setSuggestError('');
    try {
      // Costruisco un summary arricchito con target Zona + macro residui, così l'IA propone pasti che chiudono il gap
      const summary = buildEatingHabitsSummary({ meals, weights, goal })
        + `\n\nTARGET ODIERNO (Dieta a Zona 40/30/30 per dimagrimento):\n`
        + `- Calorie: ${target.kcal} kcal · Proteine: ${target.protein}g · Carb: ${target.carbs}g · Grassi: ${target.fat}g\n`
        + `MENU DI OGGI (consumato + pianificato):\n`
        + `- Calorie: ${totals.kcal}/${target.kcal} kcal (${eatenKcal} mangiate, ${plannedKcal} in piano) · Proteine: ${totals.protein}/${target.protein}g · Carb: ${totals.carbs}/${target.carbs}g · Grassi: ${totals.fat}/${target.fat}g\n`
        + `RESIDUI DA COPRIRE: ${Math.max(0,target.kcal-totals.kcal)} kcal · ${Math.max(0,target.protein-totals.protein)}g P · ${Math.max(0,target.carbs-totals.carbs)}g C · ${Math.max(0,target.fat-totals.fat)}g G\n\n`
        + `LINEE GUIDA per i suggerimenti:\n`
        + `- Proponi solo alimenti che favoriscono il dimagrimento (alta sazietà, indice glicemico basso/medio, ricchi di nutrienti).\n`
        + `- PRIVILEGIA: pesce azzurro/magro, carni bianche magre, uova, legumi, verdure di stagione, frutti di bosco, agrumi, mela, pera, frutta secca a porzioni controllate, cereali integrali (avena, farro, quinoa, riso integrale), latticini magri (greco, ricotta), olio extravergine.\n`
        + `- EVITA: zuccheri raffinati, dolci industriali, bibite zuccherate, alcolici, fritti, salumi grassi, pane bianco, pasta raffinata in eccesso, succhi confezionati.\n`
        + `- Bilancia ogni piatto verso la Zona 40/30/30 quando possibile (in particolare il pranzo e la cena).\n`
        + `- Dai precedenza ai macro residui (se mancano molte proteine, proponi pasti proteici; se mancano carb, proponi cereali integrali; ecc.).\n`;
      const memMenu = memoryToText(await loadMemory());
      const r = await suggestMeals(summary + (memMenu ? `\nCOSE DA RICORDARE SULL'UTENTE (rispettale sempre; quelle a PRIORITÀ ALTA sono vincolanti, es. cibi esclusi):\n${memMenu}\n` : ''), previousSuggested);
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

  // --- Render nuovo stile: piatto a zona (ciambella), pasti a schede o a linea del giorno, proposte IA ---
  const T = J;
  const fTitle = T.fontText || fGaramond;
  const [view, setView] = useState(()=>{ try { return localStorage.getItem('goalfit_menu_view')==='linea' ? 'linea' : 'schede'; } catch(_) { return 'schede'; } });
  const pickView = v => { setView(v); try { localStorage.setItem('goalfit_menu_view', v); } catch(_) {} };
  const ord = m => MEAL_TYPES.find(t=>t.id===m.type)?.order ?? 99;
  const dayList = [...todayMeals].sort((a,b)=> ord(a)-ord(b) || new Date(a.ts)-new Date(b.ts));
  const firstPlanned = dayList.find(m=>m.status==='planned');
  const typeName = m => MEAL_TYPES.find(t=>t.id===m.type)?.name || 'Pasto';
  const macroLine = m => `${m.qty_g?`${fmt0(m.qty_g)} g · `:''}${fmt0(m.kcal)} kcal · P ${fmt0(m.p)} · C ${fmt0(m.c)} · G ${fmt0(m.g)}`;
  const frac = (a,b) => b > 0 ? Math.min(1, a/b) : 0;
  const segs = [
    { share:0.30, p:frac(totals.protein,target.protein), op:1,    label:'proteine',    cur:totals.protein, tot:target.protein },
    { share:0.40, p:frac(totals.carbs,target.carbs),     op:0.7,  label:'carboidrati', cur:totals.carbs,   tot:target.carbs },
    { share:0.30, p:frac(totals.fat,target.fat),         op:0.45, label:'grassi',      cur:totals.fat,     tot:target.fat },
  ];
  const DS=240, DW=30, DR=(DS-DW)/2, DC=2*Math.PI*DR, DH=DS/2, GAP=6;
  let acc = 0;
  const arcs = segs.map((g,i)=>{ const off = acc; acc += g.share; const len = DC*g.share - GAP; return (
    <g key={i} transform={`rotate(-90 ${DH} ${DH})`}>
      <circle cx={DH} cy={DH} r={DR} stroke={`${T.cream}1F`} strokeWidth={DW} strokeDasharray={`${len} ${DC}`} strokeDashoffset={-DC*off} />
      <circle cx={DH} cy={DH} r={DR} stroke={T.gold} strokeOpacity={g.op} strokeWidth={DW} strokeDasharray={`${len*g.p} ${DC}`} strokeDashoffset={-DC*off} />
    </g>
  ); });
  const seg = (id,label) => (<button onClick={()=>pickView(id)} style={{flex:1,minHeight:44,borderRadius:22,border:'none',background:view===id?T.gold:'transparent',color:view===id?T.bg2:T.cream,fontFamily:fDmSans,fontSize:14,fontWeight:600,cursor:'pointer'}}>{label}</button>);
  const cardSt = { background:'#142A4C', border:'1px solid #34506F', borderRadius:22, padding:'16px 18px', display:'flex', flexDirection:'column', gap:8 };
  const tag = { fontSize:12, color:T.gold, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' };
  return (
    <div>
    <NavShell T={T} kicker="il tuo piatto a zona" title="Menù">
      {!loaded && <Loading color={T.gold} />}
      {loaded && (<div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{position:'relative',width:DS,height:DS,margin:'0 auto'}}>
          <svg width={DS} height={DS} viewBox={`0 0 ${DS} ${DS}`} fill="none" role="img" aria-label="Piatto a zona: proteine, carboidrati e grassi rispetto all'obiettivo">{arcs}</svg>
          <button onClick={()=>setEditingTargets(true)} aria-label="modifica obiettivi del giorno" style={{position:'absolute',inset:DW+6,borderRadius:'50%',background:'transparent',border:'none',color:T.cream,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,padding:0}}>
            <span style={{fontFamily:fTitle,fontSize:46,fontWeight:500,lineHeight:1}}>{fmt0(totals.kcal)}</span>
            <span style={{fontFamily:fDmSans,fontSize:13,opacity:0.8}}>di {fmt0(target.kcal)} kcal</span>
            <span style={{fontFamily:fDmSans,fontSize:11,opacity:0.7,textDecoration:'underline',textUnderlineOffset:3,marginTop:4}}>modifica obiettivi</span>
          </button>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
          {segs.map(g=>(
            <div key={g.label} style={{display:'flex',alignItems:'center',gap:7,minWidth:0}}>
              <span style={{width:14,height:14,borderRadius:4,background:T.gold,opacity:g.op,flexShrink:0}} />
              <span style={{fontSize:12,lineHeight:1.25}}>{g.label}<br/><b>{fmt0(g.cur)}</b> di {fmt0(g.tot)} g</span>
            </div>
          ))}
        </div>
        {(eatenKcal > 0 || plannedKcal > 0) && <div style={{fontSize:13,opacity:0.75,textAlign:'center'}}>{fmt0(eatenKcal)} kcal mangiate · {fmt0(plannedKcal)} in piano</div>}
        {targetReached && <div style={{alignSelf:'center',background:T.gold,color:T.bg2,fontSize:13,fontWeight:600,padding:'6px 14px',borderRadius:14}}>obiettivo del giorno raggiunto</div>}
        <div style={{background:'#142A4C',border:'1px solid #34506F',borderRadius:26,padding:4,display:'flex',gap:4}}>{seg('schede','schede')}{seg('linea','linea del giorno')}</div>
        {dayList.length === 0 && <div style={{textAlign:'center',fontSize:14,opacity:0.75,lineHeight:1.5,padding:'6px 10px'}}>Ancora nessun pasto per oggi. Chiedi una proposta all'IA e aggiungila al menù.</div>}
        {view==='schede' && dayList.map(m => (
          <div key={m.id} style={cardSt}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}><span style={tag}>{typeName(m)}</span><span style={{fontSize:12,opacity:0.75}}>{m.status==='planned' ? 'in piano' : 'mangiato'}</span></div>
            <span style={{fontFamily:fTitle,fontSize:24,fontWeight:500,lineHeight:1.15}}>{m.description || '(senza descrizione)'}</span>
            <span style={{fontSize:13,opacity:0.75}}>{macroLine(m)}</span>
            {m.status==='planned' && (
              <div style={{display:'flex',gap:8,marginTop:4}}>
                <button onClick={()=>markAsEaten(m.id)} style={{...navBtn(T),minHeight:44,flex:2}}>l'ho mangiato</button>
                <button onClick={()=>removeFromMenu(m.id)} style={{...navBtn(T,false),minHeight:44,flex:1}}>togli</button>
              </div>
            )}
          </div>
        ))}
        {view==='linea' && dayList.length>0 && (
          <div style={{paddingTop:6}}>
            {dayList.map((m,i) => (
              <NavStep key={m.id} T={T} time={`${fmt0(m.kcal)} kcal`} title={typeName(m)} desc={`${m.description || '(senza descrizione)'} · ${m.status==='planned' ? 'in piano, tocca quando l’hai mangiato' : 'mangiato'}`} state={m.status!=='planned' ? 'done' : (firstPlanned && firstPlanned.id===m.id ? 'now' : 'todo')} last={i===dayList.length-1} onTap={m.status==='planned' ? ()=>markAsEaten(m.id) : undefined} />
            ))}
          </div>
        )}
        {suggestLoading && <div style={{textAlign:'center',fontSize:14,opacity:0.8,padding:'8px 0'}}>sto pensando ai tuoi pasti…</div>}
        {suggestError && !suggestLoading && <div style={{fontSize:13,color:'#F0B9A0',textAlign:'center'}}>{suggestError}</div>}
        {suggestions && suggestions.length>0 && !suggestLoading && (<>
          <div style={{...navKicker,paddingBottom:0}}>proposte dell'ia</div>
          {suggestions.map((m,i) => (
            <div key={i} style={cardSt}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}><span style={tag}>{typeName(m)}</span><span style={{fontSize:12,opacity:0.75}}>proposta</span></div>
              <span style={{fontFamily:fTitle,fontSize:24,fontWeight:500,lineHeight:1.15}}>{m.description}</span>
              <span style={{fontSize:13,opacity:0.75}}>{macroLine(m)}</span>
              {m.perche && <span style={{fontSize:13,opacity:0.75,lineHeight:1.4}}>{m.perche}</span>}
              <button onClick={()=>addSuggestion(m)} style={{...navBtn(T,false),minHeight:44,marginTop:4}}>aggiungi al menù</button>
            </div>
          ))}
        </>)}
        <button onClick={loadSuggestions} disabled={suggestLoading} style={{...navBtn(T),opacity:suggestLoading?0.6:1}}>{suggestions ? 'altre proposte dell’ia' : suggestError ? 'riprova' : 'chiedi suggerimenti all’ia'}</button>
      </div>)}
    </NavShell>
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
    <NavModal onClose={onClose} title="Obiettivo del giorno" sub="Dieta a zona: 40% carboidrati, 30% proteine, 30% grassi">
      <NavField label="calorie al giorno" unit="kcal" size={40} type="text" inputMode="numeric" value={kcalStr} onChange={e=>setKcalStr(e.target.value.replace(/[^0-9]/g,''))} />
      <button onClick={applyZone} style={pillBtn('g')}>ricalcola i nutrienti in zona</button>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gap:12}}>
        <NavField label="proteine" unit="g" size={22} type="text" inputMode="numeric" value={pStr} onChange={e=>setPStr(e.target.value.replace(/[^0-9]/g,''))} />
        <NavField label="carboidrati" unit="g" size={22} type="text" inputMode="numeric" value={cStr} onChange={e=>setCStr(e.target.value.replace(/[^0-9]/g,''))} />
        <NavField label="grassi" unit="g" size={22} type="text" inputMode="numeric" value={gStr} onChange={e=>setGStr(e.target.value.replace(/[^0-9]/g,''))} />
      </div>
      <span style={{fontSize:13,lineHeight:1.4,color:balanced?C_CREAM:C_SAL,opacity:balanced?0.8:1}}>
        {balanced ? 'I nutrienti corrispondono alle calorie.' : `I nutrienti danno ${fmt0(kcalFromMacros)} kcal: ${diff>0?'+':''}${fmt0(diff)} rispetto al totale.`}
      </span>
      {err && <span style={{fontSize:13,color:C_SAL}}>{err}</span>}
      <button onClick={resetToZone} disabled={saving} style={{...modalLink,textAlign:'left'}}>torna al calcolo automatico</button>
      <NavButtons onCancel={onClose} onSave={save} disabled={saving} saveLabel={saving?'…':'salva'} />
    </NavModal>
  );
}

function MealModal({ existing, onClose, onSave, onDelete, J, seedPhoto }){
  const [type, setType] = useState(existing?.type || mealTypeFromHour(new Date()));
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
    <NavModal onClose={onClose} title={existing ? 'Modifica pasto' : 'Nuovo pasto'} sub={existing?.ts ? new Date(existing.ts).toLocaleString('it-IT',{weekday:'long',hour:'2-digit',minute:'2-digit'}) : ''} wide>
      <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} style={{display:'none'}} />
      {displayPhoto ? (<>
        <img src={displayPhoto} alt="foto del piatto" loading="lazy" style={{width:'100%',height:150,objectFit:'cover',borderRadius:18,display:'block'}} />
        <div style={{display:'flex',justifyContent:'space-between',marginTop:-8}}>
          <button onClick={()=>fileRef.current?.click()} style={modalLink}>cambia foto</button>
          <button onClick={removePhoto} style={modalLink}>rimuovi foto</button>
        </div>
      </>) : (
        <button onClick={()=>fileRef.current?.click()} disabled={busy} style={{height:96,borderRadius:18,background:`${C_CREAM}0D`,border:`1px dashed ${C_GOLD}`,color:C_CREAM,fontFamily:fDmSans,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
          <Camera size={22} strokeWidth={1.9} color={C_GOLD} /> {busy ? 'preparo la foto…' : 'aggiungi una foto'}
        </button>
      )}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gap:6}}>
        {MEAL_TYPES.map(t=>(<button key={t.id} onClick={()=>setType(t.id)} style={pillChip(type===t.id)}>{t.id==='spuntino_s' ? 'Serale' : t.name}</button>))}
      </div>
      <NavField label="descrizione" type="text" value={description} onChange={e=>setDescription(e.target.value)} placeholder="es. pasta al pomodoro" size={22} />
      <div style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',gap:12}}>
        <NavField label="quantità" unit={qtyUnit} type="text" inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value)} placeholder={qtyUnit==='ml'?'330':'250'}
          right={<button type="button" onClick={e=>{ e.preventDefault(); setQtyUnit(qtyUnit==='g'?'ml':'g'); }} style={{background:'transparent',border:`1px solid ${C_CREAM}55`,borderRadius:10,color:C_CREAM,fontFamily:fDmSans,fontSize:11,padding:'1px 8px',cursor:'pointer'}}>usa {qtyUnit==='g'?'ml':'g'}</button>} />
        <NavField label="calorie" unit="kcal" type="text" inputMode="numeric" value={kcal} onChange={e=>setKcal(e.target.value)} placeholder="450" />
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gap:12}}>
        <NavField label="proteine" unit="g" size={20} type="text" inputMode="decimal" value={p} onChange={e=>setP(e.target.value)} placeholder="20" />
        <NavField label="carboidrati" unit="g" size={20} type="text" inputMode="decimal" value={c} onChange={e=>setC(e.target.value)} placeholder="60" />
        <NavField label="grassi" unit="g" size={20} type="text" inputMode="decimal" value={g} onChange={e=>setG(e.target.value)} placeholder="12" />
      </div>
      {existing && (isExistingToday || isExistingYesterday) && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',gap:6}}>
          <button type="button" onClick={()=>setDateChoice('oggi')} style={pillChip(dateChoice==='oggi')}>oggi</button>
          <button type="button" onClick={()=>setDateChoice('ieri')} style={pillChip(dateChoice==='ieri')}>ieri</button>
        </div>
      )}
      <button onClick={estimateNutrition} disabled={!canEstimate} style={{...pillBtn('g'),opacity:canEstimate?1:0.5}}>
        {estimating ? 'sto analizzando…' : (!!displayPhoto && !description.trim() ? 'riconosci il piatto dalla foto' : 'calcola i nutrienti con l’ia')}
      </button>
      <span style={{fontSize:12,opacity:0.75,lineHeight:1.4,marginTop:-6}}>
        {!description.trim() && !displayPhoto ? 'Scrivi la descrizione o aggiungi una foto per attivare il calcolo.' : 'L’IA stima quantità, calorie e nutrienti: puoi sempre correggerli.'}
      </span>
      {estimateNote && <span style={{fontSize:13,lineHeight:1.4}}>{estimateNote}</span>}
      {estimateError && <span style={{fontSize:13,color:C_SAL}}>{estimateError}</span>}
      <NavButtons onDelete={onDelete} onCancel={onClose} onSave={save} />
    </NavModal>
  );
}

function AllenaPage({ theme, loaded, workouts, types, updWorkouts, updTypes }){
  const T = theme;
  const fTitle = T.fontText || fGaramond;
  const [detailTypeId, setDetailTypeId] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [logType, setLogType] = useState(null);
  const ws = workouts || [], ts = types || [];

  async function saveType(data){
    if(editingType==='new') await updTypes([...ts,{id:newId(),name:data.name,unit:data.unit}]);
    else await updTypes(ts.map(t=>t.id===editingType?{...t,name:data.name,unit:data.unit}:t));
    setEditingType(null);
  }
  async function delType(){
    if(ws.some(w=>w.typeId===editingType)) await updWorkouts(ws.filter(w=>w.typeId!==editingType));
    await updTypes(ts.filter(t=>t.id!==editingType));
    setEditingType(null);
  }
  async function quickLog(data){
    await updWorkouts([...ws,{id:newId(),ts:new Date().toISOString(),typeId:logType.id,qty:data.qty,notes:data.notes}]);
    setLogType(null); setChoosing(false);
  }
  const editingT = editingType && editingType!=='new' ? ts.find(t=>t.id===editingType) : null;
  const detailType = detailTypeId ? ts.find(t=>t.id===detailTypeId) : null;
  const DAY = 86400000, now = Date.now();
  const weekCount = ws.filter(w => now - new Date(w.ts).getTime() < 7*DAY).length;
  const cardSt = { background:'#142A4C', border:'1px solid #34506F', borderRadius:22, padding:'16px 18px', display:'flex', flexDirection:'column', gap:10, width:'100%', boxSizing:'border-box', color:T.cream, fontFamily:fDmSans, textAlign:'left', cursor:'pointer' };
  return (
    <div>
    <NavShell T={T} kicker={`questa settimana · ${weekCount} ${weekCount===1?'sessione':'sessioni'}`} title="Allenamenti">
      {!loaded && <Loading color={T.gold} />}
      {loaded && (<div style={{display:'flex',flexDirection:'column',gap:12}}>
        {ts.length>0 && <button onClick={()=>setChoosing(!choosing)} style={navBtn(T)}>registra allenamento</button>}
        {choosing && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gap:6}}>
            {ts.map(t=>(<button key={t.id} onClick={()=>setLogType(t)} style={{...navChip(T,false),overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</button>))}
          </div>
        )}
        {ts.length===0 && <div style={{textAlign:'center',fontSize:14,opacity:0.75,lineHeight:1.5,padding:'20px 10px'}}>Non hai ancora attività. Aggiungi la prima, ad esempio corsa o pesi.</div>}
        {ts.map(t=>{
          const tw = ws.filter(w=>w.typeId===t.id);
          const last30 = tw.filter(w => now - new Date(w.ts).getTime() < 30*DAY);
          const totalQty = last30.reduce((a,w)=>a+(w.qty||0),0);
          const sumIn = (a,b) => tw.filter(w => { const d = now - new Date(w.ts).getTime(); return d >= a*DAY && d < b*DAY; }).reduce((s,w)=>s+(w.qty||0),0);
          const recentQ = sumIn(0,15), prevQ = sumIn(15,30);
          const trend = (recentQ===0 && prevQ===0) ? '' : recentQ > prevQ*1.1 ? 'in crescita' : recentQ < prevQ*0.9 ? 'in calo' : 'stabile';
          const lastW = [...tw].sort((a,b)=>new Date(b.ts)-new Date(a.ts))[0];
          const today = new Date(); const vals=[];
          for(let i=29;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); const dk=dayKey(d); const sum=tw.filter(w=>dayKey(new Date(w.ts))===dk).reduce((a,w)=>a+(w.qty||0),0); vals.push(sum>0?sum:null); }
          const spark = buildLineChart(vals,120,36);
          return (
            <button key={t.id} onClick={()=>setDetailTypeId(t.id)} style={cardSt}>
              <span style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                <span style={{display:'flex',flexDirection:'column',gap:2,minWidth:0}}>
                  <span style={{fontFamily:fTitle,fontSize:26,fontWeight:500,lineHeight:1.1}}>{t.name}</span>
                  <span style={{fontSize:12,opacity:0.75}}>{lastW ? `ultima: ${sameDay(new Date(lastW.ts),new Date()) ? 'oggi' : new Date(lastW.ts).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}` : 'nessuna sessione'}</span>
                </span>
                <svg viewBox="0 0 120 36" width="120" height="36" style={{flexShrink:0}} aria-hidden="true">
                  {spark.points.length>1 && <path d={spark.path} stroke={T.gold} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                  {spark.points.length>0 && <circle cx={spark.points[spark.points.length-1].x} cy={spark.points[spark.points.length-1].y} r="3" fill={T.cream} />}
                  {spark.points.length===0 && <line x1="0" y1="18" x2="120" y2="18" stroke={T.cream} strokeWidth="1" strokeDasharray="3 4" opacity="0.3" />}
                </svg>
              </span>
              <span style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
                <span style={{fontSize:15,fontWeight:700}}>{fmt0(totalQty)} {t.unit} · 30 giorni · {last30.length} {last30.length===1?'sessione':'sessioni'}</span>
                <span style={{fontSize:12,color:T.gold,fontWeight:600,whiteSpace:'nowrap'}}>{trend}</span>
              </span>
            </button>
          );
        })}
        <button onClick={()=>setEditingType('new')} style={navBtn(T,false)}>nuova attività</button>
      </div>)}
    </NavShell>
      {detailType && <TypeDetailModal type={detailType} workouts={ws} onClose={()=>setDetailTypeId(null)} updWorkouts={updWorkouts} onEditType={()=>{setDetailTypeId(null); setEditingType(detailType.id);}} />}
      {editingType && <TypeModal existing={editingT} onClose={()=>setEditingType(null)} onSave={saveType} onDelete={editingType!=='new'?delType:null} />}
      {logType && <WorkoutModal existing={null} unit={logType.unit} typeName={logType.name} onClose={()=>setLogType(null)} onSave={quickLog} onDelete={null} />}
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
    <NavModal onClose={onClose} title={type.name} sub={`30 giorni · ${last30.length} ${last30.length===1?'sessione':'sessioni'}`} wide>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:10}}>
        <span style={{fontFamily:fGaramond,fontSize:46,fontWeight:500,lineHeight:1}}>{fmt0(totalQty)} <span style={{fontSize:22}}>{type.unit}</span></span>
        <button onClick={onEditType} style={modalLink}>modifica attività</button>
      </div>
      {points.length>1 ? (
        <svg viewBox="0 0 280 70" role="img" aria-label="Andamento degli ultimi 30 giorni" style={{width:'100%',height:'auto',display:'block'}}>
          <path d={area} fill={C_GOLD} fillOpacity="0.12" />
          <path d={path} stroke={C_GOLD} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="4.5" fill={C_CREAM} />
        </svg>
      ) : null}
      <div style={{maxHeight:200,overflowY:'auto'}}>
        {tw.length===0 ? <div style={{fontSize:14,opacity:0.8,padding:'8px 0'}}>Nessuna sessione registrata.</div> : tw.slice().reverse().slice(0,15).map(w=>{ const d=new Date(w.ts); return (
          <button key={w.id} onClick={()=>setEditing(w.id)} style={{display:'flex',alignItems:'baseline',gap:12,padding:'11px 2px',minHeight:44,width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${C_CREAM}33`,color:C_CREAM,fontFamily:fDmSans,cursor:'pointer',textAlign:'left'}}>
            <span style={{fontSize:13,fontWeight:700,width:64,flexShrink:0}}>{sameDay(d,new Date()) ? 'oggi' : d.toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
            <span style={{flex:1,minWidth:0,fontSize:15,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fmt(w.qty)} {type.unit}{w.notes ? ` · ${w.notes}` : ''}</span>
            <span style={{fontSize:13,opacity:0.8}}>›</span>
          </button>
        ); })}
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={onClose} style={pillBtn('o')}>chiudi</button>
        <button onClick={()=>setEditing('new')} style={{...pillBtn('p'),flex:1}}>nuova sessione</button>
      </div>
      {editing && <WorkoutModal existing={editingW} unit={type.unit} typeName={type.name} onClose={()=>setEditing(null)} onSave={saveWorkout} onDelete={editing!=='new'?delWorkout:null} />}
    </NavModal>
  );
}

function WorkoutModal({ existing, unit, typeName, onClose, onSave, onDelete }){
  const [qty, setQty] = useState(existing?.qty!=null ? String(existing.qty).replace('.',',') : '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [err, setErr] = useState('');
  function save(){ const q=parseNum(qty,0,100000); if(q==null){setErr('quantità non valida'); return;} onSave({qty:q,notes:notes.trim()}); }
  return (
    <NavModal onClose={onClose} z={220} title={typeName} sub={existing ? 'modifica sessione' : 'nuova sessione'}>
      <NavField label="quantità" unit={unit} size={44} type="text" inputMode="decimal" value={qty} onChange={e=>{setQty(e.target.value); setErr('');}} onKeyDown={e=>{if(e.key==='Enter')save();}} autoFocus placeholder={unit==='km'?'5,0':'30'} />
      {err && <span style={{fontSize:13,color:C_SAL}}>{err}</span>}
      <NavField label="note (facoltative)" size={18} type="text" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="parco del castello" />
      <NavButtons onDelete={onDelete} onCancel={onClose} onSave={save} />
    </NavModal>
  );
}

function TypeModal({ existing, onClose, onSave, onDelete }){
  const [name, setName] = useState(existing?.name || '');
  const [unit, setUnit] = useState(existing?.unit || 'min');
  function save(){ const n=name.trim(); if(!n)return; onSave({name:n,unit}); }
  return (
    <NavModal onClose={onClose} z={220} title={existing ? 'Modifica attività' : 'Nuova attività'}>
      <NavField label="nome" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="es. Bicicletta" autoFocus />
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        <span style={{fontSize:12,opacity:0.8}}>si misura in</span>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5, minmax(0, 1fr))',gap:6}}>
          {UNITS.map(u=>(<button key={u} onClick={()=>setUnit(u)} style={pillChip(u===unit)}>{u}</button>))}
        </div>
      </div>
      <NavButtons onDelete={onDelete} onCancel={onClose} onSave={save} />
    </NavModal>
  );
}

function IntegraPage({ theme, loaded, supps, taken, updSupps, updTaken }){
  // Originariamente questa pagina usava T (palette Cuoio globale).
  // Shadow di T con il theme attivo passato come prop.
  const T = theme || { bg: '#F2EBDC', ink: '#1F1A12', dim: '#6B5D45' };
  const isDashboard = T?.structuralVariant === 'dashboard';
  const [editingSupp, setEditingSupp] = useState(null);
  const [editingDay, setEditingDay] = useState(null);
  const [name, setName] = useState('');

  const today = new Date(); const todayK = dayKey(today);
  const days = [];
  for(let i=27;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); days.push(d); }

  // Su tema dashboard usa la palette cool on-brand per indice (ignora i colori terrosi salvati);
  // sugli altri temi mantiene il colore salvato o la palette classica.
  const suppsWithColor = useMemo(()=>supps.map((s,i)=> isDashboard
    ? ({...s, color: SUPP_COLORS_DASH[i%SUPP_COLORS_DASH.length]})
    : ({...s, color: s.color||SUPP_COLORS[i%SUPP_COLORS.length]})
  ),[supps, isDashboard]);

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

  // --- Render nuovo stile: calendario degli ultimi 28 giorni, integratori di oggi, costanza ---
  const fTitle = T.fontText || fGaramond;
  const takenToday = taken[todayK] || [];
  const dayState = d => { const l = (taken[dayKey(d)]||[]).filter(id => supps.some(s=>s.id===id)); return supps.length>0 && l.length>=supps.length ? 2 : l.length>0 ? 1 : 0; };
  const fullDays = days.filter(d=>dayState(d)===2).length;
  let streakFull = 0; for (let i=days.length-1;i>=0;i--){ if (dayState(days[i])===2) streakFull++; else if (i===days.length-1) continue; else break; }
  const avgCons = supps.length ? Math.round(supps.reduce((a,s)=>a+consistency(s.id),0)/supps.length) : 0;
  return (
    <div>
    <NavShell T={T} kicker={`ultimi 28 giorni · ${fullDays} ${fullDays===1?'giorno completo':'giorni completi'}`} title="Integrazione">
      {!loaded && <Loading color={T.gold} />}
      {loaded && (<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7, minmax(0, 1fr))',gap:8}}>
          {days.map(d=>{ const k=dayKey(d), st=dayState(d), isT=k===todayK; return (
            <button key={k} onClick={()=>setEditingDay(k)} aria-label={d.toLocaleDateString('it-IT',{day:'numeric',month:'long'})} style={{aspectRatio:'1 / 1',borderRadius:'50%',background:st===2?T.gold:'transparent',border:`2px solid ${st>0?T.gold:`${T.cream}33`}`,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:fDmSans,fontSize:12,fontWeight:isT?800:600,color:st===2?T.bg2:T.cream,cursor:'pointer',padding:0,boxShadow:isT?`0 0 0 2px ${T.bg2}, 0 0 0 4px ${T.cream}`:'none'}}>{d.getDate()}</button>
          ); })}
        </div>
        <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:12,opacity:0.75}}><span>pieno: tutti presi</span><span>bordo oro: alcuni</span><span>vuoto: nessuno</span><span>tocca un giorno per correggerlo</span></div>
        <div>
          <div style={navKicker}>oggi · {takenToday.filter(id=>supps.some(s=>s.id===id)).length} di {supps.length} presi</div>
          {supps.length===0 && <div style={{fontSize:14,opacity:0.75,lineHeight:1.5,padding:'6px 2px 12px'}}>Aggiungi i tuoi integratori per spuntarli ogni giorno.</div>}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {supps.map(s=>{ const on = takenToday.includes(s.id); return (
              <div key={s.id} style={{display:'flex',gap:8,alignItems:'stretch'}}>
                <button onClick={()=>toggleDaySupp(s.id, todayK)} style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:14,padding:'12px 14px',minHeight:62,background:'#142A4C',border:'1px solid #34506F',borderRadius:16,cursor:'pointer',textAlign:'left',color:T.cream,fontFamily:fDmSans,opacity:on?0.8:1}}>
                  <span style={{width:28,height:28,borderRadius:'50%',flexShrink:0,background:on?T.gold:'transparent',border:`2px solid ${T.gold}`,display:'flex',alignItems:'center',justifyContent:'center'}}>{on && <Check size={17} strokeWidth={3} color={T.bg2} />}</span>
                  <span style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
                    <span style={{fontSize:16,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</span>
                    <span style={{fontSize:12,opacity:0.75}}>{on ? 'preso' : 'tocca quando lo prendi'} · costanza {consistency(s.id)}%</span>
                  </span>
                </button>
                <button onClick={()=>openEditSupp(s)} aria-label={`modifica ${s.name}`} style={{width:48,background:'transparent',border:'1px solid #34506F',borderRadius:16,color:T.cream,fontSize:18,cursor:'pointer'}}>›</button>
              </div>
            ); })}
          </div>
        </div>
        {supps.length>0 && <NavStats T={T} items={[[streakFull,'giorni completi di fila'],[`${avgCons}%`,'costanza · 28 giorni']]} />}
        <button onClick={()=>{setEditingSupp('new'); setName('');}} style={navBtn(T,false)}>aggiungi integratore</button>
      </div>)}
    </NavShell>
      {editingSupp && (
        <ModalQ Q={T} onClose={()=>{setEditingSupp(null); setName('');}} title={editingSupp==='new'?'Nuovo integratore':'Modifica integratore'} subtitle="">
          <input type="text" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveSupp();}} autoFocus placeholder="es. Vitamina D" aria-label="nome dell'integratore" style={{width:'100%',marginTop:18,background:'transparent',border:'none',borderBottom:`2px solid ${T.gold}`,color:T.cream,fontFamily:fTitle,fontSize:26,outline:'none',padding:'4px 0',boxSizing:'border-box'}} />
          <EditButtons Q={T} onCancel={()=>{setEditingSupp(null); setName('');}} onSave={saveSupp} onDelete={editingSupp!=='new'?delSupp:null} />
        </ModalQ>
      )}
      {editingDay && (
        <ModalQ Q={T} onClose={()=>setEditingDay(null)} title={parseDayKey(editingDay).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})} subtitle="quali integratori hai preso?">
          <div style={{marginTop:14,display:'flex',flexDirection:'column'}}>
            {supps.length===0 ? <div style={{fontSize:14,opacity:0.75,padding:'10px 0'}}>Aggiungi prima i tuoi integratori.</div> : supps.map(s=>{ const on=(taken[editingDay]||[]).includes(s.id); return (
              <button key={s.id} onClick={()=>toggleDaySupp(s.id, editingDay)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,width:'100%',minHeight:52,padding:'8px 2px',background:'transparent',border:'none',borderBottom:`1px solid ${T.cream}22`,color:T.cream,fontFamily:fDmSans,fontSize:16,cursor:'pointer',textAlign:'left'}}>
                <span>{s.name}</span>
                <span style={{width:28,height:28,borderRadius:'50%',flexShrink:0,background:on?T.gold:'transparent',border:`2px solid ${T.gold}`,display:'flex',alignItems:'center',justifyContent:'center'}}>{on && <Check size={17} strokeWidth={3} color={T.bg2} />}</span>
              </button>
            ); })}
          </div>
          <button onClick={()=>setEditingDay(null)} style={{...navBtn(T),marginTop:20}}>fatto</button>
        </ModalQ>
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

  // --- Render nuovo stile: arco letto → sveglia, qualità, medie, ultime 7 notti, notti recenti ---
  const T = S;
  const fTitle = T.fontText || fGaramond;
  const ARC = Math.PI*130;
  const arcP = lastNightDur != null ? Math.max(0.04, Math.min(1, lastNightDur/8)) : 0;
  const week = chartData.slice(-7);
  const maxW = Math.max(8, ...week.map(d=>d.val||0));
  const isLastToday = lastNight && lastNight.wakeDate === todayK;
  return (
    <div>
    <NavShell T={T} kicker={!lastNight ? 'nessuna notte registrata' : isLastToday ? 'stanotte' : `notte del ${parseDayKey(lastNight.wakeDate).toLocaleDateString('it-IT',{day:'numeric',month:'long'})}`} title="Sonno">
      {!loaded && <Loading color={T.gold} />}
      {loaded && (<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
          <div style={{position:'relative',width:300,maxWidth:'100%',height:170}}>
            <svg viewBox="0 0 300 170" fill="none" aria-hidden="true" style={{width:'100%',height:'100%',display:'block'}}>
              <path d="M 20 155 A 130 130 0 0 1 280 155" stroke={`${T.cream}22`} strokeWidth="14" strokeLinecap="round" />
              {lastNight && <path d="M 20 155 A 130 130 0 0 1 280 155" stroke={T.gold} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${ARC*arcP} ${ARC}`} />}
            </svg>
            <div style={{position:'absolute',left:0,right:0,top:62,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <span style={{fontFamily:fTitle,fontSize:46,fontWeight:500,lineHeight:1}}>{lastNight ? fmtDur(lastNightDur) : '—'}</span>
              <span style={{fontSize:13,opacity:0.75}}>{lastNight ? 'hai dormito' : 'registra la tua notte'}</span>
            </div>
          </div>
          {lastNight && <div style={{width:300,maxWidth:'100%',display:'flex',justifyContent:'space-between',fontSize:13}}><span><b>{lastNight.bedtime}</b> a letto</span><span>sveglia <b>{lastNight.waketime}</b></span></div>}
        </div>
        {lastNight && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            <span style={{fontSize:13,opacity:0.75}}>qualità</span>
            <span style={{display:'flex',gap:6}} role="img" aria-label={`qualità ${lastNight.quality} su 5`}>{[1,2,3,4,5].map(n=>(<span key={n} style={{width:14,height:14,borderRadius:'50%',background:n<=lastNight.quality?T.gold:'transparent',border:`1.5px solid ${T.gold}`,boxSizing:'border-box'}} />))}</span>
          </div>
        )}
        <button onClick={()=>setEditing('new')} style={navBtn(T)}>registra la notte</button>
        <NavStats T={T} items={[[avg7!=null?fmtDur(avg7):'—','media 7 giorni'],[avg30!=null?fmtDur(avg30):'—','media 30 giorni'],[last30.length,'notti · 30 giorni']]} />
        <div>
          <div style={navKicker}>ultime 7 notti</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',padding:'0 6px'}}>
            {week.map((d,i)=>(
              <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                <span style={{fontSize:10,opacity:0.75,minHeight:12}}>{d.val!=null ? fmt(d.val) : ''}</span>
                <div style={{width:26,height:90,display:'flex',alignItems:'flex-end'}}>
                  <div style={{width:'100%',height:`${d.val!=null ? Math.max(6, Math.round(d.val/maxW*100)) : 3}%`,borderRadius:8,background:i===6?T.gold:(d.val!=null?`${T.cream}2E`:'transparent'),border:`1px solid ${d.val!=null?T.gold:`${T.cream}33`}`,boxSizing:'border-box'}} />
                </div>
                <span style={{fontSize:11,fontWeight:i===6?700:400,opacity:i===6?1:0.75}}>{d.date.toLocaleDateString('it-IT',{weekday:'narrow'})}</span>
              </div>
            ))}
          </div>
        </div>
        {sorted.length>0 && (
          <div>
            <div style={navKicker}>notti recenti · tocca per correggere</div>
            {sorted.slice().reverse().slice(0,10).map((s,i,arr)=>(
              <NavStep key={s.id} T={T} time={fmtDur(durHours(s.bedtime,s.waketime))} title={s.wakeDate===todayK ? 'Stanotte' : parseDayKey(s.wakeDate).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'short'})} desc={`${s.bedtime} – ${s.waketime} · qualità ${s.quality} su 5${s.notes ? ` · ${s.notes}` : ''}`} state="done" last={i===arr.length-1} onTap={()=>setEditing(s.id)} />
            ))}
          </div>
        )}
      </div>)}
    </NavShell>
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
    <NavModal onClose={onClose} title={existing ? 'Modifica notte' : 'La tua notte'}>
      <NavField label="data del risveglio" size={20} type="date" value={wakeDateISO} onChange={e=>{ if(!e.target.value) return; const [y,m,d]=e.target.value.split('-').map(Number); setWakeDate(dayKey(new Date(y,m-1,d))); }} />
      <div style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',gap:12}}>
        <NavField label="a letto alle" type="time" value={bedtime} onChange={e=>setBedtime(e.target.value)} />
        <NavField label="sveglia alle" type="time" value={waketime} onChange={e=>setWaketime(e.target.value)} />
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'4px 0'}}>
        <span style={{fontFamily:fGaramond,fontSize:44,fontWeight:500,lineHeight:1}}>{fmtDur(dur)}</span>
        <span style={{fontSize:13,opacity:0.8}}>di sonno</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
        <span style={{fontSize:12,opacity:0.8}}>qualità · {quality} su 5</span>
        <div style={{display:'flex',gap:8}}>
          {[1,2,3,4,5].map(n=>(<button key={n} onClick={()=>setQuality(n)} aria-label={`qualità ${n} su 5`} aria-pressed={n===quality} style={{width:44,height:44,borderRadius:'50%',background:'transparent',border:'none',cursor:'pointer',padding:4}}><span style={{display:'block',width:'100%',height:'100%',borderRadius:'50%',background:n<=quality?C_GOLD:'transparent',border:`2px solid ${C_GOLD}`,boxSizing:'border-box'}} /></button>))}
        </div>
      </div>
      <NavField label="note (facoltative)" size={18} type="text" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="risvegli, sogni…" />
      <NavButtons onDelete={onDelete} onCancel={onClose} onSave={save} />
    </NavModal>
  );
}

function SeraPage({ theme, loaded, weights, goal, notes, water, waterGoal, meals, workouts, workoutTypes, supps, taken, sleeps, mindful, updNotes, profile }){
  // Sera usa N internamente (palette Notte blu era originaria). Shadow.
  const N = theme || { bg1: '#2C3340', bg2: '#14171F', cream: '#F2E8D0', dim: '#8A8270', gold: '#C9A876', body: '#DDD3C2' };
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  // L'analisi IA viene persistita in localStorage con chiave per giorno (per utente).
  // Così sopravvive a cambi di pagina, refresh del browser, riapertura PWA — e si
  // "azzera" naturalmente quando cambia giorno o l'utente clicca rianalizza.
  const aiStorageKey = `goalfit_ai_sera_${profile?.id || 'anon'}_${dayKey(new Date())}`;
  const [aiResult, setAiResult] = useState(() => {
    try { const raw = localStorage.getItem(aiStorageKey); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  });
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
    // Pulisco la versione persistita prima di riprovare, così se l'utente cambia
    // pagina mentre l'analisi è in corso non rivede il risultato vecchio.
    try { localStorage.removeItem(aiStorageKey); } catch (_) {}
    try {
      // Costruisci il riepilogo dei dati
      const summary = buildWeightLossSummary({ weights, goal, meals, workouts, workoutTypes, supps, taken, sleeps, water });
      const memSera = memoryToText(await loadMemory());
      const r = await analyzeWeightLoss(summary + (memSera ? `\n\nCOSE DA RICORDARE SULL'UTENTE (rispettale sempre; quelle a PRIORITÀ ALTA sono vincolanti):\n${memSera}` : ''));
      if (r.error) setAiError('IA: '+(r.error||'errore sconosciuto'));
      else {
        setAiResult(r);
        // Persisto il risultato per il giorno corrente
        try { localStorage.setItem(aiStorageKey, JSON.stringify(r)); } catch (_) {}
      }
    } catch (e) { setAiError('Errore'); }
    finally { setAiAnalyzing(false); }
  }

  // Target calorico del giorno (Zona 40/30/30 — stessa logica della pagina Menù)
  const kcalTarget = useMemo(() => computeNutritionTarget(profile, weights, goal).kcal, [profile, weights, goal]);

  // === Spie semaforiche per il riepilogo serale ===
  // Palette semantica: verde=tutto bene, ambra=parziale, rosso=insufficiente, azzurro=sotto target (ok per dimagrire), nessuna=non registrato
  const OK = '#9CC73A', WARN = '#D4B86A', BAD = '#C99A7A', INFO = '#4A9EBA';
  // sonno: <6h male, 6-7h parziale, 7-9h ottimo, >9 parziale (troppo)
  const sleepDot = lastNightDur == null ? null : lastNightDur < 6 ? BAD : lastNightDur < 7 ? WARN : lastNightDur <= 9 ? OK : WARN;
  // peso: presente → ok; mancante → nessuna spia
  const pesoMattinaDot = morning ? OK : null;
  const pesoSeraDot = (evening && evening !== morning) ? OK : null;
  // calorie: 0 = nessuna spia; >120% target = rosso; >105% = ambra; 95-105% = verde; <95% = azzurro (sotto target volutamente, ok per dimagrire)
  const calDot = totalKcal === 0 ? null : totalKcal > kcalTarget * 1.20 ? BAD : totalKcal > kcalTarget * 1.05 ? WARN : totalKcal >= kcalTarget * 0.95 ? OK : INFO;
  // acqua: 0 = nessuna spia; >= goal = verde; >= 50% = ambra; <50% = rosso
  const waterDot = todayWater === 0 ? null : todayWater >= waterGoal ? OK : todayWater >= waterGoal / 2 ? WARN : BAD;
  // allenamenti: >=1 verde, 0 nessuna spia (non è "male" non allenarsi un giorno specifico)
  const workoutDot = todayWorkouts.length > 0 ? OK : null;
  // meditazione: presente → verde, no → nessuna spia
  const mindDot = totalMindfulMin > 0 ? OK : null;
  // integratori: solo se ne ha definiti; tutti → verde, parziali → ambra, 0 → rosso
  const suppDot = supps.length === 0 ? null : suppsTakenToday === supps.length ? OK : suppsTakenToday > 0 ? WARN : BAD;

  // --- Render nuovo stile: lettura dell'IA, cronologia della giornata a linea del tempo, note ---
  const T = N;
  const fTitle = T.fontText || fGaramond;
  const events = [];
  todayWeights.forEach(w => events.push({ ts:new Date(w.ts), key:'w'+w.id, title:'Pesata', text:`${fmt(w.weight)} kg` }));
  todayMeals.forEach(m => events.push({ ts:new Date(m.ts), key:'m'+m.id, title: MEAL_TYPES.find(t => t.id === m.type)?.name || 'Pasto', text:[m.description || '(senza descrizione)', m.kcal ? `${fmt0(m.kcal)} kcal` : ''].filter(Boolean).join(' · ') }));
  todayWorkouts.forEach(w => { const t=(workoutTypes||[]).find(x => x.id === w.typeId); events.push({ ts:new Date(w.ts), key:'a'+w.id, title:'Movimento', text:`${t ? t.name : 'Allenamento'}${w.qty ? ` · ${fmt0(w.qty)} ${t ? t.unit : ''}` : ''}` }); });
  todayMindful.forEach(s => events.push({ ts:new Date(s.ts), key:'r'+s.id, title:'Respiro', text:`${fmt0(s.duration_min||0)} minuti${s.note ? ` · ${s.note}` : ''}` }));
  todayNotesSorted.forEach(n => events.push({ ts:new Date(n.ts), key:'n'+n.id, title:'Nota', text:n.text, noteId:n.id }));
  events.sort((a,b) => a.ts - b.ts);
  const reflection = todayMeals.length===0 && todayWeights.length===0 && !lastNight
    ? 'La giornata è ancora vuota. Registra qualcosa per ricevere una riflessione.'
    : lastNightDur!=null && lastNightDur<6 ? `Hai dormito ${fmtDur(lastNightDur)} la scorsa notte: poco. Il sonno breve aumenta la fame e rallenta il dimagrimento.`
    : evening && morning && evening!==morning ? `Tra mattina e sera il peso è cambiato di ${fmt(Math.abs(evening.weight-morning.weight),1)} kg. È fisiologico: guarda la media settimanale.`
    : todayWater < Math.ceil(waterGoal*0.75) ? `Hai bevuto ${todayWater} bicchieri su ${waterGoal}. Domani prova a completarli.`
    : '';
  const cardSt = { background:'#142A4C', border:'1px solid #34506F', borderRadius:22, padding:'16px 18px', display:'flex', flexDirection:'column', gap:10 };
  const tag = { fontSize:12, color:T.gold, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' };
  const ta = { width:'100%', background:'transparent', border:`1px solid ${T.cream}44`, borderRadius:14, color:T.cream, fontFamily:fDmSans, fontSize:15, lineHeight:1.45, padding:12, outline:'none', resize:'none', boxSizing:'border-box' };
  return (
    <NavShell T={T} kicker="cronologia automatica della giornata" title="Diario">
      {!loaded && <Loading color={T.gold} />}
      {loaded && (<div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={cardSt}>
          <span style={tag}>lettura dell'ia</span>
          {!aiResult && !aiAnalyzing && <span style={{fontSize:15,lineHeight:1.45}}>{reflection || 'Fai analizzare all\'IA peso, sonno, alimentazione, allenamenti e integratori per sapere cosa fare per dimagrire.'}</span>}
          {aiAnalyzing && <span style={{fontSize:15,opacity:0.8}}>sto leggendo i tuoi dati…</span>}
          {aiError && !aiAnalyzing && <span style={{fontSize:13,color:'#F0B9A0'}}>{aiError}</span>}
          {aiResult && !aiAnalyzing && (<>
            {aiResult.stato && <span style={{fontSize:15,lineHeight:1.5}}>{aiResult.stato}</span>}
            {aiResult.focus && <span style={{fontSize:15,lineHeight:1.5}}><b style={{color:T.gold}}>Focus.</b> {aiResult.focus}</span>}
            {aiResult.azioni && aiResult.azioni.length>0 && (
              <ol style={{margin:0,paddingLeft:20,display:'flex',flexDirection:'column',gap:6,fontSize:14,lineHeight:1.5}}>{aiResult.azioni.map((a,i)=>(<li key={i}>{a}</li>))}</ol>
            )}
            {aiResult.attenzione && <div style={{padding:'10px 12px',background:'#F0B9A01F',border:'1px solid #F0B9A088',borderRadius:14,fontSize:13,lineHeight:1.5}}><b>Attenzione.</b> {aiResult.attenzione}</div>}
          </>)}
          <button onClick={runAiAnalysis} disabled={aiAnalyzing} style={{...navBtn(T,false),minHeight:46,opacity:aiAnalyzing?0.6:1}}>{aiResult ? 'rianalizza' : aiError ? 'riprova' : 'analizza tutto'}</button>
        </div>
        {events.length===0
          ? <div style={{fontSize:14,opacity:0.75,lineHeight:1.5,textAlign:'center',padding:'10px'}}>Niente registrato oggi. Pesate, pasti, allenamenti e note compariranno qui.</div>
          : <div style={{paddingTop:4}}>
              {events.map((ev,i)=>{
                const time = ev.ts.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
                if (ev.noteId && editingNote===ev.noteId) return (
                  <div key={ev.key} style={{...cardSt,marginBottom:16}}>
                    <textarea value={editNoteText} onChange={e=>setEditNoteText(e.target.value)} rows={3} aria-label="modifica nota" style={ta} />
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
                      <button onClick={()=>deleteNote(ev.noteId)} style={{...navBtn(T,false),width:'auto',minHeight:44,padding:'0 16px',borderColor:'#F0B9A088',color:'#F0B9A0'}}>elimina</button>
                      <button onClick={()=>{setEditingNote(null);setEditNoteText('');}} style={{...navBtn(T,false),width:'auto',minHeight:44,padding:'0 16px'}}>annulla</button>
                      <button onClick={saveEditNote} style={{...navBtn(T),width:'auto',minHeight:44,padding:'0 20px'}}>salva</button>
                    </div>
                  </div>
                );
                return <NavStep key={ev.key} T={T} time={time} title={ev.title} desc={ev.noteId ? `${ev.text} · tocca per modificare` : ev.text} state="done" last={i===events.length-1} onTap={ev.noteId ? ()=>{setEditingNote(ev.noteId);setEditNoteText(ev.text);} : undefined} />;
              })}
            </div>}
        <textarea value={noteInput} onChange={e=>setNoteInput(e.target.value)} rows={2} placeholder="Scrivi una nota (un pensiero, un dettaglio)…" aria-label="nuova nota" style={ta} />
        <button onClick={addNote} disabled={!noteInput.trim()} style={{...navBtn(T),opacity:noteInput.trim()?1:0.5}}>aggiungi nota</button>
      </div>)}
    </NavShell>
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
  // ─── Stato alimentato → glicogeno (0–12h) ───────────────────────────────
  { h:0,   label:'digestione',          note:'glucosio dal cibo in circolo',   body:"L'insulina è alta dopo il pasto. Il corpo usa lo zucchero appena ingerito come fonte primaria di energia e immagazzina l'eccesso." },
  { h:4,   label:'post-assorbente',     note:'glicogeno epatico in uso',       body:"L'insulina cala. Il fegato libera glucosio dalle sue scorte di glicogeno per mantenere stabile la glicemia." },
  { h:12,  label:'lipolisi',            note:'il grasso inizia a bruciare',     body:'Glicogeno epatico quasi esaurito. Cresce il glucagone. Inizia la mobilizzazione degli acidi grassi dal tessuto adiposo.' },
  // ─── Chetosi e autofagia (16–36h) ───────────────────────────────────────
  { h:16,  label:'autofagia · I',       note:'pulizia cellulare leggera',       body:"Le cellule iniziano a riciclare componenti danneggiati. L'ormone della crescita (GH) comincia a salire." },
  { h:18,  label:'chetosi iniziale',    note:'compaiono i corpi chetonici',     body:'Il fegato converte gli acidi grassi in chetoni (β-idrossibutirrato). Possibile sensazione di lucidità mentale.' },
  { h:24,  label:'chetosi affermata',   note:'cervello a chetoni',              body:'I chetoni coprono circa il 30% del fabbisogno energetico cerebrale. La sensibilità insulinica migliora. Fine del giorno 1.' },
  { h:36,  label:'autofagia · II',      note:'rinnovo cellulare attivo',        body:'Picco di autofagia: pulizia profonda delle cellule. La norepinefrina aumenta per preservare la massa muscolare.' },
  // ─── Rigenerazione profonda (48–72h) ────────────────────────────────────
  { h:48,  label:'rigenerazione',       note:'GH e BDNF al massimo',            body:"L'ormone della crescita può raggiungere fino a 5 volte il livello base. Il BDNF sostiene la neuroplasticità. Fine del giorno 2." },
  { h:72,  label:'reset immunitario',   note:'staminali in azione',             body:'Le cellule staminali iniziano a rigenerare il sistema immunitario. IGF-1 cala (associato in letteratura a effetti anti-aging). Fine del giorno 3.' },
  // ─── Territorio da supervisione medica (96–168h, 4–7 giorni) ────────────
  { h:96,  label:'adattamento profondo', note:'massima produzione di chetoni',  body:'Chetosi profonda stabilizzata. Il sistema immunitario produce nuovi globuli bianchi. Da qui serve competenza medica.' },
  { h:120, label:'rinnovo cellulare',    note:'pulizia metabolica estesa',      body:'Mucosa intestinale rinnovata. Calano i marker infiammatori sistemici. Rischio crescente di squilibri elettrolitici (sodio, potassio, magnesio).' },
  { h:144, label:'adattamento metabolico', note:'massima efficienza sui grassi', body:'Il metabolismo basale si adatta lievemente al ribasso. Il corpo è al massimo dell\u2019efficienza nell\u2019usare i grassi. Possibili ipotensione e debolezza.' },
  { h:168, label:'digiuno terapeutico',  note:'solo sotto controllo medico',    body:'Solo sotto stretta supervisione medica. Il sistema immunitario completa il proprio reset. Attenzione massima al rientro alimentare per evitare la refeeding syndrome.' },
];

// Etichetta breve per la timeline: ore fino a 72, poi giorni
function phaseShort(h){
  if (h < 96) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}g`;
}

// === Avvertimenti sicurezza digiuno ===
// Livelli progressivi in base alla durata pianificata (o tempo trascorso).
// Il design è "informa, non bloccare": l'utente resta libero di scegliere, ma i digiuni
// oltre 72h richiedono una conferma esplicita perché la posizione di GoalFit è
// che non vadano svolti senza supervisione medica.
function fastRiskLevel(hours){
  if (hours == null || hours <= 16) return 'none';
  if (hours <= 24) return 'info';
  if (hours <= 48) return 'caution';
  if (hours <= 72) return 'warning';
  return 'danger';
}
function fastRiskInfo(level){
  switch(level){
    case 'info':    return { color:'#5AA8B3', label:'nota',         text:'Idratati bene, integra elettroliti (sodio, potassio, magnesio) e ascolta il corpo. Non adatto in gravidanza, allattamento, diabete, disturbi alimentari o se assumi farmaci.' };
    case 'caution': return { color:'#D9B86A', label:'attenzione',   text:'Digiuno oltre 24h. Consigliato solo se hai già esperienza e non hai condizioni mediche. Se è la prima volta o assumi farmaci, parla prima con un medico.' };
    case 'warning': return { color:'#E08A3C', label:'avvertimento', text:'Digiuno esteso (48–72h). GoalFit consiglia vivamente la supervisione di un medico: possibili rischi includono ipotensione, ipoglicemia, squilibri elettrolitici, perdita di massa magra.' };
    case 'danger':  return { color:'#E04545', label:'sconsigliato', text:'Digiuno oltre 72 ore. Come società sconsigliamo di procedere senza la supervisione attiva di un medico. GoalFit non promuove digiuni prolungati come pratica autonoma.' };
    default:        return null;
  }
}

function DigiunoPage({ theme, loaded, fasts, updFasts }){
  // Digiuno usa D internamente (palette Notturno ambra era originaria). Shadow.
  const D = theme || { bg1: '#1F2228', bg2: '#0E1115', cream: '#E8E4D5', accent: '#C9A876', amber: '#D4A23E', dim: '#6B6478', active: '#A8826E', danger: '#C99A7A' };
  const [now, setNow] = useState(Date.now());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [category, setCategory] = useState('intermittent');
  const [customHours, setCustomHours] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [editing, setEditing] = useState(null); // fast in edit (oggetto fast intero)
  const [pendingFast, setPendingFast] = useState(null); // digiuno 'danger' (>72h) in attesa di conferma medica esplicita

  // Reset auto della conferma "termina" dopo 4s
  useEffect(()=>{
    if (!confirmEnd) return;
    const id = setTimeout(()=>setConfirmEnd(false), 4000);
    return ()=>clearTimeout(id);
  },[confirmEnd]);

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
    setPendingFast(null);
  }
  // Gate di sicurezza: se il digiuno richiesto è oltre 72h, mostriamo conferma esplicita
  // prima di avviarlo. Sotto soglia, parte direttamente.
  function requestStartFast(preset, hoursOverride){
    const hours = hoursOverride ?? preset.hours;
    if (fastRiskLevel(hours) === 'danger') {
      setPendingFast({ preset, hoursOverride });
      return;
    }
    startFast(preset, hoursOverride);
  }
  async function endFast(){
    if(!active) return;
    await updFasts(fasts.map(f=>f.id===active.id?{...f,ended_ts:new Date().toISOString()}:f));
  }
  async function deleteFast(id){
    await updFasts(fasts.filter(f=>f.id!==id));
    setEditing(null);
  }
  async function updateFast(updated){
    await updFasts(fasts.map(f=>f.id===updated.id?updated:f));
    setEditing(null);
  }
  async function startCustom(){
    const h = parseInt(customHours);
    if(isNaN(h)||h<1||h>240) return;
    requestStartFast({id:'custom',label:`${h}h`,hours:h}, h);
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

  // --- Render nuovo stile: anello-timer, percorso delle fasi, scelta del protocollo, storico ---
  const T = D;
  const fTitle = T.fontText || fGaramond;
  const cardSt = { background:'#142A4C', border:'1px solid #34506F', borderRadius:18, padding:'14px 16px', color:T.cream, fontFamily:fDmSans, textAlign:'left', width:'100%', boxSizing:'border-box' };
  const riskBox = (info) => info && (
    <div style={{padding:'12px 14px',background:`${info.color}1F`,border:`1px solid ${info.color}88`,borderRadius:16}}>
      <div style={{fontSize:12,letterSpacing:'0.1em',color:info.color,textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{info.label}</div>
      <div style={{fontSize:13,lineHeight:1.5}}>{info.text}</div>
    </div>
  );
  const presetBtn = (p, info) => (
    <button key={p.id} onClick={()=>requestStartFast(p)} style={{...cardSt,display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,cursor:'pointer',minHeight:64}}>
      <span style={{display:'flex',flexDirection:'column',gap:2,minWidth:0}}>
        <span style={{fontFamily:fTitle,fontSize:24,fontWeight:500,lineHeight:1.1}}>{p.label}</span>
        <span style={{fontSize:12,opacity:0.75}}>{p.desc}</span>
        {info && <span style={{fontSize:11,letterSpacing:'0.1em',color:info.color,textTransform:'uppercase',fontWeight:700,marginTop:2}}>{info.label}</span>}
      </span>
      <span style={{fontSize:13,fontWeight:700,color:T.gold,whiteSpace:'nowrap'}}>inizia ›</span>
    </button>
  );
  const remainMs = (plannedH - elapsedH) * 3600000;
  return (
    <div>
    <NavShell T={T} kicker={active ? `in corso · ${active.label}` : 'nessun digiuno attivo'} title="Digiuno">
      {!loaded && <Loading color={T.gold} />}
      {loaded && active && (<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <NavRing T={T} p={progress/100} size={260}>
          <span style={{fontSize:13,opacity:0.75}}>trascorse</span>
          <span style={{fontFamily:fTitle,fontSize:elapsedH>=24?40:54,fontWeight:500,lineHeight:1}}>{fmtElapsed(elapsedMs)}</span>
          <span style={{fontSize:13,opacity:0.75}}>{progress>=100 ? `obiettivo di ${plannedH}h raggiunto` : `mancano ${fmtElapsed(remainMs)}`}</span>
          <button onClick={()=>setEditing(active)} style={{background:'transparent',border:'none',color:T.cream,fontFamily:fDmSans,fontSize:12,opacity:0.8,cursor:'pointer',padding:'6px 10px',textDecoration:'underline',textUnderlineOffset:3}}>iniziato alle {new Date(active.started_ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})} · modifica</button>
        </NavRing>
        {!confirmEnd ? (
          <button onClick={()=>setConfirmEnd(true)} style={navBtn(T)}>termina digiuno</button>
        ) : (
          <div style={{...cardSt,display:'flex',flexDirection:'column',gap:12}}>
            <span style={{fontFamily:fTitle,fontSize:22}}>Terminare il digiuno ora?</span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setConfirmEnd(false)} style={{...navBtn(T,false),minHeight:46}}>annulla</button>
              <button onClick={()=>{ endFast(); setConfirmEnd(false); }} style={{...navBtn(T),minHeight:46}}>sì, termina</button>
            </div>
          </div>
        )}
        {riskBox(fastRiskInfo(fastRiskLevel(elapsedH)))}
        <div style={{paddingTop:6}}>
          {FAST_PHASES.map((p,i)=>{ const isCur = currentPhase && currentPhase.h===p.h; const reachedP = elapsedH >= p.h; return (
            <NavStep key={p.h} T={T} time={isCur ? 'adesso' : `${phaseShort(p.h)}`} title={p.label.charAt(0).toUpperCase()+p.label.slice(1)} desc={isCur ? `${p.note}${p.body ? ` — ${p.body}` : ''}` : (nextPhase && nextPhase.h===p.h ? `tra ${fmtElapsed((p.h-elapsedH)*3600000)}` : '')} state={isCur ? 'now' : reachedP ? 'done' : 'todo'} last={i===FAST_PHASES.length-1} />
          ); })}
        </div>
      </div>)}
      {loaded && !active && (<div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{fontSize:14,opacity:0.8,lineHeight:1.5}}>Scegli un protocollo e inizia.</div>
        <div style={{background:'#142A4C',border:'1px solid #34506F',borderRadius:26,padding:4,display:'flex',gap:4}}>
          {[{id:'intermittent',label:'intermittente'},{id:'extended',label:'prolungato'},{id:'custom',label:'su misura'}].map(c=>(
            <button key={c.id} onClick={()=>setCategory(c.id)} style={{flex:1,minHeight:44,borderRadius:22,border:'none',background:category===c.id?T.gold:'transparent',color:category===c.id?T.bg2:T.cream,fontFamily:fDmSans,fontSize:13,fontWeight:600,cursor:'pointer'}}>{c.label}</button>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {category==='intermittent' && FAST_PRESETS_INTERMITTENT.map(p=>presetBtn(p,null))}
          {category==='extended' && FAST_PRESETS_EXTENDED.map(p=>presetBtn(p, fastRiskInfo(fastRiskLevel(p.hours))))}
          {category==='custom' && (() => { const hPreview = parseInt(customHours, 10); const infoPreview = fastRiskInfo(!isNaN(hPreview) ? fastRiskLevel(hPreview) : 'none'); return (<>
            <div style={{...cardSt,display:'flex',flexDirection:'column',gap:10}}>
              <label htmlFor="fast-custom" style={{fontSize:14}}>Durata in ore (1 – 240)</label>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <input id="fast-custom" type="text" inputMode="numeric" value={customHours} onChange={e=>setCustomHours(e.target.value)} placeholder="es. 36" style={{flex:1,minWidth:0,background:'transparent',border:'none',borderBottom:`2px solid ${T.gold}`,color:T.cream,fontFamily:fTitle,fontSize:30,outline:'none',padding:'4px 0'}} />
                <button onClick={startCustom} disabled={!customHours} style={{...navBtn(T),width:'auto',padding:'0 22px',minHeight:46,opacity:customHours?1:0.5}}>inizia</button>
              </div>
            </div>
            {riskBox(infoPreview)}
          </>); })()}
        </div>
        {past.length>0 && (<>
          <NavStats T={T} items={[[past.length,'digiuni'],[`${fmt0(longest)}h`,'il più lungo'],[`${fmt0(totalHours)}h`,'in totale']]} />
          <div>
            <div style={navKicker}>storico · tocca per correggere</div>
            {past.slice(0,10).map((f,i,arr)=>{ const dur=(new Date(f.ended_ts)-new Date(f.started_ts))/3600000; const pct=Math.round((dur/(f.planned_hours||dur||1))*100); return (
              <NavStep key={f.id} T={T} time={new Date(f.started_ts).toLocaleDateString('it-IT',{day:'numeric',month:'short'})} title={fmtElapsed(new Date(f.ended_ts)-new Date(f.started_ts))} desc={`${f.label || ''} · ${pct}% dell'obiettivo`} state={pct>=100?'done':'todo'} last={i===arr.length-1} onTap={()=>setEditing(f)} />
            ); })}
          </div>
        </>)}
      </div>)}
      <div style={{marginTop:28,paddingTop:16,borderTop:`1px solid ${T.cream}22`,fontSize:12,opacity:0.75,lineHeight:1.6}}>
        <b>Nota di sicurezza.</b> GoalFit non è un dispositivo medico e non sostituisce il parere di un professionista. Il digiuno non è adatto in gravidanza, allattamento, diabete (tipo 1 e 2), disturbi del comportamento alimentare, sottopeso, o se assumi farmaci. Per digiuni superiori alle 24 ore consigliamo di parlare con il proprio medico; oltre le 72 ore <b>sconsigliamo di procedere senza supervisione medica attiva</b>.
      </div>
    </NavShell>

      {/* Modale di conferma per digiuni oltre le 72h (rischio "danger") */}
      {pendingFast && (() => {
        const h = pendingFast.hoursOverride ?? pendingFast.preset.hours;
        const info = fastRiskInfo('danger');
        return (
          <NavModal onClose={()=>setPendingFast(null)} title={`Digiuno di ${h} ore`} sub="">
            <span style={{fontSize:12,letterSpacing:'0.1em',color:info.color,textTransform:'uppercase',fontWeight:700}}>{info.label}</span>
            <span style={{fontSize:14,lineHeight:1.5}}>{info.text}</span>
            <div style={{padding:'12px 14px',background:`${info.color}26`,border:`1px solid ${info.color}`,borderRadius:16,fontSize:14,lineHeight:1.5}}>Procedi solo se hai consultato un medico, sei consapevole dei rischi e ti assumi la responsabilità di questa scelta.</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap'}}>
              <button onClick={()=>setPendingFast(null)} style={pillBtn('p')}>annulla</button>
              <button onClick={()=>startFast(pendingFast.preset, pendingFast.hoursOverride)} style={pillBtn('d')}>procedo comunque</button>
            </div>
          </NavModal>
        );
      })()}

      {editing && (
        <FastEditModal
          fast={editing}
          isActive={!editing.ended_ts}
          D={D}
          onClose={()=>setEditing(null)}
          onSave={updateFast}
          onDelete={deleteFast}
        />
      )}
    </div>
  );
}


/* ====== Modale modifica/elimina digiuno ====== */
function FastEditModal({ fast, isActive, D, onClose, onSave, onDelete }){
  // Converte ISO timestamp in valore datetime-local (YYYY-MM-DDTHH:mm in fuso locale)
  function isoToInput(iso){
    if(!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function inputToISO(s){
    if(!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const [startedInput, setStartedInput] = useState(isoToInput(fast.started_ts));
  const [endedInput, setEndedInput]     = useState(isoToInput(fast.ended_ts));
  const [plannedHours, setPlannedHours] = useState(String(fast.planned_hours||16));
  const [label, setLabel]               = useState(fast.label||'');
  const [confirmDel, setConfirmDel]     = useState(false);

  // Validazione
  const startedISO = inputToISO(startedInput);
  const endedISO   = isActive ? null : inputToISO(endedInput);
  const nowMs      = Date.now();
  const phNum      = parseInt(plannedHours, 10);
  const errors = [];
  if(!startedISO) errors.push('Inizio mancante o non valido');
  if(startedISO && new Date(startedISO).getTime() > nowMs) errors.push("L'inizio non può essere nel futuro");
  if(!isActive){
    if(!endedISO) errors.push('Fine mancante o non valida');
    if(startedISO && endedISO && new Date(endedISO).getTime() <= new Date(startedISO).getTime()) errors.push('La fine deve essere dopo l\'inizio');
    if(endedISO && new Date(endedISO).getTime() > nowMs) errors.push('La fine non può essere nel futuro');
  }
  if(isNaN(phNum) || phNum < 1 || phNum > 240) errors.push('Obiettivo: 1–240 ore');
  const canSave = errors.length === 0;

  // Durata effettiva calcolata in tempo reale (solo se non attivo e dati validi)
  const effectiveDurH = (!isActive && startedISO && endedISO) ? (new Date(endedISO).getTime() - new Date(startedISO).getTime())/3600000 : null;

  function handleSave(){
    if(!canSave) return;
    const planned_end = startedISO ? new Date(new Date(startedISO).getTime() + phNum*3600000).toISOString() : fast.planned_end_ts;
    const updated = {
      ...fast,
      started_ts: startedISO,
      ended_ts: isActive ? null : endedISO,
      planned_hours: phNum,
      planned_end_ts: planned_end,
      label: label.trim() || `${phNum}h`,
    };
    onSave(updated);
  }

  // Stili
  const overlayStyle = { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 };
  const cardStyle = { background:'#142A4C', border:`1px solid ${D.accent||D.gold}55`, maxWidth:380, width:'100%', padding:'24px 22px', borderRadius:24, maxHeight:'88vh', overflowY:'auto', color:D.cream };
  const labelStyle = { fontFamily:fDmSans, fontSize:9, letterSpacing:'0.4em', color:D.dim, textTransform:'uppercase', marginBottom:6 };
  const inputStyle = { width:'100%', background:'transparent', border:`1px solid ${(D.accent||D.gold)}55`, fontFamily:fBodoni, fontStyle:'italic', fontSize:16, color:D.cream, padding:'10px 12px', outline:'none', borderRadius:0, colorScheme:'dark' };

  return (
    <NavModal onClose={onClose} title={isActive ? 'Digiuno in corso' : 'Modifica digiuno'} sub={isActive ? 'Sul digiuno in corso puoi correggere solo l’orario di inizio.' : ''}>
      <NavField label="inizio" size={19} type="datetime-local" value={startedInput} onChange={e=>setStartedInput(e.target.value)} />
      {!isActive && <NavField label="fine" size={19} type="datetime-local" value={endedInput} onChange={e=>setEndedInput(e.target.value)} />}
      {!isActive && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',gap:12}}>
          <NavField label="obiettivo" unit="ore" type="text" inputMode="numeric" value={plannedHours} onChange={e=>setPlannedHours(e.target.value.replace(/[^0-9]/g,''))} />
          <NavField label="nome" type="text" value={label} onChange={e=>setLabel(e.target.value)} placeholder="es. 16:8" />
        </div>
      )}
      {effectiveDurH != null && (
        <span style={{fontSize:14,lineHeight:1.4}}>Durata effettiva: <b>{Math.floor(effectiveDurH)}h {String(Math.round((effectiveDurH%1)*60)).padStart(2,'0')}m</b>{phNum > 0 ? ` · ${Math.round((effectiveDurH/phNum)*100)}% dell’obiettivo` : ''}</span>
      )}
      {errors.length > 0 && <span style={{fontSize:13,color:C_SAL}}>{errors[0]}</span>}
      {!confirmDel ? (
        <NavButtons onDelete={!isActive ? ()=>setConfirmDel(true) : null} onCancel={onClose} onSave={handleSave} disabled={!canSave} />
      ) : (
        <div style={{border:`1px solid ${C_SAL}`,borderRadius:18,padding:14,display:'flex',flexDirection:'column',gap:10}}>
          <span style={{fontFamily:fGaramond,fontSize:22}}>Eliminare questo digiuno?</span>
          <span style={{fontSize:13,opacity:0.8}}>L’operazione non è reversibile.</span>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>setConfirmDel(false)} style={pillBtn('o')}>annulla</button>
            <button onClick={()=>onDelete(fast.id)} style={{...pillBtn('d'),background:C_SAL,color:C_NAVY,fontWeight:700}}>sì, elimina</button>
          </div>
        </div>
      )}
    </NavModal>
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

  // --- Render nuovo stile: cerchio del respiro con durata a scelta, sessione salvata da sola a fine tempo ---
  const T = M;
  const fTitle = T.fontText || fGaramond;
  const [durMin, setDurMin] = useState(3);
  const [endsAt, setEndsAt] = useState(null);
  const [leftS, setLeftS] = useState(0);
  const sessRef = useRef(sessions); sessRef.current = sessions;
  useEffect(()=>{
    if (!breathingOpen || !endsAt) return;
    const id = setInterval(()=>{
      const left = Math.max(0, Math.round((endsAt - Date.now())/1000));
      setLeftS(left);
      if (left <= 0) {
        clearInterval(id);
        setBreathingOpen(false); setEndsAt(null);
        updSessions([...sessRef.current,{ id:newId(), ts:new Date().toISOString(), type:'respirazione', duration_min:durMin, note:null }]);
      }
    }, 500);
    return ()=>clearInterval(id);
  },[breathingOpen, endsAt]);
  const startBreath = () => { setEndsAt(Date.now() + durMin*60000); setLeftS(durMin*60); setBreathingOpen(true); };
  const stopBreath = () => { setBreathingOpen(false); setEndsAt(null); };
  const mmss = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const circle = breathingOpen ? 0.62 + 0.38*((scale-0.35)/0.65) : 0.74;
  return (
    <div>
    <NavShell T={T} kicker="per calmare la mente, anche 1 minuto" title="Respiro">
      {!loaded && <Loading color={T.gold} />}
      {loaded && (<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,padding:'8px 0 0'}}>
          <div style={{width:230,height:230,borderRadius:'50%',border:`1px solid ${T.cream}33`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:230,height:230,borderRadius:'50%',background:'#142A4C',border:`2px solid ${T.gold}`,boxSizing:'border-box',transform:`scale(${circle})`,transition:'transform 0.12s linear',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{transform:`scale(${1/circle})`,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                <span style={{fontFamily:fTitle,fontSize:34,fontWeight:500,lineHeight:1}}>{breathingOpen ? phaseLabel : 'inspira'}</span>
                <span style={{fontSize:13,opacity:0.75}}>{breathingOpen ? `mancano ${mmss(leftS)}` : '4 secondi'}</span>
              </div>
            </div>
          </div>
          <span style={{fontSize:13,opacity:0.75,textAlign:'center'}}>respirazione quadrata · inspira, trattieni, espira, riposa</span>
        </div>
        {!breathingOpen && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:6}}>
            {[1,3,5,10].map(m=>(<button key={m} onClick={()=>setDurMin(m)} style={navChip(T, durMin===m)}>{m} min</button>))}
          </div>
        )}
        {breathingOpen
          ? <button onClick={stopBreath} style={navBtn(T,false)}>interrompi</button>
          : <button onClick={startBreath} style={navBtn(T)}>inizia a respirare</button>}
        <NavStats T={T} items={[[streak,'giorni di fila'],[fmt0(weekMin),'minuti · 7 giorni'],[todayCount,'sessioni oggi']]} />
        <div>
          <div style={navKicker}>registra un'altra pratica</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',gap:6}}>
            {MINDFUL_TYPES.map(t=>(<button key={t.id} onClick={()=>{ setLogging(t.id); setDraftMin(''); setDraftNote(''); }} style={navChip(T,false)}>{t.label}</button>))}
          </div>
        </div>
        {recent.length>0 && (
          <div>
            <div style={navKicker}>sessioni recenti · tocca due volte per eliminare</div>
            {recent.map(s=>{ const type = MINDFUL_TYPES.find(t=>t.id===s.type) || { label:s.type }; const d=new Date(s.ts); return (
              <button key={s.id} onClick={()=>{ if(confirmDelSess===s.id){ deleteSession(s.id); } else { setConfirmDelSess(s.id); } }} style={{display:'flex',alignItems:'baseline',gap:12,padding:'11px 2px',minHeight:44,width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${T.cream}22`,color:T.cream,fontFamily:fDmSans,cursor:'pointer',textAlign:'left'}}>
                <span style={{fontSize:13,fontWeight:700,width:64,flexShrink:0}}>{sameDay(d,new Date()) ? 'oggi' : d.toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
                <span style={{flex:1,minWidth:0,fontSize:15}}>{type.label} · {fmt(s.duration_min)} min{s.note ? ` · ${s.note}` : ''}</span>
                <span style={{fontSize:13,color:confirmDelSess===s.id?'#F0B9A0':T.cream,opacity:confirmDelSess===s.id?1:0.7,whiteSpace:'nowrap'}}>{confirmDelSess===s.id ? 'elimina?' : d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</span>
              </button>
            ); })}
          </div>
        )}
      </div>)}
    </NavShell>
      {logging && (
        <ModalQ Q={T} onClose={()=>setLogging(null)} title={MINDFUL_TYPES.find(t=>t.id===logging)?.label || 'sessione'} subtitle="nuova sessione">
          <InputBig value={draftMin} onChange={setDraftMin} onEnter={saveSession} placeholder="15" unit="minuti" Q={T} />
          <textarea value={draftNote} onChange={e=>setDraftNote(e.target.value)} placeholder="nota (opzionale)" aria-label="nota" rows={3} style={{width:'100%',marginTop:16,background:'transparent',border:`1px solid ${T.cream}44`,borderRadius:14,color:T.cream,fontFamily:fDmSans,fontSize:15,padding:12,outline:'none',resize:'none',boxSizing:'border-box'}} />
          <EditButtons Q={T} onCancel={()=>setLogging(null)} onSave={saveSession} />
        </ModalQ>
      )}
    </div>
  );
}

// Header in stile dashboard (Cruscotto): logo + "Goalfit" bicolore + etichetta pagina.
// Usato condizionalmente al posto del Header editoriale quando il tema è strutturale 'dashboard'.
function DashHeader({ label }){
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <img src="/icon-192.png" alt="" style={{ width:28, height:28, borderRadius:8, display:'block' }} />
        <div style={{ fontSize:16, fontWeight:800, letterSpacing:'-0.01em', fontFamily:"'Inter', system-ui, sans-serif" }}>
          <span style={{ color:'#9CC756' }}>Goal</span><span style={{ color:'#2A3942' }}>fit</span>
        </div>
      </div>
      <div style={{ fontSize:10, color:'#9AA5AB', textTransform:'uppercase', letterSpacing:'0.18em', fontWeight:700, marginRight:44, fontFamily:"'Inter', system-ui, sans-serif" }}>{label}</div>
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
function Row({ label, value, unit, details, theme, dot }){
  const T = theme || N;
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,padding:'10px 0',borderBottom:`1px solid ${T.gold}1F`}}>
      <div style={{flex:1,minWidth:0,display:'flex',alignItems:'baseline',gap:9}}>
        {/* Spia colorata semaforica: verde=ok, ambra=parziale, rosso=insufficiente, blu=sotto target volutamente, nessuna=non registrato */}
        {dot && (
          <span style={{width:8,height:8,borderRadius:'50%',background:dot,flexShrink:0,alignSelf:'center'}} />
        )}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:fFraunces,fontStyle:'italic',fontSize:13,color:T.dim||T.goldDim}}>{label}</div>
          {details && <div style={{fontFamily:fFraunces,fontSize:11,color:T.dim||T.goldDim,opacity:0.75,marginTop:3,lineHeight:1.4}}>{details}</div>}
        </div>
      </div>
      <span style={{fontFamily:fFraunces,fontWeight:400,fontSize:20,color:T.gold,whiteSpace:'nowrap'}}>{value}{unit && <span style={{fontSize:11,color:T.dim||T.goldDim,marginLeft:4,fontWeight:300}}>{unit}</span>}</span>
    </div>
  );
}
function FieldLabel({ children, light }){ return <div style={{fontFamily:fDmSans,fontSize:9,letterSpacing:'0.4em',color:'#B4BFCC',textTransform:'uppercase',marginBottom:4}}>{children}</div>; }
function fieldInput(theme){ return { width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${(theme.ink||theme.dark)}66`,fontFamily:fGaramond,fontStyle:'italic',fontSize:18,color:theme.ink||theme.dark,padding:'6px 0 4px',outline:'none' }; }
function fieldInputDark(theme){ return { width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${theme.gold}66`,fontFamily:fFraunces,fontStyle:'italic',fontSize:18,color:theme.pale,padding:'6px 0 4px',outline:'none' }; }
function btnSolid(bg, fg){ return { marginTop:22,background:bg,color:fg,border:`1px solid ${bg}`,fontFamily:fCinzel,fontSize:10,letterSpacing:'0.4em',padding:'14px 32px',cursor:'pointer',borderRadius:0 }; }
function btnOutline(c, font){ return { background:'transparent',color:c,border:`1px solid ${c}`,fontFamily:font||fMarcellus,fontSize:11,letterSpacing:'0.4em',padding:'12px 28px',cursor:'pointer',borderRadius:0 }; }
function btnOutlineThin(c){ return { background:'transparent',color:c,border:`1px solid ${c}66`,fontFamily:fCormorant,fontStyle:'italic',fontSize:14,padding:'8px 18px',cursor:'pointer',borderRadius:0 }; }
function btnOutlineMini(c, font){ return { background:'transparent',color:c,border:`1px solid ${c}66`,fontFamily:font||fDmSans,fontSize:13,padding:'10px 16px',cursor:'pointer',borderRadius:22 }; }

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
      <div onClick={e=>e.stopPropagation()} style={{...MODAL_CARD,maxWidth:wide?400:340,width:'100%',padding:'24px 22px',position:'relative',maxHeight:'88vh',overflowY:'auto'}}>{children}</div>
    </div>
  );
}

function ModalQ({ children, onClose, title, subtitle }){
  const t = String(title||'').toLowerCase();
  return <NavModal onClose={onClose} title={t.charAt(0).toUpperCase()+t.slice(1)} sub={subtitle}>{children}</NavModal>;
}

function InputBig({ value, onChange, onEnter, placeholder, unit }){
  return <NavField label="" unit={String(unit||'').toLowerCase()} size={48} type="text" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onEnter();}} autoFocus placeholder={placeholder} aria-label={String(unit||'valore').toLowerCase()} />;
}

function EditButtons({ onCancel, onSave, onDelete }){
  return <NavButtons onDelete={onDelete} onCancel={onCancel} onSave={onSave} />;
}
