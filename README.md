# Gestion Auto-École — version 2.0

Application complète de gestion d'auto-école, utilisable **hors ligne** et **installable** sur ordinateur (Windows, macOS, Linux), tablette et téléphone (Android, iPhone, iPad).

## Fonctions

| Domaine | Ce que fait l'application |
|---|---|
| Tableau de bord | Chiffres clés, liste « À traiter » : examens proches, assurances et visites techniques qui expirent, vidanges, paiements en retard, dossiers incomplets, conflits de planning |
| Apprenants | Dossier numéroté automatiquement (AE-2026-0001), photo, identité complète, pièces du dossier, statut, recherche et filtres, export Excel |
| Paiements | Encaissements avec reçus numérotés (R-2026-00001), montant en lettres, relevé de compte, reste à payer |
| Livret d'apprentissage | 19 compétences en 4 étapes, notées de « Non abordé » à « Acquis » |
| Documents imprimables | Fiche d'inscription, contrat de formation, attestation de formation, reçu, relevé de compte, liste des candidats, planning de la semaine (impression ou PDF) |
| Planning | Vue par semaine, filtre par moniteur, détection des conflits (moniteur, véhicule ou apprenant déjà occupé), mise à jour du kilométrage |
| Examens | Sessions code, plateau ou conduite, candidats, résultats ; le statut de l'apprenant suit automatiquement |
| Moniteurs | Fiches, catégories enseignées, autorisation d'enseigner avec alerte d'expiration, heures du mois |
| Véhicules | Parc, état, kilométrage, échéances d'assurance, de visite technique et de vidange, coûts par véhicule |
| Finances | Dépenses par catégorie, encaissements, résultat mensuel et annuel, graphique sur 12 mois, exports |
| Rapports | Inscriptions par mois et par catégorie, taux de réussite par épreuve, activité des moniteurs |
| Code de la route | 13 leçons, 53 panneaux dessinés, entraînement de 10 questions, **examen blanc de 40 questions chronométré** |
| Paramètres | Identité et logo de l'école, devise, sauvegarde et restauration, code d'accès, thème clair ou sombre, installation |

## Contenu du dossier

```
www/        Version installable (PWA) : à mettre en ligne pour l'installer sur tous les appareils
electron/   Version bureau : fabrique les installateurs .exe, .dmg, .AppImage, .deb
dist/       Version en ligne partagée (page unique)
src/        Code source (à modifier, puis lancer « python3 build.py »)
```

## Installer sur tous les appareils (méthode recommandée)

La version `www/` doit être hébergée sur une adresse **https**. Ensuite, chaque appareil l'installe en un clic.

### 1. Mettre en ligne (gratuit)

**Option A : Netlify Drop (le plus simple)**
1. Ouvrez https://app.netlify.com/drop
2. Glissez-déposez le dossier `www` (ou le fichier `autoecole-pwa.zip` décompressé).
3. Netlify vous donne une adresse du type `https://nom-au-hasard.netlify.app`.

**Option B : GitHub Pages**
1. Créez un dépôt GitHub et envoyez-y ce dossier.
2. Dans le dépôt : Settings › Pages › Source : « GitHub Actions ».
3. Le fichier `.github/workflows/site.yml` publie automatiquement `www/` à chaque envoi.

### 2. Installer l'application

| Appareil | Comment faire |
|---|---|
| Windows, macOS, Linux | Ouvrez l'adresse dans **Chrome** ou **Edge**, puis cliquez sur l'icône d'installation dans la barre d'adresse (ou menu ⋮ › « Installer Gestion Auto-École »). L'application apparaît dans le menu Démarrer, le Dock ou le lanceur. |
| Android (téléphone, tablette) | Chrome › menu ⋮ › « Installer l'application ». |
| iPhone, iPad | **Safari** › bouton Partager › « Sur l'écran d'accueil ». |

Une fois installée, l'application s'ouvre dans sa propre fenêtre et fonctionne **sans connexion internet**.

## Version bureau classique (.exe, .dmg, .AppImage, .deb)

Les installateurs Linux sont déjà fabriqués dans `electron/dist/` :
- `Gestion-Auto-Ecole-2.0.0-linux-x86_64.AppImage` : rendre exécutable puis double-cliquer.
- `Gestion-Auto-Ecole-2.0.0-linux-amd64.deb` : `sudo apt install ./Gestion-Auto-Ecole-2.0.0-linux-amd64.deb`

Pour Windows et macOS, deux possibilités :

**Automatique avec GitHub (recommandé)** : envoyez le dossier sur GitHub, puis onglet Actions › « Installateurs » › « Run workflow ». Au bout d'environ 10 minutes, téléchargez :
- Windows : `Gestion-Auto-Ecole-2.0.0-win-x64.exe` (installateur)
- macOS : `Gestion-Auto-Ecole-2.0.0-mac-*.dmg`
- Linux : `.AppImage` et `.deb`

