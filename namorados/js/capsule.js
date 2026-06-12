// ============================================================
// capsule.js : scellement de la capsule (step 3)
//
// Chacun saisit ses entrees (content.capsulePrompts). On ecrit
//   capsule/entries/{player} = { "<prompt>": "<reponse>", ... }
// Quand LES DEUX ont scelle :
//   capsule/baseline = nombre d'artistes musik au moment du scellement
//                      (compte Firestore, collection refrao_artists)
//   capsule/sealedAt = horodatage
//
// La capsule se rouvrira plus tard sur la page musik quand
// artistes_actuels >= baseline + 10  (voir capsule-musik.js).
// ============================================================
import { serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

export function runCapsule({ me, other, content, room, countMusikArtists, dom, say }){
  const { roomWatch, roomUpdate, roomSet } = room;
  let mySealed = false;

  // construit un champ par prompt
  dom.fields.innerHTML = "";
  const inputs = content.capsulePrompts.map((p, i) => {
    const wrap = document.createElement("label");
    wrap.className = "cap-field";
    const span = document.createElement("span");
    span.textContent = p;
    const ta = document.createElement("textarea");
    ta.rows = 2; ta.maxLength = 400; ta.dataset.prompt = p;
    wrap.append(span, ta);
    dom.fields.appendChild(wrap);
    return ta;
  });

  function myEntries(){
    const o = {};
    inputs.forEach(ta => { o[ta.dataset.prompt] = ta.value.trim(); });
    return o;
  }

  return new Promise(resolve => {
    say(content.capsuleLocked);

    dom.sealBtn.addEventListener("click", async () => {
      if (mySealed) return;
      mySealed = true;
      await roomSet(`capsule/entries/${me}`, myEntries());
      await roomUpdate("capsule/ready", { [me]: true });
      inputs.forEach(ta => ta.disabled = true);
      dom.sealBtn.disabled = true;
      dom.sealBtn.textContent = "scelle. on attend l'autre...";
    });

    roomWatch("capsule", async cap => {
      const ready = (cap && cap.ready) || {};
      if (ready.ana && ready.adrien){
        // les deux ont scelle : on fige la baseline une seule fois
        if (cap && cap.baseline == null){
          const n = await countMusikArtists();
          await roomUpdate("capsule", { baseline: (n == null ? 0 : n), sealedAt: serverTimestamp() });
        }
        if (cap && cap.sealedAt){
          dom.status.textContent = "sealed.";
          resolve();
        }
      }
    });
  });
}
