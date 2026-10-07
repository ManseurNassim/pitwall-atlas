/* Graphique de course « tour par tour » (comme les retransmissions F1) : la position de chaque pilote
   à la fin de chaque tour, des lignes qui se dessinent, les arrêts aux stands en points.
   Survoler un pilote (ligne ou code) l'isole et affiche son résumé. */
import { couleurEq, reduit, reglages } from "../lib/constantes.js";
import { esc } from "../lib/format.js";
import { t } from "../lib/i18n.js";

// Dimensions et marges du viewBox (src/config/reglages.json → graphique)
const { largeur: L, hauteur: H, gauche: G, droite: D, haut: HAUT, bas: BAS, graduation, rayonArret } = reglages.graphique;

export function htmlGraphique(course) {
  const n = course.pilotes.length, tours = course.tours;
  const x = t => G + t / tours * (L - G - D);
  const y = p => HAUT + (Math.min(p, n) - 1) / (n - 1) * (H - HAUT - BAS);
  const vues = new Set();

  const lignes = course.pilotes.map((p, i) => {
    const couleur = p.eq ? couleurEq(p.eq) : p.couleur;
    // Deux équipiers ont la même couleur : le second est en pointillés (convention des graphiques F1)
    const pointilles = vues.has(couleur); vues.add(couleur);
    const pts = p.pos.map((v, t) => v ? `${x(t).toFixed(1)},${y(v).toFixed(1)}` : null).filter(Boolean);
    const d = "M" + pts.join(" L");
    const fin = p.pos[p.pos.length - 1], tFin = p.pos.length - 1;
    const arrets = p.arrets.filter(t => p.pos[t]).map(t => `<circle cx="${x(t)}" cy="${y(p.pos[t])}" r="${rayonArret}"/>`).join("");
    const podium = !p.abandon && i < 3 ? " podium" : "";
    return `<g class="pilote${podium}" data-i="${i}" style="--c:${couleur}">
      <path class="zone" d="${d}"/>
      <path class="trace${pointilles ? " pointilles" : ""}" d="${d}" pathLength="1" style="--delai:${(i * 40)}ms"/>
      <g class="arrets">${arrets}</g>
      ${p.abandon ? `<text class="dnf" x="${x(tFin) + 4}" y="${y(fin) + 3}">✕</text>`
        : `<text class="code-fin" x="${L - D + 6}" y="${y(fin) + 3.5}">${esc(p.code)}</text>`}
      <text class="code-depart" x="${G - 6}" y="${y(p.pos[0]) + 3.5}">${esc(p.code)}</text>
    </g>`;
  }).join("");

  const graduations = [];
  for (let tour = graduation; tour < tours; tour += graduation) graduations.push(`<text x="${x(tour)}" y="${H - 6}">${tour}</text><line x1="${x(tour)}" x2="${x(tour)}" y1="${HAUT}" y2="${H - BAS}"/>`);

  return `<div class="graphique-course">
    <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="${t("graphique.aria")}">
      <g class="grille">${graduations.join("")}<text x="${L - D}" y="${H - 6}">${tours}</text></g>
      ${lignes}
    </svg>
    <p class="resume">${t("graphique.survol")} · <span class="legende"><i class="pt-arret"></i> ${t("graphique.arret")} <i class="pt-dnf">✕</i> ${t("graphique.abandon")}</span></p>
  </div>`;
}

const resume = p => {
  const depart = p.pos[0], fin = p.pos[p.pos.length - 1], gain = depart - fin;
  const arrets = p.arrets.length ? t("graphique.arrets", { n: p.arrets.length, tours: p.arrets.join(", T") }) : t("graphique.aucunArret");
  const issue = p.abandon ? t("graphique.abandonTour", { tour: p.pos.length - 1 }) : t("graphique.arrivee", { place: fin });
  return `${t("graphique.resume", { code: p.code, depart, fin: issue })}
    ${!p.abandon && gain ? `<span class="${gain > 0 ? "gain" : "perte"}">${gain > 0 ? "+" : ""}${gain}</span>` : ""} · ${arrets}`;
};

/** Branche les interactions et lance le dessin des lignes. */
export function animerGraphique(boite, course) {
  const svg = boite.querySelector("svg"), texte = boite.querySelector(".resume"), defaut = texte.innerHTML;
  svg.addEventListener("pointerover", e => {
    const g = e.target.closest(".pilote");
    if (!g) return;
    svg.classList.add("focus");
    svg.querySelectorAll(".pilote.actif").forEach(x => x.classList.remove("actif"));
    g.classList.add("actif");
    g.parentNode.append(g);   // au premier plan
    texte.innerHTML = resume(course.pilotes[g.dataset.i]);
  });
  svg.addEventListener("pointerleave", () => {
    svg.classList.remove("focus");
    svg.querySelectorAll(".pilote.actif").forEach(x => x.classList.remove("actif"));
    texte.innerHTML = defaut;
  });
  // Les lignes se dessinent quand le graphique arrive à l'écran (il est plus bas dans la fiche)
  if (reduit || !("IntersectionObserver" in window)) return svg.classList.add("dessine");
  const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { svg.classList.add("dessine"); obs.disconnect(); } }, { threshold: 0.35 });
  obs.observe(svg);
}
