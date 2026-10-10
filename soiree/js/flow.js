// ============================================================
// flow.js : ou en est la soiree, DEDUIT des deux couloirs
//
// dans chaque couloir :
//   flow.open = true                       pret a commencer
//   flow.s{n}.ready = true                 pret pour le tirage
//   flow.s{n}.done.A / .B = true           j'ai fini cette carte
//   flow.s{n}.after = "other" | "next"     apres la 1re carte
//
// resultat de derive() :
//   { phase:"opening" }
//   { phase:"intro", step, first, both }
//   { phase:"play",  step, opt, first, both, round:1|2 }
//   { phase:"after", step, opt, first, both, mine, theirs }
//   { phase:"end" }
// ============================================================
const other = o => (o === "A" ? "B" : "A");

export function derive(me, them, picks){
  const fm = (me && me.flow) || {}, ft = (them && them.flow) || {};
  if (!(fm.open && ft.open)) return { phase:"opening" };
  for (let s = 0; s < picks.length; s++){
    const a = fm["s" + s] || {}, b = ft["s" + s] || {};
    const { first, both } = picks[s];
    const second = other(first);
    const base = { step:s, first, both };
    if (!(a.ready && b.ready)) return { ...base, phase:"intro" };
    const done = (o) => !!((a.done || {})[o] && (b.done || {})[o]);
    if (!done(first)) return { ...base, phase:"play", opt:first, round:1 };
    if (!both){
      if (!(a.after && b.after && a.after === b.after)){
        return { ...base, phase:"after", opt:first, mine:a.after || null, theirs:b.after || null };
      }
      if (a.after === "next") continue;
    }
    if (!done(second)) return { ...base, phase:"play", opt:second, round:2 };
  }
  return { phase:"end" };
}

// pour la frise : 0 rien, 1 une carte faite, 2 les deux
export function stepMarks(me, them, picks){
  const fm = (me && me.flow) || {}, ft = (them && them.flow) || {};
  return picks.map((_, s) => {
    const a = (fm["s" + s] || {}).done || {}, b = (ft["s" + s] || {}).done || {};
    return ["A", "B"].filter(o => a[o] && b[o]).length;
  });
}
