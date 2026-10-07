// Fiche d'un circuit (panneau de droite) : en-tête, tracé, fiche technique, résultat ou compte à rebours, records, palmarès.
import { etat, ecouter, ouvrirCircuit, fermerCircuit, circuitVoisin } from "../etat.js";
import { MAJ, mancheParCle, detailCourse } from "../donnees.js";
import { couleurEq, chaqueSeconde, reglages } from "../lib/constantes.js";
import { esc, pad, decompte } from "../lib/format.js";
import { t, dateCourte, nombre } from "../lib/i18n.js";
import { htmlPiste, animerPiste, arreterPiste } from "./piste.js";
import { htmlGraphique, animerGraphique } from "./graphique-course.js";

const fiche = document.getElementById("fiche");
/** Position de départ affichée : stands, pole ou P<n>. */
const grille = g => (g === 0 ? t("fiche.grilleStands") : g === 1 ? t("fiche.grillePole") : "P" + g);
const bloc = (titre, contenu, classe = "") => `<div class="bloc ${classe}"><h3>${titre}</h3>${contenu}</div>`;

function htmlResultat(c) {
  if (c.vainqueur) {
    const v = c.vainqueur;
    const parti = v.grille === 0 ? t("fiche.partiStands") : t("fiche.parti", { place: "P" + v.grille });
    return `<div class="resultat-saison" style="--eq:${couleurEq(v.eqId)}">
      <span class="p1">P1</span>
      <div class="qui">${esc(v.prenom)} ${esc(v.nom)}<small>${esc(v.equipe)} · ${parti}</small>
        <div class="podium">${v.podium.map((p, i) => `<span>P${i + 1} ${esc(p.code)}</span>`).join("")}</div></div></div>`;
  }
  return `<div class="resultat-saison">
    <span class="p1 attente">${c.next ? t("panneau.next") : "R" + c.round}</span>
    <div class="compte">${t("fiche.unites").map(u => `<div><b></b><small>${u}</small></div>`).join("")}</div></div>`;
}

function majCompte() {
  const c = etat.circuitActif, cases = fiche.querySelectorAll(".compte b");
  if (!c || !cases.length) return;
  const d = decompte(c.debut - Date.now());
  [d.j, pad(d.h), pad(d.m), pad(d.s)].forEach((v, i) => { cases[i].textContent = v; });
}
chaqueSeconde(majCompte);

function htmlRecords(s) {
  const roi = s.topPilotes[0], rem = s.remontee, max = s.topEquipes[0]?.v || 1;
  const record = (titre, contenu) => `<div class="record"><dt>${titre}</dt><dd>${contenu}</dd></div>`;
  return bloc(t("fiche.records"), `<dl class="records">
      ${record(t("fiche.roi"), `<span class="gros">${roi.v}</span>${esc(roi.nom)}<small> ${t("fiche.victoiresMot", { n: roi.v })}</small>`)}
      ${record(t("fiche.poleVictoire"), `<span class="gros">${s.poleVictoire}%</span><small>${t("fiche.poleVictoireDetail", { n: s.editions })}</small>`)}
      ${record(t("fiche.remontee"), `<span class="gros">${rem.grille === 0 ? t("fiche.stands") : "P" + rem.grille}</span>${esc(rem.prenom)} ${esc(rem.nom)}<small> · ${rem.annee}</small>`)}
      ${record(t("fiche.autres"), s.topPilotes.slice(1).map(p => `${esc(p.nom)} <small>×${p.v}</small>`).join("<br>") || "<small>—</small>")}
    </dl>`)
    + bloc(t("fiche.parEcurie"), `<div class="barres">${s.topEquipes.map((e, i) => `<div class="l" style="--eq:${couleurEq(e.id)}"><span>${esc(e.nom)}</span><span class="rail"><i style="width:${e.v / max * 100}%;animation-delay:${300 + i * 70}ms"></i></span><span class="n">${e.v}</span></div>`).join("")}</div>`);
}

