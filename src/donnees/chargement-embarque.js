// Artifact (fichier unique) : tout est inclus. Le chargement à la demande casse l'ordre
// d'initialisation une fois tout fusionné en un seul script (« Cannot access … before initialization »).
const saisons = import.meta.glob("./saisons/*.json", { import: "default", eager: true });
const courses = import.meta.glob("./courses/*.json", { import: "default", eager: true });
export const lireSaison = async annee => saisons[`./saisons/${annee}.json`];
export const lireCourse = async (annee, round) => courses[`./courses/${annee}-${round}.json`] ?? null;
