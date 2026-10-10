// ============================================================
// guess-draw.js : dessine-devine (etape "drawing", carte B)
// Portage du jeu de juin (namorados/js/rounds.js, subs 4..9).
//
// 6 manches, dessinateur alterne : 0 adrien, 1 ana, 2 adrien...
// Mot de la manche r : tirage deterministe sans remise dans
// content.guessWords (graine commune), rien a echanger.
//
// Couloirs (etat retenu) :
//   solved.<r> = true   ecrit par le devineur quand il trouve
//   skip.<r>   = true   ecrit par l'un ou l'autre ("skip")
//   manche courante = premiere r ni trouvee ni passee
//
// Flux (rapides, peuvent se perdre) :
//   seg   { r, g, i, s:[{x1,y1,x2,y2}], n }  dessinateur, par lots de 50 ms
//   all   meme forme, reponse a "need" (morceaux de 1000 segments)
//   need  { r }                              devineur : renvoie-moi tout
//   clear { r, g }                           dessinateur : "erase all"
// i = index du 1er segment du lot, n = total chez le dessinateur,
// g = generation (horodatage, change a chaque "erase all") : un
// message d'une generation plus ancienne est ignore, une plus
// recente remet la planche a zero. Un trou (have < n) declenche
// un "need". Apres 1,2 s sans trait, un lot vide redonne n.
// Le dessinateur garde sa manche en sessionStorage : au rechargement
// il repart avec une generation neuve et renvoie tout ("all").
// ============================================================
import { h } from "../dom.js";
import { seeded, shuffle } from "../draw.js";
import { createBoard } from "./canvas.js";

const ROUNDS = 6;
const COLORS = { ana:"#c2452d", adrien:"#2d5fc2" };   // couleurs de juin
const BATCH_MS = 50, TAIL_MS = 1200, REVEAL_MS = 2500, NEED_EVERY = 1500;
const CHUNK = 1000, MAX_SEGS = 20000;
export const drawerOf = r => (r % 2 === 0 ? "adrien" : "ana");

