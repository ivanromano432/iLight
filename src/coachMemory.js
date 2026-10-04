// Memoria del coach: poche cose stabili sull'utente (massimo 30) che l'IA tiene presenti
// in ogni risposta e nei consigli del Menù. Tabella Supabase: coach_memory.
import { supabase } from './supabase.js';

export const MEMORY_MAX = 30;
export const MEMORY_CATEGORIES = [
  { id: 'obiettivi', label: 'Obiettivi e decisioni' },
  { id: 'alimentazione', label: 'Alimentazione' },
  { id: 'allenamenti', label: 'Allenamenti' },
  { id: 'routine', label: 'Orari e routine' },
  { id: 'vincoli', label: 'Vincoli' },
  { id: 'coach', label: 'Come vuoi il coach' },
  { id: 'altro', label: 'Altro' },
];
const CAT_IDS = MEMORY_CATEGORIES.map(c => c.id);
export const normCategory = c => { const k = String(c || '').trim().toLowerCase(); return CAT_IDS.includes(k) ? k : 'altro'; };
export const normPriority = p => String(p || '').trim().toLowerCase() === 'alta' ? 'alta' : 'normale';

async function uid() {
  try { const { data } = await supabase.auth.getSession(); return data?.session?.user?.id || null; } catch (_) { return null; }
}

export async function loadMemory() {
  const u = await uid();
  if (!u) return [];
  const { data, error } = await supabase.from('coach_memory').select('id,category,content,priority,source,created_at').eq('user_id', u).order('created_at', { ascending: true });
  if (error) { console.error('[memoria] load error', error.message); return []; }
  return data || [];
}

// Restituisce la voce salvata, oppure { error } (es. memoria piena)
export async function addMemory({ category, content, priority, source }) {
  const u = await uid();
  const text = String(content || '').trim().slice(0, 200);
  if (!u || !text) return { error: 'dati mancanti' };
  const current = await loadMemory();
  if (current.some(m => m.content.trim().toLowerCase() === text.toLowerCase())) return { error: 'già presente' };
  if (current.length >= MEMORY_MAX) return { error: 'memoria piena' };
  const row = { user_id: u, category: normCategory(category), content: text, priority: normPriority(priority), source: source === 'chat' ? 'chat' : 'utente' };
  const { data, error } = await supabase.from('coach_memory').insert(row).select('id,category,content,priority,source,created_at').single();
  if (error) { console.error('[memoria] save error', error.message); return { error: error.message }; }
  return data;
}

export async function updateMemory(id, patch) {
  const p = {};
  if (patch.content != null) p.content = String(patch.content).trim().slice(0, 200);
  if (patch.category != null) p.category = normCategory(patch.category);
  if (patch.priority != null) p.priority = normPriority(patch.priority);
  const { error } = await supabase.from('coach_memory').update(p).eq('id', id);
  if (error) console.error('[memoria] update error', error.message);
  return !error;
}

export async function deleteMemory(id) {
  const { error } = await supabase.from('coach_memory').delete().eq('id', id);
  if (error) console.error('[memoria] delete error', error.message);
  return !error;
}

export async function clearMemory() {
  const u = await uid();
  if (!u) return false;
  const { error } = await supabase.from('coach_memory').delete().eq('user_id', u);
  if (error) console.error('[memoria] clear error', error.message);
  return !error;
}

// Testo da passare all'IA: prima le voci a priorità alta
export function memoryToText(items) {
  if (!items || items.length === 0) return '';
  const lab = id => MEMORY_CATEGORIES.find(c => c.id === id)?.label || 'Altro';
  const sorted = [...items].sort((a, b) => (a.priority === 'alta' ? 0 : 1) - (b.priority === 'alta' ? 0 : 1));
  return sorted.map(m => `- [${m.priority === 'alta' ? 'PRIORITÀ ALTA' : 'normale'}] ${lab(m.category)}: ${m.content}`).join('\n');
}

// Il coach chiude la risposta con righe del tipo  [[MEMORIA: categoria | alta | testo]]
// Qui le separo dal testo da mostrare.
export function extractMemoryTags(text) {
  const found = [];
  const clean = String(text || '').replace(/\[\[\s*MEMORIA\s*:\s*([^|\]]+)\|\s*([^|\]]+)\|\s*([^\]]+)\]\]/gi, (_, c, p, t) => {
    found.push({ category: normCategory(c), priority: normPriority(p), content: t.trim() });
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { clean, found };
}
