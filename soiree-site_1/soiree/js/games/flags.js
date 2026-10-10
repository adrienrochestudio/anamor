// ============================================================
// flags.js : duel drapeaux & capitales (etape geography, carte B)
//
// 10 questions tirees du code de soiree : les memes des deux
// cotes, sans rien echanger. Questions paires : drapeau -> pays,
// impaires : pays -> capitale. 4 options, leurres plausibles.
//
// Chacun repond dans son couloir : a.<i> = { c, t, d }
//   c : option choisie   t : Date.now()   d : ms depuis l'affichage
// Score : 1 point par bonne reponse, +1 au plus rapide quand les
// deux ont bon. La vitesse compare d (temps local de chacun),
// insensible au decalage d'horloge entre les deux ordinateurs.
// La question courante est deduite des couloirs (premiere sans
// les deux reponses) : un rechargement reprend au bon endroit.
// ============================================================
import { h, clear, wait } from "../dom.js";
import { seeded, shuffle } from "../draw.js";
import { COUNTRIES, ALIKE, TWINS } from "./flags-data.js";

const N = 10;
const REVEAL_MS = 2500;
const SOFT_SECONDS = 20;
const PEOPLE = ["ana", "adrien"];   // ordre d'affichage fixe

const byCode = Object.fromEntries(COUNTRIES.map(c => [c.c, c]));
const isTwin = (a, b) => TWINS.some(t => t.includes(a) && t.includes(b));

// ── tirage ───────────────────────────────────────────────────
function pickWeighted(list, weight, r){
  let v = r() * list.reduce((s, x) => s + weight(x), 0);
  for (const x of list){ v -= weight(x); if (v < 0) return x; }
  return list[list.length - 1];
}

// 3 leurres : d'abord `first`, puis meme sous-region, region, monde
function decoys(x, first, value, r){
  const out = [];
  const add = v => { if (out.length < 3 && v && v !== value(x) && !out.includes(v)) out.push(v); };
  first.forEach(add);
  for (const near of [c => c.s === x.s, c => c.r === x.r, () => true]){
    if (out.length >= 3) break;
    shuffle(COUNTRIES.filter(c => c !== x && !isTwin(c.c, x.c) && near(c)), r).forEach(c => add(value(c)));
  }
  return out;
}

export function buildQuiz(seed){
  const r = seeded(seed, "flags");
  const used = new Set();
  const quiz = [];
  for (let i = 0; i < N; i++){
    const type = i % 2 === 0 ? "flag" : "capital";
    const pool = COUNTRIES.filter(c => !used.has(c.c) && !(type === "capital" && c.nc));
    const x = pickWeighted(pool, c => (c.f ? 3 : 1), r);
    used.add(x.c);
    let right, wrong;
    if (type === "flag"){
      const alike = ALIKE.filter(g => g.includes(x.c)).flat().filter(c => c !== x.c && !isTwin(c, x.c));
      right = x.n;
      wrong = decoys(x, shuffle([...new Set(alike)], r).slice(0, 2).map(c => byCode[c].n), c => c.n, r);
    } else {
      right = x.cap;
      wrong = decoys(x, x.t ? [x.t] : [], c => c.cap, r);
    }
    const options = shuffle([right, ...wrong], r);
    quiz.push({ type, code:x.c, name:x.n, options, answer:options.indexOf(right) });
  }
  return quiz;
}

// ── voix ─────────────────────────────────────────────────────
const LINES = {
  start:   "10 questions, the same for you two. answer fast : when both are correct, the fastest get a bonus",
  resume:  n => `we continue. question ${n}`,
  both:    ["both correct ! {f} was more fast, +1 bonus", "you two know this one. {f} was quicker", "correct correct. {f} win the speed"],
  bothTie: "both correct, exact same speed. spooky",
  one:     ["{p} find it. it was {a}", "only {p} know : {a}", "point for {p}. it is {a}"],
  none:    ["nobody find it. it was {a}", "oops. it was {a}. i forgive you", "zero for both. {a} is sad"],
  win:     "{w} win the duel, {sw} to {sl}. {l}, i still love you",
  tie:     "same score, {s} each. a perfect couple, i knew it",
  done:    "click done when you finish to celebrate",
  hurry:   "time is over... but answer anyway",
};
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);

// ── drapeaux : un seul fichier vendor/flags.json (code -> svg) ──
let FLAGS = null, flagsLoading = null;
function loadFlags(){
  if (!flagsLoading) flagsLoading = fetch("vendor/flags.json")
    .then(r => r.json()).then(j => (FLAGS = j)).catch(() => (FLAGS = {}));
  return flagsLoading;
}
function flagImg(code){
  const img = h("img", { class:"flags-flag", alt:"mystery flag", draggable:"false" });
  const set = () => {
    const svg = FLAGS && FLAGS[code];
    if (svg) img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };
  if (FLAGS) set(); else loadFlags().then(set);
  return img;
}

