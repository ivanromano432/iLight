// Helpers per le foto pasti su Supabase Storage.
// Bucket: meal-photos · Path: {user_id}/{meal_id}.jpg

import { supabase } from './supabase.js';

const BUCKET = 'meal-photos';

// Converte data URL base64 in Blob
function dataUrlToBlob(dataUrl) {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) throw new Error('Data URL non valido');
  const mime = m[1];
  const bin = atob(m[2]);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Upload di una foto pasto. Ritorna l'URL pubblico.
// dataUrl: stringa "data:image/jpeg;base64,..."
export async function uploadMealPhoto(userId, mealId, dataUrl) {
  if (!userId || !mealId || !dataUrl) throw new Error('Parametri mancanti');
  const blob = dataUrlToBlob(dataUrl);
  // Estensione in base al mime (.jpg per jpeg/jpg, .png per png, .webp per webp)
  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/${mealId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: blob.type,
      upsert: true,  // sovrascrivi se esiste (per modifiche)
      cacheControl: '31536000',  // cache 1 anno
    });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Cancella la foto pasto dallo Storage. Se path non esiste, ignora silenziosamente.
export async function deleteMealPhoto(userId, mealId) {
  if (!userId || !mealId) return;
  // Prova entrambe le estensioni comuni
  const paths = [`${userId}/${mealId}.jpg`, `${userId}/${mealId}.png`, `${userId}/${mealId}.webp`];
  await supabase.storage.from(BUCKET).remove(paths);
}
