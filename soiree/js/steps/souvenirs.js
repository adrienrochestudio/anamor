// ============================================================
// souvenirs.js : "5 photos each, one story each" (romantic, B)
//
// Les photos viennent de la prepa de chacun : les miennes en
// local, celles de l'autre par morceaux (quelques secondes par
// photo, on precharge la suivante). Ordre alterne : ana 1,
// adrien 1, ana 2... en sautant les cases vides.
// Avancement deduit des couloirs : chacun ecrit next = combien
// de SES photos il a passees. La position p avance tant que le
// proprietaire de la photo p a passe assez de ses photos.
// ============================================================
import { h, wait } from "../dom.js";

const PEOPLE = ["ana", "adrien"];
const isImage = s => typeof s === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(s);

export function mount(ctx){
  injectStyle();
  let alive = true;
  ctx.onCleanup(() => { alive = false; });

  const lists = { ana:null, adrien:null };   // [{has, caption}] de chaque prepa
  const photos = new Map();                  // "owner:i" -> { state, src, caption }
  let order = null;                          // [{ owner, i, rank }]
  let shownKey = null, lastPos = null;

  const view = h("div", { class:"souv" });
  ctx.el.append(view);

  // demande a l'autre, en reessayant tant que l'activite vit
  async function ask(owner, key){
    while (alive){
      try { return await ctx.request(owner, key); }
      catch { await wait(1000); }
    }
    return null;
  }

  PEOPLE.forEach(who => ask(who, "prep:photos").then(list => {
    if (!alive) return;
    lists[who] = Array.isArray(list) ? list : [];
    if (lists.ana && lists.adrien) order = interleave();
    update();
  }));

  function interleave(){
    const idx = who => lists[who].map((p, i) => (p && p.has ? i : -1)).filter(i => i >= 0);
    const a = idx("ana"), b = idx("adrien"), out = [];
    for (let r = 0; r < Math.max(a.length, b.length); r++){
      if (r < a.length) out.push({ owner:"ana", i:a[r], rank:r });
      if (r < b.length) out.push({ owner:"adrien", i:b[r], rank:r });
    }
    return out;
  }

  const passed = who => Number(ctx.get(who, "next")) || 0;
  function position(){
    let p = 0;
    while (p < order.length && passed(order[p].owner) > order[p].rank) p++;
    return p;
  }

  const keyOf = it => `${it.owner}:${it.i}`;
  function load(it){
    if (!it || photos.has(keyOf(it))) return;
    photos.set(keyOf(it), { state:"loading" });
    ask(it.owner, "prep:photo:" + it.i).then(d => {
      if (!alive) return;
      photos.set(keyOf(it), d && isImage(d.src)
        ? { state:"ok", src:d.src, caption:typeof d.caption === "string" ? d.caption : "" }
        : { state:"lost" });
      update();
    });
  }

  // ── rendu ──────────────────────────────────────────────────
  function update(){
    if (!order){
      const missing = PEOPLE.filter(w => !lists[w]);
      return show("wait", () => [h("p", { class:"center muted", text:
        missing.includes(ctx.other) ? `i ask ${ctx.other} for the photos list...` : "i look for the photos..." })]);
    }
    if (!order.length) return show("none", () => [h("div", { class:"panel center" },
      h("p", { text:"no photos tonight, nobody put some in the preparashion" }),
      h("p", { class:"muted", text:"so just tell each other one souvenir you love, with words. then click done" }))]);

    const p = position();
    const live = lastPos !== null && p !== lastPos;
    if (lastPos === null) ctx.say(p >= order.length ? "all the photos are told. click done when you are ready"
      : "five photos each, one story each. the owner of the photo tell, the other listen and ask");
    lastPos = p;

    if (p >= order.length){
      if (live){ ctx.sfx.good(); ctx.say("so many beautiful souvenirs. i wish i was there. click done when you are ready"); }
      return show("end", () => [h("div", { class:"panel center" },
        h("p", { text:`that was all the photos. ${order.length} stories` }),
        h("p", { class:"muted", text:"click done when you finish to talk" }))]);
    }

    const it = order[p];
    load(it);
    load(order[p + 1]);
    const ph = photos.get(keyOf(it));
    if (live){
      ctx.sfx.flip();
      ctx.say(it.owner === ctx.me ? "your photo now. tell me everything" : `${it.owner}'s photo. listen`);
    }
    show(`${p}:${ph.state}`, () => photoView(p, it, ph));
  }

  function show(key, build){
    if (key === shownKey) return;
    shownKey = key;
    view.replaceChildren(...build().filter(Boolean));
  }

  function photoView(p, it, ph){
    const mine = it.owner === ctx.me;
    const last = p === order.length - 1;
    const empty = PEOPLE.find(w => !order.some(x => x.owner === w));
    const listCaption = (lists[it.owner][it.i] || {}).caption;
    const caption = ph.state === "ok" ? ph.caption : (typeof listCaption === "string" ? listCaption : "");

    const pic = ph.state === "ok" ? h("img", { class:"souv-img", src:ph.src, alt:"" })
      : h("div", { class:"souv-wait" }, h("p", { text:ph.state === "lost"
        ? "this photo got lost on the way. tell the story without it"
        : "photo is coming..." }));
    const btn = mine
      ? h("button", { class:"big", text:last ? "that was the last one" : "next photo", onclick:() => {
          btn.disabled = true;
          ctx.set("next", it.rank + 1);
        }})
      : h("p", { class:"muted small", text:`${it.owner} press next when the story is finish` });

    return [
      empty ? h("p", { class:"center muted small", text:`${empty} has no photo tonight, so only ${empty === "ana" ? "adrien" : "ana"}'s` }) : null,
      h("p", { class:"center muted small", text:`photo ${p + 1} / ${order.length}` }),
      h("div", { class:"souv-polaroid" + (p % 2 ? " souv-tilt" : "") },
        pic,
        caption ? h("p", { class:"souv-caption keep-case", text:caption }) : null),
      h("p", { class:"center souv-owner souv-" + it.owner,
        text:mine ? "your photo. you tell the story" : `${it.owner}'s photo. ${it.owner} tell the story` }),
      h("div", { class:"center" }, btn),
    ];
  }

  ctx.onChange(update);
  update();
}

// ── styles ─────────────────────────────────────────────────
function injectStyle(){
  if (document.getElementById("souv-style")) return;
  document.head.append(h("style", { id:"souv-style", text:`
.souv{ display:flex; flex-direction:column; gap:10px; }
.souv-polaroid{
  align-self:center; max-width:100%;
  background:var(--cream); color:var(--night);
  padding:12px 12px 10px; border-radius:6px; transform:rotate(-1deg);
}
.souv-polaroid.souv-tilt{ transform:rotate(1deg); }
.souv-img{ display:block; max-width:100%; max-height:60vh; margin:0 auto; border-radius:3px; }
.souv-wait{
  width:min(640px, 80vw); height:min(420px, 50vh);
  display:flex; align-items:center; justify-content:center; text-align:center; padding:20px;
  background:var(--night-2); color:var(--cream); border-radius:3px;
}
.souv-wait p{ animation:souv-blink 1.4s steps(2) infinite; }
@keyframes souv-blink{ 50%{ opacity:.45; } }
.souv-caption{ margin:10px 4px 0; font-size:1.2rem; text-align:center; max-width:640px; }
.souv-owner{ font-size:1.25rem; margin:6px 0 2px; }
.souv-ana{ color:var(--ana); }
.souv-adrien{ color:var(--adrien); }
` }));
}
