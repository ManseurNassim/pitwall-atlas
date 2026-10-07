// Tracé animé d'un circuit : dessin progressif, secteurs S1/S2/S3, voiture + comète.
import { reduit } from "../lib/constantes.js";
import { t } from "../lib/i18n.js";

/** HTML du bloc tracé (le chemin SVG est pré-calculé au build). */
export const htmlPiste = c => `
  <div class="piste">
    <svg viewBox="0 0 1000 640" role="img" aria-label="${t("piste.aria", { nom: c.nom })}">
      <defs>
        <linearGradient id="degrade-comete"><stop offset="0" style="stop-color:var(--rouge-vif);stop-opacity:0"/><stop offset="1" style="stop-color:var(--texte)"/></linearGradient>
        <pattern id="motif-grille" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="grille-fond" fill="none"/></pattern>
      </defs>
      <rect width="1000" height="640" fill="url(#motif-grille)"/>
      ${["ombre", "base", "trait", "secteur s1", "secteur s2", "secteur s3", "comete"].map(k => `<path class="${k}" d="${c.svg}"/>`).join("")}
      <g class="ligne-depart"></g>
      <circle class="voiture" r="7"/>
    </svg>
    <div class="legende-secteurs">${["s1", "s2", "s3"].map(s => `<span style="--c:var(--${s})">${t("piste." + s)}</span>`).join("")}</div>
  </div>`;

/** Damier de la ligne de départ, perpendiculaire au tracé. */
function damier(x, y, angle) {
  const cases = [...Array(6)].map((_, i) => {
    const cx = (i % 3) * 10, cy = -5 + Math.floor(i / 3) * 5, a = i % 2 ? "#fff" : "#111", b = i % 2 ? "#111" : "#fff";
    return `<rect x="${cx - 15}" y="${cy}" width="5" height="5" fill="${a}"/><rect x="${cx - 10}" y="${cy}" width="5" height="5" fill="${b}"/>`;
  }).join("");
  return `<g transform="translate(${x},${y}) rotate(${angle + 90})">${cases}</g>`;
}

let anim = null;
export const arreterPiste = () => cancelAnimationFrame(anim);

export function animerPiste(boite) {
  arreterPiste();
  const $ = s => boite.querySelector(s);
  const trait = $(".trait"), comete = $(".comete"), voiture = $(".voiture");
  const L = trait.getTotalLength(), tiers = L / 3;
  ["s1", "s2", "s3"].forEach((k, i) => { $("." + k).style.strokeDasharray = `0 ${i * tiers} ${tiers} ${L}`; });
  const a = trait.getPointAtLength(0), b = trait.getPointAtLength(6);
  $(".ligne-depart").innerHTML = damier(a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI);

  // Le tracé se dessine, puis les secteurs et la voiture apparaissent
  trait.style.strokeDasharray = L; trait.style.strokeDashoffset = reduit ? 0 : L;
  trait.getBoundingClientRect();
  trait.style.transition = "stroke-dashoffset 1.8s cubic-bezier(.6,.05,.3,1), opacity .8s";
  trait.style.strokeDashoffset = 0;
  setTimeout(() => boite.classList.add("prete"), reduit ? 0 : 1600);
  if (reduit) return;

  const queue = Math.min(L * .12, 180), dureeTour = Math.max(4200, Math.min(7000, L * 2.2));
  comete.style.strokeDasharray = `${queue} ${L}`;
  const t0 = performance.now() + 1700;
  (function image(t) {
    const d = (Math.max(0, t - t0) % dureeTour) / dureeTour * L;
    const p = trait.getPointAtLength(d);
    voiture.setAttribute("cx", p.x); voiture.setAttribute("cy", p.y);
    comete.style.strokeDashoffset = -(d - queue);
    anim = requestAnimationFrame(image);
  })(performance.now());
}
