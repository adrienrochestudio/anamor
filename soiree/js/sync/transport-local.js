// ============================================================
// transport-local.js : meme interface que transport-mqtt, mais
// entre onglets d'un meme navigateur (BroadcastChannel). Sert aux
// tests a deux fenetres sans reseau : ?t=local dans l'URL.
// Les messages retenus vivent dans localStorage.
// ============================================================
export function createLocalTransport({ base, onMessage, onStatus }){
  const ch = new BroadcastChannel("anamor-" + base);
  const KEY = "lt:" + base + "/";

  ch.onmessage = e => {
    const { suffix, payload, retain } = e.data || {};
    if (typeof suffix === "string" && typeof payload === "string") onMessage(suffix, payload, !!retain);
  };

  // rejoue les messages retenus, comme un broker a l'abonnement
  setTimeout(() => {
    for (let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY)) onMessage(k.slice(KEY.length), localStorage.getItem(k), true);
    }
    onStatus && onStatus(1);
  }, 30);

  return {
    publish(suffix, payload, { retain = false } = {}){
      if (retain) try { localStorage.setItem(KEY + suffix, payload); } catch {}
      ch.postMessage({ suffix, payload, retain });
    },
    connected(){ return 1; },
    close(){ ch.close(); },
  };
}
