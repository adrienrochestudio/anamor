// ============================================================
// firebase.js — init + refs partagés
//
// Une seule app Firebase pour toute la soirée.
//  - Realtime Database : la room temps réel (présence, état, dessins, capsule)
//  - Firestore         : SEULEMENT pour compter les artistes de la page musik
//                        (collection "refrao_artists"), pour la baseline capsule.
//
// La config web Firebase n'est PAS secrète : elle vit côté client.
// Elle est déjà celle du reste du kompiuter (projet anam-cancao).
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getFirestore, collection, getCountFromServer }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// <<< ADRIEN : c'est déjà la bonne config (anam-cancao). Rien à coller normalement.
const firebaseConfig = {
  apiKey:            "AIzaSyA2kqrXTD_fDVOnw4j99F8b60Se_4sB6Rs",
  authDomain:        "anam-cancao.firebaseapp.com",
  databaseURL:       "https://anam-cancao-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "anam-cancao",
  storageBucket:     "anam-cancao.firebasestorage.app",
  messagingSenderId: "1078805660452",
  appId:             "1:1078805660452:web:94e57bfdfa9b83c17c29b1"
};

const app = initializeApp(firebaseConfig);

// ── Realtime Database : la room de la soirée ──────────────
export const db = getDatabase(app);
export const ROOM = "rooms/namorados-2026";
export const roomRef = ref(db, ROOM);

// ── Firestore : compteur d'artistes musik (pour la capsule) ──
// La page musik (apprendre-cancao.html) stocke les artistes dans
// la collection "refrao_artists". On compte les documents.
const fs = getFirestore(app);
const ARTISTS_COLLECTION = "refrao_artists";

export async function countMusikArtists(){
  try {
    const snap = await getCountFromServer(collection(fs, ARTISTS_COLLECTION));
    return snap.data().count;
  } catch (e){
    console.error("countMusikArtists failed", e);
    return null;
  }
}