/** Palmarès : les n plus récents, plus toujours l'année affichée même si elle est plus ancienne. */
function rendrePalmares(h, n) {
  const annee = etat.saison.annee, lignes = h.slice(0, n);
  h.filter(x => String(x.annee) === annee && !lignes.includes(x)).forEach(x => lignes.push(x));
  fiche.querySelector(".histo").innerHTML = lignes.sort((a, b) => b.annee - a.annee).map((x, i) => `
    <div class="l ${String(x.annee) === annee ? "cette-saison" : ""}" style="--eq:${couleurEq(x.eqId)};animation-delay:${Math.min(i, 14) * 35}ms">
      <span class="annee">${x.annee}</span><span class="tr"></span>
      <span class="p">${esc(x.nom)}<small>${esc(x.equipe)}</small></span>
      <span class="g ${x.grille === 1 ? "pole" : ""}">${grille(x.grille)}</span>
    </div>`).join("");
}

function rendre(c) {
  const s = c.stats, h = c.historique, annee = etat.saison.annee, initial = reglages.fiche.palmaresInitial;
  const autres = etat.saison.manches.filter(x => x.id === c.id && x.cle !== c.cle);
  const tech = [["longueur", `${nombre(c.km, 3)}<small>${t("fiche.km")}</small>`], ["tours", c.tours],
    ["distance", `${nombre(c.km * c.tours, 1)}<small>${t("fiche.km")}</small>`], ["virages", c.virages],
    ["premierGP", s.premiere ?? annee], ["editions", s.editions]];
  fiche.innerHTML = `
    <button class="fermer" aria-label="${t("fiche.fermer")}">✕</button>
    <div class="sur-titre"><span class="rd">${t("fiche.manche", { n: c.round })}</span><span>${dateCourte(c.date)} ${annee}</span><span>· ${esc(c.code)}</span></div>
    <h2>${esc(c.gp)}</h2>
    <div class="lieu"><b>${esc(c.nom)}</b> · ${esc(c.ville)}, ${esc(c.pays)}</div>
    ${htmlPiste(c)}
    <dl class="fiche-tech">${tech.map(([cle, v]) => `<div><dt>${t("fiche." + cle)}</dt><dd>${v}</dd></div>`).join("")}</dl>
    ${bloc(c.fini ? t("fiche.resultat", { annee }) : t("fiche.depart"), htmlResultat(c)
      + (autres.length ? `<div class="autre-manche">${autres.map(a => `<button data-cle="${a.cle}">${t("fiche.aussi", { annee, round: pad(a.round), gp: a.gp })}</button>`).join("")}</div>` : ""))}
    <div class="bloc bloc-course" hidden><h3>${t("fiche.tourParTour")}</h3></div>
    ${h.length ? htmlRecords(s) + bloc(t("fiche.palmares"), `<div class="histo"></div>${h.length > initial ? `<button class="plus">${t("fiche.voirTout", { n: h.length })}</button>` : ""}`)
      : bloc(t("fiche.palmares"), `<p class="vide">${t("fiche.premiereEdition", { annee })}</p>`)}
    ${bloc(t("fiche.saviezVous"), `<p class="anecdote">${esc(c.fait)}</p>`)}
    <p class="source">${t("fiche.source", { maj: dateCourte(MAJ) + " " + MAJ.slice(0, 4) })}</p>`;

  fiche.querySelector(".fermer").onclick = () => fermerCircuit();
  fiche.querySelectorAll(".autre-manche button").forEach(b => { b.onclick = () => ouvrirCircuit(mancheParCle(etat.saison, b.dataset.cle)); });
  if (h.length) {
    rendrePalmares(h, initial);
    fiche.querySelector(".plus")?.addEventListener("click", e => { rendrePalmares(h, h.length); e.target.remove(); });
  }
  majCompte();
  animerPiste(fiche.querySelector(".piste"));
  // Graphique tour par tour : chargé à part (fichier séparé sur le site), seulement si OpenF1 couvre la course
  detailCourse(etat.saison, c).then(course => {
    if (!course || etat.circuitActif !== c) return;
    const boite = fiche.querySelector(".bloc-course");
    boite.insertAdjacentHTML("beforeend", htmlGraphique(course));
    boite.hidden = false;
    animerGraphique(boite, course);
  });
}

ecouter("circuit", c => {
  document.body.classList.toggle("fiche-ouverte", !!c);
  if (!c) return arreterPiste();
  rendre(c);
  fiche.scrollTop = 0;
});

addEventListener("keydown", e => {
  if (!etat.circuitActif) return;
  if (e.key === "Escape") { e.preventDefault(); fermerCircuit(); }
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") circuitVoisin(e.key === "ArrowRight" ? 1 : -1);
});
