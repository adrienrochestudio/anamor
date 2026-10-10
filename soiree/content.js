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

  // <<< ADRIEN : les 2 videos musee de l'etape 1 (lien youtube complet)
  museums: [
    { url: "", label: "museum one" },
    { url: "", label: "museum two" },
  ],

  // <<< ADRIEN : la phrase secrete des 7 clics sur kompiuter
  secret7: "ok ok stop clicking me. secret : he talk about you all the time. all. the. time. dont tell him i said",

  // ── voix generale ─────────────────────────────────────────
  lines: {
    yawn:        "*yaaaawn* ... sorry. it is late for a kompiuter",
    who:         "who are you ?",
    code:        "type the secret word of tonight. the same word on both sides",
    codeHelp:    "you say it to each other on the phone. i use it to lock everything",
    waiting:     "i waite for the other one...",
    opening: [
      "oh you both here now",
      "tonight i made you a little trip. eight stops",
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
    offline:     "the other one is not here... i wait",
    reconnect:   "connection is wobbly, i try again",
  },

  // ── prepa ─────────────────────────────────────────────────
  prep: {
    hello:    "hello. this is the preparashion room",
    private:  "you fill your part. the other cannot see it, promise. it stay in this computer until tonight",
    save:     "do the save file too. browsers forget things sometimes. i dont",
    done:     "all ready. i am proud uhu",
    sameMac:  "important : do it on the mac and the browser you use tonight",
  },

  // ── les etapes ────────────────────────────────────────────
  // guide : cle du personnage pixel (voir js/guides.js)
  steps: [
    {
      id: "escape", guide: "waiter", title: "escape",
      intro: "bon appetit. while you eat, i take you somewhere. the waiter choose where",
      pick:  "the waiter put the plate on...",
      A: { title: "museum one", desc: "a walk in a museum, together" },
      B: { title: "museum two", desc: "another museum, another walk" },
    },
    {
      id: "geo", guide: "pigeon", title: "geography",
      intro: "now we travel more. the pigeon know the world, he choose",
      pick:  "the pigeon peck...",
      A: { title: "worldguessr", desc: "dropped somewhere in the world. where are you ? private game for you two" },
      B: { title: "flags & capitals", desc: "a duel. 10 questions. fastest one get a bonus" },
    },
    {
      id: "draw", guide: "painter", title: "drawing",
      intro: "time to draw. the painter choose the brush",
      pick:  "the painter point his brush at...",
      A: { title: "skribbl", desc: "the classic. you draw, the other guess, in a private room" },
      B: { title: "draw & guess", desc: "like dia dos namorados. i give the secret words" },
    },
    {
      id: "love", guide: "cupid", title: "romantic",
      intro: "okae now it get romantic. the cupid shoot (he is not very good)",
      pick:  "the cupid aim...",
      A: { title: "3 questions", desc: "three questions to fall in love. a bit more deep each time" },
      B: { title: "souvenirs", desc: "5 photos each. one story for each photo" },
    },
    {
      id: "play", guide: "gamepad", title: "play together",
      intro: "game time. the little gamepad choose",
      pick:  "the gamepad press...",
      A: { title: "the dark maze", desc: "one see the map, the other walk in the dark. talk to find the star" },
      B: { title: "codenames duet", desc: "words and spies. you win together or lose together" },
    },
    {
      id: "letters", guide: "candle", title: "words",
      intro: "you both wrote something. the candle decide who read first",
      pick:  "the candle flame lean to...",
      A: { title: "ana read first", desc: "ana read out loud. adrien listen" },
      B: { title: "adrien read first", desc: "adrien read out loud. ana listen" },
    },
    {
      id: "us", guide: "detective", title: "us two",
      intro: "how well you know each other ? the detective investigate",
      pick:  "the detective look with his loupe at...",
      A: { title: "trivia", desc: "10 questions about the other. no cheating" },
      B: { title: "two truths one lie", desc: "find the lie. three times each" },
    },
    {
      id: "finale", guide: "projectionist", title: "finale",
      intro: "last stop. joueur du grenier. the projectionist load the film",
      pick:  "the projectionist take the reel...",
      A: { title: "ana's video", desc: "the one ana choose" },
      B: { title: "adrien's video", desc: "the one adrien choose" },
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