// ── tolerance du jeu de juin, a l'identique ─────────────────
export function editDist(a, b){
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 1) return 2;
  const dp = Array.from({ length:m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++){
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + c);
  }
  return dp[m][n];
}
function norm(s){
  return (s || "").toString().trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.,!?;:]+$/, "").replace(/\s+/g, " ");
}
// retire les articles en tete ("le metro" == "metro" == "the metro")
function stripArticles(s){
  let out = s.replace(/'/g, " ").replace(/\s+/g, " ").trim();
  const ART = /^(le|la|les|l|un|une|des|the|a|an|o|os|as|um|uma)\s+/;
  while (ART.test(out)) out = out.replace(ART, "");
  return out;
}
// une entree guessWords peut contenir plusieurs reponses "a / b / c"
export function accepts(input, entry){
  const raw = norm(input);
  if (!raw) return false;
  const guesses = [raw, stripArticles(raw)];
  const variants = String(entry).split("/").map(norm).filter(Boolean);
  return variants.some(v => {
    const targets = [v, stripArticles(v)];
    return targets.some(t => guesses.some(g =>
      g === t || (t.length > 3 && editDist(t, g) <= 1)   // tolere une petite faute
    ));
  });
}

// ── segments recus : on ne garde que des nombres dans [0..1] ──
const unit = v => typeof v === "number" && v >= 0 && v <= 1;
const cleanSeg = s => (s && unit(s.x1) && unit(s.y1) && unit(s.x2) && unit(s.y2)
  ? { x1:s.x1, y1:s.y1, x2:s.x2, y2:s.y2 } : null);

export function mount(ctx){
  injectStyle();
  const { me, other } = ctx;
  const words = ctx.content.guessWords;
  const order = shuffle(words.map((_, i) => i), seeded(ctx.seed, "guess"));
  const entryOf = r => words[order[r % order.length]] || "";
  const wordOf = r => entryOf(r).split("/")[0].trim();

  const flag = (key, r) => [me, other].some(w => ctx.get(w, `${key}.${r}`) === true);
  const isDone = r => flag("solved", r) || flag("skip", r);
  const current = () => { let r = 0; while (r < ROUNDS && isDone(r)) r++; return r; };
  const score = () => { let n = 0; for (let r = 0; r < ROUNDS; r++) if (flag("solved", r)) n++; return n; };

  // ── interface ────────────────────────────────────────────
  const roundEl = h("span");
  const scoreEl = h("span");
  const role = h("p", { class:"gd-role" });
  const canvas = h("canvas", { class:"gd-board" });
  const banner = h("div", { class:"gd-reveal", hidden:true });
  const wrap = h("div", { class:"gd-wrap" }, canvas, banner);
  const input = h("input", { type:"text", class:"gd-input", placeholder:"what is it ?",
    autocomplete:"off", spellcheck:"false", maxlength:"80" });
  const fb = h("p", { class:"gd-fb small muted" });
  const guessRow = h("div", { class:"gd-row" }, input, h("button", { text:"send", onclick:submit }));
  const eraseBtn = h("button", { class:"small", text:"erase all", onclick:erase });
  const skipBtn = h("button", { class:"small", text:"skip", onclick:skip });
  const ctrl = h("div", { class:"gd-ctrl" }, guessRow, h("div", { class:"gd-row" }, eraseBtn, skipBtn), fb);
  const final = h("div", { class:"gd-final", hidden:true });
  ctx.el.append(h("div", { class:"gd" },
    h("div", { class:"gd-top" }, roundEl, scoreEl), role, wrap, ctrl, final));
  input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

  const board = createBoard(canvas, { onStroke });

  // ── etat local ───────────────────────────────────────────
  let shown = -1, revealing = false;
  let mine = null;              // ma manche de dessinateur { r, g, segs, from }
  const got = new Map();        // manches de l'autre : r -> { g, segs, have, n, needAt }
  const timers = { batch:null, tail:null, save:null, reveal:null };
  const tick = setInterval(checkMissing, NEED_EVERY);
  const iDraw = r => me === drawerOf(r);

  // ── dessinateur ──────────────────────────────────────────
  const storeKey = r => `gd:${ctx.seed}:${r}`;
  // toujours une generation neuve : apres un rechargement, les index
  // ne recouvrent jamais des segments que le devineur a deja
  function loadMine(r){
    let segs = [];
    try {
      const s = JSON.parse(sessionStorage.getItem(storeKey(r)) || "null");
      if (s && Array.isArray(s.s)) segs = s.s.map(cleanSeg).filter(Boolean).slice(0, MAX_SEGS);
    } catch {}
    return { r, g:Date.now(), segs, from:segs.length };
  }
  function saveSoon(){
    clearTimeout(timers.save);
    timers.save = setTimeout(() => {
      if (!mine) return;
      try { sessionStorage.setItem(storeKey(mine.r), JSON.stringify({ s:mine.segs })); } catch {}
    }, 600);
  }
  function sendRange(kind, from){
    const n = mine.segs.length;
    let i = from;
    do {
      ctx.send(kind, { r:mine.r, g:mine.g, i, s:mine.segs.slice(i, i + CHUNK), n });
      i += CHUNK;
    } while (i < n);
  }
  function flush(){
    timers.batch = null;
    if (!mine || mine.from >= mine.segs.length) return;
    const from = mine.from;
    mine.from = mine.segs.length;
    sendRange("seg", from);
  }
  function tailSoon(){
    clearTimeout(timers.tail);
    timers.tail = setTimeout(() => { if (mine) sendRange("seg", mine.segs.length); }, TAIL_MS);
  }
  function onStroke(s){
    if (!mine || mine.r !== shown || revealing || mine.segs.length >= MAX_SEGS) return;
    mine.segs.push(s);
    if (!timers.batch) timers.batch = setTimeout(flush, BATCH_MS);
    tailSoon();
    saveSoon();
  }
  function erase(){
    if (!mine || revealing) return;
    clearTimeout(timers.batch); timers.batch = null;
    mine.g = Math.max(Date.now(), mine.g + 1);
    mine.segs = []; mine.from = 0;
    board.show([]);
    ctx.send("clear", { r:mine.r, g:mine.g });
    tailSoon();
    saveSoon();
  }
  ctx.onStream("need", m => {
    if (!mine || !m || m.r !== mine.r) return;
    flush();
    sendRange("all", 0);
  });

  // ── devineur ─────────────────────────────────────────────
  function receive(m){
    if (!m || !Number.isInteger(m.r) || m.r < 0 || m.r >= ROUNDS || iDraw(m.r)) return;
    if (typeof m.g !== "number") return;
    let st = got.get(m.r);
    if (!st || m.g > st.g){
      st = { g:m.g, segs:[], have:0, n:0, needAt:0 };
      got.set(m.r, st);
      if (m.r === shown) board.show([]);
    } else if (m.g < st.g) return;
    if (Number.isInteger(m.n)) st.n = Math.min(Math.max(st.n, m.n), MAX_SEGS);
    const fresh = [];
    if (Array.isArray(m.s) && Number.isInteger(m.i) && m.i >= 0){
      m.s.forEach((raw, k) => {
        const idx = m.i + k;
        if (idx >= MAX_SEGS || st.segs[idx]) return;
        const s = cleanSeg(raw);
        if (!s) return;
        st.segs[idx] = s; st.have++; fresh.push(s);
      });
    }
    if (m.r === shown && fresh.length) board.add(fresh);
    if (st.have < st.n) askAll(m.r, st);
  }
  function askAll(r, st){
    const now = Date.now();
    if (st && now - st.needAt < NEED_EVERY) return;
    if (st) st.needAt = now;
    ctx.send("need", { r });
  }
  function checkMissing(){
    if (revealing || shown < 0 || shown >= ROUNDS || iDraw(shown)) return;
    const st = got.get(shown);
    if (!st || st.have < st.n) askAll(shown, st);   // rien recu encore, ou un trou
  }
  ctx.onStream("seg", receive);
  ctx.onStream("all", receive);
  ctx.onStream("clear", receive);

  function submit(){
    if (revealing || shown < 0 || shown >= ROUNDS || iDraw(shown)) return;
    const v = input.value.trim();
    if (!v) return;
    if (accepts(v, entryOf(shown))){
      fb.textContent = "yes ! that is it";
      ctx.set(`solved.${shown}`, true);
    } else {
      fb.textContent = "nope... again";
      input.value = "";
      input.focus();
      ctx.sfx.bad();
    }
  }
  function skip(){
    if (revealing || shown < 0 || shown >= ROUNDS) return;
    ctx.set(`skip.${shown}`, true);
  }

  // ── manches ──────────────────────────────────────────────
  function showRound(r, live){
    shown = r;
    banner.hidden = true;
    if (r >= ROUNDS) return showEnd(live);
    const drawer = drawerOf(r);
    roundEl.textContent = `round ${r + 1} / ${ROUNDS} · ${drawer} draw`;
    ctrl.hidden = false;
    fb.textContent = "";
    if (iDraw(r)){
      if (!mine || mine.r !== r) mine = loadMine(r);
      board.show(mine.segs, COLORS[me]);
      role.replaceChildren("you draw : ", h("span", { class:"gd-word keep-case", text:wordOf(r) }));
      guessRow.hidden = true;
      eraseBtn.hidden = false;
      if (mine.segs.length) sendRange("all", 0);   // apres un rechargement
      if (live) ctx.say("your turn to draw. no words no letters");
    } else {
      mine = null;
      const st = got.get(r);
      board.show(st ? st.segs.filter(Boolean) : [], COLORS[drawer]);
      role.textContent = `${drawer} draw. you guess, type what you see`;
      guessRow.hidden = false;
      eraseBtn.hidden = true;
      input.value = "";
      if (live) ctx.say(`${drawer} draw now. you guess`);
      input.focus({ preventScroll:true });
      askAll(r, null);
    }
    board.setDrawable(iDraw(r));
  }

  function startReveal(r){
    revealing = true;
    board.setDrawable(false);
    if (mine && mine.r === r){ clearTimeout(timers.batch); flush(); }
    try { sessionStorage.removeItem(storeKey(r)); } catch {}
    const ok = flag("solved", r), w = wordOf(r);
    banner.textContent = (ok ? "found : " : "it was : ") + w;
    banner.hidden = false;
    ctrl.hidden = true;
    ctx.say(ok ? `yes ! it was ${w}` : `skip... it was ${w}`);
    ctx.sfx.good();
    timers.reveal = setTimeout(() => {
      revealing = false;
      showRound(r + 1, true);
      update();
    }, REVEAL_MS);
  }

  function showEnd(live){
    board.setDrawable(false);
    mine = null;
    const n = score();
    roundEl.textContent = "finish";
    role.textContent = "";
    wrap.hidden = true;
    ctrl.hidden = true;
    final.hidden = false;
    final.replaceChildren(
      h("p", { class:"gd-big", text:`you found ${n} on ${ROUNDS}` }),
      h("p", { class:"muted", text:"when you are ready, click done" }),
    );
    ctx.say(`you found ${n} on ${ROUNDS}. artists`);
    if (live) ctx.sky.shower(12);
  }

  function update(){
    scoreEl.textContent = `found : ${score()} / ${ROUNDS}`;
    if (revealing) return;
    const cur = current();
    if (shown < 0){
      if (cur < ROUNDS) ctx.say("okae. one draw, one guess. i give the secret worde");
      showRound(cur, false);
    } else if (cur > shown && shown < ROUNDS) startReveal(shown);
  }

  ctx.onChange(update);
  update();

  return () => {
    clearInterval(tick);
    Object.values(timers).forEach(t => clearTimeout(t));
    board.destroy();
  };
}

// ── styles du module (injectes une fois) ────────────────────
const CSS = `
.gd{ display:flex; flex-direction:column; align-items:center; gap:10px; }
.gd [hidden]{ display:none !important; }
.gd-top{ width:100%; max-width:640px; display:flex; justify-content:space-between; gap:12px; color:var(--muted); }
.gd-role{ font-size:1.3rem; text-align:center; min-height:1.4em; margin:0; }
.gd-word{ color:var(--rose); }
.gd-wrap{ position:relative; width:min(100%, 640px, calc(58vh * 4 / 3)); aspect-ratio:4 / 3; }
.gd-board{
  display:block; width:100%; height:100%;
  background:var(--cream); border:3px solid var(--bord); border-radius:14px;
  touch-action:none; user-select:none; -webkit-user-select:none;
}
.gd-reveal{
  position:absolute; left:50%; top:14px; transform:translateX(-50%) rotate(-1deg);
  max-width:90%; padding:6px 18px; font-size:1.5rem; text-align:center;
  background:var(--night-2); border:3px solid var(--cream); border-radius:14px;
}
.gd-ctrl{ width:100%; max-width:640px; display:flex; flex-direction:column; align-items:center; gap:8px; }
.gd-row{ display:flex; gap:10px; align-items:center; justify-content:center; flex-wrap:wrap; width:100%; }
.gd-input{ flex:1 1 220px; width:auto; max-width:420px; }
.gd-fb{ min-height:1.4em; margin:0; }
.gd-final{ text-align:center; margin:20px 0; }
.gd-big{ font-size:1.8rem; }
`;
function injectStyle(){
  if (document.getElementById("guessdraw-style")) return;
  document.head.append(h("style", { id:"guessdraw-style", text:CSS }));
}
