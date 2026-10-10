// ============================================================
// video.js : lecteur YouTube synchronise (etape 1 et finale)
//
// Pas de controles YouTube natifs (sinon un ecran partirait sans
// l'autre). Nos boutons ecrivent une commande dans MON couloir :
//   cmd = { a:"play"|"pause", pos:secondes, ts:ms }
// La commande la plus recente des deux couloirs fait foi.
// Correction d'ecart toutes les 3 s pendant la lecture.
// Si la video refuse l'integration : compte a rebours commun,
// puis un lien pour l'ouvrir sur YouTube des deux cotes.
// ============================================================
import { h, clear } from "../dom.js";
import { loadYT, EMBED_REFUSED } from "../yt.js";
import { ytId } from "../prep-store.js";

export function mount(ctx){
  const { params, content } = ctx;
  const box = h("div", { class:"video-box" });
  const ctrl = h("div", { class:"video-ctrl" });
  const note = h("p", { class:"small muted center" });
  const extra = h("div");
  ctx.el.append(box, ctrl, note, extra);

  let player = null, ready = false, applying = false, timer = null, alive = true, refused = false;
  let videoId = null;
  ctx.onCleanup(() => { alive = false; clearInterval(timer); try { player && player.destroy(); } catch {} });

  // ── d'ou vient la video ───────────────────────────────────
  async function resolveId(){
    const manual = latest("manual");
    if (manual && ytId(manual.v)) return ytId(manual.v);
    if (params.source === "museum"){
      const m = content.museums[params.index];
      return m ? ytId(m.url) : null;
    }
    if (params.source === "jdg"){
      note.textContent = `i ask ${params.owner} for the video...`;
      try { return ytId(await ctx.request(params.owner, "prep:jdg")) || null; }
      catch { return null; }
    }
    return null;
  }

  function latest(path){
    const a = ctx.get(ctx.me, path), b = ctx.get(ctx.other, path);
    return [a, b].filter(Boolean).sort((x, y) => (y.ts || 0) - (x.ts || 0))[0] || null;
  }

  // ── si la video manque, l'un des deux peut coller un lien ──
  function askManual(){
    const input = h("input", { type:"url", class:"keep-case", placeholder:"paste a youtube link" });
    const go = () => {
      if (!ytId(input.value)){ input.value = ""; input.placeholder = "this is not a youtube link"; return; }
      ctx.set("manual", { v:input.value.trim(), ts:Date.now() });
    };
    clear(extra).append(h("div", { class:"panel" },
      h("p", { text:"i have no video here. one of you paste a youtube link, i give it to both" }),
      h("div", { class:"row" }, h("div", { class:"grow" }, input), h("button", { text:"ok", onclick:go }))));
  }

  // ── lecteur ───────────────────────────────────────────────
  async function start(){
    videoId = await resolveId();
    if (!alive) return;
    if (!videoId){ note.textContent = ""; askManual(); return; }
    clear(extra);
    note.textContent = "loading...";
    let YT;
    try { YT = await loadYT(); } catch { note.textContent = "youtube not reachable. watch it on the phone"; return; }
    if (!alive) return;
    clear(box);
    const holder = h("div");
    box.append(holder);
    player = new YT.Player(holder, {
      videoId,
      host:"https://www.youtube-nocookie.com",
      playerVars:{ controls:0, disablekb:1, rel:0, playsinline:1, modestbranding:1, iv_load_policy:3, fs:0 },
      events:{
        onReady:() => { ready = true; note.textContent = "press play when you are both ready"; buildCtrl(); apply(); },
        onError:e => { if (EMBED_REFUSED.has(e.data)) fallback(); else note.textContent = "this video do not work"; },
        onStateChange:() => {},
      },
    });
    clearInterval(timer);
    timer = setInterval(() => apply(true), 3000);
  }

  const now = () => (player && ready ? player.getCurrentTime() || 0 : 0);

  function command(a, pos){
    ctx.set("cmd", { a, pos:Math.max(0, pos), ts:Date.now() });
  }

  function buildCtrl(){
    const playBtn = h("button", { class:"big", text:"play" });
    playBtn.addEventListener("click", () => {
      const c = latest("cmd");
      const playing = c && c.a === "play";
      command(playing ? "pause" : "play", now());
    });
    const jump = d => h("button", { class:"small", text:(d > 0 ? "+" : "") + d + "s", onclick:() => {
      const c = latest("cmd");
      command(c && c.a === "play" ? "play" : "pause", now() + d);
    }});
    const full = h("button", { class:"small", text:"big screen", onclick:() => {
      const el = box;
      (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
    }});
    clear(ctrl).append(jump(-30), jump(-10), playBtn, jump(10), jump(30), full);
    buildCtrl.playBtn = playBtn;
  }

  function apply(soft){
    if (!ready || applying || refused) return;
    const c = latest("cmd");
    if (buildCtrl.playBtn) buildCtrl.playBtn.textContent = c && c.a === "play" ? "pause" : "play";
    if (!c) return;
    applying = true;
    try {
      const target = c.a === "play" ? c.pos + (Date.now() - c.ts) / 1000 : c.pos;
      const drift = Math.abs(now() - target);
      if (c.a === "play"){
        if (drift > (soft ? 1.5 : 0.8)) player.seekTo(target, true);
        const st = player.getPlayerState();
        if (st !== 1 && st !== 3) player.playVideo();
        if (!soft) setTimeout(checkBlocked, 2500);
        note.textContent = "";
      } else {
        if (player.getPlayerState() === 1) player.pauseVideo();
        if (drift > 0.5) player.seekTo(target, true);
        note.textContent = "paused";
      }
    } finally { applying = false; }
  }

  // le navigateur a bloque la lecture automatique : un clic ici
  function checkBlocked(){
    if (!alive || !ready) return;
    const c = latest("cmd");
    if (!c || c.a !== "play") return;
    if (player.getPlayerState() === 1) return;
    clear(extra).append(h("div", { class:"center" },
      h("button", { class:"big", text:"click here to start the video", onclick:() => {
        clear(extra); player.playVideo(); setTimeout(() => apply(), 400);
      }})));
  }

  // ── integration refusee : ouverture commune sur youtube ───
  function fallback(){
    refused = true;
    clear(box).append(h("div", { class:"center", style:"padding:40px" },
      h("p", { text:"this video refuse to play inside my page" })));
    clear(ctrl).append(h("button", { class:"big", text:"open it on youtube together", onclick:() => {
      ctx.set("open", { ts:Date.now() });
    }}));
    note.textContent = "";
  }
  let openSeen = (latest("open") || {}).ts || 0;
  function watchOpen(){
    const o = latest("open");
    if (!o || o.ts <= openSeen) return;
    openSeen = o.ts;
    let n = 3;
    const cd = h("p", { class:"countdown", text:"3" });
    clear(extra).append(cd);
    const t = setInterval(() => {
      n--;
      if (n > 0){ cd.textContent = String(n); ctx.sfx.tick(); return; }
      clearInterval(t);
      const url = "https://www.youtube.com/watch?v=" + videoId;
      clear(extra).append(h("div", { class:"center" },
        h("a", { class:"btn big", href:url, target:"_blank", rel:"noopener", text:"go ! click here" })));
    }, 1000);
  }

  let lastManual = (latest("manual") || {}).ts || 0;
  ctx.onChange(() => {
    const m = latest("manual");
    if (m && m.ts > lastManual){
      lastManual = m.ts;
      try { player && player.destroy(); } catch {}
      player = null; ready = false; refused = false;
      start();
      return;
    }
    apply();
    watchOpen();
  });

  ctx.say(params.source === "jdg"
    ? "lights off. popcorn. press play together"
    : "take your plate, we go visit. press play when you are ready");
  start();
}
