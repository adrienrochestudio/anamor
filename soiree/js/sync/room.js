// ============================================================
// room.js : etat partage de la soiree, sans serveur a nous
//
// Principe des COULOIRS : chacun n'ecrit que dans SON couloir
// (lane/ana ou lane/adrien), publie en message retenu. Personne
// n'ecrase jamais l'autre. Tout l'etat de la soiree se DEDUIT
// des deux couloirs (flow.js). Recharger la page = relire les
// deux couloirs retenus et reprendre au meme endroit.
//
// A cote, des FLUX non retenus (s/ana, s/adrien) : presence,
// traits de dessin, envoi des contenus de prepa en morceaux.
//
// API :
//   room.me, room.other, room.seed
//   room.ready                 promesse : mon couloir est resynchronise
//   room.lane(who)             couloir (lecture)
//   room.get(who, "a.b.c")     lecture d'un chemin
//   room.set("a.b.c", v)       ecriture dans MON couloir
//   room.on(cb) -> unsub       appele a chaque changement de couloir
//   room.send(kind, data)      flux
//   room.onStream(kind, cb)    cb(data, from) -> unsub
//   room.provide(key, fn)      je fournis un contenu sur demande
//   room.request(key)          je demande un contenu a l'autre
//   room.online(who)
// ============================================================
import { deriveRoom, seal, open } from "./crypto.js";
import { createMqttTransport } from "./transport-mqtt.js";
import { createLocalTransport } from "./transport-local.js";

const PEOPLE = ["ana", "adrien"];
const CHUNK = 24000;          // caracteres par morceau de contenu
const MAX_PAYLOAD = 120000;   // au-dela : ignore
const PING_EVERY = 5000, ONLINE_FOR = 16000;

