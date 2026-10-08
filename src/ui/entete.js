// En-tête : logo, sélecteur de saison, encart « prochain GP » ou « champion ».
import { etat, ecouter, changerSaison, ouvrirCircuit, vueGlobale } from "../etat.js";
import { ANNEES, SAISON_EN_COURS } from "../donnees.js";
import { couleurEq, chaqueSeconde } from "../lib/constantes.js";
import { esc, pad, decompte } from "../lib/format.js";
import { t, nombre } from "../lib/i18n.js";

const nav = document.getElementById("saisons"), encart = document.getElementById("encart");

nav.innerHTML = `<span class="curseur"></span>` + ANNEES.map(a =>
  `<button aria-pressed="false" data-annee="${a}">${a}${a === SAISON_EN_COURS ? `<span class="live" title="${t("entete.saisonEnCours")}"></span>` : ""}</button>`).join("");
const curseur = nav.querySelector(".curseur");

nav.addEventListener("click", e => {
  const b = e.target.closest("button[data-annee]");
  if (b && b.dataset.annee !== etat.saison.annee) changerSaison(b.dataset.annee);
});

function placerCurseur(anime = true) {
  const b = nav.querySelector(`button[data-annee="${etat.saison.annee}"]`);
  if (!anime) curseur.style.transition = "none";
  curseur.style.width = b.offsetWidth + "px";
  curseur.style.transform = `translateX(${b.offsetLeft}px)`;
  curseur.getBoundingClientRect(); curseur.style.transition = "";
  nav.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
}
// Toute variation de la barre (rotation, police chargée, passage portrait/paysage) replace le curseur
new ResizeObserver(() => etat.saison && placerCurseur(false)).observe(nav);

function rendreEncart() {
  const { prochain, pilotes, annee } = etat.saison;
  if (prochain) {
    const d = decompte(prochain.debut - Date.now());
    encart.innerHTML = `<div class="prochain"><span class="lbl">${t("entete.prochain")}</span><button>
      <span class="gp">${esc(prochain.ville)}</span>
      <span class="cd mono">${prochain.debut > Date.now() ? t("entete.decompte", { j: d.j, h: pad(d.h), m: pad(d.m) }) : t("entete.enCours")}</span></button></div>`;
    encart.querySelector("button").onclick = () => ouvrirCircuit(prochain);
    return;
  }
  const ch = pilotes[0];
  encart.innerHTML = ch ? `<div class="champion" style="--eq:${couleurEq(ch.eqId)}"><span class="lbl">${t("entete.champion", { annee })}</span>
    <b>${esc(ch.prenom)} ${esc(ch.nom)}</b><small>${t("entete.bilanChampion", { pts: nombre(ch.pts), v: ch.v })}</small></div>` : "";
}
chaqueSeconde(() => etat.saison?.prochain && rendreEncart());

document.getElementById("logo").onclick = e => { e.preventDefault(); vueGlobale(); };

ecouter("saison", ({ premiere }) => {
  placerCurseur(!premiere);
  rendreEncart();
  document.getElementById("sous-logo").textContent = t("page.sousLogo", { annee: etat.saison.annee, n: etat.saison.manches.length });
});
