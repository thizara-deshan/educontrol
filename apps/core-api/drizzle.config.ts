import { defineConfig } from "drizzle-kit";

// Only used by `db:generate`; the app runs the generated SQL with drizzle's migrator (src/db/client.ts).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
