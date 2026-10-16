import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["frontend/dist/", "backend/public/", "coverage/", "node_modules/"],
  },
  js.configs.recommended,
  {
    files: ["frontend/**/*.{js,jsx}", "frontend/vite.config.js"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ["frontend/vite.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["backend/**/*.js", "scripts/**/*.js"],
    languageOptions: { globals: globals.node, parserOptions: { ecmaVersion: "latest", sourceType: "module" } },
  },
  {
    files: ["**/*.{test,spec}.{js,jsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
