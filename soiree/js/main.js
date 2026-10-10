// ============================================================
// main.js : la soiree
//
//  1. qui es-tu (ana / adrien)       ?me= force le role (tests)
//  2. code de soiree (dit a l'oral)  -> salle chiffree
//  3. ouverture quand les deux sont la
//  4. 8 etapes : cartes A/B, "ready", le guide choisit, activite,
//     "done", puis "the other one too" ou "next"
//  5. au revoir
//
// L'etat affiche est TOUJOURS deduit des deux couloirs (flow.js),
// donc un rechargement reprend au meme endroit.
//
// parametres de test : ?t=local (deux onglets, sans reseau)
//                      ?code=xxx  ?force=A|B  ?jump=n
// ============================================================
import { content } from "../content.js";
import { h, $, clear, wait } from "./dom.js";
import { createSky } from "./sky.js";
import { createKompiuter } from "./kompiuter.js";
import { sfx, muteButton } from "./sound.js";
import { createRoom } from "./sync/room.js";
import { normCode } from "./sync/crypto.js";
import { stepPick } from "./draw.js";
import { derive, stepMarks } from "./flow.js";
import { loadPrep, ytId } from "./prep-store.js";
import { createGuide } from "./guides.js";
import { ACTIVITIES } from "./activities.js";

const params = new URLSearchParams(location.search);
const TRANSPORT = params.get("t") === "local" ? "local" : "mqtt";
const FORCE = params.get("force");
const JUMP = parseInt(params.get("jump"), 10);
const L = content.lines;
const STEPS = content.steps;

const sky = createSky($("#sky"));
const k = createKompiuter($("#kompiuter"), { sfx });
const stage = $("#stage");
$("#topbar").append(muteButton());

let me = null, other = null, room = null, prep = null, picks = [];
let ui = { key:null, pos:null };
let busy = false, pendingRender = false;
let activity = null;          // { cleanup }
let guide = null;
let konamiSeen = null;

document.addEventListener("click", e => {
  if (e.target.closest("button")) sfx.click();
});

// ════════════════════════════════════════════════════════════
// 1. identite et code
// ════════════════════════════════════════════════════════════
function askWho(){
  k.say(L.who);
  clear(stage).append(h("div", { class:"who" },
    ["ana", "adrien"].map(n => h("button", { text:`i am ${n}`, onclick:() => { me = n; askCode(); } }))
  ));
}

function askCode(){
  const urlCode = params.get("code") || content.secretWord;
  if (urlCode) return join(urlCode);
  k.say(L.code);
  const input = h("input", { type:"text", class:"keep-case", placeholder:"the secret word", autocomplete:"off" });
  const msg = h("p", { class:"small warn" });
  const go = () => {
    if (normCode(input.value).length < 3){ msg.textContent = "a bit longer please"; return; }
    join(input.value);
  };
  input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  clear(stage).append(h("section", { class:"card narrow" },
    h("h2", { text:"the secret word" }),
    h("div", { class:"row" }, h("div", { class:"grow" }, input), h("button", { text:"enter", onclick:go })),
    msg,
  ));
  input.focus();
}

async function join(code){
  other = me === "ana" ? "adrien" : "ana";
  try { sessionStorage.setItem("soiree-me", me); sessionStorage.setItem("soiree-code", code); } catch {}
  clear(stage).append(h("p", { class:"center muted", text:"connecting..." }));
  try {
    room = await createRoom({ me, code, transport:TRANSPORT, onStatus:onNet });
  } catch (e){
    console.error(e);
    k.say("hmm this secret word do not work. try again");
    try { sessionStorage.removeItem("soiree-code"); } catch {}
    return askCode();
  }
  prep = await loadPrep(me);
  provideContent();
  picks = STEPS.map((_, s) => stepPick(room.seed, s, FORCE));
  await room.ready;
  if (params.has("reset")){                 // test : repartir de zero
    room.reset();
    params.delete("reset");
    history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : ""));
  }
  if (Number.isInteger(JUMP) && JUMP > 0) devJump(JUMP);
  room.on(render);
  setInterval(render, 2000);
  render();
}

