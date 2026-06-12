// ============================================================
// fx.js : petites animations (univers mumy joe + style du site)
//
// Dessin a la main, traits bordeaux, rose poudre, vert sauge.
// Tout est ephemere : chaque element se nettoie tout seul.
// Aucune dependance (pas de firebase). Importable partout.
// ============================================================

const BORD = "#8B1A2B", ANA = "#c2452d", ADR = "#2d5fc2";
const PINK = "#f3cdc9", SAGE = "#6f8a52", LEAF = "#cde0b3";

let styled = false;
function ensureStyles(){
  if (styled) return; styled = true;
  const css = `
  .fx{ position:fixed; z-index:9970; pointer-events:none; will-change:transform,opacity; }
  @keyframes fx-rise{ from{ transform:translateY(0) rotate(var(--r,0deg)); opacity:.95; }
                      to{ transform:translateY(var(--dy,-115vh)) rotate(var(--r,0deg)); opacity:0; } }
  @keyframes fx-bloom{ 0%{ transform:scale(0) rotate(-28deg); opacity:0; }
                       55%{ transform:scale(1.12) rotate(4deg); opacity:1; }
                       70%{ transform:scale(1) rotate(0deg); }
                       100%{ transform:scale(1) translateY(-26vh) rotate(0deg); opacity:0; } }
  @keyframes fx-pop{ 0%{ transform:scale(.2); opacity:0; } 40%{ transform:scale(1.15); opacity:1; }
                     100%{ transform:scale(.6) translateY(-60px); opacity:0; } }
  @keyframes fx-spin-fade{ 0%{ transform:scale(.3) rotate(0deg); opacity:0; }
                           35%{ transform:scale(1.1) rotate(40deg); opacity:1; }
                           100%{ transform:scale(.7) rotate(160deg) translateY(-70px); opacity:0; } }
  @keyframes fx-tap{ 0%{ transform:scale(.4); opacity:.8; } 100%{ transform:scale(1.8); opacity:0; } }
  @keyframes fx-shake{ 0%,100%{ transform:translateX(0); } 20%{ transform:translateX(-7px); }
                       40%{ transform:translateX(6px); } 60%{ transform:translateX(-4px); } 80%{ transform:translateX(3px); } }
  .fx-shake{ animation:fx-shake .4s ease; }
  button{ transition:transform .08s ease; }
  button:active:not(:disabled){ transform:scale(.94); }
  `;
  const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
}

function spawn(html, x, y, anim, dur, vars){
  const el = document.createElement("div");
  el.className = "fx";
  el.style.left = x + "px"; el.style.top = y + "px";
  el.style.transform = "translate(-50%,-50%)";
  el.innerHTML = html;
  const inner = el.firstElementChild;
  inner.style.animation = `${anim} ${dur}ms ease forwards`;
  if (vars) for (const k in vars) inner.style.setProperty(k, vars[k]);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), dur + 60);
  return el;
}

// ── briques dessinees ───────────────────────────────────────
function heartSVG(c, s = 26){
  return `<svg width="${s}" height="${s}" viewBox="0 0 32 30">
    <path d="M16 27 C8 20 2 15 2 9 C2 4 6 1 10 3 C13 4 15 7 16 9 C17 7 19 4 22 3 C26 1 30 4 30 9 C30 15 24 20 16 27Z"
      fill="${c}" stroke="${BORD}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
function petalSVG(c, s = 20){
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24">
    <path d="M12 2 C19 6 19 18 12 22 C5 18 5 6 12 2Z" fill="${c}" stroke="${BORD}" stroke-width="1.4"/></svg>`;
}
function starSVG(c, s = 22){
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24">
    <path d="M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 16.5 L6.5 21 L8.5 13.5 L3 9 L10 9Z"
      fill="${c}" stroke="${BORD}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
}
// la fleur d'adrien : tulipe a tete tracee main, yeux + nez coeur,
// tige qui crochete a gauche, feuille verte enroulee. head = couleur
// du contour de la tete (variantes possibles).
const GREEN = "#1b6b2f", INK = "#161015";
export function flowerSVG(s = 80, head = BORD){
  return `<svg width="${s}" height="${s * 2}" viewBox="0 0 300 600" fill="none"
      stroke-linecap="round" stroke-linejoin="round">
    <!-- tige + crochet a gauche -->
    <path d="M178 300 C182 372 179 442 176 492 C172 536 150 566 118 566"
      stroke="${head}" stroke-width="13"/>
    <!-- feuille verte enroulee -->
    <path d="M176 360 C236 350 250 410 192 414 C152 416 158 372 210 386"
      stroke="${GREEN}" stroke-width="15"/>
    <!-- contour de la tete (tulipe a sommet festonne) -->
    <path d="M92 178 C84 122 96 90 126 84 Q142 60 160 88 Q178 60 196 88
             Q214 60 232 86 C260 94 270 126 260 180
             C270 252 232 306 176 306 C120 306 82 252 92 178 Z"
      stroke="${head}" stroke-width="13"/>
    <!-- ligne interieure des petales -->
    <path d="M116 100 C146 104 162 142 178 138 C196 142 214 104 244 100"
      stroke="${head}" stroke-width="11"/>
    <!-- yeux -->
    <ellipse cx="145" cy="182" rx="9" ry="14" fill="${INK}" stroke="none"/>
    <ellipse cx="212" cy="186" rx="9" ry="14" fill="${INK}" stroke="none"/>
    <!-- nez coeur -->
    <path d="M178 250 C171 240 159 239 157 249 C155 257 166 264 178 274
             C190 264 201 257 199 249 C197 239 185 240 178 250 Z"
      fill="${INK}" stroke="none"/>
  </svg>`;
}

