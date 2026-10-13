import { fileURLToPath } from "node:url";

// Lives directly in src/ so the same relative URL works from src/*.ts (tsx, vitest) and from the
// bundled dist/main.js: both sit one level below apps/core-api/.
export const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle/", import.meta.url));
