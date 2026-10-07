---
description: Revue d'architecture du projet (à lancer toutes les 2-3 fonctionnalités)
---

Fais une revue d'architecture de F1 Atlas par rapport à la section « Architecture et règles de code » de CLAUDE.md.

1. Regarde ce qui a changé depuis la dernière revue : `git log --oneline` et `git diff` depuis le commit dont le message commence par « revue-archi » (ou les 5 derniers commits s'il n'y en a pas).
2. Sur ces fichiers seulement (pas tout le projet), cherche :
   - du code dupliqué ou presque (à déplacer dans `src/lib/` ou dans un sélecteur de `donnees.js`) ;
   - un composant qui modifie le DOM ou l'état d'un autre au lieu de passer par `etat.js` ;
   - des couleurs/polices en dur hors de `tokens.css` ;
   - des fichiers de plus de ~300 lignes, des fonctions de plus de ~50 lignes ;
   - du code mort, des calculs faits dans le navigateur qui devraient l'être au build.
3. Corrige directement ce qui est sûr et mécanique ; pour le reste, liste-le en 3 à 6 points concrets (fichier:ligne, problème, correction proposée) et demande avant de toucher.
4. Vérifie que la page fonctionne toujours (build + aperçu, console sans erreur), mets à jour CLAUDE.md si une règle a évolué, puis commit avec un message commençant par « revue-archi : ».

Réponse courte : ce qui a été corrigé, ce qui reste proposé.
