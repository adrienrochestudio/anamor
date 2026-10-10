// ============================================================
// maze.js : le labyrinthe dans le noir (etape "play together", A)
//
// Tino marche dans le noir (il ne voit que les murs des cases autour
// de lui), l'autre voit tout et le guide a la voix. Niveau 1 : ana marche. Niveau 2 :
// adrien marche. Plus grand, plus rapide.
// Chaque partie (chaque depart) tire un nouveau labyrinthe et une
// nouvelle place pour l'etoile, loin du depart.
//
// Danger, calcule des deux cotes sans echange (meme graine, meme
// horloge de niveau) :
//  - murs qui bougent : certains passages s'ouvrent et se ferment
//  - le baron du petrole passe au-dessus et lache des bombes.
//    Le guide voit ou elles vont tomber avant l'impact. Explosion en
//    croix ; si tino est dedans, retour au depart.
//
// Etat, dans le couloir de celui qui marche :
//   start.<niveau> = ms      horloge commune du niveau
//   pos.<niveau>   = { x, y, n, t }   (au plus toutes les 80 ms)
//   dead.<niveau>  = nombre d'explosions subies
//   won.<niveau>   = true
// Flux "move" : la position en temps reel pour le guide.
// ============================================================
import { h, clear } from "../dom.js";
import { seeded } from "../draw.js";

// hunt : part des bombes qui visent tino (autour de lui au moment du lacher)
// step : ms accordees par case du plus court chemin ; au-dela du chrono,
// retour au depart avec un nouveau labyrinthe
const LEVELS = [
  { size:21, walker:"ana",    every:1200, warn:1250, gates:46, period:1500, braid:0.04, hunt:0.65, step:900, min:70000 },
  { size:25, walker:"adrien", every:950,  warn:1050, gates:70, period:1250, braid:0.04, hunt:0.75, step:800, min:80000 },
];
const GRACE = 3000;        // ms avant la premiere bombe
const BLAST = 700;         // duree d'une explosion
const LIGHT = 1;           // celui qui marche voit un carre de 3x3 cases autour de tino
const WRITE_EVERY = 80;
const MAX_W = 600;
const TOP = 54;            // bande du baron au-dessus du labyrinthe
const PAD = 6;
const SP = 3;              // px ecran par pixel de sprite
const TINO_SRC = "../3.png";

const N = 1, E = 2, S = 4, W = 8;
const DIRS = [
  { bit:N, opp:S, dx:0,  dy:-1 },
  { bit:E, opp:W, dx:1,  dy:0 },
  { bit:S, opp:N, dx:0,  dy:1 },
  { bit:W, opp:E, dx:-1, dy:0 },
];
const KEYS = { arrowup:0, w:0, z:0, arrowright:1, d:1, arrowdown:2, s:2, arrowleft:3, a:3, q:3 };

const PAL = { k:"#0b0f22", w:"#FAF8F4", r:"#d0697c", y:"#fff1b8", g:"#9aa0c2", G:"#5d6391", b:"#9a6a48", o:"#4a4d6e", Y:"#f0c75e" };
const BARON = [
  "....YYYYYYY.....",
  "...YYYYYYYYY....",
  "..YYYYYYYYYYY...",
  "..YYwwwwwwwYY...",
  "...wwkwwwkww....",
  "...wwwwwwwww....",
  "...wwwrrrwww....",
  "....wwwwwww.....",
  "..GGGGGGGGGGG...",
  ".GGGGGGGGGGGGG..",
  "GGGGGGGGGGGGGGG.",
  "GGGGGGGGGGGGGGGw",
  "GGGGGGGGGGGGGGGb",
  ".GGGGGGGGGGGGGbb",
  "..GGG.....GGG.bb",
  "..oo.......oo...",
];
const BOMB = [
  "....y..",
  "...yk..",
  "..ggg..",
  ".ggggg.",
  ".gggGg.",
  ".ggggg.",
  "..ggg..",
];
const STAR = [
  "...y...",
  "...y...",
  "..yyy..",
  "yyyyyyy",
  ".yyyyy.",
  "..y.y..",
  ".y...y.",
];