function onNet(n){
  const el = $("#net");
  if (!el) return;
  el.textContent = n > 0 ? "" : L.reconnect;
}

// ════════════════════════════════════════════════════════════
// contenus de ma prepa, fournis a l'autre sur demande
// ════════════════════════════════════════════════════════════
function localContent(key){
  if (key === "prep:jdg") return ytId(prep.jdg) || "";
  if (key === "prep:photos") return prep.photos.map(p => ({ has:!!p.src, caption:p.caption }));
  const m = key.match(/^prep:photo:(\d)$/);
  if (m){ const p = prep.photos[+m[1]]; return p ? { src:p.src, caption:p.caption } : null; }
  if (key === "prep:text") return { kind:prep.text.kind, body:prep.text.body };
  if (key === "prep:trivia") return prep.trivia.filter(t => t.q.trim());
  if (key === "prep:lies") return prep.lies.filter(l => l.s.some(x => x.trim()));
  return null;
}

function provideContent(){
  ["prep:jdg", "prep:photos", "prep:trivia", "prep:lies",
   ...prep.photos.map((_, i) => "prep:photo:" + i)]
    .forEach(key => room.provide(key, () => localContent(key)));
  // le texte ne part que quand son auteur l'a lu a voix haute
  room.provide("prep:text", () => (room.get(me, "share.text") ? localContent("prep:text") : null));
}

// ════════════════════════════════════════════════════════════
// rendu
// ════════════════════════════════════════════════════════════
function keyOf(pos){
  if (pos.phase === "play") return `play:${pos.step}:${pos.opt}`;
  if (pos.phase === "intro" || pos.phase === "after") return `${pos.phase}:${pos.step}`;
  return pos.phase;
}

function render(){
  if (!room) return;
  if (busy){ pendingRender = true; return; }
  const pos = derive(room.lane(me), room.lane(other), picks);
  updateFrise(pos);
  checkKonami();
  const key = keyOf(pos);
  if (key !== ui.key){
    const prev = ui;
    ui = { key, pos };
    transition(prev, pos);
  } else {
    ui.pos = pos;
    refresh(pos);
  }
}

async function transition(prev, pos){
  busy = true;
  try {
    if (pos.phase === "opening") mountOpening();
    else if (pos.phase === "end") mountEnd();
    else if (pos.phase === "intro") mountIntro(pos);
    else if (pos.phase === "play") await mountPlay(prev, pos);
    else if (pos.phase === "after") mountAfter(pos);
  } catch (e){
    console.error(e);
  }
  busy = false;
  if (pendingRender){ pendingRender = false; render(); }
  else refresh(ui.pos);
}

function refresh(pos){
  if (!pos) return;
  if (pos.phase === "opening") refreshOpening();
  if (pos.phase === "intro") refreshIntro(pos);
  if (pos.phase === "play") refreshPlay(pos);
  if (pos.phase === "after") refreshAfter(pos);
}

// ── frise ────────────────────────────────────────────────────

function updateFrise(pos){
  const fr = $("#frise");
  if (!room || pos.phase === "opening"){ fr.style.visibility = "hidden"; return; }
  fr.style.visibility = "visible";
  const marks = stepMarks(room.lane(me), room.lane(other), picks);
  clear(fr).append(...STEPS.map((st, s) => h("span", {
    class:"cell" + (marks[s] >= 1 ? " done" : "") + (marks[s] === 2 ? " double" : "") + (pos.step === s ? " now" : ""),
    title:st.title,
    text:String(s + 1),
  })));
}

