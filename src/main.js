// Point d'entrée : charge les styles et les modules (chacun s'abonne à l'état), puis démarre.
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/intro.css";
import "./styles/entete.css";
import "./styles/panneau.css";
import "./styles/globe.css";
import "./styles/fiche.css";
import "./styles/replay.css";

import { traduirePage } from "./lib/i18n.js";
import { etat, changerSaison, choisirContinent, lireHash, ouvrirCircuit } from "./etat.js";
import { ANNEES, SAISON_EN_COURS, mancheDuCircuit } from "./donnees.js";
import { placerDepart, volArrivee } from "./globe/scene.js";
import { poserPays } from "./globe/pays.js";
import "./globe/marqueurs.js";
import { feuxDeDepart } from "./ui/decor.js";
import "./ui/entete.js";
import "./ui/panneau.js";
import "./ui/fiche.js";
import "./ui/replay.js";

traduirePage();   // textes fixes du HTML (data-t)
const { annee, circuit } = lireHash();
await changerSaison(ANNEES.includes(annee) ? annee : SAISON_EN_COURS, { premiere: true });
placerDepart();
setTimeout(poserPays, 60);   // laisse la page s'afficher avant le calcul des hexagones

feuxDeDepart(() => {
  volArrivee();
  if (circuit) setTimeout(() => ouvrirCircuit(mancheDuCircuit(etat.saison, circuit)), 900);
});

// Échap sans fiche ouverte : retire le filtre de continent
addEventListener("keydown", e => { if (e.key === "Escape" && !e.defaultPrevented && etat.continentFiltre) choisirContinent(etat.continentFiltre); });
