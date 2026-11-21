import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

// Like the existing mobile UI bundle, compile the shared TSX and let Next
// process its original CSS modules. Only include the two fields used here.
const ui = dirname(fileURLToPath(import.meta.resolve("@ductura/ui")));
const ulaz = resolve(ui, "prijava-problema-entry.ts");
const izlaz = resolve("node_modules/.ductura-mobile");
const bundle = await rolldown({
  input: ulaz,
  platform: "browser",
  transform: { jsx: "react-jsx" },
  external: ["react", "react/jsx-runtime"],
  plugins: [{
    name: "prijava-problema-polja",
    resolveId(id, importer) {
      if (id === ulaz) return ulaz;
      if (importer && id.endsWith(".module.css")) {
        const css = relative(izlaz, resolve(dirname(importer), id)).replaceAll("\\", "/");
        return { id: css, external: true };
      }
    },
    load(id) {
      if (id === ulaz) return 'export { Select } from "./components/Select"; export { TextArea } from "./components/TextArea";';
    },
  }],
});
try {
  await bundle.write({ file: resolve(izlaz, "prijava-problema.mjs"), format: "esm", banner: '"use client";' });
} finally {
  await bundle.close();
}
