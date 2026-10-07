# Roadmap — Pitwall Atlas

Ordre = priorité. Mode automatique (`/loop` dans une session ouverte sur ce dossier) : prendre la première case vide,
l'implémenter en suivant CLAUDE.md, vérifier (`npm run dev` + navigateur intégré), `npm run build:artifact` et republier,
cocher ici avec une ligne de résultat, commit. Tâche bloquée : la marquer `[!]` avec la raison et passer à la suivante.

## Déjà fait

Globe 3D hexagonal · intro « feux de départ » · 7 saisons (2020 → en cours) depuis l'API · fiche circuit (tracé animé avec secteurs, résultat, records, palmarès, graphique tour par tour 2023+) · classements · replay de saison (caméra, annonce, tracé, podium, classement animé) · étiquettes façon habillage F1 · clic facile (zone large, clic aimanté) · optimisations (données allégées, rendu fluide) · architecture modulaire, textes et réglages hors du code · mise à jour automatique (GitHub Actions + Vercel). Détail : `git log`.

## À faire
- [ ] Mettre le projet sur GitHub, l'importer dans Vercel et ajouter le nom de domaine (voir README)
- [ ] Graphique tour par tour pour 2020-2022 (tours Jolpica, téléchargement étalé sur plusieurs heures)
- [ ] Vérifier/corriger la mise en page mobile (400 px) : globe, panneau saison en tiroir, fiche plein écran
- [ ] Sur le globe, dessiner le vrai tracé du circuit sélectionné (pathsData) quand on est zoomé très près
- [ ] Fiche : drapeau du pays dessiné en SVG/CSS (pas d'emoji, invisibles sous Windows)
- [ ] Fiche : record du tour (API `fastest/1` par circuit) et nombre de poles du roi des lieux
- [ ] Fiche : mini-graphique des positions de départ des vainqueurs (montre si on gagne depuis la pole ou pas sur ce circuit)
- [ ] Transitions : effet « vitesse » (traînées) pendant le vol de caméra vers un circuit
- [ ] Onglet Pilotes : clic sur un pilote → ses victoires 2026 mises en évidence sur le globe
- [ ] Recherche rapide (taper « mon » → Monaco)
- [ ] Sons optionnels (bouton) : bip de feux de départ, montée en régime à l'ouverture d'une fiche
- [ ] Ajouter les circuits historiques retirés (Imola, Bahreïn, Djeddah, Hockenheim…) en mode « Légendes », marqueurs gris
