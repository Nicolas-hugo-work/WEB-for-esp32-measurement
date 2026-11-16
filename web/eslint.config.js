import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dev-dist", "src/lib/database.types.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.serviceworker } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // XSS: la sesión vive en localStorage, así que nunca se inyecta HTML.
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Prohibido: riesgo de XSS." },
      ],
    },
  },
);
