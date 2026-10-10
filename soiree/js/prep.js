// ============================================================
// prep.js : page de preparation (une par personne)
// tout reste dans le navigateur de la personne (prep-store.js)
// ============================================================
import { content } from "../content.js";
import { h, $, clear, debounce } from "./dom.js";
import { createSky } from "./sky.js";
import { createKompiuter } from "./kompiuter.js";
import { sfx, muteButton } from "./sound.js";
import { loadYT, EMBED_REFUSED } from "./yt.js";
import {
  loadPrep, savePrep, progress, ytId, exportFile, importFile,
  photoToDataUrl, N_PHOTOS
} from "./prep-store.js";

createSky($("#sky"));
const k = createKompiuter($("#kompiuter"), { sfx });
$("#kompiuter").append(h("div", { style:"margin-left:auto;align-self:flex-start" }, muteButton()));
const app = $("#app");
k.say(content.prep.hello);

let me = null, prep = null;
let gaugeFill, gaugeText, savedEl;

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
  try { localStorage.setItem("soiree-prep-me", me); } catch {}
  prep = await loadPrep(me);
  render();
}

// ── sauvegarde ───────────────────────────────────────────────
const persist = debounce(async () => {
  try {
    await savePrep(prep);
    savedEl.textContent = "saved";
    savedEl.className = "small ok";
  } catch (e){
    console.error(e);
    savedEl.textContent = "not saved ! download a copy";
    savedEl.className = "small warn";
  }
}, 400);

function changed(){
  savedEl.textContent = "";
  savedEl.className = "small muted";
  updateGauge();
  persist();
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
    sectionSave(),
  );
  updateGauge();
}

function card(title, help, ...body){
  return h("section", { class:"card" }, h("h2", { text:title }), help ? h("p", { class:"muted", text:help }) : null, ...body);
}

// ── 1. video joueur du grenier ───────────────────────────────
function sectionJdg(){
  const input = h("input", { type:"url", class:"keep-case", placeholder:"https://www.youtube.com/watch?v=...", value:prep.jdg });
  const status = h("p", { class:"small" });
  const box = h("div", { class:"yt-preview" });
  box.style.display = "none";
  let player = null;

  async function check(){
    const id = ytId(input.value);
    clear(status);
    if (!input.value.trim()){ box.style.display = "none"; return; }
    if (!id){ status.className = "small warn"; status.textContent = "not a youtube link"; box.style.display = "none"; return; }
    status.className = "small muted"; status.textContent = "...";
    box.style.display = "";
    try {
      const YT = await loadYT();
      if (player){ player.cueVideoById(id); return; }
      const holder = h("div");
      clear(box).append(holder);
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

  return card("your joueur du grenier video", null, input, status, box);
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

  return card("5 photos of us", null, grid, note, picker);
}

// ── 3. texte : lettre ou poeme ──────────────────────────────
function sectionText(){
  const t = prep.text;
  const bLetter = h("button", { class:"small", text:"a letter" });
  const bPoem = h("button", { class:"small", text:"a poem" });
  const area = h("textarea", { class:"keep-case", placeholder:"write here...", value:t.body, maxLength:8000 });
  const sync = () => { bLetter.classList.toggle("on", t.kind === "letter"); bPoem.classList.toggle("on", t.kind === "poem"); };
  bLetter.addEventListener("click", () => { t.kind = "letter"; sync(); changed(); });
  bPoem.addEventListener("click", () => { t.kind = "poem"; sync(); changed(); });
  area.addEventListener("input", () => { t.body = area.value; changed(); });
  sync();
  return card("a letter or a poem", "you read it out loud tonight",
    h("div", { class:"row" }, bLetter, bPoem), h("div", { style:"height:10px" }), area);
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
  return card("10 questions about you", "good answers : separate them with /",
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

// ── sauvegarde fichier ───────────────────────────────────────
function sectionSave(){
  const file = h("input", { type:"file", accept:"application/json,.json", style:"display:none" });
  const msg = h("p", { class:"small" });
  file.addEventListener("change", async () => {
    try {
      prep = await importFile(file.files[0], me);
      await savePrep(prep);
      render();
    } catch (e){
      msg.className = "small warn";
      msg.textContent = e.message === "not your file" ? "this copy is not yours" : "i cannot read this file";
    }
    file.value = "";
  });
  return card("a copy, just in case",
    "everything stays only in this browser. download a copy. if it disappear, load the copy",
    h("div", { class:"row" },
      h("button", { text:"download a copy", onclick:() => exportFile(prep) }),
      h("button", { text:"load a copy", onclick:() => file.click() }),
    ),
    msg, file,
    h("p", { class:"small muted" }, "not ", me, " ? ",
      h("a", { href:"#", text:"change", onclick:e => { e.preventDefault(); try { localStorage.removeItem("soiree-prep-me"); } catch {} askWho(); } })),
  );
}
