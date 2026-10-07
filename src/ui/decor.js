// Décor : ciel étoilé, intro « feux de départ », chiffre géant au changement de saison.
import { ecouter, etat } from "../etat.js";
import { reduit, reglages } from "../lib/constantes.js";
import { rejouer } from "../lib/format.js";
import { t } from "../lib/i18n.js";

/* Ciel dessiné une seule fois (et au redimensionnement) : l'animer image par image coûtait du temps
   à chaque frame et rendait le globe moins fluide. */
const ciel = document.getElementById("ciel");
function dessinerCiel() {
  const ctx = ciel.getContext("2d"), w = ciel.width = innerWidth * devicePixelRatio, h = ciel.height = innerHeight * devicePixelRatio;
  const g = ctx.createRadialGradient(w * .55, h * .5, 0, w * .55, h * .5, w * .7);
  const C = reglages.couleurs.ciel;
  g.addColorStop(0, C.centre); g.addColorStop(.5, C.milieu); g.addColorStop(1, C.bord);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  for (let i = Math.round(innerWidth * innerHeight / 2600); i--;) {
    ctx.globalAlpha = Math.random() * .7 + .1;
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 1.1 * devicePixelRatio + .2, 0, 7); ctx.fill();
  }
}
let minuterie;
dessinerCiel();
addEventListener("resize", () => { clearTimeout(minuterie); minuterie = setTimeout(dessinerCiel, 150); });

/** Intro : les 5 feux s'allument un à un, s'éteignent (« lights out »), puis le rideau se lève. */
export function feuxDeDepart(apres) {
  document.getElementById("intro-saison").textContent = etat.saison.annee;
  const intro = document.getElementById("intro"), feux = [...intro.querySelectorAll(".feu")];
  const lever = () => { intro.classList.add("parti"); apres(); };
  if (reduit) return lever();
  const { pas, debut, pause, lever: delaiLever } = reglages.intro;
  feux.forEach((f, i) => setTimeout(() => f.classList.add("on"), debut + i * pas));
  setTimeout(() => {
    feux.forEach(f => f.classList.remove("on"));
    document.getElementById("intro-txt").innerHTML = t("intro.depart");
    setTimeout(lever, delaiLever);
  }, debut + feux.length * pas + pause);
}

/** Annonce plein écran : bande rouge qui balaie l'écran + texte géant (changement de saison, manche du replay). */
const flash = document.getElementById("flash");
export function annoncer(titre, surtitre = "") {
  if (reduit) return;
  flash.classList.toggle("avec-surtitre", !!surtitre);
  flash.innerHTML = `<span class="bande"></span><span class="texte">${surtitre ? `<small>${surtitre}</small>` : ""}${titre}</span>`;
  rejouer(flash, "go");
}
ecouter("saison", ({ premiere }) => { if (!premiere) annoncer(etat.saison.annee); });
