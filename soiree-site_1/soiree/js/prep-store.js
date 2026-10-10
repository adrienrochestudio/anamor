// ============================================================
// prep-store.js : la preparation de chacun, stockee SEULEMENT
// dans son navigateur (IndexedDB). Jamais dans le repo.
//
// forme d'une prepa :
// {
//   v:1, me:"ana"|"adrien", updated:ms,
//   jdg:   "https://youtu.be/...",                 // 1 video joueur du grenier
//   photos:[{ src:"data:image/jpeg...", caption:"" } x5],
//   text:  { kind:"letter"|"poem", body:"" },
//   trivia:[{ q:"", a:"rep1 / rep2" } x10],
//   lies:  [{ s:["","",""], lie:0|1|2|null } x3],
// }
// ============================================================
const DB = "anamor-soiree";
const STORE = "prep";
export const N_PHOTOS = 5, N_TRIVIA = 10, N_LIES = 3;
const MAX_TEXT = 8000, MAX_LINE = 300, MAX_PHOTO = 900000;

export function emptyPrep(me){
  return {
    v:1, me, updated:0,
    jdg:"",
    photos: Array.from({ length:N_PHOTOS }, () => ({ src:"", caption:"" })),
    text: { kind:"letter", body:"" },
    trivia: Array.from({ length:N_TRIVIA }, () => ({ q:"", a:"" })),
    lies: Array.from({ length:N_LIES }, () => ({ s:["", "", ""], lie:null })),
  };
}

function openDb(){
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function loadPrep(me){
  try {
    const db = await openDb();
    const val = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const q = tx.objectStore(STORE).get(me);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    return sanitizePrep(val, me);
  } catch (e){
    console.error("loadPrep", e);
    return emptyPrep(me);
  }
}

export async function savePrep(prep){
  prep.updated = Date.now();
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(prep, prep.me);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ── validation stricte (import de fichier, lecture DB) ─────────
const str = (v, max = MAX_LINE) => (typeof v === "string" ? v.slice(0, max) : "");

export function sanitizePrep(raw, me){
  const p = emptyPrep(me);
  if (!raw || typeof raw !== "object") return p;
  p.updated = Number(raw.updated) || 0;
  p.jdg = ytId(str(raw.jdg)) ? str(raw.jdg) : "";
  if (Array.isArray(raw.photos)) raw.photos.slice(0, N_PHOTOS).forEach((ph, i) => {
    const src = str(ph && ph.src, MAX_PHOTO);
    p.photos[i] = {
      src: /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : "",
      caption: str(ph && ph.caption, 140),
    };
  });
  if (raw.text){
    p.text.kind = raw.text.kind === "poem" ? "poem" : "letter";
    p.text.body = str(raw.text.body, MAX_TEXT);
  }
  if (Array.isArray(raw.trivia)) raw.trivia.slice(0, N_TRIVIA).forEach((t, i) => {
    p.trivia[i] = { q: str(t && t.q), a: str(t && t.a) };
  });
  if (Array.isArray(raw.lies)) raw.lies.slice(0, N_LIES).forEach((l, i) => {
    const s = Array.isArray(l && l.s) ? l.s : [];
    p.lies[i] = {
      s: [0, 1, 2].map(k => str(s[k])),
      lie: [0, 1, 2].includes(l && l.lie) ? l.lie : null,
    };
  });
  return p;
}

// ── avancement ─────────────────────────────────────────────
export function progress(p){
  const parts = {
    jdg: ytId(p.jdg) ? 1 : 0,
    photos: p.photos.filter(x => x.src).length,
    text: p.text.body.trim().length > 20 ? 1 : 0,
    trivia: p.trivia.filter(t => t.q.trim() && t.a.trim()).length,
    lies: p.lies.filter(l => l.s.every(x => x.trim()) && l.lie !== null).length,
  };
  const total = 1 + N_PHOTOS + 1 + N_TRIVIA + N_LIES;
  const done = parts.jdg + parts.photos + parts.text + parts.trivia + parts.lies;
  return { parts, done, total, pct: Math.round((done / total) * 100) };
}

// ── youtube ────────────────────────────────────────────────
export function ytId(url){
  if (typeof url !== "string") return null;
  const u = url.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(u)) return u;
  const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── sauvegarde fichier ─────────────────────────────────────
export function exportFile(prep){
  const blob = new Blob([JSON.stringify(prep)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `soiree-prep-${prep.me}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function importFile(file, me){
  if (!file || file.size > 8_000_000) throw new Error("file too big");
  const raw = JSON.parse(await file.text());
  if (raw.me && raw.me !== me) throw new Error("not your file");
  return sanitizePrep(raw, me);
}

// ── photo : redimensionnee a 1280px max, jpeg ─────────────────
export async function photoToDataUrl(file){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("unreadable"));
      im.src = url;
    });
    const max = 1280;
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    let q = 0.82, out = c.toDataURL("image/jpeg", q);
    while (out.length > MAX_PHOTO && q > 0.4){ q -= 0.1; out = c.toDataURL("image/jpeg", q); }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
