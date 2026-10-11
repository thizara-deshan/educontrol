import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/generated/**",
      "reference/**",
      "refrenced-guide/**",
      "guide/**",
      "docs/**",
      "services/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
);
