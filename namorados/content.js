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
    portraitLeft:   "you draw on the LEFT side. only the face",
    portraitRight:  "you draw on the RIGHT side. only the face",
    portraitReveal: "you two, side by side",
    drawerRole:     "you draw. no words no letters",
    guesserRole:    "you guess, type what you see",
    guessYes:       "yes ! that is it",
    guessNo:        "nope... again",
  },

  // POOL de mots a dessiner. on en tire 6 au hasard pendant la soiree
  // (3 manches par personne), donc meme adrien ne sait pas lesquels
  // tomberont. chaque entree = plusieurs reponses valides separees par
  // " / " ; la 1re est celle montree au dessinateur. les articles
  // (le/la/un/the/o/um...) et une petite faute de frappe sont tolerees.
  guessWords: [
    "le métro / metro / subway / metrô",
    "un chat / chat / cat / gato / gatinho",
    "la plage / plage / beach / praia",
    "le soleil / soleil / sun / sol",
    "une rose / rose / rosa",
    "un coeur / coeur / cœur / heart / coracao",
    "la lune / lune / moon / lua",
    "un parapluie / parapluie / umbrella / guarda-chuva",
    "un poisson / poisson / fish / peixe",
    "une étoile / etoile / star / estrela",
    "une maison / maison / house / casa",
    "un oiseau / oiseau / bird / passaro",
    "un gâteau / gateau / cake / bolo",
    "une fleur / fleur / flower / flor",
    "un avion / avion / plane / aviao",
    "une montagne / montagne / mountain / montanha",
    "un café / cafe / coffee / kawa",
    "une guitare / guitare / guitar / violao",
    "un nuage / nuage / cloud / nuvem",
    "une clé / cle / key / chave",
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

  // au revoir : verif cote ana + bouton d'envoi cote adrien
  goodbyeAnaConfirm: "u are ana right ?",
  goodbyeAnaCheck:   "uh... ok. check you e mael",
  goodbyeAdrienBtn:  "send to ana",
  goodbyeAdrienSent: "sent. tell her to look uhu",

  // envoi auto de nos dessins (.png) par email a la toute fin.
  // <<< ADRIEN : colle l'URL du web app Apps Script ici (voir EMAIL_SETUP.md).
  // tant que c'est vide, rien n'est envoye (la soiree marche quand meme).
  mailEndpoint: "",
  mailTo: "adrien.etks@gmail.com",
  mailSubject: "nossos desenhos, dia dos namorados",
  mailMessage: "oi bonita! here is our little dia dos namorados drawings uhu",
};
