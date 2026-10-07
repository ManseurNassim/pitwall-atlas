/* Couches « pays » du globe :
   - hexagones = le décor, sans interaction (leurs trous faisaient clignoter le survol) ;
   - polygones = zone de survol/clic continue, posée une fois pour toutes sur les continents qui ont déjà
     accueilli une course. Survoler un pays allume son continent ; seuls les pays hôtes ont nom et contour.

   PERFORMANCE : changer un accesseur de globe.gl (hexPolygonColor, polygonCapMaterial...) lui fait
   recalculer toute la géométrie (≈ 2 s de blocage). Les accesseurs ne sont posés qu'une fois ; ensuite
   on modifie directement les matériaux 3D (couleur, opacité, visibilité), ce qui est instantané.
   Couleurs et réglages : src/config/reglages.json (couleurs.hexagones, globe.*). */
import { globe, Materiau, curseur, vol } from "./scene.js";
import { etat, ecouter, survolerPays, choisirContinent, ouvrirCircuit } from "../etat.js";
import { pays, HOTES_TOUS, CONTINENTS_TOUS, manchesDuPays, mancheDuCircuit } from "../donnees.js";
import { esc, pad } from "../lib/format.js";
import { reglages } from "../lib/constantes.js";
import { lieuProche, ouvrirLieu, clicMarqueurRecent } from "./marqueurs.js";

const COULEURS = reglages.couleurs, R = reglages.globe;

const estHote = f => etat.saison.hotes.has(f.properties.n);

// Matériaux qui n'écrivent pas la profondeur : sinon la couche de survol masque les hexagones dessous
// `visible: false` : la surface n'est jamais dessinée (gain GPU) mais reste détectée au survol (raycast).
const INVISIBLE = new Materiau({ visible: false, depthWrite: false });
const voileHote = new Map([...HOTES_TOUS].map(n => [n,
  new Materiau({ color: COULEURS.voileHote, transparent: true, opacity: COULEURS.opaciteVoile, depthWrite: false, visible: false })]));

/** Couleur des hexagones. Hors sélection : hôtes en blanc. Continent survolé ou choisi : tout le continent
    passe au rouge, les hôtes en rouge clair (même famille de couleur, ils restent repérables sans détonner). */
function couleurHex(f) {
  const { c } = f.properties, hote = estHote(f), { continentFiltre, continentSurvole, paysSurvole } = etat, H = COULEURS.hexagones;
  if (hote && f === paysSurvole) return H.hoteSurvole;
  const zone = c === continentFiltre ? H.continentChoisi : c === continentSurvole ? H.continentSurvole : continentFiltre ? H.horsChoix : H.normal;
  return hote ? zone.hote : zone.autre;
}

const cacheRgba = new Map();
function recolorer() {
  for (const f of pays.features) {
    const m = f.__threeObjHexPolygon?.material;   // créé par globe.gl ; absent tant qu'il n'est pas construit
    if (!m) continue;
    const s = couleurHex(f);
    if (!cacheRgba.has(s)) {
      const [r, g, b, a = 1] = s.match(/[\d.]+/g).map(Number);
      cacheRgba.set(s, [`rgb(${r},${g},${b})`, a]);
    }
    const [rgb, a] = cacheRgba.get(s);
    m.color.set(rgb); m.opacity = a;
  }
}

/** Contours visibles seulement pour les hôtes de la saison (les objets apparaissent après coup : on réessaie). */
function majContours(essai = 0) {
  let trouves = 0;
  globe.scene().traverse(o => {
    const f = o.__globeObjType === "polygon" && o.__data?.data;
    if (!f) return;
    trouves++;
    o.children.forEach(c => { if (c.type.startsWith("Line")) c.visible = estHote(f); });
  });
  if (!trouves && essai < 20) setTimeout(() => majContours(essai + 1), 250);
}

function infobulle(f) {
  if (!estHote(f) || !etat.saison.continents.includes(f.properties.c)) return "";
  return `<div class="infobulle-pays"><b>${esc(f.properties.nf)}</b>${manchesDuPays(etat.saison, f.properties.n)
    .map(c => `<span><em>R${pad(c.round)}</em> ${esc(c.gp)}</span>`).join("")}</div>`;
}

