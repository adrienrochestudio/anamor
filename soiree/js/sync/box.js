// ============================================================
// box.js : la boite de tino. Chaque prepa y est deposee, chiffree,
// en messages retenus sur les brokers publics (les memes que la
// soiree). Le soir, le jeu la relit, quel que soit l'appareil qui a
// servi a la remplir. Le navigateur garde toujours sa copie.
//
// sujets, sous anamor-box/<salle> :
//   p/<who>/m          manifeste { updated, core, ph:[empreinte|""], n:[morceaux] }
//   p/<who>/core       { h, v:{ jdg, text, trivia, lies, captions } }
//   p/<who>/ph<i>/<j>  { h, j, n, part }   photo i, morceau j
// Chaque partie porte son empreinte : un vieux morceau ne passe pas.
// La salle et la cle viennent d'un mot fixe (BOX_WORD), pas du mot
// secret de la soiree : changer ce dernier ne vide pas la boite.
// ============================================================
import { deriveRoom, seal, open } from "./crypto.js";
import { createMqttTransport } from "./transport-mqtt.js";
import { createLocalTransport } from "./transport-local.js";
import { sanitizePrep, N_PHOTOS } from "../prep-store.js";

const BOX_WORD = "anamor : la boite de tino, 10 octobre";
const PEOPLE = ["ana", "adrien"];
const CHUNK = 24000;
const MAX_IN = 60000;

let derived = null;
const boxKey = () => derived || (derived = deriveRoom(BOX_WORD));

