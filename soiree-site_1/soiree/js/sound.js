// ============================================================
// sound.js : petits sons chiptune generes en direct (Web Audio)
// aucun fichier son. bouton muet memorise localement.
// ============================================================
let ctx = null;
let muted = false;
try { muted = localStorage.getItem("soiree-mute") === "1"; } catch {}

function ac(){
  if (muted) return null;
  if (!ctx){
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ctx = new A();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = "square", vol = 0.05, at = 0, slide = 0 } = {}){
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const seq = (notes, step = 0.08, opts) => notes.forEach((f, i) => f && tone(f, step * 0.95, { ...opts, at: i * step }));

export const sfx = {
  click(){ tone(660, 0.05, { vol:0.03 }); },
  blip(n = 1){ tone(500 + n * 60, 0.05, { vol:0.035 }); },
  flip(){ tone(300, 0.12, { slide:500, vol:0.04 }); },
  tick(){ tone(880, 0.03, { vol:0.025, type:"triangle" }); },
  pick(){ seq([392, 494, 587, 784], 0.07); },
  good(){ seq([523, 659, 784, 1047], 0.07, { type:"triangle", vol:0.06 }); },
  bad(){ seq([311, 233], 0.12, { vol:0.04 }); },
  glitch(){ for (let i = 0; i < 8; i++) tone(200 + Math.random() * 900, 0.04, { at:i * 0.05, vol:0.03 }); },
  star(){ tone(1400, 0.4, { slide:-900, type:"triangle", vol:0.04 }); },
  fanfare(){ seq([523, 523, 523, 659, 0, 587, 659, 784], 0.11, { vol:0.05 }); },
  isMuted(){ return muted; },
  setMuted(m){
    muted = !!m;
    try { localStorage.setItem("soiree-mute", muted ? "1" : "0"); } catch {}
  },
};

// bouton muet standard (texte, pas d'icone)
export function muteButton(){
  const b = document.createElement("button");
  b.className = "small mute";
  const label = () => { b.textContent = sfx.isMuted() ? "sound off" : "sound on"; };
  label();
  b.addEventListener("click", () => { sfx.setMuted(!sfx.isMuted()); label(); sfx.click(); });
  return b;
}
