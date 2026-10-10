// ============================================================
// guides.js : les guides pixel art (un par etape)
//
//   createGuide(slotEl, key) -> {
//     choose(cards:[elA, elB], index:0|1, { refuse }) : Promise<void>
//     destroy()
//   }
//
// Chaque guide est dessine depuis des grilles de caracteres
// (1 caractere = 1 pixel, couleurs dans PAL) sur un <canvas>
// agrandi en image-rendering:pixelated (--gpx px ecran par pixel).
//
// choose : le guide survole une carte, puis l'autre, hesite 2 ou
// 3 fois, se pose sur la carte choisie et fait son geste (act),
// la carte sursaute. refuse : il hesite, revient au milieu et
// secoue la tete. Positions lues sur les cartes au moment du
// mouvement (getBoundingClientRect), donc ca marche aussi avec
// les cartes empilees (mobile).
//
// Les grilles sont dessinees tournees vers la droite ; le guide
// se retourne (scaleX(-1)) quand il va vers la gauche.
// ============================================================
const PX = 4;                 // taille des effets (px ecran par pixel)
const STYLE_ID = "guides-style";

const PAL = {
  w:"#FAF8F4",   // creme
  r:"#d0697c",   // rose
  R:"#8B1A2B",   // bordeaux
  y:"#fff1b8",   // jaune pale
  g:"#9aa0c2",   // gris bleu
  G:"#5d6391",   // gris bleu fonce
  b:"#9a6a48",   // brun chaud
  k:"#0b0f22",   // trait sombre (yeux, details)
};

