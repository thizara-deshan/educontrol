import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildHwJsonSchema } from "./hw-json-schema.ts";

const dir = new URL("../generated/", import.meta.url);
const target = new URL("hw.schema.json", dir);
mkdirSync(dir, { recursive: true });
writeFileSync(target, buildHwJsonSchema());
console.log(`wrote ${fileURLToPath(target)}`);
