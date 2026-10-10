// ============================================================
// maze.js : le labyrinthe dans le noir (etape "play together", A)
//
// Meme labyrinthe des deux cotes : seeded(seed, "maze", niveau).
// Niveau 1 : ana marche, adrien guide. Niveau 2 : on echange.
// Le guide voit tout ; celui qui marche ne voit que les cases
// autour de lui (plus un point sur les cases deja visitees).
//
// Etat, dans le couloir de celui qui marche :
//   pos.<niveau> = { x, y, n, t }   au plus toutes les 80 ms
//   won.<niveau> = true             arrive a l'etoile
// Flux "move" : la meme position, en temps reel. Le guide affiche
// la plus recente des deux (t) ; le couloir fait foi au rechargement.
// Niveau courant deduit : le premier niveau sans won.
// ============================================================
import { h, clear } from "../dom.js";
import { seeded } from "../draw.js";

const LEVELS = [
  { size:9,  walker:"ana" },
  { size:11, walker:"adrien" },
];
const CS = 10;            // pixels logiques par case (mur compris)
const PAD = 2;            // marge autour du labyrinthe
const WRITE_EVERY = 80;   // ms entre deux ecritures de couloir
const MAX_CSS = 520;      // largeur max du canvas a l'ecran
const LIGHT = 1;          // rayon vu par celui qui marche

const N = 1, E = 2, S = 4, W = 8;
const DIRS = [
  { bit:N, opp:S, dx:0,  dy:-1 },
  { bit:E, opp:W, dx:1,  dy:0 },
  { bit:S, opp:N, dx:0,  dy:1 },
  { bit:W, opp:E, dx:-1, dy:0 },
];
// fleches, wasd (qwerty) et zqsd (azerty)
const KEYS = {
  arrowup:0, w:0, z:0,
  arrowright:1, d:1,
  arrowdown:2, s:2,
  arrowleft:3, a:3, q:3,
};

const HEART = [
  ".xx.xx.",
  "xxxxxxx",
  "xxxxxxx",
  ".xxxxx.",
  "..xxx..",
  "...x...",
];
const STAR = [
  "...x...",
  "...x...",
  "..xxx..",
  "xxxxxxx",
  ".xxxxx.",
  "..x.x..",
  ".x...x.",
];

const CSS = `
.maze{ display:flex; flex-direction:column; align-items:center; gap:10px; }
.maze [hidden]{ display:none !important; }
.maze-hud{ width:100%; max-width:${MAX_CSS + 22}px; display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap; }
.maze-hud p{ margin:0; }
.maze-role{ font-size:1.4rem; }
.maze-moves{ font-size:1.1rem; white-space:nowrap; }
.maze-ana{ color:var(--ana); }
.maze-adrien{ color:var(--adrien); }
.maze-frame{ border:3px solid var(--cream); border-radius:14px; padding:8px; background:var(--night); transition:border-color .12s; }
.maze-frame.maze-bump{ border-color:var(--rose); }
.maze-canvas{ display:block; image-rendering:pixelated; image-rendering:crisp-edges; }
.maze-hint{ margin:0; text-align:center; }
.maze-pad{ display:grid; grid-template-columns:repeat(3, 56px); grid-template-rows:repeat(2, 46px); gap:6px; }
.maze-pad button{ padding:0; font-size:1.4rem; line-height:1; touch-action:manipulation; }
.maze-up{ grid-column:2; grid-row:1; }
.maze-left{ grid-column:1; grid-row:2; }
.maze-down{ grid-column:2; grid-row:2; }
.maze-right{ grid-column:3; grid-row:2; }
.maze-end{ text-align:center; }
.maze-end .maze-big{ font-size:1.6rem; }
`;

