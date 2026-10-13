import { build } from "esbuild";

// dist/main.js for `node dist/main.js` (M08 AC8, M10). @eduscope/contracts is TypeScript source, so
// it is bundled in; every npm dependency stays external and is loaded from node_modules at runtime.

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  plugins: [
    {
      name: "externalize-npm-packages",
      setup(builder) {
        builder.onResolve({ filter: /^[^./]/ }, (args) => (args.path.startsWith("@eduscope/") ? undefined : { path: args.path, external: true }));
      },
    },
  ],
});
console.log("built dist/main.js");
