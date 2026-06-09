import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Next 16 ships React-Compiler-era rules that flag legitimate
      // data-fetch-on-mount and auth-redirect effects. These patterns are
      // correct here (client-side token guards + fetch hooks), so relax the
      // two rules that produce false positives for them.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Backend has its own lint setup; not the frontend's concern.
    "server/**",
  ]),
]);

export default eslintConfig;
