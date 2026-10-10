// ============================================================
// trivia.js : etape "us two", carte A
//
// Chacun a ecrit 10 questions sur lui dans sa prepa. Chacun
// repond aux questions de L'AUTRE, en meme temps.
//
// couloirs (espace de noms de l'activite) :
//   ans.<i>   = { v:texte, ok:bool }  ma reponse a la question i
//                                     de l'autre (ok = auto)
//   judge.<i> = true|false            l'auteur tranche la reponse
//                                     de l'autre a SA question i
// validite finale de la reponse i = judge de l'auteur si present,
// sinon ok automatique (answers.js).
// ============================================================
import { h, clear } from "../dom.js";
import { accepts, listAnswers } from "../games/answers.js";

const MAX_Q = 10, MAX_ANSWER = 200;

const CSS = `
.trivia-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:0 18px; align-items:start; }
.trivia-prog{ text-align:center; margin:0; }
.trivia-q{ font-size:1.35rem; margin:4px 0 12px; }
.trivia-pass{ margin-top:8px; }
.trivia-item{ border-top:2px dashed var(--line); padding:8px 0; }
.trivia-item:first-of-type{ border-top:0; }
.trivia-item.trivia-new{ border:2px solid var(--cream); border-radius:12px; padding:8px 10px; margin-bottom:6px; }
.trivia-item.trivia-wait{ opacity:.45; }
.trivia-k{ color:var(--muted); }
.trivia-yes{ color:var(--ok); }
.trivia-no{ color:var(--rose); }
.trivia-toggle{ display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
.trivia-toggle button.trivia-on-yes{ background:var(--ok); border-color:var(--ok); color:var(--night); }
.trivia-toggle button.trivia-on-no{ background:var(--rose); border-color:var(--rose); color:var(--cream); }
.trivia-score{ display:flex; gap:28px; justify-content:center; flex-wrap:wrap; margin:6px 0 10px; }
.trivia-score > div{ text-align:center; }
.trivia-score b{ display:block; font-size:2.6rem; font-weight:normal; line-height:1.1; }
.trivia-ana{ color:var(--ana); }
.trivia-adrien{ color:var(--adrien); }
`;

function injectCss(){
  if (document.getElementById("trivia-css")) return;
  document.head.append(h("style", { id:"trivia-css", text:CSS }));
}

// meme filtre des deux cotes : les indices concordent
function clean(list){
  if (!Array.isArray(list)) return [];
  return list
    .filter(t => t && typeof t.q === "string" && t.q.trim())
    .slice(0, MAX_Q)
    .map(t => ({ q:t.q.trim(), a:typeof t.a === "string" ? t.a : "" }));
}