// ── module ───────────────────────────────────────────────────
export function mount(ctx){
  injectStyle();
  const quiz = buildQuiz(ctx.seed);
  const { me, other } = ctx;
  loadFlags();

  const answer = (who, i) => {
    const a = ctx.get(who, "a." + i);
    return a && Number.isInteger(a.c) && a.c >= 0 && a.c < 4 ? a : null;
  };
  const bothIn = i => !!(answer(me, i) && answer(other, i));
  const current = () => { let i = 0; while (i < N && bothIn(i)) i++; return i; };

  function result(i){
    const q = quiz[i];
    const ok = {}, pts = {};
    for (const p of PEOPLE){ ok[p] = answer(p, i).c === q.answer; pts[p] = ok[p] ? 1 : 0; }
    let fast = null;
    if (ok.ana && ok.adrien){
      const sp = p => { const a = answer(p, i); return Number.isFinite(a.d) ? a.d : a.t; };
      if (sp("ana") !== sp("adrien")) fast = sp("ana") < sp("adrien") ? "ana" : "adrien";
      if (fast) pts[fast]++;
    }
    return { ok, pts, fast };
  }

  function scores(){
    const s = { ana:0, adrien:0 };
    for (let i = 0; i < N; i++) if (bothIn(i)){
      const { pts } = result(i);
      s.ana += pts.ana; s.adrien += pts.adrien;
    }
    return s;
  }

  // ── rendu ──────────────────────────────────────────────────
  const root = h("div", { class:"panel flags" });
  ctx.el.append(root);
  let view = null, shownAt = 0, revealing = false, lastTick = null;
  let ui = null;     // { buttons, status, timer, score } de la question affichee
  const timers = [];

  function scoreLine(){
    const s = scores();
    return h("span", { class:"flags-score" },
      PEOPLE.map(p => h("span", { class:`flags-${p}`, text:`${p} ${s[p]}` })));
  }

  function show(i){
    view = i;
    revealing = false;
    if (i >= N) return showEnd();
    const q = quiz[i];
    shownAt = Date.now();
    lastTick = null;
    const timer = h("span", { class:"flags-timer muted" });
    const score = h("span", {}, scoreLine());
    const buttons = q.options.map((o, k) => h("button", { class:"flags-opt", onclick:() => choose(k) },
      h("span", { class:"flags-label", text:o }),
      h("span", { class:"flags-tags" })));
    const status = h("p", { class:"flags-status muted small" });
    clear(root).append(
      h("div", { class:"flags-head" },
        h("span", { class:"muted", text:`question ${i + 1} / ${N}` }), timer, score),
      ...(q.type === "flag"
        ? [h("h2", { class:"flags-q", text:"which country has this flag ?" }),
           flagImg(q.code)]
        : [h("h2", { class:"flags-q" }, "capital of ", h("span", { class:"flags-country", text:q.name }), " ?")]),
      h("div", { class:"flags-opts" }, buttons),
      status,
    );
    ui = { buttons, status, timer, score };
    paint();
    tickTimer();
  }

  function tag(p){ return h("span", { class:`flags-tag flags-${p}`, text:p }); }

  function paint(){
    if (!ui || view >= N) return;
    const q = quiz[view];
    const mine = answer(me, view), theirs = answer(other, view);
    ui.buttons.forEach((b, k) => {
      const tags = b.querySelector(".flags-tags");
      clear(tags);
      const picks = PEOPLE.filter(p => {
        const a = p === me ? mine : (revealing ? theirs : null);
        return a && a.c === k;
      });
      tags.append(...picks.map(tag));
      b.disabled = !!mine || revealing;
      b.classList.toggle("flags-picked", picks.length > 0);
      b.classList.toggle("flags-right", revealing && k === q.answer);
      b.classList.toggle("flags-wrong", revealing && k !== q.answer && picks.length > 0);
    });
    if (revealing){
      const { pts, fast } = result(view);
      ui.status.className = "flags-status small";
      clear(ui.status).append(...PEOPLE.map(p => h("span", { class:`flags-${p} flags-gain`,
        text:`${p} +${pts[p]}${fast === p ? " (fastest)" : ""}` })));
      clear(ui.score).append(scoreLine());
      return;
    }
    ui.status.className = "flags-status muted small";
    ui.status.textContent = mine ? `waiting ${other}...` : theirs ? `${other} already answer. your turn` : "";
  }

  function choose(k){
    if (view >= N || revealing || answer(me, view)) return;
    const now = Date.now();
    ctx.set("a." + view, { c:k, t:now, d:now - shownAt });
  }

  function reveal(i){
    revealing = true;
    if (ui) ui.timer.textContent = "";
    paint();
    const q = quiz[i];
    const { ok, fast } = result(i);
    const a = q.options[q.answer].toLowerCase();
    const pick = arr => arr[i % arr.length];
    let line;
    if (ok.ana && ok.adrien) line = fast ? fill(pick(LINES.both), { f:fast }) : LINES.bothTie;
    else if (ok.ana || ok.adrien) line = fill(pick(LINES.one), { p:ok.ana ? "ana" : "adrien", a });
    else line = fill(pick(LINES.none), { a });
    ctx.say(line);
    ok[me] ? ctx.sfx.good() : ctx.sfx.bad();
    timers.push(setTimeout(() => { revealing = false; show(current()); }, REVEAL_MS));
  }

  function showEnd(){
    ui = null;
    const s = scores();
    const [w, l] = s.ana >= s.adrien ? ["ana", "adrien"] : ["adrien", "ana"];
    const line = s.ana === s.adrien ? fill(LINES.tie, { s:s.ana })
      : fill(LINES.win, { w, l, sw:s[w], sl:s[l] });
    clear(root).append(
      h("h2", { class:"flags-q", text:"final score" }),
      h("div", { class:"flags-final" }, PEOPLE.map(p => h("div", { class:`flags-${p}` },
        h("div", { class:"flags-big", text:String(s[p]) }), h("div", { text:p })))),
      h("p", { class:"center", text:line }),
      h("p", { class:"center muted small", text:LINES.done }),
    );
    ctx.sfx.fanfare();
    ctx.sky.shower(12);
    let alive = true;
    ctx.onCleanup(() => { alive = false; });
    ctx.say(line).then(() => wait(1500)).then(() => { if (alive) ctx.say(LINES.done); });
  }

  function tickTimer(){
    if (!ui || revealing || view >= N) return;
    if (answer(me, view)){ ui.timer.textContent = ""; return; }
    const left = SOFT_SECONDS - Math.floor((Date.now() - shownAt) / 1000);
    ui.timer.textContent = left > 0 ? `${left} s` : "time is over";
    ui.timer.classList.toggle("flags-late", left <= 5);
    if (left !== lastTick && left <= 5 && left >= 0){
      lastTick = left;
      left > 0 ? ctx.sfx.tick() : ctx.say(LINES.hurry);
    }
  }
  const iv = setInterval(tickTimer, 250);

  function update(){
    if (revealing) return;
    const cur = current();
    if (view === null || cur < view) show(cur);
    else if (cur > view) reveal(view);
    else paint();
  }

  const start = current();
  if (start === 0 && !answer(me, 0) && !answer(other, 0)) ctx.say(LINES.start);
  else if (start < N) ctx.say(LINES.resume(start + 1));
  show(start);
  ctx.onChange(update);

  return () => { clearInterval(iv); timers.forEach(clearTimeout); };
}