// ── labyrinthe : backtracker recursif (iteratif) ─────────────
// murs par case, bits N E S W ; meme rng = meme labyrinthe
export function makeMaze(size, r){
  const walls = new Uint8Array(size * size).fill(N | E | S | W);
  const seen = new Uint8Array(size * size);
  const stack = [0];
  seen[0] = 1;
  while (stack.length){
    const c = stack[stack.length - 1];
    const x = c % size, y = (c - x) / size;
    const free = DIRS.filter(d => {
      const nx = x + d.dx, ny = y + d.dy;
      return nx >= 0 && ny >= 0 && nx < size && ny < size && !seen[ny * size + nx];
    });
    if (!free.length){ stack.pop(); continue; }
    const d = free[Math.floor(r() * free.length)];
    const nc = (y + d.dy) * size + x + d.dx;
    walls[c] &= ~d.bit;
    walls[nc] &= ~d.opp;
    seen[nc] = 1;
    stack.push(nc);
  }
  return walls;
}

function injectStyle(){
  if (document.getElementById("maze-style")) return;
  document.head.append(h("style", { id:"maze-style", text:CSS }));
}

function palette(){
  const s = getComputedStyle(document.documentElement);
  const v = (name, fb) => s.getPropertyValue(name).trim() || fb;
  return {
    night:v("--night", "#10152e"), floor:v("--night-2", "#171d3d"),
    cream:v("--cream", "#FAF8F4"), rose:v("--rose", "#d0697c"),
    memory:v("--muted", "#9aa0c2"), star:"#fff1b8",
  };
}

function validPos(p, size){
  return p && Number.isInteger(p.x) && Number.isInteger(p.y)
    && p.x >= 0 && p.y >= 0 && p.x < size && p.y < size
    && Number.isFinite(p.n) ? p : null;
}
const newest = (a, b) => (!a ? b : !b ? a : ((b.t || 0) > (a.t || 0) ? b : a));
const otherOf = who => (who === "ana" ? "adrien" : "ana");
const name = who => h("span", { class:"maze-" + who, text:who });