// ── les personnages ─────────────────────────────────────────
// frames : grille complete, ou { from:"idle", rows:{ n:"..." } }
//          (remplace seulement les lignes n de la frame from)
// idle   : sequence d'attente, une frame par tick (ms)
// perch  : ou il se pose pour agir, en px depuis le haut-milieu
//          de la carte (dx < 0 : a gauche, tourne vers la carte)
// act    : le geste. f frame, ms duree, hit = la carte sursaute,
//          fx effet (voir FX), from/to en pixels de la grille
//          (to sous la derniere ligne = dans la carte), body =
//          mouvement du personnage entier ("lean", "hop", "squash")
export const SPRITES = {
  waiter: {
    frames: {
      idle: [
        "............yy....",
        "..........wwwwww..",
        ".........wwwwwwww.",
        ".........wwwwwwww.",
        "..bbbbb.yyyyyyyyyy",
        ".bbbbbbb...ww.....",
        ".bwwwwwb...gg.....",
        ".wkwwwkw...gg.....",
        ".wwwwwww...gg.....",
        ".rbbwbbr...gg.....",
        "..wwwww....gg.....",
        "..rrRrr....gg.....",
        ".ggwwwgggggg......",
        "gggwwwgg..........",
        "ggggwggg..........",
        "gwwwwwww..........",
        "wwwwwwww..........",
        ".wwwwwww..........",
        "..GG.GG...........",
        ".bbb.bbb..........",
      ],
      idle2: { from:"idle", rows:{ 7:".wbwwwbw...gg....." } },
      act: { from:"idle", rows:{
        0:"..................",
        1:"..................",
        2:"..................",
        3:"..................",
        4:"..bbbbb...........",
        5:".bbbbbbb..........",
        6:".bwwwwwb..........",
        7:".wkwwwkw..........",
        8:".wwwwwww..........",
        9:".rbbwbbr..........",
        10:"..wwwww...........",
        11:"..rrRrr...........",
        12:".ggwwwggggyyyyyyyy",
        13:"gggwwwgg.ww.......",
      }},
    },
    idle: ["idle", "idle", "idle", "idle", "idle", "idle2"],
    tick: 520,
    perch: { dx:-24, dy:2 },
    act: [
      { f:"act", ms:260 },
      { f:"act", ms:520, hit:true, fx:"plate", from:[14, 10], to:[14, 24], fxms:240, stay:700 },
      { f:"idle", ms:160 },
    ],
  },

  pigeon: {
    frames: {
      idle: [
        "..........ggg....",
        ".........ggggg...",
        ".........ggkgg...",
        ".........gggggyy.",
        "..........rGgg...",
        "..........GrGg...",
        "...ggggggGrGgg...",
        ".gggGGGGGGrgggg..",
        "gggGGGGGGGgggggg.",
        "GGGGkGGkGGgggggg.",
        "GG..GGGGGgggggg..",
        "G....ggggggggg...",
        "......ggggggg....",
        "........r..r.....",
        ".......rr.rr.....",
      ],
      idle2: { from:"idle", rows:{
        0:"...........ggg...",
        1:"..........ggggg..",
        2:"..........ggkgg..",
        3:"..........gggggyy",
        4:"..........rGggg..",
      }},
      act: { from:"idle", rows:{
        0:".................",
        1:".................",
        2:".................",
        3:".................",
        4:".................",
        5:".................",
        6:"...gggggggg......",
        7:".gggGGGGGGgggg...",
        8:"gggGGGGGGGgggrG..",
        9:"GGGGkGGkGGggrGgg.",
        10:"GG..GGGGGgggggkgg",
        11:"G....ggggggggggg.",
        12:"......ggggggg..yy",
      }},
    },
    idle: ["idle", "idle", "idle2", "idle"],
    tick: 380,
    perch: { dx:-14, dy:2 },
    act: [
      { f:"act", ms:130 }, { f:"idle", ms:130 },
      { f:"act", ms:130 }, { f:"idle", ms:130 },
      { f:"act", ms:240, hit:true }, { f:"idle", ms:200 },
    ],
  },

  painter: {
    frames: {
      idle: [
        "......R...........",
        "...RRRRRR...r.....",
        "..RRRRRRRRR.r.....",
        "..bwwwwwb...b.....",
        "..wkwwwkw...b.....",
        "..rwwwwwr...b.....",
        "..wwkkkww...b.....",
        "...wwwww...ww.....",
        "....rrr...ww......",
        "..wwwwwwwww.......",
        "..GGGGGGG.........",
        "bbbwwwwww.........",
        "byrbGGGGG.........",
        "bwbwwwwww.........",
        ".bbGGGGGG.........",
        "..bbbbbbb.........",
        "..bbb.bbb.........",
        "..bbb.bbb.........",
        "..GGG.GGG.........",
        ".GGGG.GGGG........",
      ],
      idle2: { from:"idle", rows:{ 4:"..wbwwwbw...b....." } },
      up: { from:"idle", rows:{
        0:"......R.......r...",
        1:"...RRRRRR....b....",
        2:"..RRRRRRRRR.b.....",
        3:"..bwwwwwb..b......",
        4:"..wkwwwkw.b.......",
        5:"..rwwwwwrww.......",
        6:"..wwkkkwwww.......",
        7:"...wwwww..........",
        8:"....rrr...........",
      }},
      tap: { from:"idle", rows:{
        0:"......R...........",
        1:"...RRRRRR.........",
        2:"..RRRRRRRRR.......",
        3:"..bwwwwwb.........",
        4:"..wkwwwkw.........",
        5:"..rwwwwwr.........",
        6:"..wwkkkww.........",
        7:"...wwwww..........",
        8:"....rrr...........",
        9:"..wwwwwwwwww......",
        10:"..GGGGGGG..ww.....",
        11:"bbbwwwwww....b....",
        12:"byrbGGGGG.....b...",
        13:"bwbwwwwww......b..",
        14:".bbGGGGGG.......r.",
      }},
    },
    idle: ["idle", "idle", "idle", "idle", "idle2"],
    tick: 520,
    perch: { dx:-30, dy:2 },
    act: [
      { f:"up", ms:220 },
      { f:"tap", ms:200, hit:true, fx:"dab", from:[16, 22], stay:650 },
      { f:"up", ms:200 },
      { f:"tap", ms:260, fx:"dab", from:[19, 25], stay:500 },
      { f:"idle", ms:160 },
    ],
  },

  cupid: {
    fly: true,
    frames: {
      idle: [
        "......yyyyy.......",
        ".....yyyyyyy..b...",
        ".....ywwwwwy...b..",
        ".....wkwwwkw...wb.",
        ".....rwwwwwr...w.b",
        "......wwkww....w.b",
        "ww.....www.....w.b",
        "wgww..wwwwwwwwwwwb",
        "wwgwwwwwwwww...w.b",
        ".wwgwwrwwww....w.b",
        "..wwwwwrrww....wb.",
        "...ww.wwwrr...b...",
        "......wwwww..b....",
        "......ww.ww.......",
        "......w...w.......",
      ],
      idle2: { from:"idle", rows:{
        5:"ww....wwkww....w.b",
        6:"wgww...www.....w.b",
        7:"wwgwwwwwwwwwwwwwwb",
        8:".wwgwwwwwwww...w.b",
        9:"..wwwwrwwww....w.b",
        10:"......wrrww....wb.",
        11:"......wwwrr...b...",
      }},
      aim: { from:"idle", rows:{
        7:"wgww..wwwwwwwww.wb",
        8:"wwgwwwwwwwwwwwwwwb",
      }},
    },
    idle: ["idle", "idle2"],
    tick: 240,
    perch: { dx:-44, dy:-30 },
    act: [
      { f:"aim", ms:380 },
      { f:"idle", ms:420, hit:true, fx:"arrow", from:[18, 8], to:[33, 23], fxms:200, stay:650 },
      { f:"idle2", ms:160 },
    ],
  },

  gamepad: {
    frames: {
      idle: [
        "..gggggggggggggggg..",
        ".gwwwwwwwwwwwwwwwwg.",
        "gwwwGwwwwwwwwwwwrwwg",
        "gwwGGGwwkwwwwkwrwywg",
        "gwwwGwwwkwwwwkwwywwg",
        "gwwwwwwwwwkkwwwwwwwg",
        "gwwwwwwgggggggwwwwwg",
        ".gwwwwg......gwwwwg.",
        "..gggg........gggg..",
        "....G..........G....",
        "....G..........G....",
        "...bbb........bbb...",
      ],
      idle2: { from:"idle", rows:{
        3:"gwwGGGwwwwwwwwwrwywg",
        4:"gwwwGwwwkwwwwkwwywwg",
      }},
      press: [
        "....................",
        "....................",
        "..gggggggggggggggg..",
        ".gwwwwwwwwwwwwwwwwg.",
        "gwwwGwwwwwwwwwwwwwwg",
        "gwwGGGwwkwwwwkwkwywg",
        "gwwwGwwwwwwwwwwwywwg",
        "gwwwwwwwwkkkkwwwwwwg",
        "gwwwwwwgggggggwwwwwg",
        ".ggggg........ggggg.",
        "...G............G...",
        "..bbb..........bbb..",
      ],
    },
    idle: ["idle", "idle", "idle", "idle", "idle2"],
    tick: 480,
    perch: { dx:0, dy:2 },
    act: [
      { f:"idle", ms:260, body:"hop" },
      { f:"press", ms:300, hit:true, fx:"ping", from:[10, 13], stay:260 },
      { f:"idle", ms:160, body:"hop" },
      { f:"press", ms:240, fx:"ping", from:[10, 13], stay:200 },
      { f:"idle", ms:140 },
    ],
  },

  candle: {
    frames: {
      idle: [
        ".....y......",
        ".....yy.....",
        "....yyy.....",
        "....ywyy....",
        "...yywwy....",
        "...ywwwy....",
        "....yrry....",
        ".....k......",
        "...wwwwww...",
        "...wwwwwww..",
        "...wkwwkww..",
        "...wwwwwww..",
        "...wwrrwww..",
        "..wwwwwwww..",
        "...wwwwwww..",
        "...wwwwww...",
        "...wwwwww...",
        ".gggggggggg.",
        "gggggggggggG",
        ".GGGGGGGGGG.",
      ],
      idle2: { from:"idle", rows:{
        0:"......y.....",
        1:".....yy.....",
        2:".....yyy....",
        3:"....yywy....",
        4:"....ywwyy...",
        5:"...yywwwy...",
        6:"....yrry....",
      }},
      lean: { from:"idle", rows:{
        0:"..........yy",
        1:"........yyy.",
        2:"......yyyy..",
        3:".....ywwyy..",
        4:"....ywwwy...",
        5:"....ywwy....",
        6:"....yrry....",
        10:"...wbwwbww..",
        12:"...wwrrrww..",
      }},
    },
    idle: ["idle", "idle2"],
    tick: 200,
    perch: { dx:-34, dy:2 },
    act: [
      { f:"lean", ms:300 }, { f:"idle", ms:140 },
      { f:"lean", ms:520, hit:true }, { f:"idle2", ms:160 },
    ],
  },

  detective: {
    frames: {
      idle: [
        "....bbbbbb........",
        "...bbbbbbbb.......",
        "...GGGGGGGG.......",
        ".bbbbbbbbbbbb.....",
        "...wwwwwww........",
        "...wkwwwkw........",
        "...rwwwwwr........",
        "...wwwkwww....gg..",
        "....wwwww....gwwg.",
        "...yyyyyyy..gwwwwg",
        "..yyyyyyyyy.gwwwwg",
        "..yyyybyyyywwgwwg.",
        "..yyyybyyyy..bgg..",
        "..bbbbbbbbb..b....",
        "..yyyyyyyyy.......",
        "..yyyybyyyy.......",
        "..yyyyyyyyy.......",
        "...GGG.GGG........",
        "...GGG.GGG........",
        "..kkkk.kkkk.......",
      ],
      idle2: { from:"idle", rows:{
        5:"...wbwwwbw........",
        7:"...wwwkwww...gg...",
        8:"....wwwww...gwwg..",
        9:"...yyyyyyy.gwwwwg.",
        10:"..yyyyyyyyygwwwwg.",
        11:"..yyyybyyyywgwwg..",
        12:"..yyyybyyyy.bgg...",
        13:"..bbbbbbbbbb......",
      }},
      look: { from:"idle", rows:{
        7:"...wwwkwww........",
        8:"....wwwww.........",
        9:"...yyyyyyy........",
        10:"..yyyyyyyyyy......",
        11:"..yyyybyyyyyww....",
        12:"..yyyybyyyy..bb...",
        13:"..bbbbbbbbb...bgg.",
        14:"..yyyyyyyyy..gwwwg",
        15:"..yyyybyyyy.gwwwwg",
        16:"..yyyyyyyyy.gwwwwg",
        17:"...GGG.GGG...gwwg.",
        18:"...GGG.GGG....gg..",
      }},
    },
    idle: ["idle", "idle", "idle2", "idle2", "idle", "idle"],
    tick: 460,
    perch: { dx:-30, dy:2 },
    act: [
      { f:"look", ms:820, hit:true, body:"lean" },
      { f:"idle", ms:180 },
    ],
  },

  projectionist: {
    frames: {
      idle: [
        "..wwwww....wwwww....",
        ".wwGwGww..wwGwGww...",
        ".wwwGwww..wwwGwww...",
        ".wwGwGww..wwGwGww...",
        "..wwwww....wwwww....",
        "....G.......G.......",
        "...ggggggggggggg....",
        "..ggggggggggggggg...",
        "..gwwgggggwwggggGGy.",
        "..gwkgggggwkggggGyyw",
        "..ggggggggggggggGGy.",
        "..gggggkkkgggggggg..",
        "..ggggggggggggggg...",
        "...ggggggggggggg....",
        ".....G.......G......",
        ".....G.......G......",
        "....bbb.....bbb.....",
      ],
      idle2: { from:"idle", rows:{
        1:".wwwGwww..wwwGwww...",
        2:".wwGGGww..wwGGGww...",
        3:".wwwGwww..wwwGwww...",
      }},
      beam: { from:"idle", rows:{
        8:"..gwwgggggwwggggGGw.",
        9:"..gkkgggggkkggggGwww",
        10:"..ggggggggggggggGGw.",
        11:"..gggggkkkgggggggg..",
      }},
    },
    idle: ["idle", "idle2"],
    tick: 300,
    perch: { dx:-58, dy:2 },
    act: [
      { f:"beam", ms:200, fx:"beam", from:[19, 9], stay:760 },
      { f:"beam", ms:500, hit:true },
      { f:"idle", ms:260 },
    ],
  },
};