// ── styles ───────────────────────────────────────────────────
function injectStyle(){
  if (document.getElementById("flags-style")) return;
  document.head.append(h("style", { id:"flags-style", text:`
.flags{ max-width:640px; margin:12px auto; }
.flags-head{ display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
.flags-score{ display:inline-flex; gap:14px; }
.flags-ana{ color:var(--ana); }
.flags-adrien{ color:var(--adrien); }
.flags-timer.flags-late{ color:var(--rose); }
.flags-q{ text-align:center; font-size:1.6rem; margin:12px 0; }
.flags-country{ color:var(--rose); }
.flags-flag{
  display:block; width:min(300px, 80%); aspect-ratio:4/3; object-fit:cover;
  margin:4px auto 16px; border:3px solid var(--cream); border-radius:8px;
  background:var(--night-2); transform:rotate(-1deg); user-select:none;
}
.flags-opts{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.flags-opt{ min-height:58px; padding:6px 12px; font-size:1.15rem; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; }
.flags-opt:disabled{ opacity:.5; }
.flags-opt.flags-picked, .flags-opt.flags-right{ opacity:1; }
.flags-opt.flags-right{ border-color:var(--ok); color:var(--ok); }
.flags-opt.flags-wrong{ border-color:var(--rose); border-style:dashed; }
.flags-opt:nth-child(odd){ transform:rotate(-.4deg); }
.flags-opt:nth-child(even){ transform:rotate(.4deg); }
.flags-tags{ display:flex; gap:6px; justify-content:center; }
.flags-tags:empty{ display:none; }
.flags-tag{ font-size:.8rem; line-height:1.2; padding:0 8px; border:2px solid currentColor; border-radius:8px; background:var(--night); }
.flags-status{ text-align:center; min-height:1.4em; margin-top:12px; display:flex; gap:18px; justify-content:center; }
.flags-final{ display:flex; justify-content:center; gap:60px; text-align:center; margin:8px 0 12px; }
.flags-big{ font-size:3.4rem; line-height:1; }
@media (max-width:560px){
  .flags-opts{ grid-template-columns:1fr; }
  .flags-final{ gap:30px; }
}
` }));
}
