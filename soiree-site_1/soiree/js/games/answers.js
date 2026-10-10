// ============================================================
// answers.js : tolerance des reponses tapees
// Reprise de namorados/js/rounds.js (juin) : casse, accents,
// ponctuation finale, articles en tete, une petite faute.
// Une entree peut contenir plusieurs reponses : "a / b / c".
// ============================================================

// distance d'edition (Levenshtein). Ecart de longueur > 1 : renvoie 2
// (on ne tolere jamais plus d'une faute, inutile de calculer)
export function editDist(a, b){
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 1) return 2;
  const dp = Array.from({ length:m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++){
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + c);
  }
  return dp[m][n];
}

export function norm(s){
  return String(s ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.,!?;:]+$/, "").replace(/\s+/g, " ");
}

// retire les articles en tete ("le metro" == "metro" == "the metro")
export function stripArticles(s){
  let out = s.replace(/'/g, " ").replace(/\s+/g, " ").trim();
  const ART = /^(le|la|les|l|un|une|des|the|a|an|o|os|as|um|uma)\s+/;
  while (ART.test(out)) out = out.replace(ART, "");
  return out;
}

// les reponses d'une entree, telles qu'ecrites (pour l'affichage)
export function listAnswers(entry){
  return String(entry ?? "").split("/").map(s => s.trim()).filter(Boolean);
}

export function accepts(input, entry){
  const raw = norm(input);
  if (!raw) return false;
  const guesses = [raw, stripArticles(raw)];
  const variants = String(entry ?? "").split("/").map(norm).filter(Boolean);
  return variants.some(v => {
    const targets = [v, stripArticles(v)];
    return targets.some(t => guesses.some(g =>
      g === t || (t.length > 3 && editDist(t, g) <= 1)   // une petite faute
    ));
  });
}
