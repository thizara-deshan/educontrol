import { fileURLToPath } from "node:url";

// Lives directly in src/ so the same relative URL works from src/*.ts (tsx, vitest) and from the
// bundled dist/main.js: both sit one level below apps/core-api/.
export const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle/", import.meta.url));
/** core-api's own package.json: S3e "Software version". */
export const PACKAGE_JSON = fileURLToPath(new URL("../package.json", import.meta.url));
