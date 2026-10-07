// Accès aux données (générées par scripts/donnees.py) et sélecteurs. Aucun état ici : que des lectures.
import circuits from "./donnees/circuits.json";
import pays from "./donnees/pays.json";
import index from "./donnees/index.json";
// « @chargement » : fichiers à la demande sur le site, tout embarqué dans l'Artifact (voir vite.config.js)
import { lireSaison, lireCourse } from "@chargement";

export { circuits, pays };
export const ANNEES = index.saisons;
export const SAISON_EN_COURS = index.enCours;
export const MAJ = index.maj;
export const HOTES_TOUS = new Set(index.hotes);
export const CONTINENTS_TOUS = new Set(index.continents);

/** Charge une saison et la prépare pour l'affichage. */
export async function chargerSaison(annee) {
  const brut = await lireSaison(annee);
  const manches = brut.courses.map(r => {
    const c = { ...circuits[r.id], ...r, cle: `${annee}-${r.round}` };
    c.debut = new Date(`${c.date}T${c.heure || "14:00:00Z"}`);
    c.fini = !!c.vainqueur;
    return c;
  });
  const prochain = manches.find(c => !c.fini) || null;
  if (prochain) prochain.next = true;

  // Un marqueur par circuit : un circuit peut accueillir deux manches dans la même saison (2020)
  const parId = new Map();
  for (const c of manches) {
    if (!parId.has(c.id)) parId.set(c.id, { id: c.id, lat: c.lat, lng: c.lng, manches: [] });
    parId.get(c.id).manches.push(c);
  }
  return {
    annee, manches, prochain, lieux: [...parId.values()],
    hotes: new Set(manches.map(c => c.paysNE)),
    continents: [...new Set(manches.map(c => c.continent))],
    pilotes: brut.pilotes, constructeurs: brut.constructeurs,
    progression: brut.progression, detailsDispo: new Set(brut.detailsDispo),
  };
}

/** Manche à afficher pour un circuit : la prochaine à courir, sinon la première. */
export const mancheDuCircuit = (S, id) => S.manches.find(c => c.id === id && !c.fini) || S.manches.find(c => c.id === id);
export const mancheParCle = (S, cle) => S.manches.find(c => c.cle === cle);
export const mancheDeRound = (S, round) => S.manches.find(c => c.round === round);
export const manchesDuPays = (S, nom) => S.manches.filter(c => c.paysNE === nom);
export const manchesDuContinent = (S, cont) => S.manches.filter(c => c.continent === cont);

/** Positions tour par tour d'une manche (null si OpenF1 ne la couvre pas : avant 2023). */
export const detailCourse = (S, manche) => S.detailsDispo.has(manche.round) ? lireCourse(S.annee, manche.round) : Promise.resolve(null);
