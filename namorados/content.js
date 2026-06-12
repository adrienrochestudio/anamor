// ============================================================
// content.js — LE SEUL FICHIER QU'ADRIEN EDITE
//
// Toutes les paroles du kompiuter, les couleurs, les mots du jeu,
// les prompts de la capsule, et SURTOUT le message final.
// Voix : minuscules, anglais cassé et tendre. zero emoji.
// ============================================================
export const content = {
  colors: { ana: "#c2452d", adrien: "#2d5fc2" },

  waiting: "i wait for you two...",
  opening: [
    "oh. you both here now.",
    "good. i was hoping.",
    "today is the special day i think",
    "happy dia dos namorados",
    "i made you some things. come →",
  ],

  // intros des manches (voix kompiuter)
  roundIntros: {
    exquis:   "first. we draw a monster together. you the top, you the bottom. no peeking.",
    portrait: "now. you draw each other. but you not look at your own paper. only look at the face.",
    guess:    "okae last one. one draws, one guesses. i give the secret word.",
  },
  // mots a dessiner pour la manche "dessine-devine"
  guessWords: ["saudade", "le metro", "un chat", "la plage", "le soleil", "un coeur"],

  // capsule — entrees ecrites par les deux ce soir
  capsulePrompts: [
    "un souvenir de nous",
    "une promesse",
    "une envie pour la prochaine fois qu'on se voit",
  ],
  capsuleLocked: "i keep this safe. it opens when ana put 10 new artists on the musik page.",

  // message final — ECRIT EN AMONT PAR ADRIEN, montre en live ce soir
  revealIntro: "okae. now i go quiet. he has something to say.",
  finalMessage: "je t'aime, et ce n'est que le début !",

  // mot cache optionnel, revele a l'ouverture de la capsule sur musik
  capsuleSecret: "",

  goodbye: "okae lovebirds. that is all i made. enjoy your night. i be here tomorrow.",
};
