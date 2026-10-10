// ============================================================
// prep.js : page de preparation (une par personne)
// chaque frappe est gardee dans le navigateur (prep-store.js) et,
// quelques secondes apres, deposee dans la boite de tino
// (sync/box.js), d'ou le jeu la relit le soir.
// ============================================================
import { content } from "../content.js";
import { h, $, clear, debounce } from "./dom.js";
import { createSky } from "./sky.js";
import { createKompiuter } from "./kompiuter.js";
import { sfx, muteButton } from "./sound.js";
import { loadYT, EMBED_REFUSED } from "./yt.js";
import { loadPrep, savePrep, progress, ytId, photoToDataUrl, N_PHOTOS } from "./prep-store.js";
import { openBox, verifyBox } from "./sync/box.js";

const TRANSPORT = new URLSearchParams(location.search).get("t") === "local" ? "local" : "mqtt";

createSky($("#sky"));
const k = createKompiuter($("#kompiuter"), { sfx });
$("#kompiuter").append(h("div", { style:"margin-left:auto;align-self:flex-start" }, muteButton()));
const app = $("#app");
k.say(content.prep.hello);

let me = null, other = null, prep = null, box = null, touched = false;
let gaugeFill, gaugeText, savedEl;
let local = "", cloud = "";             // etat affiche : ici / chez tino

// ── identite ─────────────────────────────────────────────────
const forced = new URLSearchParams(location.search).get("me");
let stored = null;
try { stored = localStorage.getItem("soiree-prep-me"); } catch {}
if (forced === "ana" || forced === "adrien") start(forced);
else if (stored === "ana" || stored === "adrien") start(stored);
else askWho();

function askWho(){
  clear(app).append(h("div", { class:"who" },
    ["ana", "adrien"].map(n => h("button", { text:`i am ${n}`, onclick:() => start(n) }))
  ));
}

async function start(who){
  me = who;
  other = me === "ana" ? "adrien" : "ana";
  touched = false;
  try { localStorage.setItem("soiree-prep-me", me); } catch {}
  prep = await loadPrep(me);
  render();
  connectBox();
}

// ── la boite de tino ─────────────────────────────────────────
let boxP = null;
function ensureBox(){
  if (!boxP) boxP = openBox({ transport:TRANSPORT }).then(b => {
    box = b;
    b.on(() => { if (cloud === "offline" && b.connected()) scheduleUpload(200); });
    return b;
  }, e => { console.error(e); boxP = null; return null; });
  return boxP;
}
async function connectBox(){
  if (!await ensureBox()) return;
  // une version plus recente chez tino (rempli sur un autre appareil) : on la reprend
  const r = await box.wait(me, 7000);
  if (r && !touched && r.prep.updated > prep.updated){
    r.prep.photos.forEach((ph, i) => { if (!ph.src && r.has[i] && prep.photos[i].src) ph.src = prep.photos[i].src; });
    prep = r.prep;
    try { await savePrep(prep, { keep:true }); } catch {}
    cloud = "ok";
    render();
  } else if (!r || r.manifest.updated !== prep.updated){
    if (progress(prep).done > 0) scheduleUpload(300);
  } else { cloud = "ok"; showStatus(); }
}

let upTimer = null, uploading = false;
function scheduleUpload(ms = 2500){
  clearTimeout(upTimer);
  upTimer = setTimeout(uploadNow, ms);
}
async function uploadNow(){
  if (!box){ ensureBox(); return scheduleUpload(5000); }
  if (uploading) return scheduleUpload(1500);
  uploading = true;
  cloud = "sending"; showStatus();
  try {
    await box.upload(prep);
    cloud = "ok";
  } catch (e){
    console.warn("box", e && e.message);
    cloud = "offline";
    scheduleUpload(8000);
  }
  uploading = false;
  showStatus();
}

// ── sauvegarde ici, a chaque frappe ──────────────────────────
let saveTimer = null;
async function saveNow(){
  clearTimeout(saveTimer); saveTimer = null;
  try { await savePrep(prep); local = "ok"; }
  catch (e){ console.error(e); local = "fail"; }
  showStatus();
}
const flushSave = () => { if (saveTimer) saveNow(); };
window.addEventListener("pagehide", flushSave);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });

function changed(){
  touched = true;
  local = "pending"; cloud = cloud === "offline" ? "offline" : "pending";
  showStatus();
  updateGauge();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
  scheduleUpload();
}

function showStatus(){
  if (!savedEl) return;
  const here = local === "fail" ? "not saved here !" : local === "pending" ? "..." : "saved";
  const there = cloud === "ok" ? " · tino has it" : cloud === "sending" ? " · sending to tino" : cloud === "offline" ? " · tino offline, i retry" : "";
  savedEl.textContent = here + there;
  savedEl.className = "small " + (local === "fail" || cloud === "offline" ? "warn" : cloud === "ok" && local !== "pending" ? "ok" : "muted");
}

