// ============================================================
// q36.js : "3 questions to fall in love" (etape romantic, A)
//
// Les 36 questions d'Arthur Aron, reecrites dans la voix de
// kompiuter, en 3 series de 12 (de la plus legere a la plus
// intime). Une question tiree par serie, meme tirage des deux
// cotes (seeded). Une carte ne se retourne que quand les deux
// ont clique "flip" (flip.<k> dans chaque couloir), et dans
// l'ordre : la carte 2 seulement apres la carte 1.
// ============================================================
import { h } from "../dom.js";
import { seeded } from "../draw.js";

export const SETS = [
  [
    "you can invite anybody of the whole world for dinner. who you choose ?",
    "you want to be famous one day ? famous for what ?",
    "before a phone call, you practise in your head what you will say ? why ?",
    "tell me your perfect day. from wake up until sleep",
    "when is the last time you sing alone ? and for somebody ?",
    "you live until 90. for the last 60 years you keep the body of a 30 years old, or the head of a 30 years old. which one ?",
    "you have a little secret idea of how you will die one day ?",
    "find three things you two have the same. not the too easy ones",
    "what in your life make you the most thankful ?",
    "if you can change one thing in how you was raised, what it is ?",
    "tell the story of your life in four minutes. with lot of details. go",
    "tomorrow you wake up with one new power, or one new quality. which one you want ?",
  ],
  [
    "a magic ball can tell you the truth about anything. you, your life, the future. what you ask to it ?",
    "there is a thing you dream to do since long time ? why you did not do it yet ?",
    "what is the biggest thing you did in your life ? the one you are most proud",
    "what is the most important for you in a friend ?",
    "what is your most precious souvenir ?",
    "and your most terrible souvenir ?",
    "you know you will die suddenly in one year. you change something in how you live now ? why ?",
    "what friendship mean, for you ?",
    "what place love and tenderness have in your life ?",
    "one by one, say a good quality of the other. five in total",
    "your family is close and warm ? you think your childhood was more happy than the one of other people ?",
    "how you feel about you and your mother ?",
  ],
  [
    "make three true phrases with \"we\". like \"we are both on the phone and we feel...\"",
    "finish this phrase : \"i wish i had someone to share ... with\"",
    "what the other must know about you, to be very very close to you ?",
    "tell the other what you like in them. very honest, things you dont say to somebody you just meet",
    "tell a moment of your life where you was very very embarrass",
    "when you cry last time in front of somebody ? and alone ?",
    "tell the other one thing you already love about them",
    "for you, what is too serious to make jokes about ? if something",
    "if you go tonight without talk to anybody, what you regret most to never have told to someone ? why you did not tell it yet ?",
    "your house burn. everybody is safe, the animals too. you can run inside one last time and take one thing. what ? why ?",
    "of all your family, who it would break you the most to lose ? why ?",
    "tell a problem you have now and ask the other what they would do. then the other tell you how you seem to feel about it",
  ],
];
const FIRST = ["ana", "adrien", "ana"];
const otherOf = n => (n === "ana" ? "adrien" : "ana");

