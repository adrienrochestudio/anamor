// ============================================================
// lies.js : etape "us two", carte B (deux verites un mensonge)
//
// Chacun a prepare 3 manches. Ordre alterne, deduit des deux
// listes (memes donnees, meme calcul des deux cotes) :
//   manche 1 d'ana (adrien devine), manche 1 d'adrien (ana
//   devine), manche 2 d'ana, etc.
//
// couloirs (espace de noms de l'activite) :
//   vote.<owner>.<r> = 0|1|2   chez celui qui devine
//   next.<r> = true            chez l'auteur de la manche r,
//                              apres son histoire : on passe
// La manche en cours = la premiere sans next de son auteur.
// ============================================================
import { h, clear } from "../dom.js";

const N_ROUNDS = 3;
const PEOPLE = ["ana", "adrien"];
const otherOf = who => (who === "ana" ? "adrien" : "ana");

const CSS = `
.lies-score{ display:flex; gap:24px; justify-content:center; flex-wrap:wrap; margin:0 0 6px; }
.lies-ana{ color:var(--ana); }
.lies-adrien{ color:var(--adrien); }
.lies-head{ margin:0 0 10px; }
.lies-list{ display:flex; flex-direction:column; gap:10px; }
.lies-s{
  display:block; width:100%; text-align:left; font-size:1.15rem;
  border:3px solid var(--line); border-radius:14px; padding:10px 14px;
  background:rgba(16,21,46,.6); color:var(--cream); text-transform:none;
}
button.lies-s{ border-color:var(--cream); }
button.lies-s:nth-child(odd){ transform:rotate(-.4deg); }
button.lies-s:nth-child(even){ transform:rotate(.4deg); }
.lies-s .lies-tag{ display:block; font-size:.85rem; color:var(--muted); text-transform:lowercase; }
.lies-s.lies-mine{ border-style:dashed; border-color:var(--rose); }
.lies-s.lies-lie{ border-color:var(--rose); background:rgba(139,26,43,.45); }
.lies-s.lies-voted:not(.lies-lie){ border-color:var(--muted); }
.lies-result{ font-size:1.4rem; text-align:center; margin:12px 0 4px; }
.lies-story{ text-align:center; }
.lies-big{ display:block; font-size:2.6rem; line-height:1.1; }
`;

function injectCss(){
  if (document.getElementById("lies-css")) return;
  document.head.append(h("style", { id:"lies-css", text:CSS }));
}

// meme filtre des deux cotes : les indices concordent
function clean(list){
  if (!Array.isArray(list)) return [];
  return list
    .filter(l => l && Array.isArray(l.s) && [0, 1, 2].includes(l.lie)
      && typeof l.s[l.lie] === "string" && l.s[l.lie].trim())
    .slice(0, N_ROUNDS)
    .map(l => ({ s:[0, 1, 2].map(k => (typeof l.s[k] === "string" ? l.s[k].trim() : "")), lie:l.lie }));
}

// ana d'abord, puis on alterne
function order(rounds){
  const seq = [];
  for (let r = 0; r < N_ROUNDS; r++){
    for (const owner of PEOPLE) if (rounds[owner][r]) seq.push({ owner, r, guesser:otherOf(owner), ...rounds[owner][r] });
  }
  return seq;
}

