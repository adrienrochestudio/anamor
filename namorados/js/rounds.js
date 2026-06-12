// ============================================================
// rounds.js : les 3 manches de l'atelier (step 2)
//
// Sous-machine a etats SYNCHRONISEE, stockee dans RTDB sous
//   atelier = { sub:int, ready:{ ana:int, adrien:int } }
//
// sub :  0 exquis-dessin    1 exquis-reveal
//        2 portrait-dessin  3 portrait-reveal
//        4..9 devine (6 manches, dessinateur alterne, 3 par personne)
//        10 fini -> on rend la main a soiree.js (step 3)
//
// Manches (cf brief 1.7) :
//   1. cadavre exquis  : adrien moitie haute, ana moitie basse.
//      showOwn=true, showOther=false. reveal = superposition.
//   2. portrait a l'aveugle : chacun dans SA moitie (ana gauche,
//      adrien droite) pour ne pas se chevaucher. ~75s. reveal superpose.
//   3. dessine-devine : mot TIRE AU SORT dans un pool de 20, stocke
//      dans la RTDB (meme mot pour les deux). un dessine (showOwn),
//      l'autre voit le trait en direct (showOther) et tape. tolerance
//      articles + Levenshtein. 6 manches, 3 chacun.
// ============================================================

// distance d'edition (Levenshtein), reprise de "learn lagagne"
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
// retire les articles en tete ("le metro" == "metro" == "the metro")
function stripArticles(s){
  let out = s.replace(/'/g, " ").replace(/\s+/g, " ").trim();
  const ART = /^(le|la|les|l|un|une|des|the|a|an|o|os|as|um|uma)\s+/;
  while (ART.test(out)) out = out.replace(ART, "");
  return out;
}
// une entree guessWords peut contenir plusieurs reponses "a / b / c"
export function accepts(input, entry){
  const raw = norm(input);
  if (!raw) return false;
  const guesses = [raw, stripArticles(raw)];
  const variants = String(entry).split("/").map(norm).filter(Boolean);
  return variants.some(v => {
    const targets = [v, stripArticles(v)];
    return targets.some(t => guesses.some(g =>
      g === t || (t.length > 3 && editDist(t, g) <= 1)   // tolere une petite faute
    ));
  });
}

// 6 manches de devinette (3 par personne), dessinateur alterne.
const GUESS_SUBS = [4, 5, 6, 7, 8, 9];
const DRAWER = { 4:"adrien", 5:"ana", 6:"adrien", 7:"ana", 8:"adrien", 9:"ana" };
const LAST_SUB = 9;   // au dela -> atelier fini

export function runAtelier({ cvs, me, other, content, room, dom, say, fx }){
  const { roomWatch, roomUpdate, roomSet } = room;
  let lastSub = -1;
  let timerId = null;
  let solved = false;
  let curWords = {};    // sub -> index du mot (tire au sort, partage via RTDB)
  let assigned = {};    // sub -> j'ai deja demande le tirage (anti-doublon)

  cvs.setColors(content.colors);

  function clearTimer(){ if (timerId){ clearInterval(timerId); timerId = null; } }
  function showSuivant(on){ dom.suivant.style.display = on ? "" : "none"; }
  function showGuess(on){ dom.guessWrap.style.display = on ? "" : "none"; }
  function showSecret(word){ dom.secret.textContent = word ? `tu dessines : ${word}` : ""; dom.secret.style.display = word ? "" : "none"; }
  function showTimer(txt){ dom.timer.textContent = txt || ""; dom.timer.style.display = txt ? "" : "none"; }

  function readyUp(sub){ roomUpdate("atelier/ready", { [me]: sub }); }

  // ── rend une manche selon le sub courant ────────────────
  function showDivider(on){ if (dom.divider) dom.divider.style.display = on ? "" : "none"; }

  // visage-exemple gris tres grossier (style mumy joe), dans MA moitie.
  // jitter aleatoire => l'air croquis. il s'efface au 1er trait.
  function buildGhostFace(left){
    const cx = left ? 0.25 : 0.75, cy = 0.45, rx = 0.15, ry = 0.27;
    const segs = [], J = 0.013;
    const line = (x1, y1, x2, y2) => segs.push({ x1, y1, x2, y2 });
    let prev = null;
    for (let i = 0; i <= 13; i++){
      const a = (i / 13) * Math.PI * 2;
      const p = [cx + Math.cos(a) * rx + (Math.random()*2-1)*J,
                 cy + Math.sin(a) * ry + (Math.random()*2-1)*J];
      if (prev) line(prev[0], prev[1], p[0], p[1]);
      prev = p;
    }
    line(cx-0.06, cy-0.07, cx-0.055, cy-0.02);   // oeil g
    line(cx+0.06, cy-0.07, cx+0.065, cy-0.02);   // oeil d
    line(cx, cy-0.01, cx-0.012, cy+0.05);        // nez
    line(cx-0.055, cy+0.12, cx, cy+0.155);       // bouche
    line(cx, cy+0.155, cx+0.055, cy+0.12);
    return segs;
  }

  function render(sub){
    clearTimer(); solved = false;
    dom.role.textContent = "";
    showSecret(""); showTimer(""); showGuess(false); showSuivant(true); showDivider(false);

    if (sub === 0){                                   // cadavre exquis, dessin
      say(content.roundIntros.exquis);
      const top = me === "adrien";
      dom.role.textContent = top ? content.atelier.roleTop : content.atelier.roleBottom;
      cvs.startRound("exquis", {
        showOwn:true, showOther:false,
        region: top ? { y0:0, y1:0.5 } : { y0:0.5, y1:1 }
      });
      dom.suivant.textContent = "fini, on revele";
    }
    else if (sub === 1){                              // cadavre exquis, reveal
      say(content.atelier.exquisReveal);
      dom.role.textContent = "";
      cvs.reveal("exquis", "overlay");
      dom.suivant.textContent = "suivant →";
    }
    else if (sub === 2){                              // portrait aveugle, dessin
      say(content.roundIntros.portrait);
      const left = me === "ana";                       // ana a gauche, adrien a droite
      dom.role.textContent = left ? content.atelier.portraitLeft : content.atelier.portraitRight;
      showDivider(true);                               // trait central = ta zone
      cvs.startRound("portrait", {
        showOwn:false, showOther:false,
        region: left ? { x0:0, x1:0.5 } : { x0:0.5, x1:1 },
        ghost: buildGhostFace(left)                     // exemple grossier qui s'efface
      });
      dom.suivant.textContent = "fini";
      let left2 = 75;
      showTimer(`${left2}s`);
      timerId = setInterval(() => {
        left2--; showTimer(left2 > 0 ? `${left2}s` : "time !");
        if (left2 <= 0){ clearTimer(); readyUp(sub); }  // le temps fait office de "suivant"
      }, 1000);
    }
    else if (sub === 3){                              // portrait, reveal
      say(content.atelier.portraitReveal);
      cvs.reveal("portrait", "overlay");               // chacun dans sa moitie -> superpose
      dom.suivant.textContent = "suivant →";
    }
    else if (GUESS_SUBS.includes(sub)){               // dessine-devine
      const iDraw = me === DRAWER[sub];
      say(content.roundIntros.guess);
      showSuivant(false);                              // on avance quand c'est trouve
      if (iDraw){
        dom.role.textContent = content.atelier.drawerRole;
        showSecret("...");                             // le mot tire au sort arrive de la room
        cvs.startRound("guess" + sub, { showOwn:true, showOther:false });
      } else {
        dom.role.textContent = content.atelier.guesserRole;
        showGuess(true);
        dom.guessInput.value = "";
        dom.guessFeedback.textContent = "";
        cvs.startRound("guess" + sub, { showOwn:false, showOther:true, locked:true });
        dom.guessInput.focus();
      }
    }
  }

  // ── mot de la manche : tire au sort UNE fois, ecrit dans la RTDB ──
  // (source de verite unique -> les deux ecrans ont le meme mot ; et
  //  comme c'est aleatoire, meme adrien ne sait pas lequel tombe.)
  function applyWord(sub){
    const idx = curWords[sub];
    const iDraw = me === DRAWER[sub];
    if (idx == null){
      if (iDraw && !assigned[sub]){
        assigned[sub] = true;
        const used = new Set(Object.values(curWords).map(Number));
        const avail = content.guessWords.map((_, i) => i).filter(i => !used.has(i));
        const pick = avail.length ? avail[(Math.random() * avail.length) | 0]
                                  : (Math.random() * content.guessWords.length) | 0;
        roomUpdate("atelier/words", { [sub]: pick });
      }
      return;
    }
    if (iDraw){
      const entry = content.guessWords[idx] || "?";
      showSecret(String(entry).split("/")[0].trim());  // 1re variante au dessinateur
    }
  }

  // ── soumission d'une proposition (devineur) ─────────────
  function submitGuess(){
    if (solved) return;
    const sub = lastSub;
    if (!GUESS_SUBS.includes(sub)) return;
    const idx = curWords[sub];
    if (idx == null) return;                            // mot pas encore tire
    const entry = content.guessWords[idx] || "";
    if (accepts(dom.guessInput.value, entry)){
      solved = true;
      dom.guessFeedback.textContent = content.atelier.guessYes;
      if (fx) fx.celebrate();
      roomSet("atelier/sub", sub + 1);                 // on avance les deux
    } else {
      dom.guessFeedback.textContent = content.atelier.guessNo;
      dom.guessInput.value = "";
      dom.guessInput.focus();
      if (fx) fx.shake(dom.guessInput);
    }
  }

  return new Promise(resolve => {
    // init si la room ne connait pas encore l'atelier
    roomWatch("atelier", state => {
      if (!state){ roomSet("atelier", { sub:0, ready:{} }); return; }
      const sub = state.sub | 0;

      if (sub > LAST_SUB){ clearTimer(); resolve(); return; }

      // (re)rendu seulement quand le sub change
      if (sub !== lastSub){ lastSub = sub; render(sub); }

      curWords = state.words || {};

      // avancement "les deux prets" pour les manches a bouton.
      // sentinel -1 = "pas encore pret" (sinon le defaut 0 ferait
      // passer sub 0 instantanement, car 0 >= 0).
      const r = state.ready || {};
      const ra = Number.isInteger(r.ana)    ? r.ana    : -1;
      const rd = Number.isInteger(r.adrien) ? r.adrien : -1;
      if (sub <= 3 && ra >= sub && rd >= sub){
        roomSet("atelier/sub", sub + 1);
      }

      // manches de devinette : tirage + affichage du mot
      if (GUESS_SUBS.includes(sub)) applyWord(sub);
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