// ── les effets ──────────────────────────────────────────────
// o : point d'accroche dans la grille (defaut : le centre)
function beamGrid(){
  const L = 28, rows = [];
  for (let y = 0; y < 26; y++){
    let s = "";
    for (let x = 0; x < L; x++){
      const c = 1 + x * 0.55, half = 0.6 + x * 0.3;
      s += Math.abs(y - c) <= half ? "y" : ".";
    }
    rows.push(s);
  }
  return rows;
}

const FX = {
  q: { g:[
    ".www.",
    "w...w",
    "....w",
    "..ww.",
    "..w..",
    ".....",
    "..w..",
  ]},
  plate: { g:[
    "..rr.rr..",
    ".rrrrrrr.",
    "..rrrrr..",
    "...rrr...",
    "....r....",
    "wwwwwwwww",
    ".wwwwwww.",
  ]},
  dab: { g:[
    ".r..r.",
    "..rr..",
    "rrrrr.",
    ".rrr.r",
    "r..r..",
  ]},
  arrow: { o:[8, 8], g:[
    "w.w......",
    ".ww......",
    "www......",
    "...b.....",
    "....b....",
    ".....b...",
    "......rr.",
    "......rrr",
    ".......r.",
  ]},
  ping: { g:[
    "w.......w",
    ".w.....w.",
    ".........",
    "ww.....ww",
  ]},
  beam: { o:[0, 1], cls:"guide-beam", g:beamGrid() },
};

