// Petites fonctions de mise en forme indépendantes de la langue (le reste est dans i18n.js).

export const pad = n => String(n).padStart(2, "0");

/** Échappe le texte injecté dans du HTML. */
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Durée restante découpée pour un compte à rebours. */
export function decompte(ms) {
  ms = Math.max(0, ms);
  return { j: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 };
}

/** Relance une animation CSS de classe `classe` sur un élément (retirer, forcer le recalcul, remettre). */
export function rejouer(el, classe) {
  el.classList.remove(classe);
  void el.offsetWidth;
  el.classList.add(classe);
}