export async function fingerprint(s){
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d.subarray(0, 8)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const coreOf = p => ({
  jdg:p.jdg, text:p.text, trivia:p.trivia, lies:p.lies,
  captions:p.photos.map(x => x.caption),
});

// empreintes d'une prepa locale : ce que la boite devrait contenir
export async function manifestOf(p){
  return {
    updated:p.updated,
    core:await fingerprint(JSON.stringify(coreOf(p))),
    ph:await Promise.all(p.photos.map(x => (x.src ? fingerprint(x.src) : ""))),
    n:p.photos.map(x => (x.src ? Math.ceil(x.src.length / CHUNK) : 0)),
  };
}

export async function openBox({ transport = "mqtt" } = {}){
  const { key, room } = await boxKey();
  const base = "anamor-box/" + room;
  const got = {};
  PEOPLE.forEach(w => { got[w] = { m:null, core:null, ph:Array.from({ length:N_PHOTOS }, () => new Map()) }; });
  const sent = new Map();          // sujet -> empreinte deja envoyee dans cette session
  const listeners = new Set();
  let conn = 0;

  const make = transport === "local" ? createLocalTransport : createMqttTransport;
  const tr = make({
    base,
    onMessage:(suffix, payload) => { handle(suffix, payload); },
    onStatus:n => { conn = n; emit(); },
  });

  function emit(){ listeners.forEach(cb => { try { cb(); } catch (e){ console.error(e); } }); }

  async function handle(suffix, payload){
    if (typeof payload !== "string" || payload.length > MAX_IN) return;
    const [p, who, part, j] = suffix.split("/");
    if (p !== "p" || !PEOPLE.includes(who)) return;
    let env;
    try { env = await open(key, payload); } catch { return; }
    if (!env || env.from !== who || !env.data || typeof env.data !== "object") return;
    const d = env.data, g = got[who];
    if (part === "m"){
      if (!Array.isArray(d.ph) || !Array.isArray(d.n) || typeof d.core !== "string") return;
      if (!g.m || (Number(d.updated) || 0) >= (Number(g.m.updated) || 0)) g.m = d;
    } else if (part === "core"){
      if (typeof d.h === "string" && d.v && typeof d.v === "object") g.core = d;
    } else if (/^ph[0-9]$/.test(part) && /^\d{1,3}$/.test(j || "")){
      const i = +part.slice(2);
      if (i >= N_PHOTOS || typeof d.h !== "string" || typeof d.part !== "string") return;
      g.ph[i].set(d.h + ":" + d.j, d.part);
    } else return;
    emit();
  }

  // ── lecture ─────────────────────────────────────────────
  // -> null, ou { prep, has:[bool], complete, manifest }
  async function read(who){
    const g = got[who];
    if (!g.m || !g.core || g.core.h !== g.m.core) return null;
    const raw = { ...g.core.v, photos:[] };
    const has = [];
    let complete = true;
    for (let i = 0; i < N_PHOTOS; i++){
      const hsh = g.m.ph[i] || "", n = g.m.n[i] | 0;
      has.push(!!hsh);
      const caption = Array.isArray(g.core.v.captions) ? g.core.v.captions[i] : "";
      let src = "";
      if (hsh){
        const parts = [];
        for (let k = 0; k < n; k++) parts.push(g.ph[i].get(hsh + ":" + k));
        if (parts.every(x => typeof x === "string")){
          const s = parts.join("");
          if (await fingerprint(s) === hsh) src = s;
        }
        if (!src) complete = false;
      }
      raw.photos.push({ src, caption });
    }
    const prep = sanitizePrep(raw, who);
    prep.updated = Number(g.m.updated) || 0;
    return { prep, has, complete, manifest:g.m };
  }

  // attend la prepa complete de who, au plus ms ; rend ce qu'il y a
  function wait(who, ms = 8000){
    return new Promise(resolve => {
      let done = false, busy = false;
      const finish = r => { if (done) return; done = true; listeners.delete(check); clearTimeout(t); resolve(r); };
      const check = async () => {
        if (busy || done) return;
        busy = true;
        const r = await read(who);
        busy = false;
        if (r && r.complete) finish(r);
      };
      const t = setTimeout(async () => finish(await read(who)), ms);
      listeners.add(check);
      check();
    });
  }

  // ── depot ───────────────────────────────────────────────
  // envoie seulement ce qui a change, le manifeste en dernier.
  // onStep(fait, total) pour une jauge.
  async function upload(p, onStep){
    if (!PEOPLE.includes(p.me)) throw new Error("who ?");
    if (!conn) throw new Error("offline");
    const man = await manifestOf(p);
    const g = got[p.me];
    const pub = async (suffix, data) => {
      tr.publish(`p/${p.me}/${suffix}`, await seal(key, { from:p.me, data }), { retain:true });
    };
    const jobs = [];
    p.photos.forEach((ph, i) => {
      const hsh = man.ph[i];
      if (!hsh) return;
      const there = g.m && g.m.ph[i] === hsh && [...Array(man.n[i]).keys()].every(k => g.ph[i].has(hsh + ":" + k));
      if (there || sent.get("ph" + i) === hsh) return;
      for (let k = 0; k < man.n[i]; k++) jobs.push({ i, k, hsh });
    });
    const total = jobs.length + 2;
    let done = 0;
    for (const jb of jobs){
      await pub(`ph${jb.i}/${jb.k}`, { h:jb.hsh, j:jb.k, n:man.n[jb.i], part:p.photos[jb.i].src.slice(jb.k * CHUNK, (jb.k + 1) * CHUNK) });
      if (jb.k === man.n[jb.i] - 1) sent.set("ph" + jb.i, jb.hsh);
      onStep && onStep(++done, total);
      await new Promise(r => setTimeout(r, 30));
    }
    await pub("core", { h:man.core, v:coreOf(p) });
    onStep && onStep(++done, total);
    await new Promise(r => setTimeout(r, 60));
    await pub("m", man);
    onStep && onStep(++done, total);
    return man;
  }

  return {
    read, wait, upload,
    on(cb){ listeners.add(cb); return () => listeners.delete(cb); },
    connected: () => conn,
    close(){ listeners.clear(); tr.close(); },
  };
}

// verification par une connexion neuve : la boite rend-elle bien
// cette prepa, a l'identique ? -> { ok, photos, missing }
export async function verifyBox(p, { transport = "mqtt", ms = 15000 } = {}){
  const want = await manifestOf(p);
  const b = await openBox({ transport });
  try {
    const r = await b.wait(p.me, ms);
    if (!r) return { ok:false, missing:["all"] };
    const missing = [];
    if (r.manifest.core !== want.core) missing.push("texts");
    want.ph.forEach((hsh, i) => {
      if (hsh && (r.manifest.ph[i] !== hsh || !r.prep.photos[i].src)) missing.push("photo " + (i + 1));
    });
    return { ok:missing.length === 0, missing };
  } finally {
    b.close();
  }
}