export function mount(ctx){
  injectStyle();
  const mazes = LEVELS.map((lv, i) => makeMaze(lv.size, seeded(ctx.seed, "maze", i + 1)));
  const col = palette();

  // ── interface ────────────────────────────────────────────
  const canvas = h("canvas", { class:"maze-canvas", width:1, height:1 });
  const g = canvas.getContext("2d");
  const frame = h("div", { class:"maze-frame" }, canvas);
  const role = h("p", { class:"maze-role" });
  const who = h("p", { class:"muted small" });
  const moves = h("p", { class:"maze-moves" });
  const hint = h("p", { class:"maze-hint muted small" });
  const padBtn = (cls, label, d) => h("button", { class:cls, text:label, "aria-label":cls.slice(5), onclick:() => move(d) });
  const pad = h("div", { class:"maze-pad" },
    padBtn("maze-up", "↑", 0), padBtn("maze-left", "←", 3),
    padBtn("maze-down", "↓", 2), padBtn("maze-right", "→", 1));
  const end = h("div", { class:"maze-end" });
  ctx.el.append(h("div", { class:"maze" },
    h("div", { class:"maze-hud" }, h("div", null, role, who), moves),
    frame, hint, pad, end));

  // ── etat ─────────────────────────────────────────────────
  let level = 0;              // 1..LEVELS.length ; au-dela : fini
  let local = null;           // ma position quand c'est moi qui marche
  let visited = new Set();
  const streamPos = {};       // niveau -> derniere position recue en flux
  let lastWrite = 0, writeTimer = null, bumpTimer = null;

  const levelNow = () => {
    for (let i = 0; i < LEVELS.length; i++) if (!ctx.get(LEVELS[i].walker, `won.${i + 1}`)) return i + 1;
    return LEVELS.length + 1;
  };
  const finished = () => level > LEVELS.length;
  const lv = () => LEVELS[Math.min(level, LEVELS.length) - 1];
  const iWalk = () => !finished() && lv().walker === ctx.me;
  const cellKey = p => p.x + "," + p.y;

  function walkerPos(){
    if (iWalk()) return local;
    const size = lv().size;
    const lane = validPos(ctx.get(lv().walker, `pos.${level}`), size);
    return newest(lane, validPos(streamPos[level], size)) || { x:0, y:0, n:0, t:0 };
  }

  // ── niveaux ──────────────────────────────────────────────
  function enterLevel(live){
    level = levelNow();
    clearTimeout(writeTimer); writeTimer = null;
    local = null;
    visited = new Set();
    if (finished()) return finish(live);
    if (iWalk()){
      const saved = validPos(ctx.get(ctx.me, `pos.${level}`), lv().size);
      local = { x:saved ? saved.x : 0, y:saved ? saved.y : 0, n:saved ? saved.n : 0, t:Date.now() };
      visited.add(cellKey(local));
      ctx.send("move", { l:level, ...local });   // le guide voit tout de suite ou je reprends
    }
    if (live) ctx.sfx.good();
    const walker = lv().walker;
    ctx.say((live ? "one star ! now we swap. " : "")
      + `${walker}, you walk in the dark. ${otherOf(walker)}, you see everything. talk !`);
    updateHud();
    draw();
  }

  function finish(live){
    const steps = LEVELS.map((l, i) => {
      const p = ctx.get(l.walker, `pos.${i + 1}`);
      return p && Number.isFinite(p.n) ? p.n : "?";
    });
    clear(end).append(
      h("p", { class:"maze-big", text:"two stars found" }),
      h("p", { class:"muted", text:`ana walk ${steps[0]} steps, adrien walk ${steps[1]} steps` }),
      h("p", { text:"now click done" }),
    );
    ctx.say("two stars ! you find them together, only with your voices. i am so proud of you two");
    if (live){ ctx.sky.shower(20); ctx.sfx.fanfare(); }
    updateHud();
    draw();
  }

  function update(){
    if (levelNow() !== level) return enterLevel(true);
    updateHud();
    draw();
  }

  // ── deplacement (seulement celui qui marche) ─────────────
  function move(d){
    if (!iWalk()) return;
    const size = lv().size, dir = DIRS[d];
    if (local.x === size - 1 && local.y === size - 1) return;   // deja arrive
    if (mazes[level - 1][local.y * size + local.x] & dir.bit){
      ctx.sfx.blip(-6);
      frame.classList.add("maze-bump");
      clearTimeout(bumpTimer);
      bumpTimer = setTimeout(() => frame.classList.remove("maze-bump"), 140);
      return;
    }
    local = { x:local.x + dir.dx, y:local.y + dir.dy, n:local.n + 1, t:Date.now() };
    visited.add(cellKey(local));
    ctx.sfx.tick();
    ctx.send("move", { l:level, ...local });
    const won = local.x === size - 1 && local.y === size - 1;
    writePos(won);
    updateHud();
    draw();
    if (won) ctx.set(`won.${level}`, true);   // onChange fait la suite
  }

  // ecriture du couloir limitee a une toutes les WRITE_EVERY ms
  function writePos(now){
    clearTimeout(writeTimer); writeTimer = null;
    if (!local) return;
    const left = WRITE_EVERY - (performance.now() - lastWrite);
    if (now || left <= 0){
      lastWrite = performance.now();
      ctx.set(`pos.${level}`, { x:local.x, y:local.y, n:local.n, t:local.t });
    } else {
      writeTimer = setTimeout(() => writePos(true), left);
    }
  }
  const flush = () => { if (writeTimer) writePos(true); };

  function onKey(e){
    if (finished() || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
    const k = String(e.key || "").toLowerCase();
    const d = KEYS[k];
    if (d === undefined) return;
    if (k.startsWith("arrow")) e.preventDefault();   // la page ne defile pas
    if (!iWalk()) return;
    e.preventDefault();
    move(d);
  }

  // ── affichage ────────────────────────────────────────────
  function updateHud(){
    if (finished()){
      role.textContent = "the maze is finish";
      clear(who);
      moves.textContent = "";
      hint.textContent = "";
      pad.hidden = true;
      return;
    }
    const walker = lv().walker, guide = otherOf(walker);
    role.className = "maze-role maze-" + ctx.me;
    role.textContent = iWalk() ? "you walk in the dark" : "you see everything";
    clear(who).append(`level ${level} of ${LEVELS.length} · `, name(walker), " walk, ", name(guide), " guide");
    moves.textContent = `moves : ${walkerPos().n}`;
    hint.textContent = iWalk()
      ? `arrows or wasd (or the buttons). listen to ${guide}`
      : `tell ${walker} the way to the star. ${walker} see only the little light`;
    pad.hidden = !iWalk();
  }

  function sprite(rows, ox, oy, color){
    g.fillStyle = color;
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === "x") g.fillRect(ox + i, oy + j, 1, 1);
    });
  }

  function draw(){
    const i = Math.min(level, LEVELS.length) - 1;
    if (i < 0) return;
    const size = LEVELS[i].size, m = mazes[i];
    const px = size * CS + 1 + PAD * 2;
    if (canvas.width !== px){ canvas.width = canvas.height = px; fit(); }
    const X = x => PAD + x * CS;

    g.fillStyle = col.night;
    g.fillRect(0, 0, px, px);

    const full = finished() || !iWalk();
    const p = finished() ? null : walkerPos();
    const near = (x, y) => Math.abs(x - p.x) <= LIGHT && Math.abs(y - p.y) <= LIGHT;
    const shown = (x, y) => full || near(x, y);

    // la petite lumiere autour de celui qui marche (visible aussi du guide)
    if (p){
      const x0 = Math.max(0, p.x - LIGHT), y0 = Math.max(0, p.y - LIGHT);
      const x1 = Math.min(size - 1, p.x + LIGHT), y1 = Math.min(size - 1, p.y + LIGHT);
      g.fillStyle = col.floor;
      g.fillRect(X(x0), X(y0), (x1 - x0 + 1) * CS + 1, (y1 - y0 + 1) * CS + 1);
    }
    // memoire : un point pale par case deja visitee
    if (visited.size){
      g.globalAlpha = 0.4;
      g.fillStyle = col.memory;
      for (const k of visited){
        const [x, y] = k.split(",").map(Number);
        g.fillRect(X(x) + CS / 2, X(y) + CS / 2, 1, 1);
      }
      g.globalAlpha = 1;
    }
    g.fillStyle = col.cream;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
      if (!shown(x, y)) continue;
      const w = m[y * size + x];
      if (w & N) g.fillRect(X(x), X(y), CS + 1, 1);
      if (w & S) g.fillRect(X(x), X(y) + CS, CS + 1, 1);
      if (w & W) g.fillRect(X(x), X(y), 1, CS + 1);
      if (w & E) g.fillRect(X(x) + CS, X(y), 1, CS + 1);
    }
    if (shown(size - 1, size - 1)) sprite(STAR, X(size - 1) + 2, X(size - 1) + 2, col.star);
    if (p) sprite(HEART, X(p.x) + 2, X(p.y) + 3, col.rose);
  }

  // taille a l'ecran : multiple entier des pixels logiques si possible
  function fit(){
    const px = canvas.width;
    const avail = Math.max(160, Math.min(MAX_CSS, ctx.el.clientWidth - 22, window.innerHeight - 260));
    const k = Math.floor(avail / px);
    const css = k >= 2 ? px * k : avail;
    canvas.style.width = canvas.style.height = css + "px";
  }

  // ── branchements ─────────────────────────────────────────
  ctx.onStream("move", d => {
    if (!d || !Number.isInteger(d.l) || d.l < 1 || d.l > LEVELS.length) return;
    const p = validPos(d, LEVELS[d.l - 1].size);
    if (!p) return;
    streamPos[d.l] = newest(streamPos[d.l], { x:p.x, y:p.y, n:p.n, t:p.t });
    if (d.l === level && !iWalk()){ updateHud(); draw(); }
  });
  ctx.onChange(update);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", fit);
  window.addEventListener("pagehide", flush);

  const testHook = new URLSearchParams(location.search).get("t") === "local";
  if (testHook){
    window.__maze = {
      level:() => level,
      size:l => LEVELS[l - 1].size,
      walker:l => LEVELS[l - 1].walker,
      walls:l => Array.from(mazes[l - 1]),
      pos:() => (finished() ? null : { ...walkerPos() }),
    };
  }

  ctx.onCleanup(() => {
    flush();
    clearTimeout(bumpTimer);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", fit);
    window.removeEventListener("pagehide", flush);
    if (testHook) delete window.__maze;
  });

  enterLevel(false);
  requestAnimationFrame(() => frame.scrollIntoView({ block:"nearest", behavior:"smooth" }));
}