**Sur votre propre ordinateur** (Node.js 20 requis) :

```bash
cd electron
npm install
npm run dist
```

Les fichiers sont créés dans `electron/dist/` pour le système de l'ordinateur utilisé.

> Les installateurs ne sont pas signés numériquement. Au premier lancement, Windows peut afficher « Windows a protégé votre ordinateur » : cliquez sur « Informations complémentaires » › « Exécuter quand même ». Sur macOS : clic droit sur l'application › « Ouvrir ». Une signature officielle nécessite un certificat de développeur payant.

## Données et sauvegardes

- Les données sont enregistrées **sur l'appareil** (base IndexedDB du navigateur ou de l'application). Elles ne quittent jamais l'appareil.
- Chaque appareil a donc ses propres données. Pour passer d'un appareil à un autre : Paramètres › « Télécharger une sauvegarde », puis « Restaurer une sauvegarde » sur l'autre appareil.
- **Faites une sauvegarde au moins une fois par semaine**, et conservez-la sur une clé USB ou un service de stockage.
- Un code d'accès peut protéger l'ouverture de l'application (Paramètres › Code d'accès).

Pour que plusieurs postes travaillent en même temps sur les **mêmes** données, il faut un serveur central (synchronisation en ligne). La version en ligne partagée (`dist/`) le fait déjà, via le lien claude.ai.

## Modifier l'application

1. Modifiez les fichiers de `src/` :
   - `data.js` : panneaux, leçons, questions, catégories, compétences
   - `core.js` : stockage et calculs
   - `views.js` : écrans
   - `dialogs.js` : formulaires et documents
   - `styles.css` : apparence
2. Lancez `python3 build.py` (Python 3 et la bibliothèque Pillow sont requis).
3. Pour que les appareils déjà installés reçoivent la nouvelle version, changez `VERSION` dans `build.py` et `APP_VERSION` dans `src/core.js`, puis remettez `www/` en ligne.

## Protection : mot de passe d'installation et licences

### Mot de passe d'installation
- **Windows** : l'installateur demande le mot de passe avant d'installer.
- **macOS et Linux** : le mot de passe est demandé au premier lancement de l'application.
- Le mot de passe n'est **jamais écrit dans le dépôt**. Il est lu dans le secret GitHub `AE_INSTALL_PASSWORD` au moment de la fabrication :
  1. Dépôt GitHub › Settings › Secrets and variables › Actions › **New repository secret**.
  2. Name : `AE_INSTALL_PASSWORD` · Secret : votre mot de passe.
  3. Relancez « Installateurs » dans l'onglet Actions.
- Pour changer le mot de passe : modifiez le secret, puis relancez « Installateurs ».

### Période d'essai et licence
- L'application fonctionne librement pendant **30 jours** (réglable dans `src/licence-config.js`, avec vos coordonnées de vente).
- Ensuite, un écran « Période d'essai terminée » bloque l'accès. Il affiche l'**identifiant de l'appareil** (ex. `AE-1A01-9E26-4D12`) et permet d'importer un fichier de licence `.lic`. Les données ne sont jamais effacées, et une sauvegarde reste possible.
- Le client peut aussi activer sa licence avant la fin de l'essai : Paramètres › Licence.

### Créer une licence pour un client
1. Le client vous envoie l'identifiant de son appareil.
2. Ouvrez `tools/generateur-licence.html` dans Chrome ou Edge (fonctionne sans internet).
3. Chargez votre clé privée `cle-privee.json`.
4. Remplissez le nom du client, l'école et l'identifiant de l'appareil, puis choisissez une licence définitive ou un abonnement avec date de fin.
5. Le fichier `.lic` est téléchargé : envoyez-le au client (e-mail, WhatsApp, clé USB).

En ligne de commande : `node tools/generer-licence.mjs --client "Nom" --ecole "École" --appareil AE-XXXX-XXXX-XXXX [--expire 2027-12-31]`

### La clé privée : à protéger absolument
- Le fichier `cle-privee.json` permet de créer des licences. **Ne le mettez jamais sur GitHub et ne le partagez pas.** Le dossier `cles/` est exclu du dépôt.
- Gardez-en deux copies, par exemple une clé USB et un stockage personnel. Si vous la perdez, vous ne pourrez plus créer de licences pour les versions déjà installées.
- Pour changer de clé : `node tools/creer-cles.mjs --force`, puis reconstruisez l'application. Les anciennes licences ne seront alors plus acceptées par les nouvelles versions.

### Limites à connaître
- Les licences sont signées : sans votre clé privée, impossible d'en fabriquer une fausse ou de modifier une vraie.
- Le mot de passe d'installation et la période d'essai restent des protections dissuasives. Une personne très expérimentée peut les contourner, comme pour la plupart des logiciels installés localement.
- Si l'appareil est réinitialisé, ou si les données de l'application sont effacées, son identifiant change : il faut alors délivrer une nouvelle licence.
