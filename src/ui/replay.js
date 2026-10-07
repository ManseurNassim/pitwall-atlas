/* Replay de saison : bouton ▶, annonce plein écran à chaque manche, classement animé des pilotes
   (barres qui montent, dépassements ▲▼, nouveau leader), carte du vainqueur, frise des manches.
   La caméra et l'onde sur le circuit sont gérées par globe/scene.js et globe/marqueurs.js. */
import { etat, ecouter, lancerReplay, pauseReplay, arreterReplay, survolerManches } from "../etat.js";
import { mancheDeRound } from "../donnees.js";
import { couleurEq, reduit, reglages } from "../lib/constantes.js";
import { esc, pad, rejouer } from "../lib/format.js";
import { t, nombre } from "../lib/i18n.js";
import { annoncer } from "./decor.js";
import { htmlPiste, animerPiste, arreterPiste } from "./piste.js";

const R = reglages.replay;
let nbLignes = R.lignesMax;
/** Nombre de lignes qui tiennent dans la place restante (recalculé à chaque manche : la carte du podium change de taille). */
const ajusterLignes = () => { nbLignes = Math.max(R.lignesMin, Math.min(R.lignesMax, Math.floor(barres.clientHeight / R.hauteurLigne))); };
const bouton = document.getElementById("bouton-replay");
const panneau = document.getElementById("replay");
const carte = document.getElementById("replay-carte");
const barres = panneau.querySelector(".replay-barres"), frise = panneau.querySelector(".replay-frise");
const boitePiste = panneau.querySelector(".replay-piste");
const lignes = new Map();   // code pilote → { el, pts, rang }
let leader = null;

bouton.onclick = lancerReplay;
panneau.querySelector(".pause").onclick = pauseReplay;
panneau.querySelector(".quitter").onclick = arreterReplay;
addEventListener("keydown", e => {
  if (!etat.replay) return;
  if (e.key === "Escape") { e.preventDefault(); arreterReplay(); }
  if (e.key === " ") { e.preventDefault(); pauseReplay(); }
});

const mancheDe = etape => mancheDeRound(etat.saison, etape.round);

/** Fait défiler un nombre de son ancienne à sa nouvelle valeur (compteur de points). */
function compter(el, de, a) {
  if (reduit || de === a) { el.textContent = nombre(a); return; }
  const t0 = performance.now(), duree = R.dureeCompteur;
  (function image(maintenant) {
    const k = Math.min(1, (maintenant - t0) / duree), v = de + (a - de) * (1 - (1 - k) ** 3);
    el.textContent = k < 1 ? Math.round(v) : nombre(a);
    if (k < 1) requestAnimationFrame(image);
  })(t0);
}

function preparer() {
  const P = etat.saison.progression, codes = new Map();
  P.forEach(e => e.pilotes.forEach(([code, , eq]) => codes.set(code, eq)));
  barres.innerHTML = ""; lignes.clear();
  for (const [code, eq] of codes) {
    const el = document.createElement("div");
    el.className = "ligne-replay";
    el.style.setProperty("--eq", couleurEq(eq));
    el.innerHTML = `<span class="pos"></span><span class="code" data-win="${t("replay.win")}">${esc(code)}<i class="delta"></i></span><span class="rail"><i></i></span><b class="pts mono">0</b>`;
    barres.append(el);
    lignes.set(code, { el, pts: 0, rang: 99 });
  }
  leader = null;
  frise.innerHTML = P.map((e, i) => `<i data-i="${i}" title="${esc(mancheDe(e).gp)}"></i>`).join("");
  panneau.querySelector(".annee").textContent = etat.saison.annee;
}

