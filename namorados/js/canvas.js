// ============================================================
// canvas.js : moteur de toile partagee
//
// Segments normalises { x1,y1,x2,y2,color } dans [0..1], pousses
// dans RTDB sous  draw/{round}/{player}  (une cle par manche et par
// joueur). Coordonnees normalisees => ca s'adapte a tous les ecrans.
//
// Deux drapeaux decident ce qu'on AFFICHE pendant qu'on dessine
// (le reveal, lui, montre toujours tout) :
//   showOwn   : est-ce que je vois mon propre trait en direct ?
//   showOther : est-ce que je vois le trait de l'autre en direct ?
//
// Echo local immediat pour mon trait (reactif), l'autre arrive via
// onChildAdded. Au reveal on rejoue les deux tableaux memorises.
// ============================================================
import { db, ROOM } from "./firebase.js";
import { ref, push, onChildAdded, remove, get }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

export function createCanvas(canvasEl, me, other){
  const ctx = canvasEl.getContext("2d");

  let round = null;
  let flags = { showOwn:true, showOther:true };
  let region = null;          // {y0,y1} pour limiter ma zone (cadavre exquis)
  let locked = false;         // true = je ne peux pas dessiner (le devineur)
  let ghost = [];             // traits-exemple gris (disparaissent au 1er trait)
  let ghostGone = false;
  let ownSegs = [];           // mes segments (round courant)
  let otherSegs = [];         // segments de l'autre (round courant)
  let otherUnsub = null;
  let myColor = "#000", otherColor = "#000";
  let colorByName = { ana:"#000", adrien:"#000" };
  let drawing = false, last = null;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function fit(){
    const r = canvasEl.getBoundingClientRect();
    canvasEl.width  = Math.round(r.width  * DPR);
    canvasEl.height = Math.round(r.height * DPR);
    redraw();
  }
  window.addEventListener("resize", fit);

  function seg(s, color, width){
    ctx.strokeStyle = color;
    ctx.lineWidth = (width || 2.2) * DPR;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.x1 * canvasEl.width, s.y1 * canvasEl.height);
    ctx.lineTo(s.x2 * canvasEl.width, s.y2 * canvasEl.height);
    ctx.stroke();
  }

  function clearScreen(){ ctx.clearRect(0,0,canvasEl.width,canvasEl.height); }

  function redraw(){
    clearScreen();
    if (ghost.length && !ghostGone){
      ctx.save(); ctx.globalAlpha = 0.5;
      ghost.forEach(s => seg(s, "#c7bdb3", 4));   // exemple gris tres grossier
      ctx.restore();
    }
    if (flags.showOther) otherSegs.forEach(s => seg(s, otherColor));
    if (flags.showOwn)   ownSegs.forEach(s => seg(s, myColor));
  }

  // ── pointer ─────────────────────────────────────────────
  function pos(e){
    const r = canvasEl.getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width;
    let y = (e.clientY - r.top)  / r.height;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    if (region){
      if (region.y0 != null) y = Math.max(region.y0, Math.min(region.y1, y));
      if (region.x0 != null) x = Math.max(region.x0, Math.min(region.x1, x));
    }
    return { x, y };
  }
  function down(e){
    if (locked) return;
    if (ghost.length && !ghostGone){ ghostGone = true; redraw(); }  // l'exemple disparait des qu'on dessine
    drawing = true; last = pos(e);
  }
  function move(e){
    if (!drawing) return;
    const p = pos(e);
    const s = { x1:last.x, y1:last.y, x2:p.x, y2:p.y, color:myColor };
    ownSegs.push(s);
    if (flags.showOwn) seg(s, myColor);
    push(ref(db, `${ROOM}/draw/${round}/${me}`), s); // sync
    last = p;
  }
  function up(){ drawing = false; last = null; }

  canvasEl.addEventListener("pointerdown", down);
  canvasEl.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);

  // ── API ─────────────────────────────────────────────────
  return {
    fit,
    // accepte la map complete { ana, adrien } (de content.colors)
    setColors(map){
      colorByName = { ana: map.ana, adrien: map.adrien };
      myColor = colorByName[me];
      otherColor = colorByName[other];
    },

    // demarre une manche : reset visuel + ecoute du trait de l'autre
    startRound(roundKey, opts = {}){
      round = roundKey;
      flags = { showOwn: opts.showOwn !== false, showOther: !!opts.showOther };
      region = opts.region || null;
      locked = !!opts.locked;
      ghost = opts.ghost || []; ghostGone = false;
      ownSegs = []; otherSegs = [];
      if (otherUnsub){ otherUnsub(); otherUnsub = null; }
      clearScreen();
      fit();
      // recoit les traits de l'autre au fil de l'eau
      otherUnsub = onChildAdded(ref(db, `${ROOM}/draw/${round}/${other}`), snap => {
        const s = snap.val();
        if (!s) return;
        otherSegs.push(s);
        if (flags.showOther) seg(s, otherColor);
      });
    },

    // reveal : montre TOUT, en RELISANT les deux joueurs depuis la RTDB
    // (donc reload-safe : meme apres un refresh on reconstruit tout).
    //   "overlay"     -> les deux traits superposes (cadavre exquis)
    //   "side-by-side"-> ana a gauche, adrien a droite (portraits)
    async reveal(roundKey, mode = "overlay"){
      flags = { showOwn:true, showOther:true };
      if (otherUnsub){ otherUnsub(); otherUnsub = null; }
      fit();
      clearScreen();
      const [aSnap, dSnap] = await Promise.all([
        get(ref(db, `${ROOM}/draw/${roundKey}/ana`)),
        get(ref(db, `${ROOM}/draw/${roundKey}/adrien`))
      ]);
      const aSegs = snapList(aSnap), dSegs = snapList(dSnap);
      if (mode === "side-by-side"){
        const half = (segs, color, xOff) => segs.forEach(s => seg({
          x1: s.x1*0.5 + xOff, y1: s.y1, x2: s.x2*0.5 + xOff, y2: s.y2
        }, color));
        half(aSegs, colorByName.ana, 0);      // ana a gauche
        half(dSegs, colorByName.adrien, 0.5); // adrien a droite
      } else {
        aSegs.forEach(s => seg(s, colorByName.ana));
        dSegs.forEach(s => seg(s, colorByName.adrien));
      }
    },

    // efface la manche cote RTDB (avant de la rejouer / nettoyage)
    async wipeRound(roundKey){
      await remove(ref(db, `${ROOM}/draw/${roundKey}`));
    }
  };

  // transforme un snapshot RTDB (objet de push) en tableau de segments
  function snapList(snap){
    const v = snap.val();
    return v ? Object.keys(v).map(k => v[k]) : [];
  }
}
