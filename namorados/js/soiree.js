// ============================================================
// soiree.js : machine a etats + repliques du kompiuter
//
// Le `step` partage (room) pilote l'ecran des DEUX. Toutes les
// paroles viennent de content.js.
//
//   step 0  qui es-tu        (local) -> choisit "me", joinPresence
//   step 1  ouverture        presence + repliques + "comecar"
//   step 2  atelier          3 manches (rounds.js)
//   step 3  capsule          scellement (capsule.js)
//   step 4  message final    revealIntro puis le message d'adrien
//   step 5  au revoir        goodbye, lumieres qui baissent
//
// Recharger = reprendre l'etat (on lit state/step). Ana en retard =
// rejoint a l'etape en cours.
// ============================================================
import { content } from "../content.js";
import { countMusikArtists } from "./firebase.js";
import {
  joinPresence, watchPresence, watchState, setReady, setStep,
  roomWatch, roomUpdate, roomSet, roomGet
} from "./room.js";
import { createCanvas } from "./canvas.js";
import { runAtelier } from "./rounds.js";
import { runCapsule } from "./capsule.js";
import { fx } from "./fx.js";
import { sendDrawings } from "./mail.js";

const room = { roomWatch, roomUpdate, roomSet };
const $ = id => document.getElementById(id);

// petite animation a chaque clic sur un bouton (partout)
document.addEventListener("click", e => {
  const b = e.target.closest("button, .id-btn");
  if (b && !b.disabled) fx.tap(e.clientX, e.clientY);
});

let me = null, other = null, cvs = null;
let mountedStep = -1;
let atelierStarted = false, capsuleStarted = false;

function say(t){ $("speech").textContent = t || ""; }
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === id));
}

// ── step 0 : qui es-tu (local) ──────────────────────────────
function chooseIdentity(){
  showScreen("s-identity");
  say(content.waiting);
  document.querySelectorAll(".id-btn").forEach(b => {
    b.addEventListener("click", () => start(b.dataset.me));
  });
}

function start(who, persist = true){
  me = who;
  other = me === "ana" ? "adrien" : "ana";
  if (persist) localStorage.setItem("namorados-me", me);
  joinPresence(me);
  cvs = createCanvas($("board"), me, other);
  cvs.setColors(content.colors);

  // si la room n'a pas encore d'etat, on l'ouvre a l'etape 1
  watchState(st => {
    const step = (st && st.step) ? st.step : 1;
    if (!st || !st.step) setStep(1);
    render(step, st);
  });
}

// ── routeur d'etapes ────────────────────────────────────────
function render(step, st){
  if (step !== mountedStep){
    mountedStep = step;
    mount(step);
  }
  // avancement "les deux prets" pour les etapes a bouton (1 et 4)
  if (st && st.ready){
    const r = st.ready;
    if ((r.ana | 0) >= step && (r.adrien | 0) >= step && (step === 1 || step === 4)){
      setStep(step + 1);
    }
  }
}

function mount(step){
  if (step <= 1) return mountOpening();
  if (step === 2) return mountAtelier();
  if (step === 3) return mountCapsule();
  if (step === 4) return mountFinal();
  return mountGoodbye();
}

// ── step 1 : ouverture ──────────────────────────────────────
function mountOpening(){
  showScreen("s-opening");
  let bothOnline = false;
  watchPresence(p => {
    const aOn = !!(p.ana && p.ana.online);
    const dOn = !!(p.adrien && p.adrien.online);
    $("dot-ana").classList.toggle("on", aOn);
    $("dot-adrien").classList.toggle("on", dOn);
    if (aOn && dOn && !bothOnline){ bothOnline = true; playOpening(); }
    if (!bothOnline) say(content.waiting);
  });
}

