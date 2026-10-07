import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const chemin = f => fileURLToPath(new URL(f, import.meta.url));

// `npm run build` → site statique (dist/) ; `npm run build:artifact` → un seul fichier HTML (dist-artifact/)
export default defineConfig(({ mode }) => {
  const artifact = mode === "artifact";
  return {
    base: "./",
    resolve: {
      alias: { "@chargement": chemin(artifact ? "./src/donnees/chargement-embarque.js" : "./src/donnees/chargement-a-la-demande.js") },
    },
    build: {
      target: "es2022",
      outDir: artifact ? "dist-artifact" : "dist",
      chunkSizeWarningLimit: 4000,
      // Site : la librairie 3D dans son propre fichier, mis en cache par le navigateur d'une mise à jour à l'autre
      rollupOptions: artifact ? {} : { output: { manualChunks: { globe: ["globe.gl"] } } },
    },
    plugins: artifact ? [viteSingleFile()] : [],
    // Artifact : noms de variables gardés. Le renommage du minifieur avait produit, par coïncidence,
    // une séquence que le validateur des Artifacts prenait pour une page de revue de code (publication refusée).
    esbuild: artifact ? { minifyIdentifiers: false } : {},
  };
});
