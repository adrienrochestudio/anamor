# BRIEF — soirée « dos namorados » + passe de nettoyage (kompiuter)

Repo : `adrienrochestudio.github.io`, le site vit dans `/anamor/`.
Travailler en **deux phases**. Faire la Phase 0 d'abord, montrer le rapport, attendre le feu vert, puis Phase 1.

Préférences de l'auteur : code **fragmenté** (un rôle par fichier), **modifier l'existant plutôt que réécrire**, **aucun emoji**, esthétique minimaliste/typographique, voix du kompiuter en minuscules anglais cassé.

---

# PHASE 0 — Audit & nettoyage du site

Objectif : un site **propre, sans poids mort, sans bugs**, prêt à recevoir la feature de ce soir. Pas de durcissement de sécurité demandé.

## 0.1 — Audit NON destructif d'abord (ne rien supprimer encore)
Parcourir tout `/anamor/` et produire un rapport court :
- **Inventaire** : lister toutes les pages et tous les fichiers, et la carte des liens entre pages.
- **Fichiers orphelins** : fichiers/images/scripts présents mais référencés nulle part.
- **Assets inutilisés** : images non utilisées, CSS/JS mort, fonctions jamais appelées, fichiers de test oubliés.
- **Doublons** : CSS dupliqué, blocs JS copiés-collés, styles redondants.
- **Code mort** : gros blocs commentés, `console.log` de debug, branches `DEV_MODE`/bypass laissées.
- **Bugs** : liens cassés, images 404, appels Firebase qui échouent, erreurs console sur chaque page, casse responsive mobile.
- **Cohérence** : nav/header/footer partagés ou non, styles incohérents d'une page à l'autre, voix du kompiuter régulière.
- **Risques d'intégration** : clés `localStorage` et chemins Firebase déjà utilisés, pour éviter toute collision quand on ajoutera `/namorados/`.

Sortir tout ça en une liste claire, avec pour chaque item : où, et l'action proposée (supprimer / fusionner / corriger / laisser).

