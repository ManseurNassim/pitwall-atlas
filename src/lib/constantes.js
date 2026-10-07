// Référentiels partagés lus dans la configuration : couleurs d'écurie, cadrage des continents, préférences de l'appareil.
import equipes from "../config/equipes.json";
import reglages from "../config/reglages.json";

export { reglages };
export const couleurEq = id => equipes[id] || equipes._defaut;

/** Cadrage caméra de chaque continent (le nom affiché vient des textes : t(`continents.${nom}`)). */
export const CONTINENTS = reglages.continents;

export const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const mobile = () => innerWidth <= reglages.mobileMax;

/** Une seule horloge pour tous les comptes à rebours de la page. */
const tic = new Set();
setInterval(() => tic.forEach(fn => fn()), 1000);
export const chaqueSeconde = fn => tic.add(fn);
