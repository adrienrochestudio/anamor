// ============================================================
// mail.js : a la fin, envoie tous nos dessins en .png par email.
//
// Les traits sont dans la RTDB (draw/{manche}/{joueur}). On rend
// chaque manche sur un canvas blanc, on exporte en PNG, et on POST
// le tout a un petit relais Google Apps Script (voir EMAIL_SETUP.md)
// qui envoie le mail avec les pieces jointes.
//
// Si content.mailEndpoint est vide : on ne fait rien (no-op), la
// soiree n'est jamais cassee par l'email.
// ============================================================
import { db, ROOM } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

function listOf(snap){
  const v = snap.val();
  return v ? Object.keys(v).map(k => v[k]) : [];
}

// rend une manche (les deux joueurs superposes) sur fond clair -> PNG
async function roundToPng(roundKey, colors, size = 900){
  const [a, d] = await Promise.all([
    get(ref(db, `${ROOM}/draw/${roundKey}/ana`)),
    get(ref(db, `${ROOM}/draw/${roundKey}/adrien`))
  ]);
  const aSegs = listOf(a), dSegs = listOf(d);
  if (!aSegs.length && !dSegs.length) return null;

  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#FAF8F4"; ctx.fillRect(0, 0, size, size);
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 3.5;
  const paint = (segs, color) => {
    ctx.strokeStyle = color;
    segs.forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s.x1 * size, s.y1 * size);
      ctx.lineTo(s.x2 * size, s.y2 * size);
      ctx.stroke();
    });
  };
  paint(dSegs, colors.adrien);
  paint(aSegs, colors.ana);
  return c.toDataURL("image/png");
}

// toutes nos manches dessinees, dans l'ordre de la soiree
const ROUNDS = [
  ["exquis", "le-monstre"],
  ["portrait", "les-portraits"],
  ["guess4", "dessine-1"], ["guess5", "dessine-2"], ["guess6", "dessine-3"],
  ["guess7", "dessine-4"], ["guess8", "dessine-5"], ["guess9", "dessine-6"]
];

export async function collectDrawings(colors){
  const out = [];
  for (const [key, name] of ROUNDS){
    const png = await roundToPng(key, colors);
    if (png) out.push({ name: name + ".png", dataUrl: png });
  }
  return out;
}

export async function sendDrawings({ endpoint, to, subject, message, colors }){
  if (!endpoint) return { skipped: true, reason: "no endpoint" };
  const images = await collectDrawings(colors);
  if (!images.length) return { skipped: true, reason: "no drawings" };
  // no-cors + text/plain = requete "simple" (pas de preflight). On
  // n'a pas besoin de lire la reponse (envoi fire-and-forget).
  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ to, subject, message, images })
  });
  return { sent: true, count: images.length };
}