## 0.2 — Nettoyage
Après le rapport :
- Appliquer directement les corrections **sûres et évidentes** (404, liens morts, console.log, doublons triviaux, code commenté mort).
- Pour tout ce qui est **potentiellement risqué** (supprimer un fichier, toucher la logique d'un jeu existant, modifier des données Firebase), **lister et demander avant** de toucher.
- Ne jamais casser les données Firebase existantes ni la page musik (on s'en sert en Phase 1).
- Note (sans forcer) : si les photos d'artistes sont stockées en base64 dans Firebase, le signaler comme source de poids, mais ne pas migrer sans accord.

---

# PHASE 1 — La soirée namorados

Page spéciale **temps réel à deux** dans un nouveau dossier `/anamor/namorados/`. Ana et Adrien l'ouvrent chacun sur leur écran, en visio. Le **kompiuter** les guide ~30 min : ouverture → atelier de dessin (3 manches) → capsule scellée → message final → au revoir. Tout est **additif**, ne rien casser ailleurs.

## 1.1 — Voix & style (NON négociable)
- Esthétique kompiuter existante : minuscules, anglais cassé et tendre (déjà sur le site : « uuh... », « oh okae », « i guess », « you ! »). **Zéro emoji.**
- Minimal, typographique, beaucoup de vide, police simple, palette douce.
- Réutiliser le personnage : images `../1.png` … `../7.png`.
- Mobile + tactile OK (souris et doigt sur la toile).

## 1.2 — Firebase (Realtime Database)
- Même version de Firebase que le reste du kompiuter. Sinon : **v9 modular via CDN ESM** (`<script type="module">`).
- Projet `anam-cancao`. **Activer Realtime Database.** Room unique fixe : `rooms/namorados-2026`.
- Pas de sécurité demandée : règles RTDB simples (read/write) sur cette room. À resserrer plus tard si besoin.
- Présence avec `onDisconnect`.

## 1.3 — Architecture des fichiers (fragmenté)
```
/anamor/namorados/
  index.html        # structure + montage des écrans
  soiree.css        # styles (vibe kompiuter)
  content.js        # << SEUL FICHIER QU'ADRIEN ÉDITE (template fourni §1.8)
  js/firebase.js    # init + refs (room + ref vers les artistes musik pour la capsule)
  js/room.js        # présence + avancement d'étape SYNCHRONISÉ
  js/canvas.js      # moteur de toile partagée (modes live / masqué-jusqu'au-reveal)
  js/rounds.js      # les 3 manches de l'atelier
  js/capsule.js     # scellement de la capsule (entrées des deux + baseline du compteur musik)
  js/soiree.js      # machine à états + répliques du kompiuter + message final + au revoir
```
Côté page **musik** existante (petit ajout, ne pas réécrire la page) :
```
  - une carte "capsule" verrouillée + compteur x/10
  - js/capsule-musik.js : lit la capsule, compte les artistes, débloque à baseline+10
```

## 1.4 — Synchro présence + avancement (pattern v9 à utiliser)
```js
// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
const firebaseConfig = { /* <<< ADRIEN colle la config web de anam-cancao */ };
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const roomRef = ref(db, "rooms/namorados-2026");
```
```js
// js/room.js
import { db } from "./firebase.js";
import { ref, onValue, set, update, onDisconnect, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
const R = "rooms/namorados-2026";
// "me" choisi au 1er écran ("je suis ana" / "je suis adrien"), stocké en localStorage.
export function joinPresence(me){
  const r = ref(db, `${R}/presence/${me}`);
  set(r, { online:true, at:serverTimestamp() });
  onDisconnect(r).set({ online:false });
}
export function watchPresence(cb){ onValue(ref(db,`${R}/presence`), s=>cb(s.val()||{})); }
// Avancement à deux : on n'avance que quand LES DEUX ont cliqué "suivant".
// state = { step:0, ready:{ana:n, adrien:n} }
export function watchState(cb){ onValue(ref(db,`${R}/state`), s=>cb(s.val()||{step:0,ready:{}})); }
export function setReady(me, step){ update(ref(db,`${R}/state/ready`), { [me]: step }); }
export function setStep(step){ set(ref(db,`${R}/state/step`), step); }
// soiree.js : si ready.ana>=step ET ready.adrien>=step -> setStep(step+1) (lu par les deux).
// Au chargement : lire state/step pour reprendre à l'étape en cours (si Ana arrive en retard).
```

## 1.5 — Moteur de toile (js/canvas.js)
Une toile partagée par segments `{x1,y1,x2,y2,color}` poussés dans RTDB, sous une clé **par manche et par joueur** : `rooms/namorados-2026/draw/{round}/{player}`. Couleurs des deux pinceaux dans `content.colors`.

Chaque manche a deux drapeaux qui décident ce qu'on AFFICHE pendant qu'on dessine (le reveal affiche toujours tout) :
- `showOwn`  : est-ce que JE vois mon propre trait en direct ?
- `showOther`: est-ce que je vois le trait de l'autre en direct ?

Au **reveal** : on charge les segments des deux joueurs et on les superpose pour montrer le résultat final.

## 1.6 — Déroulé / machine à états (js/soiree.js)
Le `step` partagé pilote l'écran des deux. Toutes les répliques viennent de `content.js`.

- **step 0 — qui es-tu** (local) : « je suis ana » / « je suis adrien » → stocke `me`, lance `joinPresence`.
- **step 1 — ouverture** : voyants de présence. Tant que l'autre n'est pas là → `content.waiting`. Quand les deux sont en ligne → répliques `content.opening` une par une → bouton « começar » (les deux doivent cliquer).
- **step 2 — atelier de dessin** : trois manches enchaînées (voir §1.7). On passe à la manche suivante quand les deux ont cliqué « suivant ».
- **step 3 — capsule** : chacun écrit ses entrées (`content.capsulePrompts`), on scelle (voir §1.9). Le kompiuter explique que ça se rouvre en ajoutant 10 artistes sur musik.
- **step 4 — message final** : la toile/le reste s'efface en douceur ; `content.revealIntro` puis le **message d'Adrien** s'affiche (depuis `content.finalMessage`, écrit en amont par lui). C'est le climax, en live.
- **step 5 — au revoir** : `content.goodbye`, lumières qui baissent, fin. (Pas de film : Ana le lance de son côté.)

## 1.7 — Les 3 manches (js/rounds.js)
Rôles selon `me` (ana / adrien). Le kompiuter introduit chaque manche (textes dans content.js).

1. **Cadavre exquis** — toile coupée en deux. Adrien = moitié haute, Ana = moitié basse. Chacun voit SA moitié, pas celle de l'autre, puis reveal qui assemble le monstre.
   - flags : `showOwn=true, showOther=false`. Reveal : superpose les deux moitiés.
2. **Portrait à l'aveugle** — vous vous dessinez l'un l'autre en regardant uniquement la webcam, **sans voir votre propre trait** pendant que vous dessinez (blind contour). Reveal simultané des deux portraits côte à côte.
   - flags : `showOwn=false, showOther=false`. Timer ~75 s. Reveal : les deux portraits côte à côte.
3. **Dessine-devine** — un dessine un mot soufflé par le kompiuter (`content.guessWords`), l'autre tape ses propositions ; le trait du dessinateur est vu en direct par le devineur. Validation avec **tolérance Levenshtein** (réutiliser celle de « learn lagagne » si dispo). Alterner qui dessine sur 2 mots.
   - dessinateur : `showOwn=true`. devineur : voit le trait du dessinateur en direct (`showOther=true`).

## 1.8 — content.js (SEUL fichier que personnalise Adrien)
```js
export const content = {
  colors: { ana: "#c2452d", adrien: "#2d5fc2" },

  waiting: "i wait for you two...",
  opening: [
    "oh. you both here now.",
    "good. i was hoping.",
    "today is the special day i think",
    "happy dia dos namorados",
    "i made you some things. come →",
  ],

  // intros des manches (voix kompiuter)
  roundIntros: {
    exquis: "first. we draw a monster together. you the top, you the bottom. no peeking.",
    portrait: "now. you draw each other. but you not look at your own paper. only look at the face.",
    guess: "okae last one. one draws, one guesses. i give the secret word.",
  },
  guessWords: ["// liste de mots à dessiner, ex:", "saudade", "le métro", "un chat", "la plage", "..."],

  // capsule — entrées écrites par les deux ce soir
  capsulePrompts: [
    "un souvenir de nous",
    "une promesse",
    "une envie pour la prochaine fois qu'on se voit",
  ],
  capsuleLocked: "i keep this safe. it opens when ana put 10 new artists on the musik page.",

  // message final — ÉCRIT EN AMONT PAR ADRIEN, montré en live ce soir
  revealIntro: "okae. now i go quiet. he has something to say.",
  finalMessage: "// ton message pour elle ici",

  goodbye: "okae lovebirds. that is all i made. enjoy your night. i be here tomorrow.",
};
```

## 1.9 — Capsule : scellement + déblocage
**Scellement (ce soir, dans la soirée)** — `js/capsule.js` :
- Chacun saisit ses entrées (selon `content.capsulePrompts`). On écrit `rooms/namorados-2026/capsule/entries/{player}`.
- **Compter les artistes** de la page musik dans Firebase (Claude Code repère le chemin exact pendant l'audit) et stocker `capsule/baseline = nombre actuel` au moment du scellement.
- Stocker `capsule/sealedAt`.

**Déblocage (plus tard, sur la page musik)** — `js/capsule-musik.js` :
- Sur la page musik, afficher une **carte capsule verrouillée** avec un compteur `(<artistes actuels> − baseline) / 10`.
- À chaque ajout d'artiste, le compteur monte. Quand `artistes_actuels >= baseline + 10` → la capsule **s'ouvre** et affiche les entrées des deux (et, si présent, un mot caché d'Adrien).
- Optionnel : un mot caché supplémentaire d'Adrien, mis dans content.js, révélé à l'ouverture.

## 1.10 — Robustesse
- Recharger une page = reprendre l'état (lire `state/step`).
- Ana en retard = rejoint à l'étape en cours.
- Tester à deux onglets (un « ana », un « adrien ») avant ce soir : présence, avancement à deux, reveals, scellement capsule, et compteur sur musik.

---

# CE QU'ADRIEN FAIT À LA MAIN
1. Console `anam-cancao` : activer **Realtime Database**, coller la config web dans `js/firebase.js`, mettre des règles read/write simples sur `rooms/namorados-2026`.
2. Éditer **uniquement `content.js`** : son **message final**, la liste `guessWords`, éventuellement ajuster les prompts de capsule et les couleurs.
3. Tester à deux onglets.