const CSS = `
.maze{ display:flex; flex-direction:column; align-items:center; gap:10px; }
.maze [hidden]{ display:none !important; }
.maze-hud{ width:100%; max-width:${MAX_W + 24}px; display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap; }
.maze-hud p{ margin:0; }
.maze-role{ font-size:1.35rem; }
.maze-frame{ border:3px solid var(--cream); border-radius:14px; padding:6px; background:var(--night); transition:border-color .12s, transform .08s; }
.maze-frame.maze-bump{ border-color:var(--rose); }
.maze-frame.maze-boom{ border-color:#fff1b8; transform:translate(2px,-1px); }
.maze-canvas{ display:block; }
.maze-pad{ display:grid; grid-template-columns:repeat(3, 56px); grid-template-rows:repeat(2, 46px); gap:6px; }
.maze-pad button{ padding:0; font-size:1.4rem; line-height:1; touch-action:manipulation; }
.maze-up{ grid-column:2; grid-row:1; }
.maze-left{ grid-column:1; grid-row:2; }
.maze-down{ grid-column:2; grid-row:2; }
.maze-right{ grid-column:3; grid-row:2; }
.maze-end{ text-align:center; }
.maze-end .maze-big{ font-size:1.6rem; }
`;

// ── labyrinthe ───────────────────────────────────────────────
export function makeMaze(size, r, braid = 0){
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
    walls[c] &= ~d.bit; walls[nc] &= ~d.opp;
    seen[nc] = 1;
    stack.push(nc);
  }
  // quelques boucles : il existe des detours pour eviter les bombes
  for (let c = 0; c < size * size; c++){
    if (r() >= braid) continue;
    const x = c % size, y = (c - x) / size;
    const d = DIRS[Math.floor(r() * 4)];
    const nx = x + d.dx, ny = y + d.dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
    walls[c] &= ~d.bit; walls[ny * size + nx] &= ~d.opp;
  }
  return walls;
}

// murs mobiles : segments internes qui s'ouvrent et se ferment
function makeGates(size, count, period, r, exit){
  const gates = new Map();
  const list = [];
  let guard = 0;
  while (list.length < count && guard++ < 500){
    const x = Math.floor(r() * size), y = Math.floor(r() * size);
    const horiz = r() < 0.5;               // vrai : mur est, faux : mur sud
    const nx = horiz ? x + 1 : x, ny = horiz ? y : y + 1;
    if (nx >= size || ny >= size) continue;
    const near = (a, b) => Math.abs(a - exit.x) + Math.abs(b - exit.y) <= 1;
    if (x + y < 2 || near(x, y) || near(nx, ny)) continue;   // pas pres du depart ni de l'etoile
    const k1 = `${x},${y},${horiz ? E : S}`, k2 = `${nx},${ny},${horiz ? W : N}`;
    if (gates.has(k1)) continue;
    const g = { x, y, horiz, off:r() * period * 2 };
    gates.set(k1, g); gates.set(k2, g);
    list.push(g);
  }
  return { gates, list };
}

// distances depuis le depart (parcours en largeur)
function distances(walls, size){
  const dist = new Int32Array(size * size).fill(-1);
  const q = [0]; dist[0] = 0;
  for (let i = 0; i < q.length; i++){
    const c = q[i], x = c % size, y = (c - x) / size;
    for (const d of DIRS){
      if (walls[c] & d.bit) continue;
      const nc = (y + d.dy) * size + x + d.dx;
      if (dist[nc] !== -1) continue;
      dist[nc] = dist[c] + 1; q.push(nc);
    }
  }
  return dist;
}

