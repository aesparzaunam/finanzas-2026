import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scratch test scripts (use CommonJS require by design)
    "test_*.js",
    "test_*.mjs",
  ]),
  {
    rules: {
      // El proyecto usa CSS custom properties (--var) dinámicas vía style prop,
      // que por definición no pueden ser movidas a archivos CSS estáticos.
      "@next/next/no-css-inline-styles": "off",
      // Patrón estándar de next-themes: useState(false) + useEffect(() => setMounted(true), [])
      // es el método oficial para evitar hydration mismatch. No es un cascading render peligroso.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
