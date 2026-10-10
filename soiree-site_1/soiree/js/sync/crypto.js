// ============================================================
// crypto.js : tout ce qui passe par les brokers publics est
// chiffre (AES-GCM 256). Le code de soiree, dit a l'oral, sert
// de mot de passe : PBKDF2 en derive le chiffrement, le nom de
// la salle et la graine des tirages. Les brokers ne voient que
// du chiffre sur un nom de salle opaque.
// ============================================================
const enc = new TextEncoder();
const dec = new TextDecoder();
const ITER = 150000;

export function normCode(code){
  return String(code || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export async function deriveRoom(code){
  const c = normCode(code);
  if (c.length < 3) throw new Error("code too short");
  const base = await crypto.subtle.importKey("raw", enc.encode(c), "PBKDF2", false, ["deriveKey", "deriveBits"]);
  const salt = s => enc.encode("anamor-soiree-v1/" + s);
  const key = await crypto.subtle.deriveKey(
    { name:"PBKDF2", salt:salt("key"), iterations:ITER, hash:"SHA-256" },
    base, { name:"AES-GCM", length:256 }, false, ["encrypt", "decrypt"]);
  const roomBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name:"PBKDF2", salt:salt("room"), iterations:ITER, hash:"SHA-256" }, base, 128));
  const seedBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name:"PBKDF2", salt:salt("seed"), iterations:ITER, hash:"SHA-256" }, base, 32));
  const room = [...roomBits].map(b => b.toString(16).padStart(2, "0")).join("");
  const seed = ((seedBits[0] << 24) | (seedBits[1] << 16) | (seedBits[2] << 8) | seedBits[3]) >>> 0;
  return { key, room, seed };
}

function toB64(bytes){
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64){
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// objet -> texte base64 (iv 12 octets + chiffre)
export async function seal(key, obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return toB64(out);
}

// texte base64 -> objet (rejette tout ce qui n'est pas a nous)
export async function open(key, b64){
  const bytes = fromB64(b64);
  if (bytes.length < 29) throw new Error("short");
  const pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv:bytes.subarray(0, 12) }, key, bytes.subarray(12));
  return JSON.parse(dec.decode(pt));
}
