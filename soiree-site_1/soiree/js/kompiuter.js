// ============================================================
// kompiuter.js : la voix du kompiuter (bulle + machine a ecrire)
//
// Easter eggs portes ici (locaux, sur l'ecran de celui qui clique) :
//  - 7 clics rapides sur kompiuter : il rougit, bugge, dit la
//    phrase secrete de content.js
//  - apres minuit heure de Paris : il baille, il ecrit plus lentement
// ============================================================
import { content } from "../content.js";

const SPRITE = "../3.png";      // kompiuter au trait blanc
const SPRITE_LOVE = "../7.png"; // kompiuter avec les coeurs

export function parisHour(d = new Date()){
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone:"Europe/Paris", hour:"numeric", hourCycle:"h23"
  }).format(d));
}
export function isLate(){ const h = parisHour(); return h >= 0 && h < 5; }

export function createKompiuter(root, { sfx } = {}){
  const img = root.querySelector("img");
  const bubble = root.querySelector("#speech");
  img.src = SPRITE;
  img.alt = "kompiuter";

  let typing = null, saysCount = 0, clicks = 0, clickTimer = null, egg = false;
  let current = "";

  function type(text, speed){
    clearInterval(typing);
    bubble.textContent = "";
    if (!text) return Promise.resolve();
    let i = 0;
    return new Promise(resolve => {
      typing = setInterval(() => {
        i++;
        bubble.textContent = text.slice(0, i);
        if (i >= text.length){ clearInterval(typing); typing = null; resolve(); }
      }, speed);
    });
  }

  function say(text){
    if (egg) { current = text; return Promise.resolve(); }  // l'oeuf finit sa phrase d'abord
    current = text;
    const late = isLate();
    saysCount++;
    if (late && saysCount % 5 === 1){
      return type(content.lines.yawn, 70).then(() => wait(900)).then(() => type(text, 70));
    }
    return type(text, late ? 70 : 26);
  }

  // ── 7 clics ───────────────────────────────────────────
  img.addEventListener("click", () => {
    if (egg) return;
    clicks++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clicks = 0; }, 2500);
    if (sfx) sfx.blip(clicks);
    if (clicks < 7) return;
    clicks = 0; egg = true;
    root.classList.add("blush", "glitch");
    if (sfx) sfx.glitch();
    setTimeout(() => {
      root.classList.remove("glitch");
      img.src = SPRITE_LOVE;
      type(content.secret7, 34);
    }, 800);
    setTimeout(() => {
      root.classList.remove("blush");
      img.src = SPRITE;
      egg = false;
      type(current, 26);
    }, 9000);
  });

  return { say };
}

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }
