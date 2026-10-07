# Pitwall Atlas — globe F1 interactif

Projet perso, amateur (pas un produit) : globe 3D des circuits de F1 (saisons 2020 → en cours) : clic continent → zoom, clic circuit → fiche (tracé animé, résultat, graphique tour par tour, records, palmarès), replay animé de chaque saison. Vite + JavaScript (modules ES), sans framework. Données F1 récupérées au build (API Jolpica, OpenF1), jamais dans le navigateur.

Artifact : https://claude.ai/artifact/LrynXR8VouL1eJFWRg9Cjg — republier `dist-artifact/pitwall-atlas.html` sur CETTE url (paramètre `url`).

## Commandes

- `npm run dev` → http://localhost:5173 (rechargement à chaud). Aperçu : navigateur intégré sur cette adresse.
- `npm run donnees` → rafraîchit les API (Jolpica puis OpenF1 ; ~15 min la 1re fois, quelques secondes ensuite) et régénère `src/donnees/` (après chaque GP). Python : `python -m pip install -r requirements.txt`.
- `npm run lint` → ESLint (JS) + Ruff (Python). `npm run verifier` → cohérence textes/données (lancé automatiquement par les builds).
- `npm run build` → site statique `dist/`. `npm run build:artifact` → fichier unique pour l'Artifact.
- Mise à jour automatique : `.github/workflows/mise-a-jour.yml` (GitHub Actions, chaque jour à 6 h UTC) → données, lint, build ; commit des données seulement si un GP a été couru (`maj` = date du dernier GP couru). Hébergement : Vercel branché sur le dépôt (`vercel.json`), qui republie à chaque commit, sur le nom de domaine de l'utilisateur. L'Artifact claude.ai n'est pas mis à jour par ce circuit : le republier à la main.

## Architecture (où mettre quoi)

```
data/config.json         réglages des scripts (saisons, tolérances géo, URLs et pauses des API…)
data/i18n/<langue>.json  traductions des DONNÉES (noms de GP, préfixes des noms courts, champ du nom des pays)
data/circuits_meta.json  fiche de chaque circuit (noms, km, tours, virages, anecdote, tracé, code pays)
scripts/commun.py        chemins, config, lire/écrire JSON, http_json (réessais, 404 = vide) — partagé par tous les scripts
scripts/fetch_api.py     Jolpica → data/api/ · scripts/fetch_openf1.py OpenF1 → data/openf1/ (non versionné)
scripts/geo.py           Shapely : pays allégés, pays d'un circuit, résolution h3, tracé → SVG
scripts/courses.py       progression du championnat (replay) + positions tour par tour
scripts/donnees.py       orchestre tout → src/donnees/ (index, circuits, pays, saisons/, courses/)
scripts/verifier.mjs     contrôles de cohérence · scripts/artifact.mjs adapte le build au format Artifact

src/config/textes.<langue>.json  TOUS les textes de l'interface (t("cle"), data-t="cle" dans le HTML)
src/config/reglages.json         langue, durées, altitudes, couleurs du globe, cadrage des continents, dimensions
src/config/equipes.json          couleur de chaque écurie (clé = constructorId)
src/main.js            démarrage uniquement
src/etat.js            état + événements + actions. SEUL endroit qui modifie l'état
src/donnees.js         lecture des JSON + sélecteurs (mancheDuCircuit, mancheDeRound, manchesDuPays…)
src/globe/             scene.js (globe, caméra, vol()) · pays.js (hexagones, survol) · marqueurs.js (marqueurs, étiquettes, arcs)
src/ui/                entete · panneau · fiche · piste (tracé animé) · graphique-course · replay · decor (ciel, intro, annoncer())
src/lib/               i18n.js (t, traduirePage, dateCourte, nombre via Intl) · format.js (esc, pad, decompte, rejouer)
                       constantes.js (couleurEq, CONTINENTS, reglages, reduit, mobile, chaqueSeconde)
src/styles/            tokens.css (couleurs, polices de l'interface) + un .css par zone
```

Événements de `etat.js` : `saison`, `circuit`, `continent`, `survol`, `survolManches`, `vueGlobale`, `replay` (détail en tête du fichier).

## Règles de code (à chaque modification)

1. **Rien en dur** : texte affiché → `src/config/textes.<langue>.json` + `t()` ou `data-t` ; nombre de réglage, durée, couleur → `reglages.json` / `equipes.json` / `tokens.css` ; donnée F1 → `data/` puis build. Dates et nombres → `dateCourte()` / `nombre()` (Intl), jamais formatés à la main.
2. Flux à sens unique : un composant lit `etat`, s'abonne avec `ecouter()`, agit via une action de `etat.js`. Jamais un module qui touche le DOM d'un autre.
3. Pas de doublon : chercher d'abord dans `src/lib/`, `donnees.js` et `scripts/commun.py`. Ce qui sert deux fois y va.
4. Réutiliser l'existant : API du navigateur (Intl, IntersectionObserver…), bibliothèques de référence (Shapely, globe.gl) avant d'écrire du code maison.
5. Calculs lourds au build (`scripts/`), pas dans le navigateur.
6. Un fichier = une responsabilité, ~250 lignes max. Noms en français. Commentaires = le *pourquoi*.
7. Avant de livrer : `npm run lint` et `npm run build:artifact` (qui lance `verifier`) sans erreur.
8. Nouvelle dépendance : seulement si elle remplace du code maison ou est un standard (justifiée ici). Actuelles : globe.gl (3D), vite + vite-plugin-singlefile (build), eslint (contrôle JS), shapely (géométrie Python), ruff (contrôle Python).