// ── konami : pluie d'etoiles filantes chez les deux ─────────
const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
let kIdx = 0;
document.addEventListener("keydown", e => {
  if (e.target.closest && e.target.closest("input, textarea")) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  kIdx = key === KONAMI[kIdx] ? kIdx + 1 : (key === KONAMI[0] ? 1 : 0);
  if (kIdx === KONAMI.length){
    kIdx = 0;
    sky.shower(); sfx.star();
    if (room) room.set("konami", (room.get(me, "konami") || 0) + 1);
  }
});
function checkKonami(){
  const n = room.get(other, "konami") || 0;
  if (konamiSeen === null){ konamiSeen = n; return; }
  if (n > konamiSeen){ konamiSeen = n; sky.shower(); sfx.star(); }
}

// ════════════════════════════════════════════════════════════
// ouverture
// ════════════════════════════════════════════════════════════
let openingPlayed = false, openingDone = false;
function mountOpening(){
  destroyActivity();
  const btn = h("button", { text:"let's go →", style:"display:none", onclick:() => {
    room.set("flow.open", true);
  }});
  const status = h("p", { class:"muted center", id:"open-status" });
  clear(stage).append(h("section", { class:"opening" },
    h("h1", { class:"center", text:"our little trip" }),
    status,
    h("div", { class:"center" }, btn),
  ));
  mountOpening.btn = btn;
  refreshOpening();
}

async function refreshOpening(){
  const btn = mountOpening.btn, status = $("#open-status");
  if (!btn || !status) return;
  const both = room.online(other);
  const mineOpen = room.get(me, "flow.open");
  if (mineOpen){
    btn.style.display = "none";
    status.textContent = L.readyWait;
    return;
  }
  if (!both){ status.textContent = ""; return; }
  status.textContent = "";
  if (!openingPlayed){
    openingPlayed = true;
    for (const line of L.opening){ await k.say(line); await wait(1300); }
    openingDone = true;
  }
  if (openingDone && !room.get(me, "flow.open")) btn.style.display = "";
}

// ════════════════════════════════════════════════════════════
// etape : ecran commun
// ════════════════════════════════════════════════════════════
let shell = null;   // { step, root, cards:{A,B}, slot, activityEl, bar }

function ensureShell(step){
  if (shell && shell.step === step && document.body.contains(shell.root)) return shell;
  destroyActivity();
  if (guide){ guide.destroy(); guide = null; }
  const st = STEPS[step];
  const card = o => {
    const vid = st.id === "escape" ? content.museums[o === "A" ? 0 : 1] : null;
    const id = vid && ytId(vid.url);
    return h("div", { class:"opt", "data-opt":o },
      id ? h("img", { class:"opt-thumb", src:`https://i.ytimg.com/vi/${id}/mqdefault.jpg`, alt:"" }) : null,
      h("h3", { text:(vid && vid.label) || st[o].title }));
  };
  const cards = { A:card("A"), B:card("B") };
  const slot = h("div", { class:"guide-slot" });
  const activityEl = h("div", { class:"activity" });
  const bar = h("div", { class:"bar" });
  const root = h("section", { class:"step" },
    h("h1", { class:"step-title" }, h("span", { class:"muted", text:`stop ${step + 1} · ` }), st.title),
    h("div", { class:"stage" }, slot, h("div", { class:"opts" }, cards.A, cards.B)),
    activityEl,
    bar,
  );
  clear(stage).append(root);
  guide = createGuide(slot, st.guide);
  shell = { step, root, cards, slot, activityEl, bar };
  return shell;
}

function setChosen(sh, opt, both){
  for (const o of ["A", "B"]){
    sh.cards[o].classList.toggle("chosen", o === opt);
    sh.cards[o].classList.toggle("faded", !both && o !== opt);
    sh.cards[o].classList.toggle("also", both && o !== opt);
  }
}

// ── intro : les deux cartes, "ready" ──────────────────────────
function mountIntro(pos){
  const sh = ensureShell(pos.step);
  destroyActivity();
  setChosen(sh, null, false);
  sh.root.classList.remove("playing");
  const st = STEPS[pos.step];
  k.say(st.intro);
  const btn = h("button", { class:"big", text:L.readyBtn, onclick:() => {
    room.set(`flow.s${pos.step}.ready`, true);
  }});
  const info = h("p", { class:"muted small" });
  clear(sh.bar).append(btn, info);
  sh.readyBtn = btn; sh.info = info;
  refreshIntro(pos);
}

