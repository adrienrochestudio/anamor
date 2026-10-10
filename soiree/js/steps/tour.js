// ============================================================
// tour.js : etape 1, visite virtuelle 360 (page web externe)
// La visite s'affiche dans un grand cadre. Chacun se promene de
// son cote, on se raconte au telephone ce qu'on voit.
// Seuls les domaines prevus sont affiches.
// ============================================================
import { h } from "../dom.js";

const HOSTS = ["www.timographie360.fr", "timographie360.fr"];

function safeUrl(raw){
  try {
    const u = new URL(String(raw || ""));
    return u.protocol === "https:" && HOSTS.includes(u.hostname) ? u.href : null;
  } catch { return null; }
}

export function mount(ctx){
  const m = ctx.content.museums[ctx.params.index] || {};
  const url = safeUrl(m.url);
  if (!url){
    ctx.el.append(h("p", { class:"muted center", text:"this visit is not ready" }));
    return;
  }
  const frame = h("iframe", {
    src:url, title:m.label || "visit",
    allow:"fullscreen; accelerometer; gyroscope",
    sandbox:"allow-scripts allow-same-origin allow-popups",
    referrerpolicy:"no-referrer",
  });
  const box = h("div", { class:"video-box tour-box" }, frame);
  const full = () => (box.requestFullscreen || box.webkitRequestFullscreen || (() => {})).call(box);
  ctx.el.append(box, h("div", { class:"video-ctrl" },
    h("button", { class:"small", text:"big screen", onclick:full }),
    h("button", { class:"small", text:"open in a new tab", onclick:() => window.open(url, "_blank", "noopener") }),
  ));
  ctx.say("take your plate, we go visit. walk together and tell what you see");
}
