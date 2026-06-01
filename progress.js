/* ============================================================
   progress.js — Ana & Adrien · the kompiuter
   Système de progression partagé : joueur (Ana / Adrien / invité)
   + scores par jeu et par catégorie + barre dépliable à 3 niveaux.

   À inclure sur chaque page, AVANT le script de la page :
       <script src="progress.js"></script>

   API publique (window.AAProgress) :
       AAProgress.getPlayer()                     -> 'ana' | 'adrien' | 'invite' | null
       AAProgress.setPlayer(id)                   change le joueur actif
       AAProgress.openSelect()                    rouvre l'écran "qui joue ?"
       AAProgress.report(game, cat, value)        enregistre un score (garde le meilleur)
       AAProgress.get(game, cat)                  -> score actuel du joueur actif
       AAProgress.isDone(game, cat)               -> true si la catégorie est au max
       AAProgress.reset(playerId?)                remet à zéro un joueur (défaut: actif)

   `cat` accepte une clé ('geo', 'sport'...) OU un index (pratique
   pour les crosswords : AAProgress.report('crosswords', currentGrid, 1)).
   ============================================================ */
(function () {
  'use strict';

  // ── CONFIG : source unique de vérité ───────────────────────
  // Les clés de catégories doivent correspondre à celles passées
  // par les pages de jeu. Pour crosswords, l'ORDRE doit suivre le
  // tableau GRIDS de la page mots-croisés.
  var STORE_KEY = 'aa-progress-v1';

  var PLAYERS = [
    { id: 'ana',    label: 'Ana' },
    { id: 'adrien', label: 'Adrien' },
    { id: 'invite', label: 'invité' }
  ];

  var GAMES = [
    {
      key: 'trivia',
      label: 'trivia',
      cats: [
        { key: 'geo',    label: 'géo',        max: 20 },
        { key: 'fr',     label: 'culture FR', max: 20 },
        { key: 'br',     label: 'culture BR', max: 20 },
        { key: 'sport',  label: 'sport',      max: 20 },
        { key: 'cine',   label: 'cinéma',     max: 20 },
        { key: 'archi',  label: 'archi',      max: 20 },
        { key: 'perso',  label: 'persos',     max: 20 },
        { key: 'invent', label: 'inventions', max: 20 },
        { key: 'estim',  label: 'estimation', max: 20 }
      ]
    },
    {
      key: 'crosswords',
      label: 'krowz wourd',
      cats: [
        { key: 'cliches',  label: 'clichés',     max: 1 },
        { key: 'insultes', label: 'insultes',    max: 1 },
        { key: 'cinema',   label: 'cinéma',      max: 1 },
        { key: 'histoire', label: 'histoire',    max: 1 },
        { key: 'art',      label: 'art & archi', max: 1 },
        { key: 'chanson',  label: 'chanson FR',  max: 1 },
        { key: 'saudade',  label: 'saudade',     max: 1 },
        { key: 'auvergne', label: 'Auvergne',    max: 1 },
        { key: 'minas',    label: 'Minas',       max: 1 },
        { key: 'paris',    label: 'Paris',       max: 1 }
      ]
    }
     ,
{
  key: 'langues',
  label: 'learn lagagne',
  cats: [
    { key: 'pt', label: 'português', max: 100 },
    { key: 'fr', label: 'français',  max: 100 }
  ]
}
  ];

  // ── STORAGE (localStorage si dispo, sinon mémoire) ──────────
  var mem = null;
  function rawGet() {
    try { var v = localStorage.getItem(STORE_KEY); if (v) return JSON.parse(v); } catch (e) {}
    return mem;
  }
  function rawSet(obj) {
    mem = obj;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) {}
  }
  function blankPlayer() {
    var o = {}; GAMES.forEach(function (g) { o[g.key] = {}; }); return o;
  }
  function load() {
    var s = rawGet();
    if (!s || typeof s !== 'object') s = { active: null, data: {} };
    if (!s.data) s.data = {};
    PLAYERS.forEach(function (p) {
      if (!s.data[p.id]) s.data[p.id] = {};
      GAMES.forEach(function (g) { if (!s.data[p.id][g.key]) s.data[p.id][g.key] = {}; });
    });
    return s;
  }
  function save() { rawSet(state); }
  var state = load();

  // ── CALCUL DES POURCENTAGES ─────────────────────────────────
  function findGame(k) { for (var i = 0; i < GAMES.length; i++) if (GAMES[i].key === k) return GAMES[i]; return null; }
  function resolveCat(game, cat) {
    if (typeof cat === 'number') return game.cats[cat] || null;
    for (var i = 0; i < game.cats.length; i++) if (game.cats[i].key === cat) return game.cats[i];
    return null;
  }
  function catValue(pid, gkey, ckey) {
    var g = state.data[pid] && state.data[pid][gkey];
    return (g && typeof g[ckey] === 'number') ? g[ckey] : 0;
  }
  function gamePct(pid, game) {
    if (!game.cats.length) return 0;
    var s = 0;
    game.cats.forEach(function (c) { s += Math.min(1, catValue(pid, game.key, c.key) / c.max); });
    return s / game.cats.length;
  }
  function generalPct(pid) {
    if (!GAMES.length) return 0;
    var s = 0; GAMES.forEach(function (g) { s += gamePct(pid, g); });
    return s / GAMES.length;
  }
  function pctTxt(p) { return Math.round(p * 100) + '%'; }
  function playerLabel(id) {
    for (var i = 0; i < PLAYERS.length; i++) if (PLAYERS[i].id === id) return PLAYERS[i].label;
    return '?';
  }

  // ── API PUBLIQUE ────────────────────────────────────────────
  var API = {
    getPlayer: function () { return state.active; },
    setPlayer: function (id) {
      if (!state.data[id]) return;
      state.active = id; save(); hideSelect(); render();
    },
    openSelect: function () { showSelect(); },
    report: function (gameKey, cat, value) {
      if (!state.active) return;
      var game = findGame(gameKey); if (!game) return;
      var c = resolveCat(game, cat); if (!c) return;
      var v = Math.max(0, Math.min(c.max, value));
      if (v > catValue(state.active, gameKey, c.key)) {  // on ne garde que le meilleur
        state.data[state.active][gameKey][c.key] = v; save();
      }
      render();
    },
    get: function (gameKey, cat) {
      if (!state.active) return 0;
      var game = findGame(gameKey); if (!game) return 0;
      var c = resolveCat(game, cat); if (!c) return 0;
      return catValue(state.active, gameKey, c.key);
    },
    isDone: function (gameKey, cat) {
      var game = findGame(gameKey); if (!game) return false;
      var c = resolveCat(game, cat); if (!c) return false;
      return this.get(gameKey, c.key) >= c.max;
    },
    reset: function (playerId) {
      var id = playerId || state.active; if (!id) return;
      state.data[id] = blankPlayer(); save(); render();
    }
  };
  window.AAProgress = API;

  // ── STYLES (reprend les variables du site, avec valeurs de repli) ──
  var CSS =
'#aap-root,#aap-select{font-family:"Patrick Hand",cursive;}' +
'#aap-root{position:fixed;top:14px;right:14px;z-index:9000;' +
  '--b:var(--bord,#8B1A2B);--bl:var(--bord-l,#e3d9cf);--w:var(--blanc,#FAF8F4);--m:var(--muted,#9a8f84);color:var(--m);}' +
'.aap-bar{display:flex;align-items:center;gap:8px;background:var(--w);border:1.5px solid var(--bl);' +
  'padding:6px 10px;cursor:pointer;color:var(--m);font-family:inherit;font-size:.8rem;transition:all .15s;}' +
'.aap-bar:hover{border-color:var(--b);color:var(--b);}' +
'.aap-bar .aap-who{color:var(--b);white-space:nowrap;}' +
'.aap-track{width:84px;height:6px;background:var(--bl);position:relative;}' +
'.aap-fill{position:absolute;inset:0 auto 0 0;width:0%;background:var(--b);transition:width .4s;}' +
'.aap-pct{font-size:.74rem;white-space:nowrap;}.aap-caret{font-size:.7rem;}' +
'.aap-panel{display:none;position:absolute;right:0;top:calc(100% + 8px);width:284px;max-width:86vw;' +
  'background:var(--w);border:1.5px solid var(--b);padding:14px;box-shadow:4px 4px 0 var(--bl);}' +
'#aap-root.open .aap-panel{display:block;}' +
'.aap-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;}' +
'.aap-head .aap-pl{color:var(--b);font-size:1.05rem;}' +
'.aap-switch{background:none;border:none;font-family:inherit;font-size:.78rem;color:var(--m);cursor:pointer;text-decoration:underline;padding:0;}' +
'.aap-switch:hover{color:var(--b);}' +
'.aap-glabel{display:flex;justify-content:space-between;font-size:.82rem;color:var(--m);margin-bottom:4px;}' +
'.aap-glabel strong{color:var(--b);}' +
'.aap-bigtrack{height:8px;background:var(--bl);margin-bottom:8px;}' +
'.aap-bigfill{height:100%;width:0%;background:var(--b);transition:width .4s;}' +
'.aap-game{border-top:1px solid var(--bl);padding:8px 0;}' +
'.aap-ghead{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.86rem;color:var(--m);}' +
'.aap-ghead:hover{color:var(--b);}.aap-ghead .aap-gname{color:var(--b);}' +
'.aap-ghead .aap-gpct{margin-left:auto;font-size:.78rem;}' +
'.aap-gcaret{font-size:.66rem;transition:transform .15s;}.aap-game.open .aap-gcaret{transform:rotate(180deg);}' +
'.aap-cats{display:none;flex-direction:column;gap:5px;margin:8px 0 2px;}' +
'.aap-game.open .aap-cats{display:flex;}' +
'.aap-cat{display:grid;grid-template-columns:78px 1fr 34px;align-items:center;gap:7px;font-size:.72rem;color:var(--m);}' +
'.aap-cat.done .aap-cn{color:var(--b);}' +
'.aap-cn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
'.aap-cb{height:5px;background:var(--bl);position:relative;}' +
'.aap-cb span{position:absolute;inset:0 auto 0 0;background:var(--b);width:0%;}' +
'.aap-cv{text-align:right;font-size:.7rem;}' +
'#aap-select{position:fixed;inset:0;z-index:9500;display:none;align-items:center;justify-content:center;' +
  'background:var(--bord,#8B1A2B);}' +
'#aap-select.show{display:flex;}' +
'.aap-sel-card{text-align:center;padding:30px;color:var(--blanc,#FAF8F4);max-width:90vw;}' +
'.aap-sel-q{font-size:clamp(1.8rem,6vw,3rem);margin-bottom:6px;}' +
'.aap-sel-sub{font-size:.9rem;opacity:.8;margin-bottom:26px;}' +
'.aap-sel-btns{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}' +
'.aap-sel-btn{font-family:"Patrick Hand",cursive;font-size:1.2rem;padding:14px 30px;cursor:pointer;' +
  'background:transparent;color:var(--blanc,#FAF8F4);border:1.5px solid var(--blanc,#FAF8F4);transition:all .15s;}' +
'.aap-sel-btn:hover{background:var(--blanc,#FAF8F4);color:var(--bord,#8B1A2B);}' +
'.aap-sel-btn.guest{opacity:.85;border-style:dashed;}' +
'@media(max-width:600px){.aap-track{display:none;}.aap-panel{width:262px;}}';

  // ── DOM ─────────────────────────────────────────────────────
  var rootEl, barEl, panelEl, selEl;
  var openGames = {};

  function buildDOM() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

    rootEl = document.createElement('div');
    rootEl.id = 'aap-root';
    rootEl.innerHTML =
      '<button class="aap-bar" type="button">' +
        '<span class="aap-who"></span>' +
        '<span class="aap-track"><span class="aap-fill"></span></span>' +
        '<span class="aap-pct">0%</span>' +
        '<span class="aap-caret">&#9662;</span>' +
      '</button>' +
      '<div class="aap-panel"></div>';
    document.body.appendChild(rootEl);
    barEl = rootEl.querySelector('.aap-bar');
    panelEl = rootEl.querySelector('.aap-panel');

    barEl.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!state.active) { showSelect(); return; }
      rootEl.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (rootEl && !rootEl.contains(e.target)) rootEl.classList.remove('open');
    });

    selEl = document.createElement('div');
    selEl.id = 'aap-select';
    var btns = '';
    PLAYERS.forEach(function (p) {
      btns += '<button class="aap-sel-btn' + (p.id === 'invite' ? ' guest' : '') +
              '" data-id="' + p.id + '">' + p.label + '</button>';
    });
    selEl.innerHTML =
      '<div class="aap-sel-card">' +
        '<div class="aap-sel-q">qui joue ?</div>' +
        '<div class="aap-sel-sub">le score est gardé séparément pour chacun, bah</div>' +
        '<div class="aap-sel-btns">' + btns + '</div>' +
      '</div>';
    document.body.appendChild(selEl);
    selEl.querySelectorAll('.aap-sel-btn').forEach(function (b) {
      b.addEventListener('click', function () { API.setPlayer(b.dataset.id); });
    });
    // clic sur le fond : ne ferme que si un joueur est déjà choisi
    selEl.addEventListener('click', function (e) {
      if (e.target === selEl && state.active) hideSelect();
    });
  }

  function showSelect() { if (selEl) selEl.classList.add('show'); }
  function hideSelect() { if (selEl) selEl.classList.remove('show'); }

  function render() {
    if (!rootEl) return;
    var active = state.active;
    var who = rootEl.querySelector('.aap-who');
    var fill = rootEl.querySelector('.aap-fill');
    var pct = rootEl.querySelector('.aap-pct');

    if (!active) {
      who.textContent = 'qui joue ?'; fill.style.width = '0%'; pct.textContent = '';
      panelEl.innerHTML = ''; return;
    }

    var gp = generalPct(active);
    who.textContent = playerLabel(active);
    fill.style.width = pctTxt(gp);
    pct.textContent = pctTxt(gp);

    var html =
      '<div class="aap-head">' +
        '<span class="aap-pl">' + playerLabel(active) + '</span>' +
        '<button class="aap-switch" type="button" data-act="switch">changer de joueur</button>' +
      '</div>' +
      '<div class="aap-glabel"><span>progression générale</span><strong>' + pctTxt(gp) + '</strong></div>' +
      '<div class="aap-bigtrack"><div class="aap-bigfill" style="width:' + pctTxt(gp) + '"></div></div>';

    GAMES.forEach(function (g) {
      var gpct = gamePct(active, g);
      var isOpen = !!openGames[g.key];
      html += '<div class="aap-game' + (isOpen ? ' open' : '') + '">' +
        '<div class="aap-ghead" data-act="toggle" data-game="' + g.key + '">' +
          '<span class="aap-gname">' + g.label + '</span>' +
          '<span class="aap-gpct">' + pctTxt(gpct) + '</span>' +
          '<span class="aap-gcaret">&#9662;</span>' +
        '</div><div class="aap-cats">';
      g.cats.forEach(function (c) {
        var v = catValue(active, g.key, c.key);
        var cp = Math.min(1, v / c.max);
        var done = v >= c.max;
        var valTxt = c.max === 1 ? (done ? '&#10003;' : '&#9675;') : (v + '/' + c.max);
        html += '<div class="aap-cat' + (done ? ' done' : '') + '">' +
          '<span class="aap-cn">' + c.label + '</span>' +
          '<span class="aap-cb"><span style="width:' + pctTxt(cp) + '"></span></span>' +
          '<span class="aap-cv">' + valTxt + '</span></div>';
      });
      html += '</div></div>';
    });

    panelEl.innerHTML = html;
    panelEl.querySelector('[data-act="switch"]').addEventListener('click', function (e) {
      e.stopPropagation(); showSelect();
    });
    panelEl.querySelectorAll('[data-act="toggle"]').forEach(function (h) {
      h.addEventListener('click', function (e) {
        e.stopPropagation();
        var k = h.getAttribute('data-game');
        openGames[k] = !openGames[k];
        rootEl.classList.add('open');
        render();
      });
    });
  }

  function init() { buildDOM(); render(); if (!state.active) showSelect(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
