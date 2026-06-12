// ============================================================
// capsule-musik.js — la capsule, cote page musik
//
// Lit la capsule scellee pendant la soiree namorados et affiche
// une carte VERROUILLEE avec un compteur (artistes_actuels - baseline)/10.
// Quand on a ajoute 10 nouveaux artistes, la capsule s'ouvre et
// montre les entrees des deux (+ un mot cache optionnel d'adrien).
//
// Module autonome : il cree sa propre app firebase nommee pour ne
// pas entrer en collision avec le script Firestore de la page musik.
// Ne reecrit rien de la page : il se contente de remplir #capsule-musik.
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getFirestore, collection, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { content } from "../namorados/content.js";

const firebaseConfig = {
  apiKey:            "AIzaSyA2kqrXTD_fDVOnw4j99F8b60Se_4sB6Rs",
  authDomain:        "anam-cancao.firebaseapp.com",
  databaseURL:       "https://anam-cancao-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "anam-cancao",
  storageBucket:     "anam-cancao.firebasestorage.app",
  messagingSenderId: "1078805660452",
  appId:             "1:1078805660452:web:94e57bfdfa9b83c17c29b1"
};

const NEED = 10;
const app = initializeApp(firebaseConfig, "capsuleMusik");
const db  = getDatabase(app);
const fs  = getFirestore(app);

const host = document.getElementById("capsule-musik");
if (host){
  injectStyles();
  let cap = null;       // { baseline, entries, sealedAt }
  let count = null;     // nombre d'artistes actuel

  onValue(ref(db, "rooms/namorados-2026/capsule"), s => { cap = s.val(); render(); });
  onSnapshot(collection(fs, "refrao_artists"), snap => { count = snap.size; render(); });

  function render(){
    if (!cap || !cap.sealedAt){ host.innerHTML = ""; return; }   // rien scelle => pas de carte
    if (count == null) return;

    const added = Math.max(0, count - (cap.baseline | 0));
    const open  = added >= NEED;
    const shown = Math.min(added, NEED);

    if (!open){
      host.innerHTML =
        '<div class="cap-card locked">' +
          '<div class="cap-lock">capsule</div>' +
          '<div class="cap-count">' + shown + ' / ' + NEED + '</div>' +
          '<p class="cap-msg">' + esc(content.capsuleLocked) + '</p>' +
        '</div>';
    } else {
      host.innerHTML =
        '<div class="cap-card open">' +
          '<div class="cap-lock">capsule — ouverte</div>' +
          entriesHTML(cap.entries) +
          (content.capsuleSecret ? '<p class="cap-secret">' + esc(content.capsuleSecret) + '</p>' : '') +
        '</div>';
    }
  }
}

function entriesHTML(entries){
  if (!entries) return "";
  const block = (who, label) => {
    const e = entries[who]; if (!e) return "";
    const rows = Object.keys(e).map(k =>
      '<div class="cap-row"><span class="cap-k">' + esc(k) + '</span>' +
      '<span class="cap-v">' + esc(e[k]) + '</span></div>').join("");
    return '<div class="cap-person"><div class="cap-name">' + label + '</div>' + rows + '</div>';
  };
  return block("ana", "ana") + block("adrien", "adrien");
}

function esc(t){
  return String(t == null ? "" : t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function injectStyles(){
  const css =
  '#capsule-musik{max-width:760px;margin:18px auto 0;padding:0 18px;font-family:"Patrick Hand",cursive;}' +
  '.cap-card{border:1.5px solid #8B1A2B;padding:16px 18px;background:#FAF8F4;}' +
  '.cap-card.locked{text-align:center;}' +
  '.cap-lock{color:#9a8f84;font-size:.95rem;letter-spacing:.04em;}' +
  '.cap-count{color:#8B1A2B;font-size:2rem;margin:4px 0;}' +
  '.cap-msg{color:#8B1A2B;opacity:.85;}' +
  '.cap-person{margin-top:12px;}' +
  '.cap-name{color:#8B1A2B;font-size:1.1rem;margin-bottom:4px;}' +
  '.cap-row{display:flex;gap:10px;justify-content:space-between;border-top:1px solid #e3d9cf;padding:5px 0;}' +
  '.cap-k{color:#9a8f84;}.cap-v{color:#8B1A2B;text-align:right;}' +
  '.cap-secret{margin-top:14px;color:#8B1A2B;font-size:1.15rem;text-align:center;}';
  const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
}
