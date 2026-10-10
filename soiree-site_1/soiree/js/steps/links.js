// ============================================================
// links.js : activites sur un site externe (worldguessr,
// skribbl, codenames). L'un cree la salle, colle le lien ou le
// code, l'autre le recoit avec un bouton pour ouvrir/copier.
// Seuls les domaines prevus sont ouverts.
// ============================================================
import { h, clear } from "../dom.js";

const SERVICES = {
  worldguessr: {
    name:"worldguessr", url:"https://www.worldguessr.com/",
    hosts:["worldguessr.com", "www.worldguessr.com"], code:true,
    what:"the party code (or the link)",
    how:[
      "one of you open worldguessr, go in multiplayer and create a private party",
      "paste the party code here, i send it to the other",
      "the other join with the code. play, then come back and click done",
    ],
  },
  skribbl: {
    name:"skribbl", url:"https://skribbl.io/",
    hosts:["skribbl.io", "www.skribbl.io"], code:false,
    what:"the invite link",
    how:[
      "one of you open skribbl, choose a name, click create private room",
      "copy the invite link and paste it here",
      "the other open the link. play some rounds, then click done",
    ],
  },
  codenames: {
    name:"codenames", url:"https://codenames.game/",
    hosts:["codenames.game", "www.codenames.game"], code:false,
    what:"the room link",
    how:[
      "one of you open codenames, create a room and choose duet",
      "paste the room link here",
      "the other open it. win together, then click done",
    ],
  },
};

export function parseShared(service, raw){
  const s = SERVICES[service];
  const v = String(raw || "").trim().slice(0, 300);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)){
    try {
      const u = new URL(v);
      if (u.protocol === "https:" && s.hosts.includes(u.hostname)) return { kind:"url", v:u.href };
    } catch {}
    return null;
  }
  if (s.code && /^[A-Za-z0-9-]{3,24}$/.test(v)) return { kind:"code", v };
  return null;
}

export function mount(ctx){
  const s = SERVICES[ctx.params.service];
  const input = h("input", { type:"text", class:"keep-case", placeholder:`paste ${s.what}` });
  const msg = h("p", { class:"small" });
  const shown = h("div");

  const send = () => {
    const p = parseShared(ctx.params.service, input.value);
    if (!p){ msg.className = "small warn"; msg.textContent = `this is not ${s.what} from ${s.name}`; return; }
    ctx.set("shared", { ...p, t:Date.now() });
    msg.className = "small ok"; msg.textContent = "sent";
    input.value = "";
    ctx.sfx.flip();
  };
  input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });

  ctx.el.append(h("div", { class:"panel" },
    ...s.how.map(t => h("p", { text:"- " + t })),
    h("div", { class:"row", style:"margin-top:10px" },
      h("button", { text:`open ${s.name}`, onclick:() => window.open(s.url, "_blank", "noopener") }),
    ),
    h("div", { class:"row", style:"margin-top:10px" }, h("div", { class:"grow" }, input), h("button", { text:"send", onclick:send })),
    msg,
  ), shown);

  let lastT = 0;
  function update(){
    const mine = ctx.get(ctx.me, "shared"), theirs = ctx.get(ctx.other, "shared");
    const cur = [mine, theirs].filter(x => x && x.v).sort((a, b) => b.t - a.t)[0];
    if (!cur || cur.t === lastT) return;
    lastT = cur.t;
    const p = parseShared(ctx.params.service, cur.v);
    if (!p) return;
    const fromOther = cur === theirs;
    if (fromOther){ ctx.sfx.good(); ctx.say(`the other send you ${s.what}`); }
    const copy = h("button", { text:"copy", onclick:() => {
      navigator.clipboard && navigator.clipboard.writeText(p.v).then(() => { copy.textContent = "copied"; });
    }});
    clear(shown).append(h("div", { class:"panel" },
      h("p", { class:"muted", text:fromOther ? "from the other :" : "you sent :" }),
      p.kind === "code"
        ? h("p", { class:"big-code", text:p.v })
        : h("p", { class:"keep-case small", text:p.v }),
      h("div", { class:"row center-row" },
        p.kind === "url" ? h("button", { text:"open the room", onclick:() => window.open(p.v, "_blank", "noopener") }) : null,
        copy,
      ),
    ));
  }
  ctx.onChange(update);
  update();
  ctx.say(`one of you make the room on ${s.name}. i pass the message`);
}
