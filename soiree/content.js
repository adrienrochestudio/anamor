// ============================================================
// content.js : LE SEUL FICHIER QU'ADRIEN EDITE
//
// Voix du kompiuter : minuscules, anglais casse et tendre,
// fautes volontaires, zero emoji.
// Les contenus perso (photos, textes, trivia, mensonges, videos
// joueur du grenier) ne sont PAS ici : chacun les saisit dans
// soiree/prep.html, ils restent dans son navigateur.
// ============================================================
export const content = {

  // <<< ADRIEN : l'etape 1. A : la visite 360 (page web). B : la video.
  // video : lien youtube, ou lien direct vers un fichier .mp4 ;
  // vide = chacun choisit le fichier video sur son ordinateur
  museums: [
    { url: "https://www.timographie360.fr/visites/visite-virtuelle/grotte-lascaux/", label: "the lascaux cave" },
    { url: "", label: "philomena cunk" },
  ],

  // <<< ADRIEN : les videos de la finale (lien youtube). vide = celle de la prepa
  videos: {
    adrien: "https://www.youtube.com/watch?v=9Hb0A6NEXjY",
    ana: "",
  },

  // <<< ADRIEN : le mot secret de la salle. vide = chacun le tape a l'arrivee
  secretWord: "test",

  // <<< ADRIEN : la phrase secrete des 7 clics sur kompiuter
  secret7: "ok ok stop clicking me. secret : he talk about you all the time. all. the. time. dont tell him i said",

  // ── voix generale ─────────────────────────────────────────
  lines: {
    yawn:        "*yaaaawn* ... sorry. it is late for a kompiuter",
    who:         "who are you ?",
    code:        "type the secret word of tonight. the same word on both sides",
    opening: [
      "i am tino, the little brother of tina. tonigth i organise your evening",
      "eight stops for you two",
      "at each stop there is two choices",
      "you dont choose. a little friend choose for you",
      "but after, you can do the other one too. i am not a dictator",
      "ready ? →",
    ],
    readyBtn:    "ready",
    readyWait:   "waiting the other...",
    choosing:    "hmm... let me see...",
    refuse:      "it cannot choose. so you do both. sorry not sorry",
    launch:      "go",
    doneBtn:     "done",
    afterAsk:    "finish ? you can do the other one too, or go next",
    otherBtn:    "do the other one too",
    nextBtn:     "next",
    disagree:    "you two dont agree. talk on the phone and decide",
    goodbye:     "that was all the stops. thank you for coming in my little trip. good nigth you two",
    reconnect:   "connection is wobbly, i try again",
  },

  // ── prepa : tino se presente, c'est tout ───────────────────
  prep: {
    hello: "i am tino, the little brother of tina. tonigth i organise your evening",
  },

  // ── labyrinthe ────────────────────────────────────────────
  maze: {
    intro: "donald found oil in your maze, he wants your resources !",
    swap:  "now you swap",
    win:   "you saved the oil",
    timeout: "too slow. donald took the oil. again !",
    again: "play again",
  },

  // ── les etapes ────────────────────────────────────────────
  // guide : cle du personnage pixel (voir js/guides.js)
  steps: [
    {
      id: "escape", guide: "waiter", title: "escape",
      intro: "bon appetit",
      pick:  "the waiter put the plate on...",
      A: { title: "the lascaux cave" },
      B: { title: "philomena cunk" },
    },
    {
      id: "geo", guide: "pigeon", title: "geography",
      intro: "let's travel",
      pick:  "the pigeon peck...",
      A: { title: "worldguessr" },
      B: { title: "flags & capitals" },
    },
    {
      id: "draw", guide: "painter", title: "drawing",
      intro: "time to draw",
      pick:  "the painter point his brush at...",
      A: { title: "skribbl" },
      B: { title: "draw & guess" },
    },
    {
      id: "love", guide: "cupid", title: "romantic",
      intro: "romantic time",
      pick:  "the cupid aim...",
      A: { title: "3 questions" },
      B: { title: "souvenirs" },
    },
    {
      id: "play", guide: "gamepad", title: "play together",
      intro: "game time",
      pick:  "the gamepad press...",
      A: { title: "the dark maze" },
      B: { title: "codenames duet" },
    },
    {
      id: "letters", guide: "candle", title: "words",
      intro: "who read first ?",
      pick:  "the candle flame lean to...",
      A: { title: "ana read first" },
      B: { title: "adrien read first" },
    },
    {
      id: "us", guide: "detective", title: "us two",
      intro: "how well you know each other ?",
      pick:  "the detective look with his loupe at...",
      A: { title: "trivia" },
      B: { title: "two truths one lie" },
    },
    {
      id: "finale", guide: "projectionist", title: "finale",
      intro: "last stop",
      pick:  "the projectionist take the reel...",
      A: { title: "ana's video" },
      B: { title: "adrien's video" },
    },
  ],

  // ── dessine-devine : pool de juin + nouveaux mots ─────────
  // chaque entree = plusieurs reponses valides separees par " / ",
  // la 1re est montree au dessinateur. articles et petite faute toleres.
  guessWords: [
    "homer simpson / homer / simpson",
    "neymar / ney / neymar jr",
    "un chat sur un vélo / chat vélo / chat a velo / cat on a bike / chat sur velo",
    "harry potter / harry / potter",
    "la tour eiffel / tour eiffel / eiffel / eiffel tower",
    "dark vador / darth vader / vador / vader",
    "une licorne / licorne / unicorn / unicornio",
    "un dinosaure / dinosaure / dino / dinosaur / dinossauro",
    "super mario / mario",
    "une pizza volante / pizza volante / flying pizza / pizza qui vole",
    "batman / the batman",
    "un robot amoureux / robot amoureux / robot in love / robot",
    "un chat astronaute / chat astronaute / space cat / chat dans l'espace",
    "cristiano ronaldo / ronaldo / cr7 / cristiano",
    "une banane qui danse / banane qui danse / dancing banana / banane danse",
    "spiderman / spider man / araignée",
    "le roi lion / roi lion / lion king / simba",
    "un poulet géant / poulet géant / poulet geant / giant chicken / gros poulet",
    "la joconde / joconde / mona lisa",
    "un pingouin amoureux / pingouin amoureux / penguin in love / pingouin",
    // nouveaux
    "un flamant rose / flamant rose / flamant / flamingo",
    "un pastel de nata / pastel de nata / pasteis de nata / pastel / nata",
    "un azulejo / azulejo / azulejos / carreau / carrelage",
    "un tramway / tramway / tram / bonde / eletrico",
    "le christ rédempteur / christ redempteur / cristo redentor / christ / corcovado",
    "un ananas / ananas / pineapple / abacaxi",
    "une sirène / sirene / mermaid / sereia",
    "un fantôme / fantome / ghost / fantasma",
    "une montgolfière / montgolfiere / hot air balloon / balao",
    "un escargot / escargot / snail / caracol",
    "un bonhomme de neige / bonhomme de neige / snowman / boneco de neve",
    "un vampire / vampire / vampiro / dracula",
    "un phare / phare / lighthouse / farol",
    "une sardine / sardine / sardinha",
    "un hamster / hamster",
  ],
};
