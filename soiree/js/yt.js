// ============================================================
// yt.js : chargement unique de l'API IFrame YouTube
// ============================================================
let loading = null;

export function loadYT(){
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => { loading = null; reject(new Error("youtube api unreachable")); };
    document.head.appendChild(s);
    setTimeout(() => { if (!(window.YT && window.YT.Player)) reject(new Error("youtube api timeout")); }, 15000);
  });
  return loading;
}

// codes d'erreur YouTube : 101 / 150 = integration refusee par l'auteur
export const EMBED_REFUSED = new Set([101, 150, 153]);
