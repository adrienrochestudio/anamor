// ============================================================
// tour.js : etape 1, un simple lien a ouvrir (visite, video)
// ============================================================
import { h } from "../dom.js";

export function mount(ctx){
  const m = ctx.content.museums[ctx.params.index] || {};
  const url = /^https:\/\//.test(ctx.params.url || "") ? ctx.params.url : m.url;
  ctx.el.append(h("div", { class:"center" },
    h("button", { class:"big", text:"open", onclick:() => window.open(url, "_blank", "noopener") })));
  ctx.say("take your plate. open it on both sides");
}
