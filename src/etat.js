/* État central de l'application. SEUL ce fichier modifie l'état ; les composants le lisent
   (`etat.xxx`), s'abonnent aux événements (`ecouter`) et agissent via les actions exportées.

   Événements :
   - "saison"   ({ premiere, rouvre })     nouvelle saison chargée
   - "circuit"  (manche | null, { revenir }) fiche ouverte / fermée
   - "continent" ()                         filtre de continent changé
   - "survol"   ({ continentChange })       pays survolé sur le globe
   - "survolManches" (manches[], oui, { defiler }) mise en évidence de manches (liste + marqueurs)
   - "vueGlobale" ()                        retour à la vue d'ensemble
   - "replay"   ("debut" | "etape" | "pause" | "fin" | "arret")  replay de saison (étape courante : etat.replay.index) */
import { chargerSaison, mancheDuCircuit, SAISON_EN_COURS } from "./donnees.js";
import { CONTINENTS, reglages } from "./lib/constantes.js";

export const etat = {
  saison: null,           // objet renvoyé par chargerSaison()
  continentFiltre: null,
  continentSurvole: null,
  paysSurvole: null,      // feature GeoJSON
  circuitActif: null,     // manche affichée dans la fiche
  replay: null,           // { index, pause, fini } pendant un replay de saison
};

const abonnes = new Map();
export function ecouter(evenement, fn) {
  if (!abonnes.has(evenement)) abonnes.set(evenement, []);
  abonnes.get(evenement).push(fn);
}
const emettre = (evenement, ...args) => (abonnes.get(evenement) || []).forEach(fn => fn(...args));

/* ---------- Actions ---------- */

export async function changerSaison(annee, { premiere = false } = {}) {
  arreterReplay();
  const ouvert = etat.circuitActif;
  const S = await chargerSaison(annee);
  fermerCircuit({ revenir: false });
  Object.assign(etat, { saison: S, continentFiltre: null, continentSurvole: null, paysSurvole: null });
  // Si la fiche d'un circuit était ouverte et que ce circuit existe aussi cette saison, on y reste
  const meme = ouvert && mancheDuCircuit(S, ouvert.id);
  emettre("saison", { premiere, rouvre: !!meme });
  majHash();
  if (meme) setTimeout(() => ouvrirCircuit(meme), 350);
}

export function ouvrirCircuit(manche) {
  // Déjà ouverte : ne rien relancer (deux vols de caméra simultanés se contrarient → saut visible)
  if (!manche || etat.circuitActif?.cle === manche.cle) return;
  arreterReplay();
  if (etat.continentFiltre && manche.continent !== etat.continentFiltre) {
    etat.continentFiltre = null;
    emettre("continent");
  }
  etat.circuitActif = manche;
  emettre("circuit", manche, {});
  majHash();
}

export function fermerCircuit({ revenir = true } = {}) {
  if (!etat.circuitActif) return;
  etat.circuitActif = null;
  emettre("circuit", null, { revenir });
  majHash();
}

/** Manche précédente / suivante du calendrier (flèches du clavier). */
export function circuitVoisin(delta) {
  const m = etat.saison.manches;
  const suivant = m[m.indexOf(etat.circuitActif) + delta];
  if (suivant) ouvrirCircuit(suivant);
}

export function choisirContinent(cont) {
  if (!CONTINENTS[cont]) return;
  etat.continentFiltre = etat.continentFiltre === cont ? null : cont;
  fermerCircuit({ revenir: false });
  emettre("continent");
}

export function vueGlobale() {
  etat.continentFiltre = null;
  fermerCircuit({ revenir: false });
  emettre("continent");
  emettre("vueGlobale");
}

/** Survol d'un pays du globe (null = rien). Les continents sans course cette saison sont ignorés. */
export function survolerPays(f) {
  if (f && !etat.saison.continents.includes(f.properties.c)) f = null;
  if (f === etat.paysSurvole) return;
  const avant = etat.continentSurvole;
  etat.paysSurvole = f;
  etat.continentSurvole = f ? f.properties.c : null;
  emettre("survol", { continentChange: avant !== etat.continentSurvole });
  emettre("survolManches", etat.saison.manches, false, {});
  if (f) emettre("survolManches", etat.saison.manches.filter(c => c.paysNE === f.properties.n), true, {});
}

export const survolerManches = (manches, oui, options = {}) => emettre("survolManches", manches, oui, options);

/* ---------- Replay de saison ----------
   Une étape par manche courue (classement après la course, voir progression dans donnees.js). */
let minuterieReplay;

export function lancerReplay() {
  if (!etat.saison.progression?.length) return;
  fermerCircuit({ revenir: false });
  etat.continentFiltre = null;
  emettre("continent");
  etat.replay = { index: -1, pause: false, fini: false };
  emettre("replay", "debut");
  avancerReplay();
}

function avancerReplay() {
  clearTimeout(minuterieReplay);
  const r = etat.replay;
  if (!r || r.pause) return;
  if (r.index >= etat.saison.progression.length - 1) {
    r.fini = true;
    return emettre("replay", "fin");
  }
  r.index++;
  emettre("replay", "etape");
  minuterieReplay = setTimeout(avancerReplay, reglages.replay.dureeEtape);
}

export function pauseReplay() {
  const r = etat.replay;
  if (!r || r.fini) return;
  r.pause = !r.pause;
  emettre("replay", "pause");
  if (!r.pause) avancerReplay();
}

export function arreterReplay() {
  if (!etat.replay) return;
  clearTimeout(minuterieReplay);
  etat.replay = null;
  emettre("replay", "arret");
}

/* ---------- Lien direct : #2024, #monaco, #2024-monaco ---------- */

export function lireHash() {
  const [, annee, circuit] = location.hash.slice(1).match(/^(\d{4})?-?([a-z_]+)?$/) || [];
  return { annee, circuit };
}

function majHash() {
  const parts = [];
  if (etat.saison.annee !== SAISON_EN_COURS) parts.push(etat.saison.annee);
  if (etat.circuitActif) parts.push(etat.circuitActif.id);
  try { history.replaceState(null, "", parts.length ? "#" + parts.join("-") : location.pathname + location.search); } catch { /* bac à sable */ }
}