// l'etoile : une case tiree parmi les plus eloignees du depart
export function pickExit(walls, size, r){
  const dist = distances(walls, size);
  let max = 0;
  for (const d of dist) if (d > max) max = d;
  const far = [];
  dist.forEach((d, c) => { if (d >= max * 0.8) far.push(c); });
  const c = far[Math.floor(r() * far.length)];
  return { x:c % size, y:Math.floor(c / size) };
}

// plus court chemin sur le labyrinthe de base (cible privilegiee des bombes)
function solve(walls, size, exit){
  const prev = new Int32Array(size * size).fill(-1);
  const q = [0]; prev[0] = 0;
  for (let i = 0; i < q.length; i++){
    const c = q[i], x = c % size, y = (c - x) / size;
    for (const d of DIRS){
      if (walls[c] & d.bit) continue;
      const nc = (y + d.dy) * size + x + d.dx;
      if (prev[nc] !== -1) continue;
      prev[nc] = c; q.push(nc);
    }
  }
  const path = [];
  for (let c = exit.y * size + exit.x; c !== 0 && c !== -1; c = prev[c]) path.push(c);
  return path.reverse();
}

function injectStyle(){
  if (document.getElementById("maze-style")) return;
  document.head.append(h("style", { id:"maze-style", text:CSS }));
}

function validPos(p, size){
  return p && Number.isInteger(p.x) && Number.isInteger(p.y)
    && p.x >= 0 && p.y >= 0 && p.x < size && p.y < size
    && Number.isFinite(p.n) ? p : null;
}
const newest = (a, b) => (!a ? b : !b ? a : ((b.t || 0) > (a.t || 0) ? b : a));
const otherOf = who => (who === "ana" ? "adrien" : "ana");