export function mount(ctx){
  injectCss();
  const { me, other } = ctx;
  let alive = true;
  ctx.onCleanup(() => { alive = false; });

  let mine = [];     // mes questions (l'autre y repond)
  let theirs = [];   // ses questions (j'y reponds)
  const root = h("div", { class:"trivia" });
  ctx.el.append(root);

  // ── lecture des couloirs ──────────────────────────────────
  const ans = (who, i) => { const v = ctx.get(who, "ans." + i); return v && typeof v === "object" ? v : null; };
  const judge = (who, i) => { const v = ctx.get(who, "judge." + i); return typeof v === "boolean" ? v : null; };
  const authorOf = answerer => (answerer === me ? other : me);
  const questionsFor = answerer => (answerer === me ? theirs : mine);
  function valid(answerer, i){
    const a = ans(answerer, i);
    if (!a) return null;
    const j = judge(authorOf(answerer), i);
    return j !== null ? j : !!a.ok;
  }
  function answered(who){
    let c = 0;
    for (let i = 0; i < questionsFor(who).length; i++) if (ans(who, i)) c++;
    return c;
  }
  function score(who){
    let c = 0;
    for (let i = 0; i < questionsFor(who).length; i++) if (valid(who, i)) c++;
    return c;
  }
  const finished = who => answered(who) >= questionsFor(who).length;
  function nextIdx(){
    for (let i = 0; i < theirs.length; i++) if (!ans(me, i)) return i;
    return -1;
  }

  // ── chargement des questions ──────────────────────────────
  async function load(){
    const wait = h("p", { class:"muted center", text:"questions are coming..." });
    clear(root).append(wait);
    ctx.say(`i ask ${other} for the questions...`);
    const slow = setTimeout(() => { wait.textContent = `questions are coming... (${other} must be on this page too)`; }, 10000);
    let a, b;
    try {
      [a, b] = await Promise.all([ctx.request(me, "prep:trivia"), ctx.request(other, "prep:trivia")]);
    } catch (e){
      if (!alive) return;
      console.warn("trivia", e);
      clear(root).append(h("div", { class:"panel center" },
        h("p", { text:`the questions of ${other} do not arrive. is ${other} here ?` }),
        h("button", { text:"try again", onclick:load })));
      return;
    } finally {
      clearTimeout(slow);
    }
    if (!alive) return;
    mine = clean(a);
    theirs = clean(b);
    build();
  }

  // ── ecran ─────────────────────────────────────────────────
  let els = null, shownIdx = null, lastAnswered = null;
  let sigs = {}, otherCount = null, finishSaid = false, endLine = null;

  function build(){
    els = {
      prog: h("p", { class:"trivia-prog small muted" }),
      play: h("div"),
      my: h("div"),
      judge: h("div", { class:"panel" }),
      end: h("div"),
    };
    clear(root).append(
      els.end,
      els.prog,
      h("div", { class:"trivia-grid" },
        h("div", {}, h("div", { class:"panel" }, els.play, els.my)),
        els.judge),
    );
    shownIdx = null; sigs = {};
    otherCount = answered(other);
    // deja fini avant un rechargement : pas de fanfare
    if (finished(me) && finished(other)) endLine = "";
    if (!theirs.length) ctx.say(`${other} wrote no questions. it is okae, nothing to answer for you`);
    else ctx.say(`answer the questions of ${other}. ${other} see your answers and can be generous`);
    ctx.onChange(update);
    update();
  }

  function update(){
    if (!alive || !els) return;
    renderPlay();
    renderMy();
    renderJudge();
    renderEnd();
    els.prog.textContent = `you : ${answered(me)} / ${theirs.length}  ·  ${other} : ${answered(other)} / ${mine.length}`;
  }

  // rebuild seulement si les donnees affichees ont change
  function changed(name, data){
    const s = JSON.stringify(data);
    if (sigs[name] === s) return false;
    sigs[name] = s;
    return true;
  }

  // la question en cours (reconstruite seulement quand l'indice change)
  function renderPlay(){
    const i = nextIdx();
    const key = i < 0 ? "end:" + finished(other) : i;
    if (key === shownIdx) return;
    shownIdx = key;
    if (!theirs.length){
      clear(els.play).append(h("p", { text:`${other} wrote no questions about ${other === "ana" ? "her" : "him"}self. so nothing to answer here, it is not your fault` }));
      return;
    }
    if (i < 0){
      clear(els.play).append(h("p", { class:"ok", text:finished(other) ? "all answered" : `all answered. now ${other} finish` }));
      if (!finishSaid && !finished(other)){ finishSaid = true; ctx.say(`finish ! ${other} still think...`); }
      return;
    }
    const input = h("input", { type:"text", class:"keep-case", placeholder:"your answer", autocomplete:"off", maxlength:String(MAX_ANSWER) });
    const go = () => { if (input.value.trim()) submit(i, input.value); };
    input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    clear(els.play).append(
      h("p", { class:"muted small", text:`question ${i + 1} / ${theirs.length} from ${other}` }),
      h("p", { class:"trivia-q keep-case", text:theirs[i].q }),
      h("div", { class:"row" }, h("div", { class:"grow" }, input), h("button", { text:"answer", onclick:go })),
      h("button", { class:"small trivia-pass", text:"i dont know", onclick:() => submit(i, "") }),
    );
    input.focus({ preventScroll:true });
  }

  function submit(i, text){
    if (ans(me, i)) return;
    const v = String(text).trim().slice(0, MAX_ANSWER);
    const ok = v ? accepts(v, theirs[i].a) : false;
    lastAnswered = i;
    ctx.set("ans." + i, { v, ok });
    if (ok) ctx.sfx.good(); else ctx.sfx.bad();
  }

  const status = (ok, overridden, by) => h("span", {
    class:ok ? "trivia-yes" : "trivia-no",
    text:(ok ? "it count" : "it dont count") + (overridden ? ` (${by} decide)` : ""),
  });
  const expected = a => {
    const list = listAnswers(a);
    return list.length ? list.join(" / ") : "(no answer written)";
  };

  // mes reponses, la plus recente en haut, avec la reponse attendue
  function renderMy(){
    const rows = [];
    for (let i = 0; i < theirs.length; i++){
      const a = ans(me, i);
      if (a) rows.push({ i, v:a.v, ok:!!a.ok, final:valid(me, i), j:judge(other, i) });
    }
    if (!changed("my", { rows, lastAnswered })) return;
    clear(els.my);
    if (!rows.length) return;
    els.my.append(h("p", { class:"muted small", style:"margin-top:14px", text:"your answers" }));
    for (const r of rows.reverse()){
      els.my.append(h("div", { class:"trivia-item" + (r.i === lastAnswered ? " trivia-new" : "") },
        h("div", { class:"keep-case" }, h("span", { class:"trivia-k", text:`${r.i + 1}. ` }), theirs[r.i].q),
        h("div", {}, h("span", { class:"trivia-k", text:"you : " }), h("span", { class:"keep-case", text:r.v || "(i dont know)" })),
        h("div", {}, h("span", { class:"trivia-k", text:"answer : " }), h("span", { class:"keep-case", text:expected(theirs[r.i].a) })),
        h("div", {}, status(r.final, r.j !== null && r.j !== r.ok, other)),
      ));
    }
  }

  // les reponses de l'autre a MES questions, en direct, avec arbitrage
  function renderJudge(){
    const n = answered(other);
    if (otherCount !== null && n > otherCount) ctx.sfx.tick();
    otherCount = n;
    const rows = mine.map((_, i) => {
      const a = ans(other, i);
      return a ? { i, v:a.v, ok:!!a.ok, j:judge(me, i) } : { i };
    });
    if (!changed("judge", rows)) return;
    clear(els.judge).append(h("h3", { text:`${other} answer your questions` }));
    if (!mine.length){
      els.judge.append(h("p", { class:"muted", text:`you wrote no questions, so ${other} has nothing to answer. next time !` }));
      return;
    }
    els.judge.append(h("p", { class:"muted small", text:"you decide. if it is close enough, say it count" }));
    for (const r of rows){
      const q = mine[r.i];
      const item = h("div", { class:"trivia-item" + (r.v === undefined ? " trivia-wait" : "") },
        h("div", { class:"keep-case" }, h("span", { class:"trivia-k", text:`${r.i + 1}. ` }), q.q),
        h("div", {}, h("span", { class:"trivia-k", text:"you wrote : " }), h("span", { class:"keep-case", text:expected(q.a) })),
      );
      if (r.v === undefined){
        item.append(h("div", { class:"trivia-k", text:`${other} : ...` }));
      } else {
        const final = r.j !== null ? r.j : r.ok;
        item.append(
          h("div", {}, h("span", { class:"trivia-k", text:`${other} : ` }), h("span", { class:"keep-case", text:r.v || "(dont know)" })),
          h("div", { class:"trivia-k small", text:`kompiuter think : ${r.ok ? "yes" : "no"}` }),
          h("div", { class:"trivia-toggle" },
            h("button", { class:"small" + (final ? " trivia-on-yes" : ""), text:"ok that counts", onclick:() => ctx.set("judge." + r.i, true) }),
            h("button", { class:"small" + (!final ? " trivia-on-no" : ""), text:"no", onclick:() => ctx.set("judge." + r.i, false) }),
          ),
        );
      }
      els.judge.append(item);
    }
  }

  // scores quand les deux ont fini (ils bougent encore si on arbitre)
  function renderEnd(){
    if (!(finished(me) && finished(other))){ if (changed("end", null)) clear(els.end); return; }
    const people = ["ana", "adrien"].map(who => ({
      who, of:who === "ana" ? "adrien" : "ana", s:score(who), n:questionsFor(who).length,
    }));
    if (!changed("end", people)) return;
    const line = winnerLine(people);
    clear(els.end).append(h("div", { class:"panel center" },
      h("div", { class:"trivia-score" }, people.map(p => h("div", {},
        h("b", { class:"trivia-" + p.who, text:p.n ? `${p.s} / ${p.n}` : "-" }),
        h("span", { class:"small", text:`${p.who} know ${p.of}` })))),
      h("p", { text:line }),
      h("p", { class:"muted small", text:"talk about it, then click done" }),
    ));
    if (line !== endLine){
      if (endLine === null){ ctx.sfx.fanfare(); ctx.sky.shower(12); }
      endLine = line;
      ctx.say(line);
    }
  }

  load();
}

function winnerLine([a, b]){
  if (!a.n && !b.n) return "no questions on both sides. you know each other by heart, i suppose";
  const ra = a.n ? a.s / a.n : -1, rb = b.n ? b.s / b.n : -1;
  if (ra === rb) return "equal ! you know each other exactly the same. very romantic or very suspicious";
  const [w, l] = ra > rb ? [a, b] : [b, a];
  if (!l.n) return `${w.who} know ${w.of} well. ${l.who} had nothing to answer, lucky`;
  return `${w.who} know ${w.of} better. ${l.who}, you have some homework tonight`;
}
