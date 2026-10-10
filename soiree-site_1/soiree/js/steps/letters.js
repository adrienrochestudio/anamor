// ============================================================
// letters.js : etape "words". params.reader lit son texte de
// prepa (lettre ou poeme) a voix haute, l'autre ecoute.
//
// Lecteur : prompteur de son texte, bouton "i finished reading"
//   -> setGlobal("share.text", true) (main.js libere prep:text)
//   -> set("read", true)
// Auditeur : ecran calme, puis quand le couloir du lecteur a
//   read = true, demande prep:text et le devoile ligne a ligne,
//   avec un bouton pour le telecharger en image.
// Les deux options (A puis B) montent ce module, chacune avec
// son lecteur et son propre espace de noms.
// ============================================================
import { h, wait } from "../dom.js";

const NIGHT = "#10152e", CREAM = "#FAF8F4", MUTED = "#9aa0c2";

export function mount(ctx){
  injectStyle();
  const reader = ctx.params.reader === "adrien" ? "adrien" : "ana";
  const listener = reader === "ana" ? "adrien" : "ana";
  const isReader = ctx.me === reader;
  let alive = true;
  const timers = [];
  ctx.onCleanup(() => { alive = false; timers.forEach(clearTimeout); });

  const root = h("div", { class:"letters" });
  ctx.el.append(root);
  const hasRead = () => !!ctx.get(reader, "read");

  // ── lecteur ────────────────────────────────────────────────
  function mountReader(){
    const { kind, body } = ctx.prep.text;
    const text = body.trim() ? body : "";
    let size = 1.6;
    const prompter = text
      ? h("div", { class:"letters-prompter keep-case", text })
      : h("div", { class:"panel center" },
          h("p", { text:"you wrote nothing in the preparashion. no problem" }),
          h("p", { text:`say it from the heart to ${listener}, then press i finished` }));
    const zoom = d => () => { size = Math.min(2.6, Math.max(1.1, size + d)); prompter.style.fontSize = size + "rem"; };
    const btn = h("button", { class:"big", text:"i finished reading", onclick:() => {
      btn.disabled = true;
      ctx.setGlobal("share.text", true);
      ctx.set("read", true);
    }});
    const after = h("div", { class:"panel center", style:"display:none" },
      h("p", { text:text ? `thank you. ${listener} can keep your ${kind} now` : "thank you. it was from the heart, i heard it" }),
      h("p", { class:"muted", text:"click done when you are ready" }));
    root.append(
      h("p", { class:"center letters-lead", text:text ? `read your ${kind} to ${listener}. slowly, it is not a race` : `your turn to talk to ${listener}` }),
      text ? h("div", { class:"row center-row letters-zoom" },
        h("button", { class:"small", text:"smaller", onclick:zoom(-0.2) }),
        h("button", { class:"small", text:"bigger", onclick:zoom(0.2) })) : null,
      prompter,
      h("div", { class:"center letters-actions" }, btn),
      after,
    );
    let wasRead = hasRead();
    ctx.say(wasRead ? "you already read. click done when you are ready"
      : `take your time. ${listener} listen, me too`);
    const update = () => {
      const r = hasRead();
      btn.style.display = r ? "none" : "";
      after.style.display = r ? "" : "none";
      if (r && !wasRead){ ctx.sfx.good(); ctx.say("that was beautiful. i think i have a little tear in my screen. click done when you are ready"); }
      wasRead = r;
    };
    ctx.onChange(update);
    update();
  }

  // ── auditeur ───────────────────────────────────────────────
  function mountListener(){
    const calm = h("div", { class:"letters-calm" },
      ...Array.from({ length:7 }, (_, i) => h("span", { class:"letters-star", style:starPos(i) })),
      h("p", { class:"letters-lead", text:`${reader} is reading for you. just listen` }),
      h("p", { class:"muted small", text:"after, i give you the words to keep" }));
    const reveal = h("div", { style:"display:none" });
    root.append(calm, reveal);
    let started = false;
    const live = !hasRead();
    ctx.say(live ? `shhh. ${reader} read for you now. maybe close the eyes` : `${reader} has finish reading`);

    async function start(){
      started = true;
      calm.querySelector(".letters-lead").textContent = `${reader} finished. i bring the words...`;
      const data = await ask();
      if (!alive) return;
      const kind = data && data.kind === "poem" ? "poem" : "letter";
      const body = data && typeof data.body === "string" ? data.body.trim() : "";
      calm.style.display = "none";
      reveal.style.display = "";
      if (!body){
        reveal.append(h("div", { class:"panel center" },
          h("p", { text:`${reader} spoke from the heart, nothing written. keep it in your head` }),
          h("p", { class:"muted", text:"click done when you are ready" })));
        return;
      }
      const lines = body.split("\n");
      const box = h("div", { class:"letters-paper keep-case" });
      const title = `a ${kind} from ${reader}`;
      const dl = h("button", { text:"download", onclick:() => download(title, body, `${kind}-from-${reader}.png`) });
      const end = h("div", { class:"center letters-actions", style:"visibility:hidden" },
        dl, h("p", { class:"muted", text:"click done when you are ready" }));
      reveal.append(h("p", { class:"center letters-lead", text:title }), box, end);
      const step = live ? Math.max(250, Math.min(900, 22000 / lines.length)) : 60;
      for (const line of lines){
        if (!alive) return;
        box.append(h("p", { class:"letters-line", text:line || " " }));
        await wait(step);
      }
      if (!alive) return;
      end.style.visibility = "visible";
      if (live) ctx.say(`this ${kind} is yours now. you can download it. click done when you are ready`);
    }

    async function ask(){
      while (alive){
        try { return await ctx.request(reader, "prep:text"); }
        catch { await wait(1000); }
      }
      return null;
    }

    const update = () => { if (!started && hasRead()) start(); };
    ctx.onChange(update);
    update();
  }

  if (isReader) mountReader(); else mountListener();
}

