# F1Atlas 🏎️🌍

Un petit projet perso pour voir jusqu'où on peut aller avec un globe 3D et des données de Formule 1.

La planète tourne, on clique sur un circuit et on plonge dessus : tracé animé avec ses secteurs, résultat de la course, records, palmarès depuis 1950, et même le graphique des positions tour par tour. Il y a aussi un **replay** de chaque saison (2020 → aujourd'hui) où les points des pilotes montent pendant que la caméra fait le tour du calendrier.

Projet amateur, sans prétention : rien d'officiel, juste pour le plaisir.

> **Fait avec l'aide de l'IA.** Pour être transparent : ce projet a été développé avec l'assistance d'une IA (Claude, d'Anthropic), notamment pour les parties graphiques et 3D (le globe, les animations, le replay, les graphiques). Les idées, les choix de design et les tests sont les miens.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173.

## D'où viennent les données

- Résultats et classements : [Jolpica-F1](https://github.com/jolpica/jolpica-f1) (l'ancienne API Ergast)
- Positions tour par tour et arrêts aux stands : [OpenF1](https://openf1.org) (depuis 2023)
- Tracés des circuits : [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits)
- Carte du monde : [Natural Earth](https://www.naturalearthdata.com/)

Les données sont téléchargées et préparées à l'avance par des scripts Python (`scripts/`), puis embarquées dans le site. Pour les rafraîchir à la main :

```bash
python -m pip install -r requirements.txt
npm run donnees
```

## Mise en ligne et mise à jour automatique

Le site est fait pour **Vercel** (`vercel.json`) et se met à jour tout seul :

1. chaque matin, une GitHub Action (`.github/workflows/mise-a-jour.yml`) récupère les derniers résultats ;
2. s'il y a eu un Grand Prix, elle enregistre les nouvelles données dans le dépôt ;
3. Vercel voit le changement et republie le site.

Pour l'installer : envoyer le projet sur GitHub, l'importer dans Vercel (*Add New → Project*, tout est détecté), ajouter son nom de domaine dans *Settings → Domains*, puis lancer une première fois l'action depuis l'onglet *Actions* de GitHub (environ 15 minutes la première fois, quelques secondes ensuite).

## Petit tour du code

- `src/` : le site (globe, fiche, replay…) ; `src/config/` pour les textes, les couleurs et les réglages
- `scripts/` : téléchargement et préparation des données
- `data/` : sources (fiches des circuits, tracés, carte du monde) et cache des API

`npm run lint` vérifie le code, `npm run verifier` la cohérence des textes et des données.
