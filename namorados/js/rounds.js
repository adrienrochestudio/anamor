// ============================================================
// rounds.js — les 3 manches de l'atelier (step 2)
//
// Sous-machine a etats SYNCHRONISEE, stockee dans RTDB sous
//   atelier = { sub:int, ready:{ ana:int, adrien:int } }
//
// sub :  0 exquis-dessin   1 exquis-reveal
//        2 portrait-dessin 3 portrait-reveal
//        4 devine (adrien dessine) 5 devine (ana dessine)
//        6 fini -> on rend la main a soiree.js (step 3)
//
// Manches (cf brief 1.7) :
//   1. cadavre exquis  : adrien moitie haute, ana moitie basse.
//      showOwn=true, showOther=false. reveal = superposition.
//   2. portrait a l'aveugle : showOwn=false, showOther=false, ~75s.
//      reveal = les deux portraits cote a cote.
//   3. dessine-devine : un dessine (showOwn), l'autre voit le trait
//      en direct (showOther) et tape. tolerance Levenshtein.
// ============================================================

// distance d'edition (Levenshtein) — reprise de "learn lagagne"
export function editDist(a, b){
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 1) return 2;
  const dp = Array.from({ length:m+1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++){
    const c = a[i-1] === b[j-1] ? 0 : 1;
    dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+c);
  }
  return dp[m][n];
}
function norm(s){
  return (s || "").toString().trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.,!?;:]+$/, "").replace(/\s+/g, " ");
}
function accepts(input, target){
  const i = norm(input), t = norm(target);
  if (!i) return false;
  if (i === t) return true;
  return t.length > 3 && editDist(t, i) <= 1; // tolere une petite faute
}

const DRAWER = { 4: "adrien", 5: "ana" };   // qui dessine a chaque manche devine
const WORD_IDX = { 4: 0, 5: 1 };            // quel mot de content.guessWords

export function runAtelier({ cvs, me, other, content, room, dom, say }){
  const { roomWatch, roomUpdate, roomSet } = room;
  let lastSub = -1;
  let timerId = null;
  let solved = false;

  cvs.setColors(content.colors);

  function clearTimer(){ if (timerId){ clearInterval(timerId); timerId = null; } }
  function showSuivant(on){ dom.suivant.style.display = on ? "" : "none"; }
  function showGuess(on){ dom.guessWrap.style.display = on ? "" : "none"; }
  function showSecret(word){ dom.secret.textContent = word ? `tu dessines : ${word}` : ""; dom.secret.style.display = word ? "" : "none"; }
  function showTimer(txt){ dom.timer.textContent = txt || ""; dom.timer.style.display = txt ? "" : "none"; }

  function readyUp(sub){ roomUpdate("atelier/ready", { [me]: sub }); }

  // ── rend une manche selon le sub courant ────────────────
  function render(sub){
    clearTimer(); solved = false;
    dom.role.textContent = "";
    showSecret(""); showTimer(""); showGuess(false); showSuivant(true);

    if (sub === 0){                                   // cadavre exquis — dessin
      say(content.roundIntros.exquis);
      const top = me === "adrien";
      dom.role.textContent = top ? "tu as la moitie du haut" : "tu as la moitie du bas";
      cvs.startRound("exquis", {
        showOwn:true, showOther:false,
        region: top ? { y0:0, y1:0.5 } : { y0:0.5, y1:1 }
      });
      dom.suivant.textContent = "fini, on revele";
    }
    else if (sub === 1){                              // cadavre exquis — reveal
      say("there. the monster you made.");
      dom.role.textContent = "";
      cvs.reveal("exquis", "overlay");
      dom.suivant.textContent = "suivant →";
    }
    else if (sub === 2){                              // portrait aveugle — dessin
      say(content.roundIntros.portrait);
      dom.role.textContent = "draw the face. don't look at your line.";
      cvs.startRound("portrait", { showOwn:false, showOther:false });
      dom.suivant.textContent = "fini";
      let left = 75;
      showTimer(`${left}s`);
      timerId = setInterval(() => {
        left--; showTimer(left > 0 ? `${left}s` : "time !");
        if (left <= 0){ clearTimer(); readyUp(sub); }  // le temps fait office de "suivant"
      }, 1000);
    }
    else if (sub === 3){                              // portrait — reveal
      say("you two. side by side.");
      cvs.reveal("portrait", "side-by-side");
      dom.suivant.textContent = "suivant →";
    }
    else if (sub === 4 || sub === 5){                 // dessine-devine
      const drawer = DRAWER[sub];
      const word = content.guessWords[WORD_IDX[sub]] || "?";
      const iDraw = me === drawer;
      say(content.roundIntros.guess);
      if (iDraw){
        dom.role.textContent = "you draw. no words, no letters.";
        showSecret(word);
        showSuivant(false);                            // le dessinateur n'avance pas seul
        cvs.startRound("guess" + sub, { showOwn:true, showOther:false });
      } else {
        dom.role.textContent = "you guess. type what you see.";
        showSuivant(false);
        showGuess(true);
        dom.guessInput.value = "";
        dom.guessFeedback.textContent = "";
        cvs.startRound("guess" + sub, { showOwn:false, showOther:true, locked:true });
        dom.guessInput.focus();
      }
    }
  }

  // ── soumission d'une proposition (devineur) ─────────────
  function submitGuess(){
    if (solved) return;
    const sub = lastSub;
    if (sub !== 4 && sub !== 5) return;
    const word = content.guessWords[WORD_IDX[sub]] || "";
    const val = dom.guessInput.value;
    if (accepts(val, word)){
      solved = true;
      dom.guessFeedback.textContent = "yes ! that's it.";
      roomSet("atelier/sub", sub + 1);                 // on avance les deux
    } else {
      dom.guessFeedback.textContent = "nope... again";
      dom.guessInput.value = "";
      dom.guessInput.focus();
    }
  }

  return new Promise(resolve => {
    // init si la room ne connait pas encore l'atelier
    roomWatch("atelier", state => {
      if (!state){ roomSet("atelier", { sub:0, ready:{} }); return; }
      const sub = state.sub | 0;

      if (sub >= 6){ clearTimer(); resolve(); return; }

      // (re)rendu seulement quand le sub change
      if (sub !== lastSub){ lastSub = sub; render(sub); }

      // avancement "les deux prets" pour les manches a bouton.
      // sentinel -1 = "pas encore pret" (sinon le defaut 0 ferait
      // passer sub 0 instantanement, car 0 >= 0).
      const r = state.ready || {};
      const ra = Number.isInteger(r.ana)    ? r.ana    : -1;
      const rd = Number.isInteger(r.adrien) ? r.adrien : -1;
      if (sub <= 3 && ra >= sub && rd >= sub){
        roomSet("atelier/sub", sub + 1);
      }
    });

    // bouton suivant : j'annonce que je suis pret a quitter le sub courant
    dom.suivant.addEventListener("click", () => {
      if (lastSub <= 3) readyUp(lastSub);
    });
    // devineur : Entree ou bouton
    dom.guessBtn.addEventListener("click", submitGuess);
    dom.guessInput.addEventListener("keydown", e => { if (e.key === "Enter") submitGuess(); });
  });
}