// ── image a telecharger ──────────────────────────────────────
function wrapLines(g, text, maxW){
  const out = [];
  for (const para of text.split("\n")){
    if (!para.trim()){ out.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/)){
      const test = line ? line + " " + word : word;
      if (g.measureText(test).width <= maxW || !line){ line = test; continue; }
      out.push(line);
      line = word;
    }
    out.push(line);
  }
  return out;
}

function download(title, body, filename){
  const loaded = document.fonts && document.fonts.check('32px "Patrick Hand"');
  const family = loaded ? '"Patrick Hand", cursive' : '"Comic Sans MS", cursive';
  const W = 1200, pad = 100, bodyPx = 34, lh = Math.round(bodyPx * 1.5);
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  g.font = `${bodyPx}px ${family}`;
  const lines = wrapLines(g, body, W - pad * 2);
  c.width = W;
  c.height = Math.min(30000, pad * 2 + 110 + lines.length * lh);

  g.fillStyle = NIGHT;
  g.fillRect(0, 0, c.width, c.height);
  // quelques etoiles pixel, toujours aux memes endroits
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = CREAM;
  for (let i = 0; i < Math.round(c.height / 40); i++){
    g.globalAlpha = 0.25 + rnd() * 0.5;
    g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * c.height), 3, 3);
  }
  g.globalAlpha = 1;
  g.strokeStyle = CREAM;
  g.lineWidth = 3;
  g.strokeRect(36, 36, W - 72, c.height - 72);

  g.textBaseline = "top";
  g.fillStyle = CREAM;
  g.font = `52px ${family}`;
  g.fillText(title, pad, pad);
  g.font = `${bodyPx}px ${family}`;
  lines.forEach((line, i) => g.fillText(line, pad, pad + 110 + i * lh));
  g.fillStyle = MUTED;
  g.font = `22px ${family}`;
  g.fillText("our little trip", W - pad - g.measureText("our little trip").width, c.height - 70);

  c.toBlob(blob => {
    if (!blob) return;
    const a = h("a", { href:URL.createObjectURL(blob), download:filename, style:"display:none" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, "image/png");
}

const STARS = [[8, 18], [22, 70], [40, 30], [58, 80], [72, 22], [86, 60], [94, 35]];
const starPos = i => `left:${STARS[i][0]}%;top:${STARS[i][1]}%;animation-delay:${(i * 0.7) % 3}s`;

// ── styles ─────────────────────────────────────────────────
function injectStyle(){
  if (document.getElementById("letters-style")) return;
  document.head.append(h("style", { id:"letters-style", text:`
.letters{ display:flex; flex-direction:column; gap:10px; }
.letters-lead{ font-size:1.35rem; }
.letters-zoom{ margin:0; }
.letters-prompter{
  font-size:1.6rem; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere;
  max-height:62vh; overflow-y:auto; padding:22px 26px;
  border:3px solid var(--cream); border-radius:16px; background:rgba(16,21,46,.96);
}
.letters-actions{ margin-top:8px; display:flex; flex-direction:column; align-items:center; gap:6px; }
.letters-calm{
  position:relative; min-height:300px; display:flex; flex-direction:column;
  align-items:center; justify-content:center; text-align:center; gap:6px;
  border:3px dashed var(--line); border-radius:16px;
}
.letters-star{
  position:absolute; width:4px; height:4px; background:#fff1b8;
  box-shadow:4px 0 #fff1b8, -4px 0 #fff1b8, 0 4px #fff1b8, 0 -4px #fff1b8;
  animation:letters-twinkle 3s steps(3) infinite;
}
@keyframes letters-twinkle{ 0%,100%{ opacity:.25; } 50%{ opacity:1; } }
.letters-paper{
  font-size:1.35rem; line-height:1.55; padding:20px 26px; overflow-wrap:anywhere;
  border:3px solid var(--cream); border-radius:16px; background:rgba(23,29,61,.94);
  max-height:62vh; overflow-y:auto;
}
.letters-line{ margin:0; white-space:pre-wrap; min-height:1.55em; animation:letters-in .9s ease-out both; }
@keyframes letters-in{ from{ opacity:0; transform:translateY(4px); } }
` }));
}