export function mount(ctx){
  injectStyle();
  const lines = (ctx.content.maze) || {};
  const NL = LEVELS.length;
  // un labyrinthe par partie : tire de la graine et de l'heure du depart
  const layouts = new Map();
  function layout(i, start){
    const key = i + ":" + start;
    if (!layouts.has(key)){
      const c = LEVELS[i];
      const walls = makeMaze(c.size, seeded(ctx.seed, "maze", i + 1, start), c.braid);
      const exit = pickExit(walls, c.size, seeded(ctx.seed, "exit", i + 1, start));
      const { gates, list } = makeGates(c.size, c.gates, c.period, seeded(ctx.seed, "gates", i + 1, start), exit);
      const path = solve(walls, c.size, exit);
      layouts.set(key, { ...c, walls, exit, gates, gateList:list, path, time:Math.max(c.min, path.length * c.step) });
    }
    return layouts.get(key);
  }

  // tino : le sprite est recadre sur son dessin (l'image a beaucoup de vide)
  const tino = new Image();
  let tinoBox = null;
  tino.onload = () => {
    const k = 0.25, w = Math.round(tino.naturalWidth * k), hh = Math.round(tino.naturalHeight * k);
    const c = document.createElement("canvas"); c.width = w; c.height = hh;
    const cx = c.getContext("2d");
    cx.drawImage(tino, 0, 0, w, hh);
    const d = cx.getImageData(0, 0, w, hh).data;
    let x0 = w, y0 = hh, x1 = -1, y1 = -1;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++){
      if (d[(y * w + x) * 4 + 3] > 40){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    tinoBox = x1 < 0 ? [0, 0, tino.naturalWidth, tino.naturalHeight]
      : [x0 / k, y0 / k, (x1 - x0 + 1) / k, (y1 - y0 + 1) / k];
  };
  tino.src = TINO_SRC;

  // ── interface ────────────────────────────────────────────
  const canvas = h("canvas", { class:"maze-canvas", width:1, height:1 });
  const g = canvas.getContext("2d");
  const frame = h("div", { class:"maze-frame" }, canvas);
  const role = h("p", { class:"maze-role" });
  const info = h("p", { class:"muted small" });
  const padBtn = (cls, label, d) => h("button", { class:cls, text:label, onclick:() => move(d) });
  const pad = h("div", { class:"maze-pad" },
    padBtn("maze-up", "↑", 0), padBtn("maze-left", "←", 3),
    padBtn("maze-down", "↓", 2), padBtn("maze-right", "→", 1));
  const end = h("div", { class:"maze-end" });
  ctx.el.append(h("div", { class:"maze" },
    h("div", { class:"maze-hud" }, role, info), frame, pad, end));

  // ── etat ─────────────────────────────────────────────────
  let level = 0, local = null;
  const streamPos = {};
  let lastWrite = 0, writeTimer = null, fxTimer = null, raf = 0, lastFrame = 0;
  let deaths = 0, seenDead = 0, killedBy = -1, boomSeen = -1, safeUntil = 0;
  let cell = 30, Wpx = 0, Hpx = 0, dpr = 1;

  const levelNow = () => {
    for (let i = 0; i < NL; i++) if (!ctx.get(LEVELS[i].walker, `won.${i + 1}`)) return i + 1;
    return NL + 1;
  };
  const finished = () => level > NL;
  const lv = () => LEVELS[Math.min(level, NL) - 1];          // reglages du niveau
  const iWalk = () => !finished() && lv().walker === ctx.me;
  const startOf = () => { const s = ctx.get(lv().walker, `start.${level}`); return Number.isFinite(s) ? s : null; };
  const elapsed = () => { const s = startOf(); return s == null ? null : Date.now() - s; };
  const lay = () => { const s = startOf(); return finished() || s == null ? null : layout(level - 1, s); };

  function walkerPos(){
    if (iWalk()) return local;
    const size = lv().size;
    const lane = validPos(ctx.get(lv().walker, `pos.${level}`), size);
    return newest(lane, validPos(streamPos[level], size)) || { x:0, y:0, n:0, t:0 };
  }

  // ── murs (avec les murs mobiles) ─────────────────────────
  function gateClosed(gt, el){
    if (el == null) return true;
    return Math.floor((el + gt.off) / lv().period) % 2 === 0;
  }
  function blocked(x, y, d, el){
    const L = lay();
    if (!L) return true;
    const gt = L.gates.get(`${x},${y},${DIRS[d].bit}`);
    if (gt) return gateClosed(gt, el);
    return !!(L.walls[y * L.size + x] & DIRS[d].bit);
  }

  // ── bombes : meme calendrier des deux cotes ──────────────
  // les bombes chasseuses visent tino : celui qui marche choisit la
  // cible au moment du lacher et la publie dans son couloir.
  const hunts = {};
  function huntedAt(k){
    if (iWalk()) return hunts[k] || null;
    const H = ctx.get(lv().walker, `hunt.${level}`);
    return H && H.s === startOf() && H.b && H.b[k] ? H.b[k] : null;
  }
  function publishHunts(){
    const ks = Object.keys(hunts).map(Number).sort((a, b) => a - b).slice(-10);
    const b = {};
    ks.forEach(k => { b[k] = hunts[k]; });
    ctx.set(`hunt.${level}`, { s:startOf(), b });
  }
  function bombAt(k){
    const L = lay();
    const r = seeded(ctx.seed, "bomb", level, k);
    const land = GRACE + k * L.every;
    if (r() < L.hunt){
      let t = huntedAt(k);
      const el = elapsed();
      if (!t && iWalk() && local && el != null && el >= land - L.warn){
        const rr = seeded(ctx.seed, "hunt", level, k);
        t = hunts[k] = {
          x:Math.min(L.size - 1, Math.max(0, local.x + Math.floor(rr() * 3) - 1)),
          y:Math.min(L.size - 1, Math.max(0, local.y + Math.floor(rr() * 3) - 1)),
        };
        publishHunts();
      }
      if (t) return { k, x:t.x, y:t.y, land, hunt:true };
    }
    const onPath = r() < 0.7 && L.path.length > 6;
    let c;
    if (onPath){
      const usable = L.path.slice(2, -2);
      c = usable[Math.floor(r() * usable.length)];
    } else {
      c = Math.floor(r() * L.size * L.size);
      if (c < 2 || c === L.exit.y * L.size + L.exit.x) c = Math.floor(L.size * L.size / 2);
    }
    const x = c % L.size;
    return { k, x, y:(c - x) / L.size, land };
  }
  function activeBombs(el){
    if (el == null || !lay()) return [];
    const L = lv();
    const k0 = Math.max(0, Math.ceil((el - BLAST - GRACE) / L.every));
    const k1 = Math.floor((el + L.warn - GRACE) / L.every);
    const out = [];
    for (let k = k0; k <= k1; k++) out.push(bombAt(k));
    return out;
  }
  const inBlast = (b, x, y) => (x === b.x && Math.abs(y - b.y) <= 1) || (y === b.y && Math.abs(x - b.x) <= 1);

  // position du baron : au-dessus de la colonne de la prochaine bombe
  function baronX(el){
    const L = lv();
    if (el == null || !lay()) return (L.size - 1) / 2;
    const t = el + L.warn - GRACE;                 // l'heure du lacher, rapportee a la serie
    const k = Math.max(0, Math.floor(t / L.every));
    const a = bombAt(Math.max(0, k)).x, b = bombAt(k + 1).x;
    const f = Math.min(1, Math.max(0, (t - k * L.every) / L.every));
    return t < 0 ? bombAt(0).x : a + (b - a) * f;
  }

  // ── niveaux ──────────────────────────────────────────────
  function enterLevel(live){
    level = levelNow();
    clearTimeout(writeTimer); writeTimer = null;
    local = null; killedBy = -1; boomSeen = -1;
    if (finished()) return finish(live);
    seenDead = ctx.get(lv().walker, `dead.${level}`) | 0;
    for (const k in hunts) delete hunts[k];
    if (iWalk()){
      const H = ctx.get(ctx.me, `hunt.${level}`);
      if (H && H.s === startOf() && H.b) Object.assign(hunts, H.b);
      const saved = validPos(ctx.get(ctx.me, `pos.${level}`), lv().size);
      local = { x:saved ? saved.x : 0, y:saved ? saved.y : 0, n:saved ? saved.n : 0, t:Date.now() };
      deaths = ctx.get(ctx.me, `dead.${level}`) | 0;
      if (startOf() == null) ctx.set(`start.${level}`, Date.now());
      ctx.send("move", { l:level, ...local });
    }
    if (live) ctx.sfx.good();
    ctx.say(level === 1 ? (lines.intro || "") : (lines.swap || ""));
    resize();
    updateHud();
  }

  function finish(live){
    const d = LEVELS.map((l, i) => ctx.get(l.walker, `dead.${i + 1}`) | 0);
    clear(end).append(
      h("p", { class:"maze-big", text:lines.win || "you saved the oil" }),
      h("p", { class:"muted", text:`boom : ana ${d[0]}, adrien ${d[1]}` }),
    );
    if (live){ ctx.sky.shower(20); ctx.sfx.fanfare(); }
    frame.hidden = true;
    updateHud();
  }

  function update(){
    if (levelNow() !== level) return enterLevel(true);
    const dead = ctx.get(lv().walker, `dead.${level}`) | 0;
    if (!iWalk() && dead > seenDead){ seenDead = dead; boomFx(); }
    updateHud();
  }

  // ── deplacement (seulement celui qui marche) ─────────────
  function move(d){
    if (!iWalk()) return;
    const L = lay(), dir = DIRS[d];
    if (!L || !local || (local.x === L.exit.x && local.y === L.exit.y)) return;
    const nx = local.x + dir.dx, ny = local.y + dir.dy;
    if (nx < 0 || ny < 0 || nx >= L.size || ny >= L.size || blocked(local.x, local.y, d, elapsed())){
      ctx.sfx.blip(-6);
      flash("maze-bump", 140);
      return;
    }
    local = { x:nx, y:ny, n:local.n + 1, t:Date.now() };
    ctx.sfx.tick();
    ctx.send("move", { l:level, ...local });
    const won = nx === L.exit.x && ny === L.exit.y;
    writePos(won);
    if (won){ ctx.set(`won.${level}`, true); return; }
    checkBlast();
  }

  function checkBlast(){
    if (!iWalk() || !local || Date.now() < safeUntil) return;   // 2 s de repit apres un retour au depart
    const el = elapsed();
    for (const b of activeBombs(el)){
      if (el < b.land || el > b.land + BLAST || b.k === killedBy) continue;
      if (inBlast(b, local.x, local.y)) return die(b.k);
    }
  }

  function die(k){
    killedBy = k;
    safeUntil = Date.now() + 2000;
    deaths++;
    local = { x:0, y:0, n:local.n, t:Date.now() };
    ctx.set(`dead.${level}`, deaths);
    writePos(true);
    ctx.send("move", { l:level, ...local });
    boomFx();
  }

  // trop lent : retour au depart, nouveau labyrinthe, chrono et bombes a zero
  function timeout(){
    for (const k in hunts) delete hunts[k];
    safeUntil = Date.now() + 2000;
    local = { x:0, y:0, n:local.n, t:Date.now() };
    killedBy = -1; boomSeen = -1;
    ctx.set(`start.${level}`, Date.now());
    ctx.set(`hunt.${level}`, { s:0, b:{} });
    writePos(true);
    ctx.send("move", { l:level, ...local });
    boomFx();
    if (lines.timeout) ctx.say(lines.timeout);
  }

  function boomFx(){
    ctx.sfx.glitch();
    flash("maze-boom", 260);
  }
  function flash(cls, ms){
    frame.classList.add(cls);
    clearTimeout(fxTimer);
    fxTimer = setTimeout(() => frame.classList.remove("maze-bump", "maze-boom"), ms);
  }

  function writePos(now){
    clearTimeout(writeTimer); writeTimer = null;
    if (!local) return;
    const left = WRITE_EVERY - (performance.now() - lastWrite);
    if (now || left <= 0){
      lastWrite = performance.now();
      ctx.set(`pos.${level}`, { x:local.x, y:local.y, n:local.n, t:local.t });
    } else writeTimer = setTimeout(() => writePos(true), left);
  }
  const flush = () => { if (writeTimer) writePos(true); };

  function onKey(e){
    if (finished() || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
    const k = String(e.key || "").toLowerCase();
    const d = KEYS[k];
    if (d === undefined) return;
    if (k.startsWith("arrow")) e.preventDefault();
    if (!iWalk()) return;
    e.preventDefault();
    move(d);
  }

  // ── affichage ────────────────────────────────────────────
  function updateHud(){
    if (finished()){ role.textContent = ""; info.textContent = ""; pad.hidden = true; return; }
    role.textContent = iWalk() ? "you walk in the dark" : "you see everything";
    const d = ctx.get(lv().walker, `dead.${level}`) | 0;
    const el = elapsed(), L = lay();
    const left = !L ? 0 : el == null ? L.time : Math.max(0, L.time - el);
    const sec = Math.ceil(left / 1000);
    info.textContent = `level ${level}/${NL} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} · boom ${d}`;
    pad.hidden = !iWalk();
  }

  function resize(){
    if (finished()) return;
    const size = lv().size;
    const avail = Math.max(240, Math.min(MAX_W, ctx.el.clientWidth - 24));
    cell = Math.max(16, Math.floor((avail - PAD * 2) / size));
    Wpx = cell * size + PAD * 2;
    Hpx = Wpx + TOP;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(Wpx * dpr);
    canvas.height = Math.round(Hpx * dpr);
    canvas.style.width = Wpx + "px";
    canvas.style.height = Hpx + "px";
  }

  const X = x => PAD + x * cell;
  const Y = y => TOP + PAD + y * cell;

  function sprite(rows, ox, oy, s = SP, flip = false){
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++){
        const c = row[i];
        if (c === ".") continue;
        g.fillStyle = PAL[c];
        const ii = flip ? row.length - 1 - i : i;
        g.fillRect(ox + ii * s, oy + j * s, s, s);
      }
    });
  }

  function draw(){
    if (finished() || !Wpx) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#10152e";
    g.fillRect(0, 0, Wpx, Hpx);
    const L = lay(), el = elapsed();
    if (!L) return;
    const size = L.size;

    // celui qui marche voit les cases autour de tino, jamais les bombes qui tombent
    const full = !iWalk();
    const p = walkerPos();
    const near = (x, y) => Math.abs(x - p.x) <= LIGHT && Math.abs(y - p.y) <= LIGHT;
    const shown = (x, y) => full || near(x, y);

    // bande du haut : le baron
    const bx = baronX(el);
    sprite(BARON, X(bx) + cell / 2 - (BARON[0].length * SP) / 2, 4, SP);

    // sol : tout pour le guide, le carre autour de tino pour celui qui marche
    g.fillStyle = "#171d3d";
    if (full) g.fillRect(X(0), Y(0), cell * size, cell * size);
    else {
      const x0 = Math.max(0, p.x - LIGHT), y0 = Math.max(0, p.y - LIGHT);
      const x1 = Math.min(size - 1, p.x + LIGHT), y1 = Math.min(size - 1, p.y + LIGHT);
      g.fillRect(X(x0), Y(y0), (x1 - x0 + 1) * cell, (y1 - y0 + 1) * cell);
    }
    // murs fixes
    g.fillStyle = "#FAF8F4";
    const T = 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
      if (!shown(x, y)) continue;
      const w = L.walls[y * size + x];
      const isGate = d => L.gates.has(`${x},${y},${d}`);
      if ((w & N) && !isGate(N)) g.fillRect(X(x) - T / 2, Y(y) - T / 2, cell + T, T);
      if ((w & S) && !isGate(S)) g.fillRect(X(x) - T / 2, Y(y) + cell - T / 2, cell + T, T);
      if ((w & W) && !isGate(W)) g.fillRect(X(x) - T / 2, Y(y) - T / 2, T, cell + T);
      if ((w & E) && !isGate(E)) g.fillRect(X(x) + cell - T / 2, Y(y) - T / 2, T, cell + T);
    }
    // murs mobiles
    for (const gt of L.gateList){
      const ox = gt.horiz ? gt.x + 1 : gt.x, oy = gt.horiz ? gt.y : gt.y + 1;
      if (!shown(gt.x, gt.y) && !shown(ox, oy)) continue;
      const closed = gateClosed(gt, el);
      g.fillStyle = closed ? "#d0697c" : "rgba(208,105,124,.28)";
      const th = closed ? 4 : 2;
      if (gt.horiz) g.fillRect(X(gt.x) + cell - th / 2, Y(gt.y) + 2, th, cell - 4);
      else g.fillRect(X(gt.x) + 2, Y(gt.y) + cell - th / 2, cell - 4, th);
    }
    // l'etoile d'arrivee (sa place change a chaque partie)
    if (shown(L.exit.x, L.exit.y)){
      const s = Math.max(2, Math.floor(cell / 10));
      sprite(STAR, X(L.exit.x) + cell / 2 - 3.5 * s, Y(L.exit.y) + cell / 2 - 3.5 * s, s);
    }
    // bombes
    for (const b of activeBombs(el)){
      if (el < b.land){
        if (!full) continue;                                  // celui qui marche ne voit rien venir
        const f = 1 - (b.land - el) / L.warn;                 // 0 au lacher, 1 a l'impact
        if (shown(b.x, b.y)){                                   // la cible clignote
          if (Math.floor(el / 180) % 2 === 0){
            g.strokeStyle = "#d0697c"; g.lineWidth = 2;
            g.strokeRect(X(b.x) + 3, Y(b.y) + 3, cell - 6, cell - 6);
          }
        }
        const by = 4 + f * (Y(b.y) - 4);
        sprite(BOMB, X(b.x) + cell / 2 - 3.5 * SP, by, SP);
      } else {
        const f = (el - b.land) / BLAST;
        g.fillStyle = `rgba(255,241,184,${0.85 * (1 - f)})`;
        for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
          const x = b.x + dx, y = b.y + dy;
          if (x < 0 || y < 0 || x >= size || y >= size || !shown(x, y)) continue;
          g.fillRect(X(x) + 1, Y(y) + 1, cell - 2, cell - 2);
        }
        if (b.k !== boomSeen){ boomSeen = b.k; ctx.sfx.bad(); }
      }
    }
    // tino
    if (tinoBox){
      const [sx, sy, sw, sh] = tinoBox;
      let hgt = cell * 0.9, wid = hgt * sw / sh;
      if (wid > cell * 0.9){ wid = cell * 0.9; hgt = wid * sh / sw; }
      g.drawImage(tino, sx, sy, sw, sh, X(p.x) + (cell - wid) / 2, Y(p.y) + (cell - hgt) / 2, wid, hgt);
    } else {
      g.fillStyle = "#d0697c";
      g.fillRect(X(p.x) + cell / 3, Y(p.y) + cell / 3, cell / 3, cell / 3);
    }
  }

  function loop(t){
    raf = requestAnimationFrame(loop);
    if (t - lastFrame < 33) return;
    lastFrame = t;
    if (!finished()){
      const el = elapsed();
      const L = lay();
      if (iWalk() && local && L && el != null && el > L.time) timeout();
      checkBlast();
      if (Math.floor(t / 500) !== loop.tick){ loop.tick = Math.floor(t / 500); updateHud(); }
    }
    draw();
  }

  // ── branchements ─────────────────────────────────────────
  ctx.onStream("move", d => {
    if (!d || !Number.isInteger(d.l) || d.l < 1 || d.l > NL) return;
    const p = validPos(d, LEVELS[d.l - 1].size);
    if (!p) return;
    streamPos[d.l] = newest(streamPos[d.l], { x:p.x, y:p.y, n:p.n, t:p.t });
  });
  ctx.onChange(update);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", flush);

  const testHook = new URLSearchParams(location.search).get("t") === "local";
  if (testHook){
    window.__maze = {
      level:() => level,
      size:l => LEVELS[l - 1].size,
      walker:l => LEVELS[l - 1].walker,
      walls:() => (lay() ? Array.from(lay().walls) : null),
      exit:() => (lay() ? { ...lay().exit } : null),
      path:() => (lay() ? lay().path.length : null),
      time:() => (lay() ? lay().time : null),
      start:() => startOf(),
      gates:() => (lay() ? lay().gateList.length : null),
      pos:() => (finished() ? null : { ...walkerPos() }),
      deaths:() => (finished() ? null : ctx.get(lv().walker, `dead.${level}`) | 0),
      elapsed:() => elapsed(),
      bombs:() => activeBombs(elapsed()),
      blocked:(x, y, d) => blocked(x, y, d, elapsed()),
    };
  }

  ctx.onCleanup(() => {
    flush();
    cancelAnimationFrame(raf);
    clearTimeout(fxTimer);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pagehide", flush);
    if (testHook) delete window.__maze;
  });

  enterLevel(false);
  raf = requestAnimationFrame(loop);
  requestAnimationFrame(() => frame.scrollIntoView({ block:"nearest", behavior:"smooth" }));
}