function updateGauge(){
  const pr = progress(prep);
  gaugeFill.style.width = pr.pct + "%";
  gaugeText.textContent = `${pr.pct} %`;
  if (pr.pct === 100 && !updateGauge.cheered){ updateGauge.cheered = true; sfx.good(); }
}

// ── rendu ────────────────────────────────────────────────────
function render(){
  gaugeFill = h("div", { class:"gauge-fill" });
  gaugeText = h("span");
  savedEl = h("span", { class:"small muted", text:"" });
  if (!local) local = "ok";
  clear(app).append(
    h("div", { class:"gauge" },
      h("div", { class:"row" }, h("span", { class:"grow" }, `${me} · `, gaugeText), savedEl),
      h("div", { class:"gauge-bar" }, gaugeFill)
    ),
    sectionJdg(),
    sectionPhotos(),
    sectionText(),
    sectionTrivia(),
    sectionLies(),
    sectionSend(),
  );
  updateGauge();
  showStatus();
}

function card(title, help, ...body){
  return h("section", { class:"card" }, h("h2", { text:title }), help ? h("p", { class:"muted", text:help }) : null, ...body);
}

// ── 1. video joueur du grenier ───────────────────────────────
function sectionJdg(){
  const input = h("input", { type:"url", class:"keep-case", placeholder:"https://www.youtube.com/watch?v=...", value:prep.jdg });
  const status = h("p", { class:"small" });
  const preview = h("div", { class:"yt-preview" });
  preview.style.display = "none";
  let player = null;

  async function check(){
    const id = ytId(input.value);
    clear(status);
    if (!input.value.trim()){ preview.style.display = "none"; return; }
    if (!id){ status.className = "small warn"; status.textContent = "not a youtube link"; preview.style.display = "none"; return; }
    status.className = "small muted"; status.textContent = "...";
    preview.style.display = "";
    try {
      const YT = await loadYT();
      if (player){ player.cueVideoById(id); return; }
      const holder = h("div");
      clear(preview).append(holder);
      player = new YT.Player(holder, {
        videoId:id, host:"https://www.youtube-nocookie.com",
        playerVars:{ rel:0, playsinline:1 },
        events:{
          onReady:() => { status.className = "small ok"; status.textContent = "ok"; },
          onStateChange:() => {},
          onError:(e) => {
            status.className = "small warn";
            status.textContent = EMBED_REFUSED.has(e.data)
              ? "this one plays only on youtube. ok for tonight, or choose another"
              : "this video do not work, choose another";
          },
        },
      });
    } catch {
      status.className = "small muted"; status.textContent = "saved";
    }
  }

  input.addEventListener("input", debounce(() => {
    prep.jdg = ytId(input.value) ? input.value.trim() : "";
    changed();
    check();
  }, 500));
  if (prep.jdg) setTimeout(check, 300);

  return card("a video you want to watch tonight", "youtube link. we watch it together at the end", input, status, preview);
}

// ── 2. photos ────────────────────────────────────────────────
function sectionPhotos(){
  const grid = h("div", { class:"photos" });
  const note = h("p", { class:"small muted" });
  const picker = h("input", { type:"file", accept:"image/*", style:"display:none" });
  let target = 0;

  async function setPhoto(i, file){
    if (!file || !file.type.startsWith("image/")) return;
    note.className = "small muted"; note.textContent = "...";
    try {
      prep.photos[i].src = await photoToDataUrl(file);
      note.textContent = "";
      sfx.flip();
      changed();
      draw();
    } catch {
      note.className = "small warn";
      note.textContent = "i cannot read this photo. try a jpg";
    }
  }

  function firstEmpty(){ const i = prep.photos.findIndex(p => !p.src); return i < 0 ? N_PHOTOS - 1 : i; }

  function slot(i){
    const ph = prep.photos[i];
    const el = h("div", { class:"photo-slot" + (ph.src ? " filled" : "") });
    if (ph.src){
      el.append(
        h("img", { src:ph.src, alt:"" }),
        h("input", { type:"text", class:"keep-case", placeholder:"a little word (optional)", value:ph.caption,
          oninput:e => { ph.caption = e.target.value.slice(0, 140); changed(); },
          onclick:e => e.stopPropagation() }),
        h("button", { class:"small", text:"remove", onclick:e => {
          e.stopPropagation(); ph.src = ""; ph.caption = ""; changed(); draw();
        }}),
      );
    } else {
      el.append(h("div", { class:"ph", text:`photo ${i + 1}\nclick or drop` }));
      el.addEventListener("click", () => { target = i; picker.click(); });
    }
    el.addEventListener("dragover", e => { e.preventDefault(); el.classList.add("drag"); });
    el.addEventListener("dragleave", () => el.classList.remove("drag"));
    el.addEventListener("drop", e => {
      e.preventDefault(); el.classList.remove("drag");
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      setPhoto(i, f);
    });
    return el;
  }

  function draw(){ clear(grid).append(...prep.photos.map((_, i) => slot(i))); }

  picker.addEventListener("change", () => { setPhoto(target, picker.files[0]); picker.value = ""; });
  document.addEventListener("paste", e => {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find(it => it.type.startsWith("image/"));
    if (item) setPhoto(firstEmpty(), item.getAsFile());
  });
  draw();

  return card("5 photos of us", `5 moments with ${other} that you love. tonigth you tell the story of each one : where, when, why this photo`, grid, note, picker);
}

