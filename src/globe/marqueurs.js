// Marqueurs des circuits, anneaux du prochain GP et arcs du trajet de la saison.
// Réglages et couleurs : src/config/reglages.json (globe.marqueurs, globe.etiquettes, globe.arcs, couleurs.arcs…).
import { globe } from "./scene.js";
import { etat, ecouter, ouvrirCircuit, survolerManches } from "../etat.js";
import { mancheDuCircuit, mancheDeRound } from "../donnees.js";
import { esc, pad } from "../lib/format.js";
import { reglages, reduit } from "../lib/constantes.js";

const R = reglages.globe, ALT_MARQUEUR = R.marqueurs.altitude, ARCS = R.arcs, COUL_ARCS = reglages.couleurs.arcs;
const typeArc = d => (d.actif ? "actif" : d.fini ? "fini" : "aVenir");

const marqueurs = new Map();   // id circuit → élément
let dernierClic = 0;
/** Vrai juste après un clic sur un marqueur : le globe en dessous reçoit aussi ce clic, il doit l'ignorer. */
export const clicMarqueurRecent = () => performance.now() - dernierClic < R.aimant.delaiClic;

function creer(lieu) {
  const el = document.createElement("div");
  const { manches } = lieu;
  el.className = "marqueur" + (manches.every(m => m.fini) ? " fini" : "") + (manches.some(m => m.next) ? " next" : "");
  el.innerHTML = `<div class="pt"></div><div class="etq"><em>${manches.map(m => `R${pad(m.round)}`).join(" · ")}</em><span>${esc(manches[0].ville)}</span></div>`;
  el.title = manches.map(m => m.gp).join(" · ");
  el.addEventListener("pointerdown", () => { dernierClic = performance.now(); });
  el.addEventListener("click", e => { e.stopPropagation(); dernierClic = performance.now(); ouvrirLieu(lieu); });
  el.addEventListener("mouseenter", () => survolerManches(manches, true, { defiler: true }));
  el.addEventListener("mouseleave", () => survolerManches(manches, false));
  marqueurs.set(lieu.id, el);
  return el;
}

globe
  .htmlLat("lat").htmlLng("lng").htmlAltitude(ALT_MARQUEUR)
  .htmlElement(creer)
  .htmlElementVisibilityModifier((el, visible) => el.classList.toggle("cache", !visible))
  .ringLat("lat").ringLng("lng")
  .ringColor(() => t => `rgba(${reglages.couleurs.anneau},${1 - t})`)
  .ringMaxRadius(R.anneaux.rayonMax).ringPropagationSpeed(R.anneaux.vitesse).ringRepeatPeriod(R.anneaux.periode)
  .arcStartLat(d => d.a.lat).arcStartLng(d => d.a.lng).arcEndLat(d => d.b.lat).arcEndLng(d => d.b.lng)
  .arcColor(d => COUL_ARCS[typeArc(d)])
  .arcAltitudeAutoScale(ARCS.echelle).arcStroke(d => ARCS.epaisseur[typeArc(d)])
  .arcDashLength(ARCS.tiret).arcDashGap(ARCS.espace).arcDashAnimateTime(d => (reduit ? 0 : ARCS.duree[typeArc(d)]))
  .arcsTransitionDuration(ARCS.transition);

/** Clic « aimanté » : le circuit visible le plus proche du clic, s'il est à moins de `rayon` pixels. */
export function lieuProche(evenement, rayon = R.aimant.rayon) {
  const cadre = globe.renderer().domElement.getBoundingClientRect();
  const x = evenement.clientX - cadre.left, y = evenement.clientY - cadre.top;
  let meilleur = null, dmin = rayon;
  for (const l of etat.saison.lieux) {
    const el = marqueurs.get(l.id);
    if (!el || el.classList.contains("cache") || el.classList.contains("masque")) continue;
    const p = globe.getScreenCoords(l.lat, l.lng, ALT_MARQUEUR);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < dmin) { dmin = d; meilleur = l; }
  }
  return meilleur;
}
export const ouvrirLieu = l => ouvrirCircuit(mancheDuCircuit(etat.saison, l.id));