function rnd(a, b){ return a + Math.random() * (b - a); }
function center(){ return { x: window.innerWidth / 2, y: window.innerHeight * 0.42 }; }

// ── effets publics ──────────────────────────────────────────
export const fx = {
  // pluie qui monte (coeurs / petales / etoiles), du bas vers le haut
  rise(kind = "heart", n = 26){
    ensureStyles();
    const make = kind === "petal" ? () => petalSVG([ANA, ADR, PINK][(Math.random()*3)|0], rnd(14, 28))
               : kind === "star"  ? () => starSVG([BORD, ANA, ADR][(Math.random()*3)|0], rnd(14, 26))
               :                     () => heartSVG([ANA, ADR, BORD][(Math.random()*3)|0], rnd(16, 30));
    for (let i = 0; i < n; i++){
      setTimeout(() => {
        const x = rnd(0.04, 0.96) * window.innerWidth;
        spawn(make(), x, window.innerHeight + 20, "fx-rise", rnd(2600, 5200),
          { "--dy": "-" + rnd(108, 125) + "vh", "--r": rnd(-25, 25) + "deg" });
      }, i * 80);
    }
  },

  // la fleur d'adrien qui eclot au centre (+ quelques petales autour)
  // variantes : taille, petit angle, et de temps en temps la couleur
  rose(){
    ensureStyles();
    const c = center();
    const head = Math.random() < 0.35 ? [ANA, ADR][(Math.random()*2)|0] : BORD;
    const tilt = rnd(-9, 9);
    const el = spawn(flowerSVG(rnd(78, 104), head), c.x, c.y + 40, "fx-bloom", 2600);
    el.firstElementChild.style.transformOrigin = "50% 90%";   // pousse depuis la tige
    el.firstElementChild.style.rotate = tilt + "deg";
    for (let i = 0; i < 10; i++){
      setTimeout(() => spawn(petalSVG([PINK, ANA][i % 2], rnd(12, 20)),
        c.x + rnd(-90, 90), c.y + rnd(-30, 50), "fx-rise", rnd(2200, 3600),
        { "--dy": "-" + rnd(50, 90) + "vh", "--r": rnd(-40, 40) + "deg" }), 250 + i * 70);
    }
  },

  // petite explosion d'etoiles depuis le centre
  stars(n = 16){
    ensureStyles();
    const c = center();
    for (let i = 0; i < n; i++){
      const a = (i / n) * Math.PI * 2, d = rnd(40, 140);
      spawn(starSVG([BORD, ANA, ADR][i % 3], rnd(14, 26)),
        c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, "fx-spin-fade", rnd(900, 1500));
    }
  },

  // burst de coeurs depuis le centre
  hearts(n = 18){
    ensureStyles();
    const c = center();
    for (let i = 0; i < n; i++){
      spawn(heartSVG([ANA, ADR, BORD][i % 3], rnd(18, 32)),
        c.x + rnd(-120, 120), c.y + rnd(-60, 60), "fx-pop", rnd(900, 1500));
    }
  },

  // celebration "on a trouve" : varie a chaque fois
  _cele: 0,
  celebrate(){
    const seq = [() => this.rose(), () => { this.stars(); this.rise("petal", 16); },
                 () => this.hearts(), () => { this.rise("star", 18); this.stars(12); }];
    seq[this._cele++ % seq.length]();
  },

  // petit "plop" + etoile a l'endroit d'un clic
  tap(x, y){
    ensureStyles();
    spawn(`<div style="width:18px;height:18px;border:2px solid ${BORD};border-radius:50%"></div>`,
      x, y, "fx-tap", 420);
    if (Math.random() < 0.5)
      spawn(starSVG([ANA, ADR][(Math.random()*2)|0], 16), x + rnd(-8, 8), y - 6, "fx-spin-fade", 700);
  },

  // secousse "mauvaise reponse"
  shake(el){
    ensureStyles();
    el.classList.remove("fx-shake"); void el.offsetWidth; el.classList.add("fx-shake");
  }
};