export function mount(ctx){
  injectStyle();
  const r = seeded(ctx.seed, "q36");
  const picks = SETS.map(set => set[Math.floor(r() * set.length)]);
  const timers = [];
  ctx.onCleanup(() => timers.forEach(clearTimeout));

  const cards = picks.map((q, k) => {
    const face = h("div", { class:"q36-face q36-down" },
      h("span", { class:"q36-heart" }),
      h("p", { class:"q36-num", text:String(k + 1) }));
    const btn = h("button", { text:"flip", onclick:() => ctx.set(`flip.${k}`, true) });
    const hint = h("p", { class:"small muted q36-hint" });
    const wrap = h("div", { class:"q36-card" }, face, btn, hint);
    return { wrap, face, btn, hint, open:false };
  });
  const end = h("div", { class:"panel center q36-end", style:"display:none" },
    h("p", { text:"click done when you finish" }));
  ctx.el.append(h("div", { class:"q36-grid" }, cards.map(c => c.wrap)), end);

  const clicked = (who, k) => !!ctx.get(who, `flip.${k}`);
  // cartes ouvertes = prefixe des cartes cliquees par les deux
  const openCount = () => {
    let n = 0;
    while (n < cards.length && clicked("ana", n) && clicked("adrien", n)) n++;
    return n;
  };

  function showQuestion(c, k){
    c.face.classList.remove("q36-down");
    c.face.replaceChildren(
      h("p", { class:"q36-q", text:picks[k] }),
      h("p", { class:"q36-who", text:`you both answer, ${FIRST[k]} first` }));
  }

  function turn(c, k, live){
    c.open = true;
    if (!live){ showQuestion(c, k); return; }
    ctx.sfx.flip();
    c.wrap.classList.add("q36-turning");
    timers.push(setTimeout(() => showQuestion(c, k), 250));
    timers.push(setTimeout(() => c.wrap.classList.remove("q36-turning"), 520));
  }

  let shown = null;   // nombre de cartes ouvertes au dernier rendu
  function update(){
    const n = openCount();
    const live = shown !== null;
    cards.forEach((c, k) => {
      if (k < n && !c.open) turn(c, k, live);
      const active = k === n;
      const mine = clicked(ctx.me, k), theirs = clicked(ctx.other, k);
      c.wrap.classList.toggle("q36-active", active);
      c.wrap.classList.toggle("q36-locked", k > n);
      c.btn.style.display = c.open ? "none" : "";
      c.btn.disabled = !active || mine;
      c.btn.textContent = active && mine ? "waiting..." : "flip";
      c.hint.textContent = !active ? ""
        : theirs && !mine ? `${ctx.other} wants to flip`
        : mine && !theirs ? `waiting for ${ctx.other}...` : "";
    });
    end.style.display = n === cards.length ? "" : "none";
    if (live && n > shown){
      if (n === cards.length) timers.push(setTimeout(() => ctx.say("click done when you are ready"), 1800));
      else ctx.say(`${FIRST[n - 1]} answer first`);
    }
    if (!live){
      ctx.say(n === 0 ? "flip together"
        : n === cards.length ? "click done when you finish"
        : "next card when you are ready");
    }
    shown = n;
  }
  ctx.onChange(update);
  update();
}

// ── styles ─────────────────────────────────────────────────
const HEART = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
function heartShadow(px){
  const out = [];
  HEART.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "X") out.push(`${x * px}px ${y * px}px var(--rose)`);
  }));
  return out.join(",");
}

function injectStyle(){
  if (document.getElementById("q36-style")) return;
  const px = 5;
  document.head.append(h("style", { id:"q36-style", text:`
.q36-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin:10px 0; }
.q36-card{ display:flex; flex-direction:column; align-items:center; gap:8px; transition:opacity .3s; }
.q36-face{
  width:100%; min-height:240px; padding:16px 14px;
  border:3px solid var(--cream); border-radius:16px; background:rgba(23,29,61,.94);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; text-align:center;
}
.q36-card:nth-child(1) .q36-face{ transform:rotate(-1deg); }
.q36-card:nth-child(3) .q36-face{ transform:rotate(1deg); }
.q36-face.q36-down{ border-style:dashed; }
.q36-active .q36-face{ border-color:var(--rose); }
.q36-locked{ opacity:.4; }
.q36-turning .q36-face{ animation:q36-turn .5s ease-in-out; }
@keyframes q36-turn{ 50%{ transform:scaleX(0); } }
.q36-heart{ display:block; width:${px}px; height:${px}px; margin-bottom:${px * 5}px; transform:translateX(-${px * 3}px); box-shadow:${heartShadow(px)}; }
.q36-num{ font-size:3rem; line-height:1; margin:0; }
.q36-level{ color:var(--muted); font-size:.9rem; margin:0; }
.q36-q{ font-size:1.3rem; line-height:1.35; margin:4px 0; }
.q36-who{ color:var(--rose); font-size:.95rem; margin:0; }
.q36-hint{ min-height:1.3em; margin:0; }
.q36-end{ margin-top:18px; }
@media (max-width:760px){ .q36-grid{ grid-template-columns:1fr; } .q36-face{ min-height:170px; } }
` }));
}
