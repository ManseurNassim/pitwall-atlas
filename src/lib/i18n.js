/* Textes et formats selon la langue (src/config/textes.<langue>.json, réglages → langue).
   - t("fiche.longueur", { … }) : texte avec paramètres {nom} ; un objet { one, other… } = pluriel (Intl.PluralRules) ;
   - traduirePage() : remplit les éléments HTML marqués data-t / data-t-aria / data-t-titre ;
   - dates et nombres : Intl du navigateur (aucune liste de mois ni séparateur décimal écrits à la main). */
import reglages from "../config/reglages.json";
import textesFr from "../config/textes.fr.json";
import { esc } from "./format.js";

const TEXTES = { fr: textesFr };
const LANGUE = reglages.langue;
const textes = TEXTES[LANGUE];
const pluriels = new Intl.PluralRules(LANGUE);

/** Texte traduit. Les paramètres de type texte sont échappés (le résultat va souvent dans innerHTML). */
export function t(cle, params = {}) {
  let v = cle.split(".").reduce((o, k) => o?.[k], textes);
  if (v == null) { console.warn(`[i18n] clé manquante : ${cle}`); return cle; }
  if (typeof v === "object" && !Array.isArray(v)) v = v[pluriels.select(params.n ?? 0)] ?? v.other;
  if (Array.isArray(v)) return v;
  return v.replace(/\{(\w+)\}/g, (_, k) => (typeof params[k] === "string" ? esc(params[k]) : params[k] ?? ""));
}

export function traduirePage(racine = document) {
  racine.querySelectorAll("[data-t]").forEach(el => { el.innerHTML = t(el.dataset.t); });
  racine.querySelectorAll("[data-t-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.tAria)));
  racine.querySelectorAll("[data-t-titre]").forEach(el => el.setAttribute("title", t(el.dataset.tTitre)));
  document.documentElement.lang = LANGUE;
}

const formatDate = new Intl.DateTimeFormat(LANGUE, { day: "numeric", month: "short" });
/** "2026-10-11" → "11 oct." */
export const dateCourte = iso => formatDate.format(new Date(iso + "T12:00:00"));

const formatsNombre = new Map();
/** Nombre à la française (virgule) avec exactement `decimales` chiffres ; sans argument : 0 ou 1 décimale. */
export function nombre(x, decimales) {
  const cle = decimales ?? "auto";
  if (!formatsNombre.has(cle)) {
    formatsNombre.set(cle, new Intl.NumberFormat(LANGUE, decimales == null
      ? { maximumFractionDigits: 1 } : { minimumFractionDigits: decimales, maximumFractionDigits: decimales }));
  }
  return formatsNombre.get(cle).format(x);
}