/* Étiquettes « face caméra », comme les habillages F1 : quand la planète tourne, le nom d'un circuit
   apparaît lorsqu'il passe en face de nous, puis s'efface. Au plus quelques noms à la fois, sans
   chevauchement (priorité au plus central). Pendant le replay : seulement le circuit de la manche. */
const E = R.etiquettes;   // max, seuilFace (cos de l'angle circuit / axe caméra), taille, intervalle
let courant = null;   // marqueur de la manche en cours pendant le replay

function majEtiquettes() {
  const cam = globe.camera().position, dc = Math.hypot(cam.x, cam.y, cam.z);
  const candidats = [];
  for (const l of etat.saison.lieux) {
    const el = marqueurs.get(l.id);
    if (!el) continue;
    const p = globe.getCoords(l.lat, l.lng, ALT_MARQUEUR);
    const face = (p.x * cam.x + p.y * cam.y + p.z * cam.z) / (Math.hypot(p.x, p.y, p.z) * dc);
    if (face > E.seuilFace && !el.classList.contains("masque")) candidats.push({ el, face, ecran: globe.getScreenCoords(l.lat, l.lng, ALT_MARQUEUR) });
  }
  candidats.sort((a, b) => b.face - a.face);
  const retenus = [];
  for (const c of candidats) {
    if (retenus.length >= E.max) break;
    // Étiquette à droite du point : on écarte celles qui toucheraient une étiquette déjà retenue
    if (retenus.some(r => Math.abs(r.ecran.y - c.ecran.y) < E.hauteur && Math.abs(r.ecran.x - c.ecran.x) < E.largeur)) continue;
    retenus.push(c);
  }
  const visibles = new Set(etat.replay ? (courant ? [courant] : []) : retenus.map(r => r.el));
  for (const el of marqueurs.values()) el.classList.toggle("face", visibles.has(el));
}
/* Vue rapprochée plus lisible : les arcs du trajet de la saison passent par-dessus tout quand on est près
   du sol ; on les retire sous une certaine altitude (sauf en replay, où ils racontent le parcours). */
let arcsMasques = false;
function majArcs() {
  const masquer = !etat.replay && globe.pointOfView().altitude < R.altitudes.masquerArcs;
  if (masquer === arcsMasques) return;
  arcsMasques = masquer;
  masquer ? globe.arcsData([]) : poserTrajet();
}

// Minuterie (les vols de caméra de globe.gl ne passent pas par les contrôles) : 24 points, coût négligeable
setInterval(() => { if (!document.hidden && etat.saison) { majEtiquettes(); majArcs(); } }, E.intervalle);

function filtrer() {
  const f = etat.continentFiltre;
  for (const l of etat.saison.lieux) marqueurs.get(l.id)?.classList.toggle("masque", !!f && l.manches[0].continent !== f);
}

/** Arcs du trajet de la saison ; pendant le replay, seulement le chemin déjà parcouru, la dernière étape en surbrillance. */
function poserTrajet(jusqua = null) {
  const m = etat.saison.manches;
  const legs = m.slice(0, -1).map((c, i) => ({ a: c, b: m[i + 1], fini: m[i + 1].fini }));
  globe.arcsData(jusqua === null ? legs : legs.slice(0, jusqua).map((l, i) => ({ ...l, actif: i === jusqua - 1 })));
}
const anneauxNormaux = () => globe.ringsData(etat.saison.prochain ? [etat.saison.prochain] : []);

ecouter("saison", () => {
  marqueurs.clear(); arcsMasques = false;
  globe.htmlElementsData(etat.saison.lieux);
  anneauxNormaux(); poserTrajet();
});

ecouter("replay", quoi => {
  if (quoi === "etape") {
    const m = mancheDeRound(etat.saison, etat.saison.progression[etat.replay.index].round);
    globe.ringsData([m]);   // onde rouge sur le circuit de la manche
    courant = marqueurs.get(m.id);
    poserTrajet(etat.saison.manches.indexOf(m));
  }
  if (quoi === "debut") { arcsMasques = false; poserTrajet(0); }
  if (quoi === "arret" || quoi === "fin") courant = null;
  if (quoi === "arret") { anneauxNormaux(); poserTrajet(); }
});
ecouter("continent", filtrer);
ecouter("survolManches", (manches, oui) => manches.forEach(m => marqueurs.get(m.id)?.classList.toggle("survol", oui)));