// ── rendu des grilles ────────────────────────────────────────
function resolveSprite(sp){
  if (sp._r) return sp._r;
  const out = {};
  const get = name => {
    if (out[name]) return out[name];
    const f = sp.frames[name];
    if (!f) return get("idle");
    let rows;
    if (Array.isArray(f)) rows = f.slice();
    else {
      rows = get(f.from || "idle").slice();
      for (const [i, row] of Object.entries(f.rows || {})) rows[+i] = row;
    }
    return (out[name] = rows);
  };
  Object.keys(sp.frames).forEach(get);
  const all = Object.values(out);
  const W = Math.max(...all.flat().map(r => r.length));
  const H = Math.max(...all.map(f => f.length));
  // toutes les frames a la meme taille, calees en bas (les pieds)
  for (const n of Object.keys(out)){
    const f = out[n].map(r => r.padEnd(W, "."));
    while (f.length < H) f.unshift(".".repeat(W));
    out[n] = f;
  }
  return (sp._r = { W, H, frames:out });
}

function paint(cv, rows){
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < rows.length; y++){
    const row = rows[y];
    for (let x = 0; x < row.length; x++){
      const c = PAL[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function gridCanvas(rows, cls){
  const W = Math.max(...rows.map(r => r.length)), H = rows.length;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  cv.className = "guide-px" + (cls ? " " + cls : "");
  cv.style.width = W * PX + "px";
  cv.style.height = H * PX + "px";
  paint(cv, rows);
  return cv;
}

// ── styles (injectes une fois) ──────────────────────────────
const CSS = `
.guide{
  --gpx:4px;
  position:absolute; left:50%; bottom:0; z-index:4;
  margin-left:calc(var(--gw) * var(--gpx) / -2);
  pointer-events:none; user-select:none;
}
.step.playing .guide{ --gpx:3px; }
.guide-body{ transform-origin:50% 100%; }
.guide-bob{ animation:guide-bob 1.4s steps(1, end) infinite; }
.guide.fly .guide-bob{ animation-duration:.8s; }
.guide-px{ display:block; image-rendering:crisp-edges; image-rendering:pixelated; }
.guide-body .guide-px{
  width:calc(var(--gw) * var(--gpx));
  height:calc(var(--gh) * var(--gpx));
}
.guide-fx{ position:absolute; left:50%; bottom:0; width:0; height:0; }
.guide-fx-item{ position:absolute; left:0; top:0; }
.guide-beam{ opacity:.55; }
@keyframes guide-bob{
  0%{ transform:translateY(0); }
  50%{ transform:translateY(calc(var(--gpx) * -1)); }
}
`;

function injectStyle(){
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement("style");
  st.id = STYLE_ID;
  st.textContent = CSS;
  document.head.append(st);
}

const strHash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const STOP = Symbol("stop");

// ════════════════════════════════════════════════════════════
export function createGuide(slotEl, key){
  if (!slotEl || typeof document === "undefined"){
    return { choose: async () => {}, destroy(){} };
  }
  injectStyle();
  const spec = SPRITES[key] || SPRITES.waiter;
  const { W, H, frames } = resolveSprite(spec);
  const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const fly = !!spec.fly;
  const homeY = fly ? -10 : 0;

  // wrap (position) > body (sens, gestes) > bob (respiration) > canvas
  const wrap = document.createElement("div");
  wrap.className = "guide" + (fly ? " fly" : "");
  wrap.dataset.guide = key;
  wrap.style.setProperty("--gw", W);
  wrap.style.setProperty("--gh", H);
  const body = document.createElement("div");
  body.className = "guide-body";
  const bob = document.createElement("div");
  bob.className = "guide-bob";
  const cv = document.createElement("canvas");
  cv.className = "guide-px";
  cv.width = W; cv.height = H;
  const fxLayer = document.createElement("div");
  fxLayer.className = "guide-fx";
  bob.append(cv); body.append(bob); wrap.append(body, fxLayer);
  slotEl.append(wrap);

  let dead = false, run = 0, acting = false, seqI = 0;
  let cx = 0, cy = homeY, facing = 1, qEl = null;
  const pending = new Set();   // attentes en cours (resolues par destroy)
  const anims = new Set();     // animations WAAPI en cours

  const draw = name => paint(cv, frames[name] || frames.idle);
  const place = () => { wrap.style.transform = `translate(${cx}px, ${cy}px)`; };
  draw("idle"); place();

  const seq = spec.idle || ["idle"];
  const timer = reduced ? null : setInterval(() => {
    if (acting) return;
    seqI = (seqI + 1) % seq.length;
    draw(seq[seqI]);
  }, spec.tick || 500);

  // attente qui ne bloque jamais : destroy la resout tout de suite
  function pause(ms){
    return new Promise(res => {
      const done = () => { clearTimeout(t); pending.delete(done); res(); };
      const t = setTimeout(done, ms);
      pending.add(done);
    });
  }
  function track(a){ anims.add(a); a.addEventListener("finish", () => anims.delete(a)); a.addEventListener("cancel", () => anims.delete(a)); return a; }

  function face(dir){
    facing = dir < 0 ? -1 : 1;
    body.style.transform = facing < 0 ? "scaleX(-1)" : "";
  }

  // ── geometrie : tout en px depuis la position de repos ─────
  function home(){
    const s = slotEl.getBoundingClientRect();
    return { x: s.left + s.width / 2, y: s.bottom };
  }
  function above(card, lift){
    const h = home(), c = card.getBoundingClientRect();
    return { x: Math.round(c.left + c.width / 2 - h.x), y: Math.round(c.top - h.y - lift) };
  }

  // ── mouvements ─────────────────────────────────────────────
  async function moveTo(x, y, ms, arc, alive){
    if (Math.abs(x - cx) > 2) face(x > cx ? 1 : -1);
    const n = 8, kf = [];
    for (let i = 0; i <= n; i++){
      const t = i / n;
      const px = cx + (x - cx) * t, py = cy + (y - cy) * t - arc * Math.sin(Math.PI * t);
      kf.push({ transform:`translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)` });
    }
    const a = track(wrap.animate(kf, { duration:ms, easing:"ease-in-out", fill:"forwards" }));
    cx = x; cy = y;
    await pause(ms);
    place(); a.cancel();
    if (!alive()) throw STOP;
  }

  function bodyMove(kind, ms){
    const f = facing < 0 ? "scaleX(-1) " : "";
    const K = {
      lean:   [0, .25, .8, 1].map((o, i) => ({ offset:o, transform:f + `rotate(${[0, 12, 12, 0][i]}deg)` })),
      hop:    [0, .5, 1].map((o, i) => ({ offset:o, transform:f + `translateY(${[0, -14, 0][i]}px)` })),
      shake:  [0, -12, 12, -12, 12, -8, 8, 0].map(d => ({ transform:f + `rotate(${d}deg)` })),
      shrug:  [1, .86, 1.06, 1].map(s => ({ transform:f + `scaleY(${s})` })),
    }[kind];
    if (K) track(body.animate(K, { duration:ms, easing:"ease-in-out" }));
  }

  function bump(card){
    const base = getComputedStyle(card).transform;
    const b = base && base !== "none" ? base + " " : "";
    const kf = [[0, 1], [5, .97], [-3, 1.03], [0, 1]].map(([y, s]) => ({ transform:`${b}translateY(${y}px) scale(${s})` }));
    track(card.animate(kf, { duration:360, easing:"ease-out" }));
  }

  // effet : grille FX accrochee a un point de la grille du guide
  function fx(name, from, to, ms, stay){
    const def = FX[name];
    if (!def) return;
    const gw = Math.max(...def.g.map(r => r.length)), gh = def.g.length;
    const [ox, oy] = def.o || [gw / 2, gh / 2];
    const item = document.createElement("div");
    item.className = "guide-fx-item";
    item.append(gridCanvas(def.g, def.cls));
    const at = ([c, r]) => {
      let x = (c - W / 2) * PX;
      const y = (r - H) * PX;
      if (facing < 0) x = -x;
      const left = facing < 0 ? x - (gw - ox) * PX : x - ox * PX;
      return `translate(${left}px, ${y - oy * PX}px)` + (facing < 0 ? " scaleX(-1)" : "");
    };
    item.style.transform = at(from);
    fxLayer.append(item);
    if (to) track(item.animate([{ transform:at(from) }, { transform:at(to) }], { duration:ms || 250, easing:"ease-in", fill:"forwards" }));
    else track(item.animate([{ opacity:0 }, { opacity:1, offset:.3 }, { opacity:.6, offset:.6 }, { opacity:1 }], { duration:240 }));
    pause((to ? ms || 250 : 0) + (stay || 400)).then(() => {
      if (dead) return;
      const a = track(item.animate([{ opacity:1 }, { opacity:0 }], { duration:220, fill:"forwards" }));
      a.addEventListener("finish", () => item.remove());
    });
  }

  function question(on){
    if (qEl){ qEl.remove(); qEl = null; }
    if (!on) return;
    qEl = document.createElement("div");
    qEl.className = "guide-fx-item";
    const g = FX.q.g;
    qEl.append(gridCanvas(g));
    // au-dessus de la tete, jamais retourne (un ? reste un ?)
    qEl.style.transform = `translate(${-g[0].length * PX / 2}px, ${-(H + g.length + 3) * PX}px)`;
    fxLayer.append(qEl);
  }

  // ── le choix ───────────────────────────────────────────────
  async function choose(cards, index, { refuse = false } = {}){
    const my = ++run;
    const alive = () => !dead && my === run;
    const wait = async ms => { await pause(ms); if (!alive()) throw STOP; };
    const els = Array.isArray(cards) ? cards : [];
    const ok = els.length >= 2 && els.every(c => c && c.isConnected) && slotEl.isConnected;
    try {
      if (!ok || reduced){ await pause(ok ? 300 : 0); return; }
      const i = index ? 1 : 0;
      const n = refuse ? 3 + (strHash(key) % 2) : 2 + ((strHash(key) + i) % 2);
      let at = refuse ? 0 : (n % 2 ? 1 - i : i);   // la derniere visite est l'autre carte
      const lift = fly ? 30 : 14;

      await moveTo(cx, homeY - 8, 160, 0, alive);
      for (let v = 0; v < n; v++){
        const p = above(els[at], lift);
        const jitter = (v % 2 ? 1 : -1) * 6;
        await moveTo(p.x + jitter, p.y, Math.max(260, 380 - v * 40), fly ? 10 : 14, alive);
        if (v === n - 1) question(true);
        await wait(v === n - 1 ? 340 : 170 + (v % 2) * 60);
        at = 1 - at;
      }

      if (refuse){
        const a = above(els[0], lift), b = above(els[1], lift);
        await moveTo(Math.round((a.x + b.x) / 2), Math.min(homeY - 6, Math.round((a.y + b.y) / 2)), 380, 10, alive);
        face(1);
        bodyMove("shake", 800);
        await wait(820);
        bodyMove("shrug", 320);
        await wait(420);
        question(false);
      } else {
        question(false);
        const card = els[i];
        const c = card.getBoundingClientRect(), h = home();
        const dx = Math.max(-c.width / 2 + 24, Math.min(c.width / 2 - 24, spec.perch.dx));
        await moveTo(Math.round(c.left + c.width / 2 - h.x + dx), Math.round(c.top - h.y + spec.perch.dy), 400, fly ? 12 : 18, alive);
        if (dx) face(dx < 0 ? 1 : -1);
        acting = true;
        for (const s of spec.act){
          draw(s.f);
          if (s.body) bodyMove(s.body, s.ms);
          if (s.fx) fx(s.fx, s.from, s.to, s.fxms, s.stay);
          if (s.hit) bump(card);
          await wait(s.ms);
        }
        acting = false;
        draw("idle");
      }
      await moveTo(0, homeY, 420, 12, alive);
      face(1);
    } catch (e){
      if (e !== STOP) console.error(e);
    } finally {
      if (my === run && !dead){ acting = false; question(false); }
    }
  }

  function destroy(){
    if (dead) return;
    dead = true;
    if (timer) clearInterval(timer);
    [...pending].forEach(done => done());
    [...anims].forEach(a => a.cancel());
    wrap.remove();
  }

  return { choose, destroy };
}
