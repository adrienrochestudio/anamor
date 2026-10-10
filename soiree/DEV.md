# soiree : notes de dev

Site statique (GitHub Pages), modules ES natifs, aucun build. Synchro par brokers MQTT publics, chiffrée (js/sync). Tout l'état est déduit de deux "couloirs" (un par personne, chacun n'écrit que dans le sien).

## Lancer et tester

- Serveur : `python3 -m http.server 8765` depuis la racine du repo.
- Deux fenêtres sans réseau : `soiree/index.html?me=ana&code=xyz&t=local` et `...?me=adrien&code=xyz&t=local`.
- `&jump=n` saute à l'étape n (0 à 7), `&force=A|B` impose la carte tirée.
- Harness Playwright : `tests/harness.py` (`two_pages(jump, force)` renvoie les pages ana, adrien et la liste d'erreurs console).
- Prépa : `soiree/prep.html?me=ana`. Chaque frappe est gardée dans le navigateur (IndexedDB + textes en double dans localStorage) puis déposée chiffrée dans la boîte de tino (`js/sync/box.js`, messages retenus sur les brokers, mot fixe `BOX_WORD`). Le soir, le jeu relit la boîte : la prépa peut être faite sur un autre appareil. La version la plus récente gagne (boîte ou navigateur de l'autre, date annoncée dans `prepUpdated`).

## Contrat d'une activité

Un module ES qui exporte `mount(ctx)` et renvoie éventuellement une fonction de nettoyage. Enregistré dans `js/activities.js`.

`ctx` :
- `el` : conteneur à remplir (vide au départ)
- `me`, `other` : "ana" | "adrien"
- `seed` : entier commun aux deux écrans (même code de soirée). Utiliser `seeded(ctx.seed, "nom", ...)` de `js/draw.js` pour tout hasard partagé.
- `step`, `stepId`, `opt` ("A"|"B"), `params` (voir activities.js)
- `content` (content.js), `prep` (MA prépa, voir prep-store.js), `sfx` (sound.js), `sky` (`sky.shower(n)`)
- `say(text)` : fait parler kompiuter (anglais cassé, minuscules)
- état partagé, espace de noms propre à l'activité :
  - `set(path, value)` : écrit dans MON couloir (chemin "a.b.c")
  - `get(who, path)` : lit le couloir de who
  - `onChange(cb)` : appelé à chaque changement d'un des deux couloirs
- flux non retenus (rapides, peuvent se perdre) : `send(kind, data)`, `onStream(kind, cb(data, from))`
- `request(owner, key)` : contenu de prépa de owner (promesse). Clés : `prep:jdg` (id youtube), `prep:photos` (liste {has, caption}), `prep:photo:0..4` ({src, caption}), `prep:text` ({kind:"mine"|"loved", body}, envoyé seulement quand le couloir de l'auteur a `share.text = true`), `prep:trivia` ([{q, a}]), `prep:lies` ([{s:[3], lie}], 2 manches) ; trivia : 5 questions
- `setGlobal(path, v)` : écrit hors de l'espace de noms (ex. `share.text`)
- `online(who)`, `markDone()`, `onCleanup(fn)`

Le bouton "done" de l'étape est géré par main.js. Les abonnements passés par ctx sont nettoyés automatiquement.

## Règles

- Jamais d'innerHTML avec du texte saisi : `h()` de `js/dom.js` ou textContent.
- Voix kompiuter : minuscules, anglais cassé et tendre, aucun emoji.
- Styles propres à un module : un `<style>` injecté une fois (id unique), classes préfixées par le nom du module.
- Couleurs : variables CSS de `css/soiree.css` (--night, --cream, --rose, --muted, --line, --ok, --ana, --adrien).
- Chaque écriture de couloir publie tout le couloir : éviter d'écrire à chaque mouvement de souris (utiliser `send` pour le temps réel).
