// ============================================================
// souvenir.js : la galerie de nos dessins de la soiree.
// Lit les traits dans la RTDB, les rend en PNG, les affiche et
// permet de les telecharger. Avec la fleur et le petit message.
// ============================================================
import { collectDrawings } from "./mail.js";
import { content } from "../content.js";

const CAPTIONS = {
  "le-monstre.png": "le monstre (cadavre exquis)",
  "les-portraits.png": "nos portraits a l'aveugle",
  "dessine-1.png": "dessine-devine 1",
  "dessine-2.png": "dessine-devine 2",
  "dessine-3.png": "dessine-devine 3",
  "dessine-4.png": "dessine-devine 4",
  "dessine-5.png": "dessine-devine 5",
  "dessine-6.png": "dessine-devine 6"
};

const grid = document.getElementById("grid");
const status = document.getElementById("status");
document.getElementById("msg").textContent = content.mailMessage;

function download(name, dataUrl){
  const a = document.createElement("a");
  a.href = dataUrl; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

(async () => {
  let images = [];
  try {
    images = await collectDrawings(content.colors);
  } catch (e){
    console.error(e);
    status.textContent = "uuh. i can not reach the drawings right now.";
    return;
  }

  if (!images.length){
    status.textContent = "uuh. no drawings saved. (la soiree a peut etre ete remise a zero)";
    return;
  }

  status.style.display = "none";
  images.forEach(img => {
    const card = document.createElement("div");
    card.className = "card";
    const im = document.createElement("img");
    im.src = img.dataUrl; im.alt = CAPTIONS[img.name] || img.name;
    const cap = document.createElement("div");
    cap.className = "cap"; cap.textContent = CAPTIONS[img.name] || img.name;
    const dl = document.createElement("a");
    dl.className = "dl"; dl.href = img.dataUrl; dl.download = img.name; dl.textContent = "télécharger";
    card.append(im, cap, dl);
    grid.appendChild(card);
  });

  const saveAll = document.getElementById("save-all");
  saveAll.style.display = "";
  saveAll.onclick = () => images.forEach((img, i) => setTimeout(() => download(img.name, img.dataUrl), i * 350));
})();