export async function createRoom({ me, code, transport = "mqtt", onStatus }){
  if (!PEOPLE.includes(me)) throw new Error("who ?");
  const other = me === "ana" ? "adrien" : "ana";
  const { key, room, seed } = await deriveRoom(code);
  const base = "anamor-soiree/" + room;

  const lanes = { ana:{ rev:0 }, adrien:{ rev:0 } };
  const LS = "soiree-lane-" + room + "-" + me;
  try {
    const b = JSON.parse(localStorage.getItem(LS) || "null");
    if (b && typeof b.rev === "number") lanes[me] = b;
  } catch {}

  const listeners = new Set();
  const streams = new Map();
  const providers = new Map();
  const pending = new Map();
  const cache = new Map();
  const seen = new Set();
  const lastSeen = { ana:0, adrien:0 };
  let synced = false, resolveReady, emitQueued = false, pubTimer = null;
  const ready = new Promise(r => { resolveReady = r; });

  // ── transport ────────────────────────────────────────────
  const make = transport === "local" ? createLocalTransport : createMqttTransport;
  let firstConnect = false;
  const tr = make({
    base,
    onMessage: (suffix, payload, retained) => { handle(suffix, payload, retained); },
    onStatus: n => {
      if (n > 0 && !firstConnect){
        firstConnect = true;
        // pas de couloir retenu a moi dans 2,5 s : je suis nouveau ici
        setTimeout(markSynced, transport === "local" ? 200 : 2500);
      }
      onStatus && onStatus(n);
    },
  });

  function markSynced(){
    if (synced) return;
    synced = true;
    if (lanes[me].rev > 0) publishLane();
    resolveReady();
  }

  async function handle(suffix, payload, retained){
    if (typeof payload !== "string" || payload.length > MAX_PAYLOAD) return;
    const [kind, who] = suffix.split("/");
    if (!PEOPLE.includes(who)) return;
    let env;
    try { env = await open(key, payload); } catch { return; }
    if (!env || env.from !== who) return;
    if (!retained && who !== me) lastSeen[who] = Date.now();

    if (kind === "lane"){
      const L = env.data;
      if (!L || typeof L !== "object" || typeof L.rev !== "number") return;
      if (L.rev > lanes[who].rev){
        lanes[who] = L;
        if (who === me) saveLocal();
        emit();
      }
      if (who === me) markSynced();
    } else if (kind === "s"){
      if (who === me) return;
      if (typeof env.id !== "string" || seen.has(env.id)) return;
      seen.add(env.id);
      if (seen.size > 4000) seen.clear();
      const hs = streams.get(env.kind);
      if (hs) hs.forEach(h => { try { h(env.data, who); } catch (e){ console.error(e); } });
    }
  }

  // ── couloirs ─────────────────────────────────────────────
  function saveLocal(){ try { localStorage.setItem(LS, JSON.stringify(lanes[me])); } catch {} }

  function publishLane(){
    clearTimeout(pubTimer);
    pubTimer = setTimeout(async () => {
      const payload = await seal(key, { from:me, data:lanes[me] });
      tr.publish("lane/" + me, payload, { retain:true });
    }, 50);
  }

  function emit(){
    if (emitQueued) return;
    emitQueued = true;
    const run = () => { emitQueued = false; listeners.forEach(cb => { try { cb(); } catch (e){ console.error(e); } }); };
    if (typeof requestAnimationFrame === "function" && document.visibilityState === "visible") requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  function getPath(obj, path){
    if (!path) return obj;
    return String(path).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function set(path, value){
    const keys = String(path).split(".");
    let o = lanes[me];
    for (let i = 0; i < keys.length - 1; i++){
      if (o[keys[i]] == null || typeof o[keys[i]] !== "object") o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
    lanes[me].rev++;
    lanes[me].t = Date.now();
    saveLocal();
    if (synced) publishLane();
    emit();
  }

  // ── flux ─────────────────────────────────────────────────
  async function send(kind, data){
    const env = { from:me, id:Math.random().toString(36).slice(2) + Date.now().toString(36), kind, data };
    tr.publish("s/" + me, await seal(key, env));
  }
  function onStream(kind, cb){
    if (!streams.has(kind)) streams.set(kind, new Set());
    streams.get(kind).add(cb);
    return () => streams.get(kind).delete(cb);
  }

  // ── contenus sur demande, en morceaux ────────────────────
  onStream("req", async (msg, who) => {
    if (!msg || typeof msg.key !== "string") return;
    const fn = providers.get(msg.key);
    if (!fn) return;
    const data = await fn(who);
    if (data == null){ send("res", { rid:msg.rid, wait:true }); return; }
    const s = JSON.stringify(data);
    const n = Math.max(1, Math.ceil(s.length / CHUNK));
    for (let i = 0; i < n; i++){
      if (msg.need && !msg.need.includes(i)) continue;
      await send("res", { rid:msg.rid, i, n, part:s.slice(i * CHUNK, (i + 1) * CHUNK) });
      await new Promise(r => setTimeout(r, 25));
    }
  });
  onStream("res", msg => {
    const p = msg && pending.get(msg.rid);
    if (!p || msg.wait) return;
    if (!Number.isInteger(msg.i) || !Number.isInteger(msg.n) || msg.n > 500) return;
    p.n = msg.n;
    p.parts[msg.i] = String(msg.part);
    const have = p.parts.filter(x => x != null).length;
    if (have === p.n){
      pending.delete(msg.rid);
      clearInterval(p.timer);
      try {
        const data = JSON.parse(p.parts.join(""));
        cache.set(p.key, data);
        p.resolve(data);
      } catch (e){ p.reject(e); }
    }
  });

  function request(k, { timeout = 180000 } = {}){
    if (cache.has(k)) return Promise.resolve(cache.get(k));
    for (const p of pending.values()) if (p.key === k) return p.promise;
    const rid = Math.random().toString(36).slice(2);
    const p = { key:k, parts:[], n:0, started:Date.now() };
    p.promise = new Promise((resolve, reject) => { p.resolve = resolve; p.reject = reject; });
    pending.set(rid, p);
    const ask = () => {
      const need = p.n ? [...Array(p.n).keys()].filter(i => p.parts[i] == null) : undefined;
      send("req", { key:k, rid, need });
    };
    ask();
    p.timer = setInterval(() => {
      if (Date.now() - p.started > timeout){
        clearInterval(p.timer); pending.delete(rid); p.reject(new Error("timeout"));
        return;
      }
      ask();
    }, 3500);
    return p.promise;
  }

  // ── presence ─────────────────────────────────────────────
  const pinger = setInterval(() => send("ping", 1), PING_EVERY);
  setTimeout(() => send("ping", 1), 300);
  onStream("ping", () => {});

  return {
    me, other, seed, ready,
    lane: who => lanes[who],
    get: (who, path) => getPath(lanes[who], path),
    set,
    on(cb){ listeners.add(cb); return () => listeners.delete(cb); },
    send, onStream,
    provide(k, fn){ providers.set(k, fn); },
    request,
    forget(k){ cache.delete(k); },
    // test : vide mon couloir (rev plus haut, donc il remplace l'ancien partout)
    reset(){
      lanes[me] = { rev:lanes[me].rev + 1, t:Date.now() };
      saveLocal();
      publishLane();
      emit();
    },
    online: who => who === me || Date.now() - lastSeen[who] < ONLINE_FOR,
    connected: () => tr.connected(),
    close(){ clearInterval(pinger); tr.close(); },
  };
}
