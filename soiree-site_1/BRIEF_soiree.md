# BRIEF soirée à distance - the kompiuter

Point de situation
- Chantier : soirée romantique à distance avec Ana, appel WhatsApp sur téléphone, site ouvert sur les deux Mac.
- Sous-chantier : brief final à valider avant construction.
- Ensemble : nouvelle section de the kompiuter, dossier anamor/soiree/. Construction, tests et mise en ligne par Claude après validation.

## 1. Décisions validées

- Emplacement : anamor/soiree/, GitHub Pages, sans Firebase.
- Langue : anglais cassé en minuscules, voix kompiuter, aucun emoji.
- Synchro : temps réel par relais MQTT public, messages chiffrés.
- Préparation : chacun saisit sa part avant, dans une page prépa.
- Tirage : le guide de l'étape choisit.
- Personnages : kompiuter (narrateur) + un guide par étape. Pas d'avatars.
- Esthétique : nuit étoilée.
- Easter eggs : 7 clics sur kompiuter, tirage rare 1/8, Konami, minuit.
- Sons chiptune : oui.
- Construction : Claude code, teste à deux fenêtres, pousse dans anamor.

## 2. Déroulé

Accueil
- Un seul lien : adrienrochestudio.github.io/anamor/soiree/
- Écran "who are you" : ana / adrien.
- Code de soirée : un mot que vous vous dites à l'oral. Il sert de mot de passe de chiffrement et de nom de salle.
- Présence : deux points, allumés quand chacun est connecté.
- kompiuter ouvre la soirée quand les deux sont là.

Mécanique d'une étape
1. le guide entre en scène, kompiuter présente les deux cartes
2. chacun clique "ready"
3. quand les deux sont prêts, le guide hésite puis choisit une carte (animation propre à chaque guide)
4. la carte choisie se retourne des deux côtés, bouton de lancement
5. "done", puis "do the other one too?" ou "next"

Règles communes
- Tirage déterministe : calculé depuis le code de soirée et le numéro d'étape. Même résultat des deux côtés.
- 1 chance sur 8 : le guide refuse de choisir, les deux cartes sont imposées.
- Frise en haut : 8 cases. Une étape faite en double reçoit une étoile en plus.
- Durée estimée : environ 3 h sans refaire d'option.

## 3. Étapes

Étape 1, évasion (repas). Guide : le serveur.
- A : vidéo musée 1. B : vidéo musée 2. Liens YouTube fournis par Adrien dans content.js.
- Lecteur intégré synchronisé : lecture, pause et avance partagées, correction d'écart toutes les 5 s.

Étape 2, géographie. Guide : le pigeon voyageur.
- A, WorldGuessr : bouton qui ouvre worldguessr.com dans un nouvel onglet. L'hôte crée la partie privée et colle le code dans le site. Le code s'affiche chez l'autre avec un bouton "copier".
- B, duel drapeaux et capitales : 10 questions, alternance "quel pays a ce drapeau" / "capitale de...", 4 réponses, mêmes questions des deux côtés. 1 point par bonne réponse, +1 au plus rapide. Score en direct, révélation finale.
- Drapeaux : bibliothèque flag-icons (SVG, licence MIT) via jsDelivr.

Étape 3, dessin. Guide : le peintre.
- A, Skribbl.io : bouton d'ouverture, lien de salle privée collé et transmis.
- B, dessine-devine de juin : 6 manches, 3 chacun, dessinateur alterné. Mot tiré dans le pool de content.js. Tolérance des articles et d'une faute de frappe (code de juin repris). Trait envoyé par paquets toutes les 50 ms.

Étape 4, romantique. Guide : le cupidon.
- A, 36 questions : 3 cartes, une par série, de la plus légère à la plus intime. Tirées au sort, retournées ensemble. Questions réécrites en anglais kompiuter.
- B, souvenirs : 5 photos chacun (prépa). Affichage en alternance chez les deux, l'auteur de la photo passe à la suivante.

Étape 5, jeu à deux. Guide : la manette.
- A, labyrinthe coop : labyrinthe généré depuis le code de soirée. L'un voit le plan entier, l'autre ne voit que les cases autour de lui et avance aux flèches, guidé à la voix. 2 niveaux, rôles inversés au niveau 2. Sortie : une étoile.
- B, Codenames Duet : bouton d'ouverture de codenames.game, lien de salle transmis.

Étape 6, romantique. Guide : la bougie.
- Chacun a écrit un texte en prépa : lettre ou poème, au choix.
- A : ana lit en premier. B : adrien lit en premier. "do the other one too" : le second lit.
- Le lecteur voit son texte en mode prompteur. Après lecture, le texte apparaît chez l'autre, téléchargeable en image.

Étape 7, nous deux. Guide : le détective.
- A, trivia : les 10 questions de l'autre (prépa). Réponse en texte libre, même tolérance que le dessine-devine. L'auteur peut valider à la main ("ok that counts"). Score.
- B, deux vérités un mensonge : 3 tours chacun (prépa). L'autre vote, révélation animée.

Finale. Guide : le projectionniste.
- A et B : les deux vidéos Joueur du Grenier de content.js. Même lecteur synchronisé qu'à l'étape 1.
- Fin : écran d'au revoir sous le ciel étoilé.

Repli vidéos : si une vidéo refuse l'intégration, compte à rebours 3-2-1 puis ouverture sur YouTube des deux côtés. La prépa d'Adrien teste les 4 liens et signale ceux qui bloquent.

## 4. Préparation (soiree/prep.html)

