// ============================================================
// sky.js : ciel de nuit en pixel art
//
// Le canvas est dessine en "pixels logiques" (PX px ecran chacun)
// puis agrandi par le CSS en image-rendering:pixelated : les
// etoiles restent des carres nets. Pas de halo, pas de degrade.
//
//   createSky(canvas) -> { shower(n) }
//   shower(n) : pluie de n etoiles filantes (code konami)
// ============================================================
const PX = 3;
const COLORS = ["#FAF8F4", "#FAF8F4", "#FAF8F4", "#fff1b8", "#f2b8c2"];

export function createSky(canvas){
  const ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, stars = [], shooters = [], lastFrame = 0, nextShooter = 0;

  function resize(){
    W = Math.ceil(innerWidth / PX);
    H = Math.ceil(innerHeight / PX);
    canvas.width = W; canvas.height = H;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    const n = Math.round((W * H) / 700);
    stars = Array.from({ length:n }, () => ({
      x: (Math.random() * W) | 0,
      y: (Math.random() * H) | 0,
      big: Math.random() < 0.07,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      ph: Math.random() * 6.28,
      sp: 0.4 + Math.random() * 1.6,
    }));
    draw(performance.now());
  }

  function spawn(delay = 0){
    const fromLeft = Math.random() < 0.5;
    shooters.push({
      x: fromLeft ? Math.random() * W * 0.6 : W * 0.4 + Math.random() * W * 0.6,
      y: Math.random() * H * 0.45,
      dx: fromLeft ? 1 : -1,
      v: 0.9 + Math.random() * 0.8,
      life: 0, max: 45 + Math.random() * 40,
      wait: delay,
    });
  }

  function px(x, y, color, a){
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, 1, 1);
  }

  function draw(t){
    ctx.clearRect(0, 0, W, H);
    for (const s of stars){
      const a = still ? 0.8 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t / 1000 * s.sp + s.ph));
      px(s.x, s.y, s.c, a);
      if (s.big){                         // petite croix de 5 pixels
        px(s.x - 1, s.y, s.c, a * 0.6); px(s.x + 1, s.y, s.c, a * 0.6);
        px(s.x, s.y - 1, s.c, a * 0.6); px(s.x, s.y + 1, s.c, a * 0.6);
      }
    }
    for (const sh of shooters){
      if (sh.wait > 0) continue;
      const fade = 1 - sh.life / sh.max;
      for (let i = 0; i < 10; i++){       // tete + trainee qui s'eteint
        px(sh.x - sh.dx * i, sh.y - i * 0.55, "#FAF8F4", fade * (1 - i / 10));
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop(t){
    requestAnimationFrame(loop);
    if (t - lastFrame < 33) return;       // ~30 images/s suffisent
    lastFrame = t;
    if (!still && t > nextShooter){
      if (nextShooter) spawn();
      nextShooter = t + 25000 + Math.random() * 45000;
    }
    for (const sh of shooters){
      if (sh.wait > 0){ sh.wait -= 33; continue; }
      sh.x += sh.dx * sh.v * 1.6; sh.y += sh.v * 0.9; sh.life++;
    }
    shooters = shooters.filter(s => s.life < s.max && s.x > -20 && s.x < W + 20 && s.y < H + 20);
    draw(t);
  }

  addEventListener("resize", resize);
  resize();
  requestAnimationFrame(loop);

  return {
    shower(n = 26){
      for (let i = 0; i < n; i++) spawn(i * (120 + Math.random() * 160));
    },
  };
}