// ── 3. un petit poeme : le sien, ou un poeme aime ───────────
function sectionText(){
  const t = prep.text;
  const bMine = h("button", { class:"small", text:"i write it" });
  const bLoved = h("button", { class:"small", text:"a poem i love" });
  const area = h("textarea", { class:"keep-case", value:t.body, maxLength:8000 });
  const sync = () => {
    bMine.classList.toggle("on", t.kind === "mine");
    bLoved.classList.toggle("on", t.kind === "loved");
    area.placeholder = t.kind === "loved" ? "the poem, and who wrote it" : "three little lines...";
  };
  bMine.addEventListener("click", () => { t.kind = "mine"; sync(); changed(); });
  bLoved.addEventListener("click", () => { t.kind = "loved"; sync(); changed(); });
  area.addEventListener("input", () => { t.body = area.value; changed(); });
  sync();
  return card("a little poem", "write one yourself, a haiku is enough (3 short lines). or give a poem you love. you read it out loud tonight",
    h("div", { class:"row" }, bMine, bLoved), h("div", { style:"height:10px" }), area);
}

// ── 4. trivia ────────────────────────────────────────────────
function sectionTrivia(){
  const rows = prep.trivia.map((t, i) => h("div", { class:"qa" },
    h("span", { class:"n", text:i + 1 }),
    h("input", { type:"text", class:"keep-case", placeholder:"a question about you", value:t.q,
      oninput:e => { t.q = e.target.value.slice(0, 300); changed(); } }),
    h("input", { type:"text", class:"keep-case a", placeholder:"answers i accept : a / b / c", value:t.a,
      oninput:e => { t.a = e.target.value.slice(0, 300); changed(); } }),
  ));
  return card("5 questions about you", "good answers : separate them with /",
    ...rows);
}

// ── 5. deux verites un mensonge ──────────────────────────────
function sectionLies(){
  const rounds = prep.lies.map((l, r) => {
    const btns = [];
    const lines = l.s.map((s, i) => {
      const b = h("button", { class:"small" + (l.lie === i ? " on" : ""), text:"the lie" });
      btns.push(b);
      b.addEventListener("click", () => {
        l.lie = i; btns.forEach((x, j) => x.classList.toggle("on", j === i)); changed();
      });
      return h("div", { class:"lie-line" },
        h("input", { type:"text", class:"keep-case", placeholder:`thing ${i + 1}`, value:s,
          oninput:e => { l.s[i] = e.target.value.slice(0, 300); changed(); } }),
        b);
    });
    return h("div", { class:"lie-round" }, h("p", { class:"muted", text:`round ${r + 1}` }), ...lines);
  });
  return card("two truths one lie", "click on the lie",
    ...rounds);
}

// ── envoi final a tino ───────────────────────────────────────
function sectionSend(){
  const msg = h("p", { class:"small" });
  const btn = h("button", { class:"big", text:"send to tino" });
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    clearTimeout(upTimer);
    msg.className = "small muted"; msg.textContent = "...";
    try {
      await saveNow();
      if (!await ensureBox()) throw new Error("offline");
      for (let i = 0; i < 20 && !box.connected(); i++) await new Promise(r => setTimeout(r, 500));
      while (uploading) await new Promise(r => setTimeout(r, 300));
      uploading = true;
      try {
        await box.upload(prep, (d, n) => { msg.textContent = `sending ${Math.round(d / n * 100)} %`; });
      } finally { uploading = false; }
      msg.textContent = "i check...";
      const v = await verifyBox(prep, { transport:TRANSPORT });
      if (v.ok){
        cloud = "ok"; showStatus();
        msg.className = "small ok"; msg.textContent = "tino has everything. you can close";
        sfx.good();
      } else {
        msg.className = "small warn"; msg.textContent = `tino did not get : ${v.missing.join(", ")}. press again`;
      }
    } catch (e){
      console.warn(e);
      cloud = "offline"; showStatus();
      msg.className = "small warn"; msg.textContent = "no internet for tino. it is saved here, press again later";
    }
    btn.disabled = false;
  });
  return card("give it to tino", "when you finish, press the button. after you can still change things, tino get them too",
    h("div", { class:"row" }, btn), msg,
    h("p", { class:"small muted" }, "not ", me, " ? ",
      h("a", { href:"#", text:"change", onclick:e => { e.preventDefault(); try { localStorage.removeItem("soiree-prep-me"); } catch {} location.href = location.pathname; } })),
  );
}
