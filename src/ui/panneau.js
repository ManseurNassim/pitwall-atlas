// Panneau de gauche : onglets (calendrier / pilotes / équipes), info continent en bas.
import { etat, ecouter, ouvrirCircuit, survolerManches, vueGlobale } from "../etat.js";
import { mancheParCle, manchesDuContinent } from "../donnees.js";
import { couleurEq } from "../lib/constantes.js";
import { esc, pad } from "../lib/format.js";
import { t, dateCourte, nombre } from "../lib/i18n.js";

const liste = document.getElementById("liste");
const info = document.getElementById("info-continent");
let onglet = "calendrier";

function rendreCalendrier() {
  liste.innerHTML = etat.saison.manches.map(c => {
    const droite = c.fini ? `<span class="puce-eq" style="--eq:${couleurEq(c.vainqueur.eqId)}">${esc(c.vainqueur.code)}</span>`
      : c.next ? `<span class="badge-next">${t("panneau.next")}</span>` : `<span class="date">${dateCourte(c.date)}</span>`;
    return `<button class="course" data-cle="${c.cle}">
      <span class="rd">R${pad(c.round)}</span>
      <span><span class="nom">${esc(c.gpCourt)}</span><span class="meta">${esc(c.nom)} · ${dateCourte(c.date)}</span></span>
      <span class="droite">${droite}</span></button>`;
  }).join("");
  marquerLignes();
}

function rendreClassement(lignes, pilotes) {
  if (!lignes.length) { liste.innerHTML = `<p class="vide">${t("panneau.indisponible")}</p>`; return; }
  const max = lignes[0].pts || 1;
  liste.innerHTML = lignes.map((x, i) => {
    const victoires = x.v ? t("panneau.victoires", { n: x.v }) : pilotes ? "" : t("panneau.aucuneVictoire");
    const detail = pilotes ? [esc(x.equipe), victoires].filter(Boolean).join(" · ") : victoires;
    return `<div class="ligne-cl" style="--eq:${couleurEq(pilotes ? x.eqId : x.id)}">
      <span class="pos">${pad(x.pos)}</span>
      <span class="qui">${pilotes ? `${esc(x.prenom)} ${esc(x.nom)}` : esc(x.nom)}<small>${detail}</small>
        <div class="barre-pts" style="width:${Math.max(2, x.pts / max * 100)}%;animation-delay:${i * 40}ms"></div></span>
      <span class="pts">${nombre(x.pts)}<small> ${t("panneau.pts")}</small></span>
    </div>`;
  }).join("");
}

function rendre() {
  document.querySelectorAll(".onglets button").forEach(b => b.setAttribute("aria-selected", b.dataset.onglet === onglet));
  if (onglet === "calendrier") rendreCalendrier();
  else rendreClassement(onglet === "pilotes" ? etat.saison.pilotes : etat.saison.constructeurs, onglet === "pilotes");
}

/** Ligne active = manche dont la fiche est ouverte. */
function marquerLignes() {
  for (const c of etat.saison.manches) liste.querySelector(`.course[data-cle="${c.cle}"]`)?.classList.toggle("actif", etat.circuitActif?.cle === c.cle);
}

function afficherInfo() {
  const cont = etat.continentSurvole || etat.continentFiltre;
  info.innerHTML = cont
    ? t("panneau.continent", { continent: t(`continents.${cont}`), n: manchesDuContinent(etat.saison, cont).length, annee: etat.saison.annee })
      + (cont !== etat.continentFiltre ? t("panneau.zoomer") : "")
    : t("panneau.aide");
}

/* ---------- Interactions ---------- */
document.querySelector(".onglets").addEventListener("click", e => {
  const b = e.target.closest("button[data-onglet]");
  if (b) { onglet = b.dataset.onglet; rendre(); }
});
const ligneManche = e => { const b = e.target.closest(".course"); return b && mancheParCle(etat.saison, b.dataset.cle); };
liste.addEventListener("click", e => ouvrirCircuit(ligneManche(e)));
liste.addEventListener("mouseover", e => { const m = ligneManche(e); if (m) survolerManches([m], true); });
liste.addEventListener("mouseout", e => { const m = ligneManche(e); if (m) survolerManches([m], false); });
document.getElementById("vue-globale").onclick = vueGlobale;

/* ---------- Réactions à l'état ---------- */
ecouter("saison", () => { rendre(); afficherInfo(); });
ecouter("continent", afficherInfo);
ecouter("circuit", marquerLignes);
ecouter("survol", ({ continentChange }) => continentChange && afficherInfo());
ecouter("survolManches", (manches, oui, { defiler }) => manches.forEach(m => {
  const l = liste.querySelector(`.course[data-cle="${m.cle}"]`);
  if (!l) return;
  l.classList.toggle("survol", oui);
  if (oui && defiler) l.scrollIntoView({ block: "nearest", behavior: "smooth" });
}));