## Ajouter une langue

`src/config/textes.<xx>.json` (copie traduite) + import dans `src/lib/i18n.js` (`TEXTES`) + `reglages.json → langue` ; côté données `data/i18n/<xx>.json` + `data/config.json → langue`, puis `npm run donnees`. `npm run verifier` signale toute clé manquante.

## Performance (budget à tenir)

- Poids : page initiale ≤ 750 Ko de code+données (hors librairie 3D, ~1,9 Mo en cache à part) ; Artifact ≤ 4 Mo. Vérifier après chaque build.
- Données : uniquement les champs affichés ; contours simplifiés au build ; saisons et courses chargées à la demande.
- Rendu : pas de `backdrop-filter` ni de filtre SVG animé ; résolution 3D plafonnée ; pause onglet caché ; surfaces invisibles en `visible: false`.
- Animations : CSS `transform`/`opacity` ; une boucle `requestAnimationFrame` par animation, arrêtée à la fermeture.

## Pièges connus (ne pas les redécouvrir)

- globe.gl : changer un accesseur (`hexPolygonColor`…) recalcule TOUTE la géométrie (≈ 2 s figé). Accesseurs posés une fois ; ensuite modifier directement les matériaux (`f.__threeObjHexPolygon.material`).
- Couche de survol : matériaux `depthWrite: false`, posée une seule fois sur les continents de toutes les saisons.
- Vols de caméra : toujours `vol()`, jamais `globe.pointOfView(pov, durée)` : globe.gl n'annule pas un vol en cours (saut visible).
- Clic sur un marqueur : le globe dessous reçoit aussi le clic ; `clicMarqueurRecent()` l'empêche de le traiter deux fois.
- Grand tour de saison : auto-rotation accélérée puis freinée (`tourDeGlobe`), la caméra prenant toujours le chemin le plus court.
- Artifact (fichier unique) : chargement à la demande impossible → alias `@chargement` ; noms de variables non minifiés (sinon faux positif « artifact-pr-review » du validateur) ; aucun appel réseau à l'exécution.
- `[hidden] { display: none !important }` dans base.css : sinon un composant `display: flex` reste visible malgré `hidden`.
- Hexagones : résolution 3, ou 4 pour un petit pays hôte (config) ; jamais plus fin.
- Le calendrier vient de l'API, jamais de la mémoire. Nouveau circuit → `data/circuits_meta.json` ; nouveau nom de GP → `data/i18n/fr.json` (le build liste les noms non traduits).
- Graphique tour par tour : 2023+ (OpenF1). OpenF1 garde des courses annulées sans données ; 404 = « aucune donnée ».
- Un circuit peut accueillir deux manches dans une saison (2020) : `cle` = `annee-round`. Liens directs : `#2024`, `#monaco`, `#2024-monaco`.
- Étiquettes : seulement face caméra (`majEtiquettes`, minuterie, car les vols ne passent pas par les contrôles).
- Replay : le vainqueur s'allume immédiatement dans le classement (classe `vainqueur`), les barres suivent en 0,6 s ; ne pas rallonger ces transitions au-delà de la montée de caméra.
- Tests navigateur : ne pas importer les modules depuis la console après un rechargement à chaud (doublons) ; recharger avec `?r=N`.

## Charte graphique

Carbone `#101016`, rouge `#e10600`, blanc ; secteurs S1 rouge / S2 bleu / S3 jaune. Titillium Web (900 italique majuscule pour les titres), Roboto Mono pour les chiffres. Thème sombre unique. Ease `cubic-bezier(.2,.8,.2,1)`, respecter `prefers-reduced-motion`. Utilisable à 400 px. S'inspirer des habillages TV F1 et des cartes connues (Google/Apple Plans) pour les interactions.

## Économie de tokens (pour Claude)

- Ne lire que le fichier concerné (le tableau ci-dessus dit lequel) ; jamais `src/donnees/` ni `data/` en entier — échantillonner.
- Modifier avec Edit ; pour un script de modification long, l'écrire dans un fichier (les heredocs complexes cassent le shell).
- Vérification : une capture + la console ; le panneau navigateur caché fige les animations : vérifier l'état par le DOM (classes, textes) plutôt qu'à l'œil.
- Une fonctionnalité = un commit (message en français), puis cocher `ROADMAP.md`. Toutes les 2-3 fonctionnalités : `/revue-archi`.
