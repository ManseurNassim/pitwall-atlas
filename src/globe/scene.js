// Le globe 3D lui-même : création, caméra, déplacements. Les couches (pays, marqueurs) sont dans les fichiers voisins.
// Couleurs, durées et altitudes : src/config/reglages.json → globe.
import Globe from "globe.gl";
import { etat, ecouter } from "../etat.js";
import { mancheDeRound } from "../donnees.js";
import { CONTINENTS, reglages, reduit, mobile } from "../lib/constantes.js";

const R = reglages.globe, ALT = R.altitudes, DUREE = R.durees, DECALAGE = R.decalageMobile;
const conteneur = document.getElementById("scene");

export const globe = new Globe(conteneur, { animateIn: false })
  .backgroundColor("rgba(0,0,0,0)")
  .showAtmosphere(true).atmosphereColor(R.atmosphere).atmosphereAltitude(R.altitudeAtmosphere);

const materiau = globe.globeMaterial();
materiau.color.set(R.fond);
materiau.emissive.set(R.emissif);
materiau.shininess = R.brillance;
/** Classe de matériau Three.js du globe, réutilisée par les couches (three n'est pas importé à part). */
export const Materiau = materiau.constructor;

// Performance : résolution plafonnée (au-delà, invisible à l'œil mais 2 à 4× plus de pixels) ; pause onglet caché
globe.renderer().setPixelRatio(Math.min(devicePixelRatio, R.pixelRatioMax));
document.addEventListener("visibilitychange", () => (document.hidden ? globe.pauseAnimation() : globe.resumeAnimation()));

const ctrl = globe.controls();
ctrl.autoRotate = !reduit; ctrl.autoRotateSpeed = R.rotation.vitesse; ctrl.enableDamping = true;
ctrl.minDistance = R.zoom.min; ctrl.maxDistance = R.zoom.max; ctrl.zoomSpeed = R.zoom.vitesse;
ctrl.addEventListener("start", () => { ctrl.autoRotate = false; tourEnCours++; volEnCours++; });

const tailler = () => globe.width(innerWidth).height(innerHeight);
addEventListener("resize", tailler); tailler();
export const curseur = valeur => { conteneur.style.cursor = valeur; };

/* Vol de caméra maison : globe.gl n'annule pas un vol en cours quand on en lance un autre, et deux vols
   simultanés se contrarient (saut visible en cliquant vite Monaco puis Monza). Ici, chaque vol annule le
   précédent et repart de la position réelle de la caméra. Longitude : toujours par le chemin le plus court. */
let volEnCours = 0;
const lisse = k => (k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
export function vol(cible, ms = DUREE.vol) {
  const id = ++volEnCours, depart = globe.pointOfView();
  const fin = { ...depart, ...cible };
  if (reduit || !ms) return globe.pointOfView(fin, 0);
  const dLng = ((fin.lng - depart.lng + 540) % 360) - 180, t0 = performance.now();
  (function image(t) {
    if (id !== volEnCours) return;
    const k = lisse(Math.min(1, (t - t0) / ms));
    // Seules les valeurs demandées sont animées : un vol d'altitude seule laisse tourner l'auto-rotation
    const pov = {};
    if ("lat" in cible) pov.lat = depart.lat + (fin.lat - depart.lat) * k;
    if ("lng" in cible) pov.lng = depart.lng + dLng * k;
    if ("altitude" in cible) pov.altitude = depart.altitude + (fin.altitude - depart.altitude) * k;
    globe.pointOfView(pov, 0);
    if (k < 1) requestAnimationFrame(image);
  })(t0);
}
const vueDe = c => ({ lat: c.lat * .5 + 12, lng: c.lng, altitude: ALT.vue });
const premiere = () => etat.saison.prochain || etat.saison.manches[0];

/* Grand tour au changement de saison : la caméra prend toujours le chemin le plus court et ne sait pas
   faire un tour complet ; on lance donc la rotation automatique très vite, on freine, puis on se pose. */
let tourEnCours = 0;
function tourDeGlobe(cible) {
  if (reduit) return vol(vueDe(cible), 0);
  const id = ++tourEnCours, t0 = performance.now(), duree = R.rotation.dureeTourSaison;
  vol({ altitude: ALT.tourSaison }, DUREE.tourSaisonMontee);
  ctrl.autoRotate = true;
  (function etape(t) {
    if (id !== tourEnCours) return;
    const k = Math.min(1, (t - t0) / duree);
    ctrl.autoRotateSpeed = R.rotation.tourSaison * (1 - k) ** 2 + R.rotation.vitesse;
    if (k < 1) return requestAnimationFrame(etape);
    ctrl.autoRotate = false; ctrl.autoRotateSpeed = R.rotation.vitesse;
    vol(vueDe(cible), DUREE.tourSaisonPose);
  })(t0);
}
const arreterRotation = () => { tourEnCours++; ctrl.autoRotate = false; ctrl.autoRotateSpeed = R.rotation.vitesse; };

/** Position de départ (derrière l'horizon) puis vol d'arrivée après l'intro. */
export function placerDepart() {
  const c = premiere();
  globe.pointOfView({ ...vueDe(c), lng: c.lng - 70, altitude: ALT.depart }, 0);
}
export const volArrivee = () => vol(vueDe(premiere()), DUREE.arrivee);

/* ---------- Réactions à l'état ---------- */

ecouter("saison", ({ premiere: debut, rouvre }) => {
  if (!debut && !rouvre) tourDeGlobe(premiere());
});

ecouter("circuit", (c, { revenir }) => {
  if (c) {
    arreterRotation();
    return vol({ lat: c.lat - (mobile() ? DECALAGE.circuit : 0), lng: c.lng, altitude: ALT.circuit }, DUREE.circuit);
  }
  if (!revenir) return;
  const pov = globe.pointOfView();
  vol(etat.continentFiltre ? CONTINENTS[etat.continentFiltre] : { lat: pov.lat, lng: pov.lng, altitude: ALT.retour }, DUREE.retour);
});

ecouter("continent", () => {
  if (etat.circuitActif) return;
  arreterRotation();
  vol(etat.continentFiltre ? CONTINENTS[etat.continentFiltre] : { altitude: ALT.vue });
});

ecouter("vueGlobale", () => {
  vol(vueDe(premiere()), DUREE.vueGlobale);
  ctrl.autoRotate = !reduit;
});

ecouter("replay", quoi => {
  if (quoi === "debut") { arreterRotation(); vol({ altitude: ALT.replayDebut }, DUREE.replayDebut); }
  if (quoi === "etape") {
    // Deux temps : on prend de la hauteur, puis on plonge sur le circuit. Le mouvement se voit même
    // quand deux manches sont voisines (Monaco → Barcelone, Bahreïn → Djeddah).
    const c = mancheDeRound(etat.saison, etat.saison.progression[etat.replay.index].round);
    const id = ++tourEnCours, m = mobile();
    vol({ lat: c.lat - (m ? DECALAGE.replayHaut : 0), lng: c.lng, altitude: ALT.replayHaut }, DUREE.replayMontee);
    setTimeout(() => {
      if (id === tourEnCours) vol({ lat: c.lat - (m ? DECALAGE.replayBas : 0), lng: c.lng, altitude: ALT.replayBas }, DUREE.replayPlongee);
    }, DUREE.replayMontee + 50);
  }
  if (quoi === "fin") { tourEnCours++; vol({ altitude: ALT.vue }, DUREE.replayFin); ctrl.autoRotate = !reduit; }
  if (quoi === "arret") { tourEnCours++; vol({ altitude: ALT.vue }, DUREE.replayArret); }
});