function playOpening(){
  const lines = content.opening.slice();
  $("comecar").style.display = "none";
  let i = 0;
  say(lines[i]);
  const timer = setInterval(() => {
    i++;
    if (i >= lines.length){
      clearInterval(timer);
      $("comecar").style.display = "";
      return;
    }
    say(lines[i]);
  }, 2300);
  $("comecar").onclick = () => {
    $("comecar").disabled = true;
    $("comecar").textContent = "on attend l'autre...";
    setReady(me, 1);
  };
}

// ── step 2 : atelier ────────────────────────────────────────
function mountAtelier(){
  showScreen("s-atelier");
  if (atelierStarted) return;
  atelierStarted = true;
  const dom = {
    role: $("role"), timer: $("timer"), secret: $("secret"),
    suivant: $("suivant"), divider: $("board-divider"),
    guessWrap: $("guess-wrap"), guessInput: $("guess-input"),
    guessBtn: $("guess-btn"), guessFeedback: $("guess-feedback")
  };
  cvs.fit();
  runAtelier({ cvs, me, other, content, room, dom, say, fx }).then(() => setStep(3));
}

// ── step 3 : capsule ────────────────────────────────────────
function mountCapsule(){
  showScreen("s-capsule");
  if (capsuleStarted) return;
  capsuleStarted = true;
  const dom = {
    fields: $("cap-fields"), sealBtn: $("seal"), status: $("cap-status")
  };
  runCapsule({ me, other, content, room, countMusikArtists, dom, say }).then(() => { fx.rose(); setStep(4); });
}

// ── step 4 : message final ──────────────────────────────────
function mountFinal(){
  showScreen("s-final");
  document.body.classList.add("dim");
  say(content.revealIntro);
  $("final-intro").textContent = content.revealIntro;
  // le message apparait doucement apres la phrase d'intro
  $("final-msg").textContent = "";
  setTimeout(() => {
    $("final-msg").textContent = content.finalMessage;
    $("final-next").style.display = "";
    fx.rose();                       // une rose eclot avec le message
    setTimeout(() => fx.rise("petal", 18), 600);
  }, 2600);
  $("final-next").onclick = () => {
    $("final-next").disabled = true;
    $("final-next").textContent = "...";
    setReady(me, 4);
  };
}

// ── step 5 : au revoir ──────────────────────────────────────
function mountGoodbye(){
  showScreen("s-goodbye");
  document.body.classList.add("night");
  say(content.goodbye);
  $("goodbye-text").textContent = content.goodbye;
  // de vrais coeurs dessines qui montent doucement dans le noir
  let waves = 0;
  const tick = setInterval(() => { if (++waves > 4){ clearInterval(tick); return; } fx.rise("heart", 10); }, 4200);
  fx.rise("heart", 10);
  maybeSendMail();
}

// envoi auto des dessins par email, une seule fois (adrien envoie,
// garde-fou RTDB contre le renvoi si la page est rechargee).
let mailDone = false;
async function maybeSendMail(){
  if (me !== "adrien" || mailDone) return;
  mailDone = true;
  try {
    const snap = await roomGet("mailSent");
    if (snap.exists() && snap.val()) return;
    await roomSet("mailSent", true);
    const res = await sendDrawings({
      endpoint: content.mailEndpoint, to: content.mailTo,
      subject: content.mailSubject, message: content.mailMessage,
      colors: content.colors
    });
    if (res && res.skipped) await roomSet("mailSent", null); // pas envoye -> on rearme
  } catch (e){ console.error("mail send failed", e); await roomSet("mailSent", null); }
}

// ── boot ────────────────────────────────────────────────────
// ?me=ana / ?me=adrien : force le role SANS toucher au localStorage.
// Permet de tester les deux roles dans deux onglets du MEME navigateur
// (sinon le localStorage est partage entre onglets et les deux seraient
// le meme joueur). Sans le parametre : flux normal (localStorage).
// On demande TOUJOURS qui tu es a la connexion (meme si le cache n'a
// pas ete vide). ?me=ana / ?me=adrien force le role pour le test solo.
const forced = new URLSearchParams(location.search).get("me");
if (forced === "ana" || forced === "adrien") start(forced, false);
else chooseIdentity();
