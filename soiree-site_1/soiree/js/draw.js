// ============================================================
// draw.js : hasard deterministe. Meme code de soiree = memes
// tirages des deux cotes, sans rien echanger.
// ============================================================
export function hash32(str){
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++){
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

// generateur pseudo-aleatoire (mulberry32), retourne des [0,1)
export function rng(seed){
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// un generateur propre a un usage : seeded(seed, "maze", 2)
export function seeded(seed, ...parts){ return rng(hash32(seed + ":" + parts.join(":"))); }

export function shuffle(arr, r){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const RARE_BOTH = 1 / 8;

// tirage d'une etape : quelle carte d'abord, et le cas rare
// ou le guide refuse de choisir (les deux sont imposees)
export function stepPick(seed, step, force){
  const r = seeded(seed, "pick", step);
  const both = r() < RARE_BOTH;
  let first = r() < 0.5 ? "A" : "B";
  if (force === "A" || force === "B") return { first:force, both:false };
  return { first, both };
}
