# Envoi auto des dessins par email (3 min, une seule fois)

A la fin de la soiree, tous nos dessins (.png) partent automatiquement
par email a `adrien.etks@gmail.com` avec le petit message du kompiuter.

Un site statique (GitHub Pages) ne peut pas envoyer d'email tout seul :
il faut un mini relais. Le plus simple et gratuit = un Google Apps
Script, sur ton compte Google. Voici les etapes.

## 1. Creer le script
1. Va sur https://script.google.com  -> "Nouveau projet".
2. Efface le code par defaut, colle ceci :

```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var atts = (data.images || []).map(function (img) {
    var b64 = img.dataUrl.split(',')[1];
    return Utilities.newBlob(Utilities.base64Decode(b64), 'image/png', img.name);
  });
  MailApp.sendEmail({
    to: data.to || 'adrien.etks@gmail.com',
    subject: data.subject || 'dia dos namorados',
    body: data.message || '',
    attachments: atts
  });
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Enregistre (icone disquette).

## 2. Deployer en "application web"
1. En haut a droite : **Deployer** -> **Nouveau deploiement**.
2. Roue dentee -> type **Application Web**.
3. Reglages :
   - Description : `namorados mail`
   - Executer en tant que : **moi (toi)**
   - Qui a acces : **Tout le monde**
4. **Deployer**. Google demande d'autoriser l'acces a Gmail -> accepte
   (c'est ton propre script qui enverra depuis ton compte).
5. Copie l'**URL de l'application web** (se termine par `/exec`).

## 3. Brancher le site
Dans `namorados/content.js`, colle l'URL dans `mailEndpoint` :

```js
mailEndpoint: "https://script.google.com/macros/s/AKfyc.../exec",
```

Commit + push (ou demande a Claude). C'est tout.

## Test
Fais une soiree complete a deux onglets jusqu'a l'ecran "au revoir".
Le mail part une seule fois (c'est l'onglet "adrien" qui l'envoie ;
un drapeau `mailSent` dans la room evite le double envoi / le renvoi
si on recharge). Verifie la boite `adrien.etks@gmail.com`.

Si `mailEndpoint` reste vide : aucun envoi, la soiree marche pareil.
