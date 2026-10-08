/* Google Analytics (GA4), seulement avec l'accord du visiteur (règles CNIL : cookies de mesure = consentement).
   - identifiant : src/config/reglages.json → analytics.idMesure (vide = désactivé) ;
   - jamais dans l'Artifact (son navigateur bloque les scripts externes) ;
   - bandeau « Accepter / Refuser » au premier passage, choix gardé dans le navigateur ;
   - événements suivis : saison choisie, circuit ouvert, replay lancé. */
import { ecouter, etat } from "../etat.js";
import { reglages } from "./constantes.js";
import { t } from "./i18n.js";

const ID = reglages.analytics?.idMesure;
const CLE_CHOIX = "f1atlas-consentement";
const actif = !!ID && import.meta.env.MODE !== "artifact";
let charge = false;

const lireChoix = () => { try { return localStorage.getItem(CLE_CHOIX); } catch { return null; } };
const ecrireChoix = v => { try { localStorage.setItem(CLE_CHOIX, v); } catch { /* navigation privée */ } };

function charger() {
  if (charge) return;
  charge = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", ID);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
  document.head.append(s);
}

/** Envoie un événement (sans effet si Analytics n'est pas chargé). */
const evenement = (nom, params) => { if (charge) window.gtag("event", nom, params); };

function bandeau() {
  const el = document.createElement("div");
  el.className = "consentement";
  el.innerHTML = `<p>${t("consentement.texte")}</p>
    <button class="refuser">${t("consentement.refuser")}</button><button class="accepter">${t("consentement.accepter")}</button>`;
  const choisir = v => { ecrireChoix(v); el.remove(); if (v === "oui") charger(); };
  el.querySelector(".accepter").onclick = () => choisir("oui");
  el.querySelector(".refuser").onclick = () => choisir("non");
  document.body.append(el);
}

if (actif) {
  const choix = lireChoix();
  if (choix === "oui") charger();
  else if (choix !== "non") bandeau();

  ecouter("saison", ({ premiere }) => { if (!premiere) evenement("choisir_saison", { saison: etat.saison.annee }); });
  ecouter("circuit", c => { if (c) evenement("ouvrir_circuit", { circuit: c.id, saison: etat.saison.annee }); });
  ecouter("replay", quoi => { if (quoi === "debut") evenement("lancer_replay", { saison: etat.saison.annee }); });
}
