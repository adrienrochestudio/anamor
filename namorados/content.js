// ============================================================
// content.js : LE SEUL FICHIER QU'ADRIEN EDITE
//
// Toutes les paroles du kompiuter, les couleurs, les mots du jeu,
// les prompts de la capsule, et SURTOUT le message final.
// Voix : minuscules, anglais casse et tendre, fautes volontaires.
// zero emoji.
//
// guessWords : chaque entree peut avoir PLUSIEURS reponses valides
// separees par " / ". la premiere est celle montree au dessinateur.
// les articles (le, la, un, the, o, a...) sont ignores au controle,
// et une petite faute de frappe est toleree.
// ============================================================
export const content = {
  colors: { ana: "#c2452d", adrien: "#2d5fc2" },

  waiting: "i waite for you two...",
  opening: [
    "oh you both here now",
    "good. i was hopeing",
    "todaye is the special day i think",
    "happy dia dos namorados",
    "i made you some things, come →",
  ],

  // intros des manches (voix kompiuter)
  roundIntros: {
    exquis:   "first, we draw a monstre together. you the top, you the bottom, no peeking",
    portrait: "now you draw each other. but you not look at your own paper, only look at the face",
    guess:    "okae last one. one draws, one guesses, i give the secret worde",
  },

  // repliques de l'atelier (voix kompiuter)
  atelier: {
    roleTop:        "tu as la moitie du haut",
    roleBottom:     "tu as la moitie du bas",
    exquisReveal:   "there. the monstre you made",
    portraitRole:   "draw the face, dont look at your line",
    portraitReveal: "you two, side by side",
    drawerRole:     "you draw. no words no letters",
    guesserRole:    "you guess, type what you see",
    guessYes:       "yes ! that is it",
    guessNo:        "nope... again",
  },

  // mots a dessiner. variantes acceptees separees par " / "
  guessWords: [
    "le métro / metro / subway / train / o metro / metrô",
    "un chat / chat / cat / gato / gatinho / minou",
  ],

  // capsule : entrees ecrites par les deux ce soir
  capsulePrompts: [
    "un souvenir de nous",
    "une promesse",
    "une envie pour la prochaine fois qu'on se voit",
  ],
  capsuleLocked: "i keep this safe. it opens when ana put 10 new artistes on the musik page",

  // message final : ECRIT EN AMONT PAR ADRIEN, montre en live ce soir
  revealIntro: "okae. now i go quiet, he has somethin to say",
  finalMessage: "je t'aime, et ce n'est que le début !\n\nmon amour de toujours",

  // mot cache du kompiuter, revele a l'ouverture de la capsule sur musik
  capsuleSecret: "ps. he tell me one more secret to keep. every new song you add here, he go listen to it and think of you. so keep adding, i watch",

  goodbye: "okae lovebirds, that is all i made. enjoy your nigth. i be here tomorow",
};
