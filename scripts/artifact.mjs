// Adapte le fichier unique produit par Vite au format Artifact : pas de <html>/<head>/<body>
// (la plateforme ajoute son propre squelette), seulement titre, liens, styles, scripts et contenu.
import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync("dist-artifact/index.html", "utf8");
const tete = source.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta (charset|name="viewport")[^>]*>/g, "");
const corps = source.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync("dist-artifact/pitwall-atlas.html", (tete + corps).trim() + "\n");
console.log(`dist-artifact/pitwall-atlas.html : ${Math.round((tete + corps).length / 1024)} Ko`);
