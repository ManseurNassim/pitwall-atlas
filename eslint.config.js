// Contrôle du JavaScript (npm run lint) : règles recommandées d'ESLint, code navigateur (src) et Node (scripts).
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/", "dist-artifact/", "node_modules/"] },
  js.configs.recommended,
  { files: ["src/**/*.js"], languageOptions: { globals: globals.browser } },
  { files: ["scripts/**/*.mjs", "*.config.js"], languageOptions: { globals: globals.node } },
];
