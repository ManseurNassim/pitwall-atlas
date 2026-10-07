// Contrôle de cohérence, lancé avant chaque build (npm run verifier) :
// - toute clé de texte utilisée (t("…"), data-t*) existe dans les textes de chaque langue ;
// - les données générées ne référencent rien d'inconnu (circuit, écurie sans couleur, continent sans cadrage ni nom).
// Code de sortie 1 s'il y a une erreur ; les avertissements n'arrêtent pas le build.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const lire = f => JSON.parse(readFileSync(f, "utf8"));
const fichiers = (dossier, ext) => readdirSync(dossier, { recursive: true }).filter(f => f.endsWith(ext)).map(f => join(dossier, f));
const erreurs = [], avertissements = [];

/* ---------- Textes ---------- */
const langues = readdirSync("src/config").filter(f => /^textes\.\w+\.json$/.test(f));
const existe = (textes, cle) => cle.split(".").reduce((o, k) => o?.[k], textes) != null;
const sources = [...fichiers("src", ".js").map(f => readFileSync(f, "utf8")), readFileSync("index.html", "utf8")].join("\n");
const cles = new Set([
  ...[...sources.matchAll(/\bt\(\s*"([\w.]+)"/g)].map(m => m[1]),
  ...[...sources.matchAll(/data-t(?:-aria|-titre)?="([\w.]+)"/g)].map(m => m[1]),
].filter(cle => !cle.endsWith(".")));   // « "fiche." + nom » est construite à l'exécution : ignorée
for (const f of langues) {
  const textes = lire(join("src/config", f));
  for (const cle of cles) if (!existe(textes, cle)) erreurs.push(`${f} : clé de texte manquante « ${cle} »`);
}

/* ---------- Données générées ---------- */
const equipes = lire("src/config/equipes.json"), reglages = lire("src/config/reglages.json");
const textesBase = lire(`src/config/textes.${reglages.langue}.json`);
const circuits = lire("src/donnees/circuits.json");
const equipesVues = new Set();
for (const f of fichiers("src/donnees/saisons", ".json")) {
  const s = lire(f);
  for (const c of s.courses) {
    if (!circuits[c.id]) erreurs.push(`${f} : circuit inconnu « ${c.id} » (ajouter sa fiche dans data/circuits_meta.json)`);
    c.vainqueur?.podium.forEach(p => equipesVues.add(p.eqId));
  }
  s.pilotes.forEach(p => equipesVues.add(p.eqId));
  s.constructeurs.forEach(e => equipesVues.add(e.id));
}
for (const id of equipesVues) if (!equipes[id]) avertissements.push(`écurie sans couleur dans src/config/equipes.json : « ${id} » (couleur par défaut utilisée)`);
for (const c of Object.values(circuits)) {
  if (!reglages.continents[c.continent]) erreurs.push(`continent sans cadrage dans reglages.json : « ${c.continent} »`);
  if (!textesBase.continents?.[c.continent]) erreurs.push(`continent sans nom dans les textes : « ${c.continent} »`);
}

/* ---------- Bilan ---------- */
avertissements.forEach(a => console.warn("⚠", a));
erreurs.forEach(e => console.error("✗", e));
console.log(`vérification : ${cles.size} clés de texte, ${langues.length} langue(s), ${Object.keys(circuits).length} circuits, `
  + `${equipesVues.size} écuries — ${erreurs.length} erreur(s), ${avertissements.length} avertissement(s)`);
process.exit(erreurs.length ? 1 : 0);