function refreshIntro(pos){
  const sh = shell;
  if (!sh || !sh.readyBtn) return;
  const mine = room.get(me, `flow.s${pos.step}.ready`);
  const theirs = room.get(other, `flow.s${pos.step}.ready`);
  sh.readyBtn.disabled = !!mine;
  sh.readyBtn.textContent = mine ? L.readyWait : L.readyBtn;
  sh.info.textContent = theirs && !mine ? `${other} is ready` : "";
}

// ── play : animation du guide, puis l'activite ───────────────
async function mountPlay(prev, pos){
  const sh = ensureShell(pos.step);
  const st = STEPS[pos.step];
  const live = prev.key === `intro:${pos.step}`;
  clear(sh.bar);
  if (live){
    destroyActivity();
    k.say(st.pick);
    sfx.pick();
    await guide.choose([sh.cards.A, sh.cards.B], pos.first === "A" ? 0 : 1, { refuse:pos.both });
    sfx.flip();
    if (pos.both){ await k.say(L.refuse); await wait(800); }
  } else if (pos.round === 2){
    destroyActivity();
    k.say("and now the other one");
  } else {
    destroyActivity();
  }
  setChosen(sh, pos.opt, pos.both);
  sh.root.classList.add("playing");
  await mountActivity(pos, sh);
  const done = h("button", { class:"big", text:L.doneBtn, onclick:() => {
    room.set(`flow.s${pos.step}.done.${pos.opt}`, true);
  }});
  const info = h("p", { class:"muted small" });
  clear(sh.bar).append(done, info);
  sh.doneBtn = done; sh.info = info;
}

function refreshPlay(pos){
  const sh = shell;
  if (!sh || !sh.doneBtn) return;
  const mine = room.get(me, `flow.s${pos.step}.done.${pos.opt}`);
  const theirs = room.get(other, `flow.s${pos.step}.done.${pos.opt}`);
  sh.doneBtn.disabled = !!mine;
  sh.doneBtn.textContent = mine ? L.readyWait : L.doneBtn;
  sh.info.textContent = theirs && !mine ? `${other} has finish` : "";
}

// ── after : refaire l'autre carte ou continuer ───────────────
function mountAfter(pos){
  const sh = ensureShell(pos.step);
  destroyActivity();
  setChosen(sh, pos.opt, false);
  sh.root.classList.remove("playing");
  const second = pos.opt === "A" ? "B" : "A";
  k.say(L.afterAsk);
  const bOther = h("button", { class:"big", text:`${L.otherBtn} : ${STEPS[pos.step][second].title}`,
    onclick:() => room.set(`flow.s${pos.step}.after`, "other") });
  const bNext = h("button", { class:"big", text:L.nextBtn + " →",
    onclick:() => room.set(`flow.s${pos.step}.after`, "next") });
  const info = h("p", { class:"muted small" });
  clear(sh.bar).append(h("div", { class:"row center-row" }, bOther, bNext), info);
  sh.vote = { bOther, bNext, info };
  refreshAfter(pos);
}

let disagreeSaid = false;
function refreshAfter(pos){
  const sh = shell;
  if (!sh || !sh.vote) return;
  const { bOther, bNext, info } = sh.vote;
  bOther.classList.toggle("on", pos.mine === "other");
  bNext.classList.toggle("on", pos.mine === "next");
  if (pos.mine && pos.theirs && pos.mine !== pos.theirs){
    info.textContent = L.disagree;
    if (!disagreeSaid){ disagreeSaid = true; k.say(L.disagree); }
  } else {
    disagreeSaid = false;
    info.textContent = pos.mine && !pos.theirs ? L.readyWait
      : pos.theirs && !pos.mine ? `${other} vote : ${pos.theirs === "next" ? "next" : "the other one"}` : "";
  }
}