- Une page par personne, choisie au premier écran.
- Contenu stocké seulement dans le navigateur de la personne (IndexedDB). Jamais dans le repo, jamais visible par l'autre avant le soir.
- À saisir : 5 photos (légende facultative), un texte (lettre ou poème), 10 questions trivia avec réponses acceptées, 3 tours de deux vérités un mensonge.
- Photos réduites à 1280 px, JPEG.
- Jauge "ready at X %".
- Export / import d'un fichier de sauvegarde. Raison : Safari peut vider le stockage d'un site non visité depuis 7 jours. La prépa doit être faite sur le Mac et le navigateur du soir.
- Le soir, au moment de l'étape, le navigateur de l'auteur envoie son contenu chiffré à l'autre.

## 5. Easter eggs et sons

- 7 clics sur kompiuter : il rougit, bugge, affiche la phrase secrète de content.js.
- Tirage rare : 1 chance sur 8, le guide refuse de choisir.
- Code Konami : pluie d'étoiles filantes chez les deux.
- Après minuit heure de Paris : kompiuter bâille, ses textes s'écrivent plus lentement.
- Sons chiptune générés en direct (Web Audio, aucun fichier) : tirage, carte qui se retourne, bonne réponse, erreur, clic. Bouton muet en haut.

## 6. Esthétique

- Fond bleu nuit uni, étoiles qui scintillent, rares étoiles filantes.
- Patrick Hand, minuscules, traits 3 px, légères rotations des cartes, aucun emoji.
- Texte crème #FAF8F4, bordeaux éclairci pour les accents.
- Ni dégradés lumineux ni halos.
- kompiuter : sprites existants. Constat à la lecture du repo : ils sont dessinés au trait, pas en pixel art. Les versions au trait blanc (3.png, 5.png, 7.png) servent sur le fond de nuit.
- Guides et étoiles en pixel art (P1).

## 7. Architecture technique

Synchro
- Brokers MQTT publics en WebSocket sécurisé, sans compte : HiveMQ, EMQX, Mosquitto.
- Connexion simultanée aux trois. Chaque message est publié sur les trois, les doublons sont ignorés. Un broker en panne ne coupe rien.
- Salle : identifiant dérivé du hash du code de soirée.
- Chiffrement : AES-GCM 256, dérivé du code de soirée par PBKDF2. Les brokers ne voient que du chiffré.
- État unique de la soirée : chaque action est un événement numéroté, les deux écrans appliquent le même réducteur.
- Dernier état retenu sur les brokers : un rechargement reprend où vous en étiez.
- Photos : découpées en morceaux de 48 Ko, réassemblées à l'arrivée.
- Transport interchangeable : MQTT en vrai, BroadcastChannel pour tester à deux onglets sans réseau.

Sécurité
- Aucun contenu perso dans le repo public ni dans l'URL.
- Tout texte reçu est affiché en textContent, jamais injecté en HTML.
- Messages reçus validés (forme, taille) avant application.
- Identifiants YouTube contrôlés par expression régulière.
- Politique de sécurité de contenu (balise meta) : scripts, connexions et cadres limités aux domaines utilisés.
- Dépendances figées à une version précise (mqtt.js, flag-icons).

Reprise du code de juin
- canvas.js et la logique de devinette de rounds.js (accepts, editDist) sont repris. Seule la couche Firebase est remplacée par la couche de synchro.

## 8. Arborescence

```
anamor/
  BRIEF_soiree.md        ce document
  soiree/
    index.html           la soirée
    prep.html            la préparation
    content.js           seul fichier édité par Adrien
    css/soiree.css
    js/
      main.js            démarrage, identité, routeur d'étapes
      draw.js            tirage déterministe + 1/8
      kompiuter.js       voix, machine à écrire, 7 clics, minuit
      guides.js          dessins et animations des guides
      sky.js             ciel étoilé, étoiles filantes, Konami
      sound.js           sons chiptune
      player.js          lecteur YouTube synchronisé
      prep-store.js      stockage local, export, import
      share.js           envoi chiffré du contenu de prépa
      sync/
        transport-mqtt.js
        transport-local.js
        crypto.js
        room.js          état partagé, réducteur, présence
      steps/             un fichier par étape (step1.js ... finale.js)
      games/
        flags.js  flags-data.js  maze.js  q36.js
        guess-draw.js  canvas.js   (repris de juin)
```

## 9. Ce que chacun fournit

Adrien, dans content.js
- 2 liens YouTube musée (étape 1)
- 2 liens YouTube Joueur du Grenier (finale, voir P2)
- mots du dessine-devine (voir P3)
- phrase secrète des 7 clics
- relecture des répliques kompiuter (Claude rédige une première version)

Adrien et Ana, dans la prépa
- photos, texte, trivia, deux vérités un mensonge

Le soir
- le code de soirée, dit à l'oral

## 10. Tests et mise en ligne

- Tests automatisés : tirage identique des deux côtés, réducteur, chiffrement aller-retour, découpage des photos, tolérance des réponses.
- Test complet à deux fenêtres (?me=ana / ?me=adrien) en transport local, puis avec les brokers réels.
- Push sur une branche soiree, fusion dans main après ton accord.
- Répétition conseillée quelques jours avant : connexion test à deux, pour vérifier la prépa d'Ana et la connexion depuis son réseau.

## 11. Points tranchés

- P1 Guides et étoiles : pixel art.
- P2 Vidéos JdG : une chacun via la prépa.
- P3 Mots du dessine-devine : pool de juin + nouveaux mots.
- P4 Accès : lien direct seulement, rien sur l'accueil the kompiuter.
- P5 Soirée : samedi 10 octobre 2026, Ana à Porto.

## 12. Suite

- Tu valides ce brief et tranches P1 à P5.
- Construction en une fois, message dès le premier résultat testable.
- Tu remplis content.js, Ana et toi remplissez la prépa, répétition, soirée.
