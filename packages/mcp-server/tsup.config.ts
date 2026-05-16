import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  target: "es2022",
  outDir: "dist",
  // Bin entry needs a shebang prepended.
  banner: { js: "#!/usr/bin/env node" },
  // Bundle so consumers don't need to install peer deps.
  external: [],
});