// Clic aimanté : dès qu'on est un peu zoomé, un clic près d'un circuit l'ouvre (inutile de viser le point)
function aimant(evenement, cont) {
  if (clicMarqueurRecent()) return true;   // déjà traité par le marqueur lui-même
  const proche = (globe.pointOfView().altitude < R.altitudes.aimant || etat.continentFiltre === cont) && lieuProche(evenement);
  if (proche) ouvrirLieu(proche);
  return !!proche;
}

// Clic : on choisit d'abord le continent ; une fois dessus, un pays hôte ouvre son circuit
function clic(f, evenement) {
  const cont = f.properties.c;
  if (aimant(evenement, cont)) return;
  if (!etat.saison.continents.includes(cont)) return;
  if (cont !== etat.continentFiltre) return choisirContinent(cont);
  if (!estHote(f)) return;
  const gps = manchesDuPays(etat.saison, f.properties.n);
  const ids = [...new Set(gps.map(c => c.id))];
  if (ids.length === 1) return ouvrirCircuit(mancheDuCircuit(etat.saison, ids[0]));
  // Plusieurs circuits dans le pays (USA, Italie, Espagne...) : on cadre le pays
  const lat = gps.reduce((s, c) => s + c.lat, 0) / gps.length, lng = gps.reduce((s, c) => s + c.lng, 0) / gps.length;
  const ecart = Math.max(...gps.map(c => Math.hypot(c.lat - lat, (c.lng - lng) * Math.cos(lat * Math.PI / 180))));
  const P = reglages.cadrerPays;
  vol({ lat, lng, altitude: Math.min(P.altitudeMax, Math.max(P.altitudeMin, ecart / P.parDegre + P.base)) });
}

// Sortie de survol retardée : frôler une côte ou passer d'un pays à l'autre ne fait pas clignoter
let minuterieSortie;
function survol(f) {
  clearTimeout(minuterieSortie);
  if (f) survolerPays(f);
  else minuterieSortie = setTimeout(() => survolerPays(null), R.survol.delaiSortie);
}

globe
  .hexPolygonResolution(f => f.properties.r).hexPolygonMargin(R.hexagones.marge)
  .hexPolygonAltitude(R.hexagones.altitude).hexPolygonColor(couleurHex).hexPolygonsTransitionDuration(0)
  .polygonAltitude(R.polygones.altitude).polygonsTransitionDuration(0)
  .polygonCapMaterial(f => voileHote.get(f.properties.n) || INVISIBLE)
  .polygonSideMaterial(() => INVISIBLE)
  .polygonStrokeColor(f => HOTES_TOUS.has(f.properties.n) ? COULEURS.contourHote : false)
  .polygonLabel(infobulle)
  .onPolygonHover(survol)
  .onPolygonClick(clic)
  .onGlobeClick((_, evenement) => aimant(evenement));   // en mer, près d'un circuit côtier (Monaco, Singapour…)

/** Pose les géométries (une seule fois, juste après le premier affichage). */
export function poserPays() {
  globe.hexPolygonsData(pays.features).polygonsData(pays.features.filter(f => CONTINENTS_TOUS.has(f.properties.c)));
  majContours();
}

/* ---------- Réactions à l'état ---------- */
let precedent = null;
ecouter("survol", ({ continentChange }) => {
  const f = etat.paysSurvole;
  if (precedent && voileHote.has(precedent.properties.n)) voileHote.get(precedent.properties.n).visible = false;
  if (f && estHote(f)) voileHote.get(f.properties.n).visible = true;
  if (continentChange || (precedent && estHote(precedent)) || (f && estHote(f))) recolorer();
  precedent = f;
  curseur(f ? "pointer" : "");
});
ecouter("saison", () => { voileHote.forEach(m => { m.visible = false; }); precedent = null; recolorer(); majContours(); });
ecouter("continent", recolorer);
