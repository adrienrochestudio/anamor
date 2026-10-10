// ============================================================
// activities.js : quelle activite pour quelle carte
// cle "<id de l'etape>:<A|B>" (ids dans content.js)
//
// Contrat d'une activite : un module ES qui exporte
//   mount(ctx) -> fonction de nettoyage (optionnelle)
// ctx est decrit dans DEV.md.
// ============================================================
export const ACTIVITIES = {
  "escape:A":  { load:() => import("./steps/video.js"),     params:{ source:"museum", index:0 } },
  "escape:B":  { load:() => import("./steps/video.js"),     params:{ source:"museum", index:1 } },
  "geo:A":     { load:() => import("./steps/links.js"),     params:{ service:"worldguessr" } },
  "geo:B":     { load:() => import("./games/flags.js") },
  "draw:A":    { load:() => import("./steps/links.js"),     params:{ service:"skribbl" } },
  "draw:B":    { load:() => import("./games/guess-draw.js") },
  "love:A":    { load:() => import("./games/q36.js") },
  "love:B":    { load:() => import("./steps/souvenirs.js") },
  "play:A":    { load:() => import("./games/maze.js") },
  "play:B":    { load:() => import("./steps/links.js"),     params:{ service:"codenames" } },
  "letters:A": { load:() => import("./steps/letters.js"),   params:{ reader:"ana" } },
  "letters:B": { load:() => import("./steps/letters.js"),   params:{ reader:"adrien" } },
  "us:A":      { load:() => import("./steps/trivia.js") },
  "us:B":      { load:() => import("./steps/lies.js") },
  "finale:A":  { load:() => import("./steps/video.js"),     params:{ source:"jdg", owner:"ana" } },
  "finale:B":  { load:() => import("./steps/video.js"),     params:{ source:"jdg", owner:"adrien" } },
};