function etape() {
  const { index } = etat.replay, e = etat.saison.progression[index], m = mancheDe(e);
  const max = e.pilotes[0][1] || 1;
  const rang = new Map(e.pilotes.map(([code], i) => [code, i]));
  ajusterLignes();
  annoncer(esc(m.gpCourt), t("replay.annonce", { round: pad(m.round), total: etat.saison.manches.length }));
  for (const [code, l] of lignes) {
    const i = rang.get(code) ?? 99, ligne = e.pilotes[i];
    const pts = ligne ? ligne[1] : l.pts;
    // Flèche de dépassement : places gagnées (▲) ou perdues (▼) depuis la manche précédente, dans le top 10
    const delta = index > 0 && i < nbLignes && l.rang < 99 ? l.rang - i : 0;
    const badge = l.el.querySelector(".delta");
    badge.className = "delta" + (delta > 0 ? " gain" : delta < 0 ? " perte" : "");
    badge.textContent = delta ? (delta > 0 ? "▲" : "▼") + Math.abs(delta) : "";
    l.el.classList.toggle("tete", i === 0);
    // Le vainqueur de la manche s'allume tout de suite, sans attendre que les barres aient fini de bouger
    l.el.classList.toggle("vainqueur", code === m.vainqueur.code);
    l.rang = i;
    l.el.style.transform = `translateY(${Math.min(i, nbLignes) * R.hauteurLigne}px)`;
    l.el.classList.toggle("hors", i >= nbLignes);
    l.el.querySelector(".pos").textContent = i < 99 ? pad(i + 1) : "";
    l.el.querySelector(".rail i").style.width = `${Math.max(1.5, pts / max * 100)}%`;
    if (ligne) l.el.style.setProperty("--eq", couleurEq(ligne[2]));   // transferts en cours de saison
    compter(l.el.querySelector(".pts"), l.pts, pts);
    l.pts = pts;
  }
  frise.querySelectorAll("i").forEach((p, i) => { p.className = i < index ? "fait" : i === index ? "ici" : ""; });
  panneau.querySelector(".manche").innerHTML = `<span class="rd">R${pad(m.round)}</span> ${esc(m.gpCourt)}`;

  const v = m.vainqueur, enTete = e.pilotes[0][0];
  const nouveauLeader = leader && enTete !== leader;
  leader = enTete;
  carte.style.setProperty("--eq", couleurEq(v.eqId));
  // Podium complet : P1 en grand (prénom + nom + écurie), P2 et P3 en dessous, chacun à sa couleur d'écurie
  const [, ...suivants] = v.podium;
  // Tracé du circuit en grand (même composant que la fiche : dessin puis secteurs S1/S2/S3)
  boitePiste.innerHTML = htmlPiste(m);
  animerPiste(boitePiste.querySelector(".piste"));
  carte.innerHTML = `<span class="fond">${esc(v.code)}</span>
    <small>R${pad(m.round)} · ${esc(m.ville)}</small><span class="lbl">${t("replay.vainqueur")}</span>
    <b>${esc(v.prenom)} ${esc(v.nom)}</b><em>${esc(v.equipe)}</em>
    <ol class="podium-replay">${suivants.map((p, i) => `<li style="--eq:${couleurEq(p.eqId)}"><i>P${i + 2}</i>${esc(p.nom)}</li>`).join("")}</ol>
    ${nouveauLeader ? `<span class="nouveau-leader">${t("replay.nouveauLeader", { code: enTete })}</span>` : ""}`;
  rejouer(carte, "entre");
  survolerManches(etat.saison.manches, false);
  survolerManches([m], true);
}

function fin() {
  arreterPiste();
  const S = etat.saison, e = S.progression[S.progression.length - 1], [code, pts, eq] = e.pilotes[0];
  const p = S.pilotes.find(x => x.code === code);
  const termine = !S.prochain;
  carte.style.setProperty("--eq", couleurEq(eq));
  carte.innerHTML = `<small>${termine ? t("replay.saison", { annee: S.annee }) : t("replay.apres", { n: e.round })}</small>
    <span class="lbl">${t(termine ? "replay.champion" : "replay.leader")}</span>
    <b>${esc(p ? p.prenom + " " + p.nom : code)}</b><em>${t("replay.points", { pts: nombre(pts) })}</em>`;
  carte.classList.add("finale");
  rejouer(carte, "entre");
  panneau.querySelector(".pause").hidden = true;
}

ecouter("replay", quoi => {
  if (quoi === "debut") {
    // Panneau affiché AVANT preparer() : le nombre de lignes du classement dépend de la place restante
    document.body.classList.add("en-replay");
    panneau.hidden = false;
    carte.classList.remove("finale"); carte.innerHTML = ""; boitePiste.innerHTML = "";
    preparer();
    panneau.querySelector(".pause").hidden = false;
  }
  if (quoi === "etape") etape();
  if (quoi === "fin") fin();
  if (quoi === "pause") panneau.querySelector(".pause").textContent = etat.replay.pause ? "▶" : "❚❚";
  if (quoi === "arret") {
    arreterPiste();
    document.body.classList.remove("en-replay");
    panneau.hidden = true;
    panneau.querySelector(".pause").textContent = "❚❚";
    survolerManches(etat.saison.manches, false);
  }
});

ecouter("saison", () => {
  bouton.hidden = !etat.saison.progression?.length;
  bouton.querySelector(".annee").textContent = etat.saison.annee;
});
