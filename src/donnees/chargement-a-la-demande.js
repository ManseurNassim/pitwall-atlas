// Site web : chaque saison / course est un fichier séparé, téléchargé seulement quand on en a besoin.
const saisons = import.meta.glob("./saisons/*.json", { import: "default" });
const courses = import.meta.glob("./courses/*.json", { import: "default" });
export const lireSaison = annee => saisons[`./saisons/${annee}.json`]();
export const lireCourse = (annee, round) => courses[`./courses/${annee}-${round}.json`]?.() ?? Promise.resolve(null);
