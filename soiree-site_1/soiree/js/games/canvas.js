// ============================================================
// canvas.js : planche a dessin (vue seule, aucune synchro)
//
// Segments normalises { x1,y1,x2,y2 } dans [0..1] (4 decimales) :
// le meme dessin s'affiche a l'identique quelle que soit la taille
// de l'ecran. La planche garde sa propre liste pour se redessiner
// au redimensionnement (DPR compris).
//
//   const b = createBoard(canvasEl, { onStroke(seg) {} })
//   b.show(segs, color)   remplace tout et redessine
//   b.add(segs)           ajoute et peint
//   b.setDrawable(bool)   souris, trackpad, doigt, stylet
//   b.fit()  b.destroy()
// ============================================================
const r4 = v => Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4;

export function createBoard(canvas, { onStroke } = {}){
  const g = canvas.getContext("2d");
  let list = [], color = "#222", drawable = false;
  let pid = null, last = null, dpr = 1;

  function fit(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const hh = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== hh){ canvas.width = w; canvas.height = hh; }
    redraw();
  }

  function paint(segs){
    if (!segs.length) return;
    const W = canvas.width, H = canvas.height;
    g.strokeStyle = color;
    g.lineWidth = Math.max(2 * dpr, W * 0.007);   // epaisseur relative : meme rendu partout
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    for (const s of segs){
      const x1 = s.x1 * W, y1 = s.y1 * H, y2 = s.y2 * H;
      let x2 = s.x2 * W;
      if (x1 === x2 && y1 === y2) x2 += 0.01;      // un simple clic laisse un point
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
    }
    g.stroke();
  }

  function redraw(){
    g.clearRect(0, 0, canvas.width, canvas.height);
    paint(list);
  }

  // ── saisie ───────────────────────────────────────────────
  function pos(e){
    const b = canvas.getBoundingClientRect();
    return {
      x: r4((e.clientX - b.left - canvas.clientLeft) / (canvas.clientWidth || 1)),
      y: r4((e.clientY - b.top - canvas.clientTop) / (canvas.clientHeight || 1)),
    };
  }
  function stroke(s){
    list.push(s);
    paint([s]);
    if (onStroke) onStroke(s);
  }
  function down(e){
    if (!drawable || pid !== null || e.button > 0) return;
    e.preventDefault();
    pid = e.pointerId;
    try { canvas.setPointerCapture(pid); } catch {}
    last = pos(e);
    stroke({ x1:last.x, y1:last.y, x2:last.x, y2:last.y });
  }
  function move(e){
    if (e.pointerId !== pid || !last) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of (evs.length ? evs : [e])){
      const p = pos(ev);
      if (p.x === last.x && p.y === last.y) continue;
      stroke({ x1:last.x, y1:last.y, x2:p.x, y2:p.y });
      last = p;
    }
  }
  function up(e){
    if (e.pointerId === pid){ pid = null; last = null; }
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("lostpointercapture", up);
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => fit()) : null;
  if (ro) ro.observe(canvas);
  window.addEventListener("resize", fit);
  fit();

  return {
    fit,
    show(segs, c){
      list = segs.slice();
      if (c) color = c;
      redraw();
    },
    add(segs){
      for (const s of segs) list.push(s);
      paint(segs);
    },
    setDrawable(v){
      drawable = !!v;
      canvas.style.cursor = drawable ? "crosshair" : "default";
      if (!drawable){ pid = null; last = null; }
    },
    destroy(){
      if (ro) ro.disconnect();
      window.removeEventListener("resize", fit);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
    },
  };
}