export function mount(ctx){
  injectCss();
  const { me, other } = ctx;
  let alive = true;
  ctx.onCleanup(() => { alive = false; });

  const root = h("div", { class:"lies" });
  ctx.el.append(root);
  let seq = [];

  const vote = it => { const v = ctx.get(it.guesser, `vote.${it.owner}.${it.r}`); return [0, 1, 2].includes(v) ? v : null; };
  const passed = it => ctx.get(it.owner, "next." + it.r) === true;
  const current = () => seq.findIndex(it => !passed(it));
  function score(guesser){
    const items = seq.filter(it => it.guesser === guesser);
    return { found:items.filter(it => vote(it) === it.lie).length, n:items.length };
  }

  // ── chargement ────────────────────────────────────────────
  async function load(){
    const wait = h("p", { class:"muted center", text:"the lies are coming..." });
    clear(root).append(wait);
    ctx.say(`i ask ${other} for the lies...`);
    const slow = setTimeout(() => { wait.textContent = `the lies are coming... (${other} must be on this page too)`; }, 10000);
    let a, b;
    try {
      [a, b] = await Promise.all([ctx.request(me, "prep:lies"), ctx.request(other, "prep:lies")]);
    } catch (e){
      if (!alive) return;
      console.warn("lies", e);
      clear(root).append(h("div", { class:"panel center" },
        h("p", { text:`the lies of ${other} do not arrive. is ${other} here ?` }),
        h("button", { text:"try again", onclick:load })));
      return;
    } finally {
      clearTimeout(slow);
    }
    if (!alive) return;
    seq = order({ [me]:clean(a), [other]:clean(b) });
    start();
  }

  // ── ecran ─────────────────────────────────────────────────
  let sig = null, said = null, revealed = null, quietEnd = false;

  function start(){
    // deja reveles avant un rechargement : pas de son
    revealed = new Set(seq.filter(it => vote(it) !== null).map(it => it.owner + it.r));
    if (seq.length && current() < 0) quietEnd = true;
    ctx.onChange(update);
    update();
  }

  function update(){
    if (!alive) return;
    const i = current();
    const it = seq[i];
    const state = { i, v:it ? vote(it) : null, sa:score("ana"), sd:score("adrien") };
    const s = JSON.stringify(state);
    if (s === sig) return;
    sig = s;
    if (!seq.length) return renderEmpty();
    if (i < 0) return renderEnd();
    renderRound(i, it, state.v);
  }

  function scoreLine(){
    return h("div", { class:"lies-score small" }, PEOPLE.map(g => {
      const { found, n } = score(g);
      return h("span", { class:"lies-" + g, text:`${g} found ${found} / ${n}` });
    }));
  }

  function renderEmpty(){
    clear(root).append(h("div", { class:"panel center" },
      h("p", { text:"nobody prepared lies. you are too honest, you two" }),
      h("p", { class:"muted", text:"tell one lie each on the phone, then click done" })));
    sayOnce("empty", "no lies prepared... honest people. i am a bit disappoint");
  }

  function renderRound(i, it, v){
    const mineRound = it.owner === me;
    const head = h("p", { class:"lies-head muted" },
      `round ${i + 1} / ${seq.length} · `,
      h("span", { class:"lies-" + it.owner, text:mineRound ? "your sentences" : `${it.owner}'s sentences` }));
    const list = h("div", { class:"lies-list" });
    const panel = h("div", { class:"panel" }, head, list);

    if (v === null){
      // en attente du vote
      if (mineRound){
        sayOnce(it, `${it.guesser} is guessing your lie. poker face`);
        head.append(h("span", { text:` · ${it.guesser} is guessing your lie` }));
        it.s.forEach((t, k) => list.append(h("div", { class:"lies-s" + (k === it.lie ? " lies-mine" : "") },
          k === it.lie ? h("span", { class:"lies-tag", text:"your lie" }) : null,
          h("span", { class:"keep-case", text:t || "..." }))));
      } else {
        sayOnce(it, `which one is the lie of ${it.owner} ? click it`);
        head.append(h("span", { text:" · which one is the lie ?" }));
        it.s.forEach((t, k) => list.append(h("button", {
          class:"lies-s", onclick:() => { if (vote(it) === null) ctx.set(`vote.${it.owner}.${it.r}`, k); },
        }, h("span", { class:"keep-case", text:t || "..." }))));
      }
    } else {
      // revele
      const right = v === it.lie;
      it.s.forEach((t, k) => {
        const tags = [];
        if (k === it.lie) tags.push("the lie");
        if (k === v) tags.push(mineRound ? `${it.guesser} chose this` : "you chose this");
        list.append(h("div", { class:"lies-s" + (k === it.lie ? " lies-lie" : "") + (k === v ? " lies-voted" : "") },
          tags.length ? h("span", { class:"lies-tag", text:tags.join(" · ") }) : null,
          h("span", { class:"keep-case", text:t || "..." })));
      });
      const who = mineRound ? it.guesser : "you";
      panel.append(
        h("p", { class:"lies-result " + (right ? "ok" : "warn"), text:right ? `${who} found it` : `${who} got fooled` }),
        h("p", { class:"lies-story", text:`${it.owner === me ? "you" : it.owner}, tell the story behind` }),
      );
      const key = it.owner + it.r;
      if (!revealed.has(key)){
        revealed.add(key);
        if (right) ctx.sfx.good(); else ctx.sfx.bad();
      }
      sayOnce(it.owner + it.r + "rev", right
        ? `${it.guesser} found the lie. ${it.owner}, now tell the true story`
        : `ha, ${it.guesser} believe the lie. ${it.owner}, tell the story behind`);
      if (mineRound){
        const last = i === seq.length - 1;
        panel.append(h("div", { class:"row center-row", style:"margin-top:10px" },
          h("button", { text:last ? "finish" : "next →", onclick:() => ctx.set("next." + it.r, true) })));
      } else {
        panel.append(h("p", { class:"muted small center", text:`${it.owner} press next after the story` }));
      }
    }
    clear(root).append(scoreLine(), panel);
  }

  function renderEnd(){
    const sa = score("ana"), sd = score("adrien");
    const line = endLine(sa, sd);
    clear(root).append(h("div", { class:"panel center" },
      h("div", { class:"lies-score" },
        PEOPLE.map(g => { const { found, n } = score(g); return h("div", {},
          h("span", { class:"lies-big lies-" + g, text:n ? `${found} / ${n}` : "-" }),
          h("span", { class:"small", text:`lies of ${otherOf(g)} found by ${g}` })); })),
      h("p", { text:line }),
      h("p", { class:"muted small", text:"click done when you are ready" })));
    if (said !== "end" && !quietEnd){ ctx.sfx.fanfare(); ctx.sky.shower(12); }
    sayOnce("end", line);
  }

  function sayOnce(key, text){
    const k = typeof key === "string" ? key : key.owner + key.r;
    if (said === k) return;
    said = k;
    ctx.say(text);
  }

  load();
}

function endLine(sa, sd){
  if (!sa.n || !sd.n) return "only one of you lied tonight. the other one is a saint, or very lazy";
  const ra = sa.found / sa.n, rd = sd.found / sd.n;
  if (ra === rd) return ra === 1 ? "you find all the lies. impossible to lie to each other, it is a good sign"
    : "equal ! same detective level, both of you";
  const [w, l] = ra > rd ? ["ana", "adrien"] : ["adrien", "ana"];
  return `${w} is the best detective. ${l}, you are too trusting`;
}