// ── activite ─────────────────────────────────────────────────
function destroyActivity(){
  if (activity){ try { activity.cleanup(); } catch (e){ console.error(e); } activity = null; }
  if (shell) clear(shell.activityEl);
}

async function mountActivity(pos, sh){
  destroyActivity();
  const st = STEPS[pos.step];
  const entry = ACTIVITIES[`${st.id}:${pos.opt}`];
  const el = h("div", { class:"act" });
  sh.activityEl.append(el);
  const ns = `g.${st.id}${pos.opt}`;
  const cleanups = [];
  const ctx = {
    el, me, other,
    seed: room.seed,
    step: pos.step, stepId: st.id, opt: pos.opt,
    params: (entry && entry.params) || {},
    content, prep, sfx, sky,
    say: t => k.say(t),
    get: (who, path) => room.get(who, path ? `${ns}.${path}` : ns),
    set: (path, v) => room.set(`${ns}.${path}`, v),
    setGlobal: (path, v) => room.set(path, v),
    lane: who => room.lane(who),
    onChange: cb => { const u = room.on(cb); cleanups.push(u); return u; },
    send: (kind, data) => room.send(`${ns}:${kind}`, data),
    onStream: (kind, cb) => { const u = room.onStream(`${ns}:${kind}`, cb); cleanups.push(u); return u; },
    request: (owner, key) => (owner === me ? Promise.resolve(localContent(key)) : room.request(key)),
    online: who => room.online(who),
    markDone: () => room.set(`flow.s${pos.step}.done.${pos.opt}`, true),
    onCleanup: fn => cleanups.push(fn),
  };
  activity = { cleanup: () => cleanups.splice(0).forEach(f => { try { f(); } catch (e){ console.error(e); } }) };
  if (!entry){ el.append(h("p", { class:"muted", text:"this part is not ready" })); return; }
  try {
    const mod = await entry.load();
    const c = mod.mount(ctx);
    if (typeof c === "function") cleanups.push(c);
  } catch (e){
    console.error(e);
    el.append(h("p", { class:"warn", text:"oups, this part has a bug. do it on the phone and click done" }));
  }
}

// ════════════════════════════════════════════════════════════
// fin
// ════════════════════════════════════════════════════════════
function mountEnd(){
  destroyActivity();
  if (guide){ guide.destroy(); guide = null; }
  shell = null;
  clear(stage).append(h("section", { class:"opening" },
    h("h1", { class:"center", text:"good nigth" }),
    h("p", { class:"center muted", text:L.goodbye }),
  ));
  k.say(L.goodbye);
  sfx.fanfare();
  setTimeout(() => sky.shower(30), 600);
}

// ════════════════════════════════════════════════════════════
// test : saute directement a l'etape n (les deux onglets le font)
// ════════════════════════════════════════════════════════════
function devJump(n){
  if (room.get(me, "flow.open")) return;
  room.set("flow.open", true);
  for (let s = 0; s < Math.min(n, STEPS.length); s++){
    const p = picks[s];
    room.set(`flow.s${s}.ready`, true);
    room.set(`flow.s${s}.done.${p.first}`, true);
    if (p.both) room.set(`flow.s${s}.done.${p.first === "A" ? "B" : "A"}`, true);
    else room.set(`flow.s${s}.after`, "next");
  }
}

// ── demarrage ───────────────────────────────────────────────
const forced = params.get("me");
let saved = {};
try { saved = { me:sessionStorage.getItem("soiree-me"), code:sessionStorage.getItem("soiree-code") }; } catch {}
if (forced === "ana" || forced === "adrien"){ me = forced; askCode(); }
else if ((saved.me === "ana" || saved.me === "adrien") && (content.secretWord || saved.code)){ me = saved.me; join(content.secretWord || saved.code); }
else askWho();
