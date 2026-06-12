// ============================================================
// room.js : presence + avancement d'etape SYNCHRONISE
//
// state = { step:0, ready:{ ana:n, adrien:n } }
//  - on n'avance a l'etape suivante que quand LES DEUX ont
//    clique "suivant" pour l'etape courante.
//  - au chargement on lit state/step pour reprendre en cours
//    (si l'autre arrive en retard).
// "me" vaut "ana" ou "adrien" (choisi au 1er ecran).
// ============================================================
import { db, ROOM } from "./firebase.js";
import {
  ref, onValue, set, update, onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── presence ──────────────────────────────────────────────
export function joinPresence(me){
  const r = ref(db, `${ROOM}/presence/${me}`);
  set(r, { online:true, at:serverTimestamp() });
  onDisconnect(r).set({ online:false, at:serverTimestamp() });
}

export function watchPresence(cb){
  onValue(ref(db, `${ROOM}/presence`), s => cb(s.val() || {}));
}

// ── etat partage (step + ready des deux) ──────────────────
export function watchState(cb){
  onValue(ref(db, `${ROOM}/state`), s => cb(s.val() || { step:0, ready:{} }));
}

// j'annonce que je suis pret a quitter `step`
export function setReady(me, step){
  update(ref(db, `${ROOM}/state/ready`), { [me]: step });
}

// passe l'etape (ecrit par celui qui constate que les deux sont prets)
export function setStep(step){
  set(ref(db, `${ROOM}/state/step`), step);
}

// helper generique : pousser une valeur quelconque dans la room
export function roomSet(path, value){ return set(ref(db, `${ROOM}/${path}`), value); }
export function roomUpdate(path, value){ return update(ref(db, `${ROOM}/${path}`), value); }
export function roomWatch(path, cb){ return onValue(ref(db, `${ROOM}/${path}`), s => cb(s.val())); }
