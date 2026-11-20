import { rolldown } from "rolldown";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const output = resolve("node_modules/.ductura-mobile");

// The two private source packages ship TypeScript. Next gets JS and handles
// the original UI CSS modules. React and ProseMirror stay shared with the app.
async function bundleSource(name, exports) {
  const source = dirname(fileURLToPath(import.meta.resolve(`@ductura/${name}`)));
  const entry = resolve(source, "mobile-entry.ts");
  const bundle = await rolldown({
    input: entry,
    platform: "browser",
    transform: { jsx: "react-jsx" },
    external: ["react", "react/jsx-runtime", "@tiptap/core", /^@tiptap\/pm\//],
    onLog(level, log, handler) {
      if (log.code !== "MODULE_LEVEL_DIRECTIVE") handler(level, log);
    },
    plugins: [{
      name: "mobile-package-entry",
      resolveId(id, importer) {
        if (id === entry) return entry;
        if (importer && id.endsWith(".module.css")) {
          const css = relative(output, resolve(dirname(importer), id)).replaceAll("\\", "/");
          return { id: css, external: true };
        }
      },
      load(id) { if (id === entry) return exports; },
    }],
  });
  try {
    await bundle.write({ file: resolve(output, `${name}.mjs`), format: "esm", banner: '"use client";' });
  } finally {
    await bundle.close();
  }
}

await bundleSource("editor-core", `
  export { EvidenceRecorder } from "./editor/capture";
  export { SourceObserver, recordWithSource } from "./editor/source";
  export { createEditorExtensions, createEditorExtensionsV2, createEditorExtensionsV3 } from "./editor/schema";
  export { StorableInput } from "./editor/storable-input";
  export { canonicalToTiptap } from "./editor/interop";
  export { canonicalToTiptapV2 } from "./editor/interop-v2";
  export { canonicalToTiptapV3 } from "./editor/interop-v3";
  export { verifyWorkOpening } from "./serverSync/work-opening";
  export { verifySignedEvidenceReceiptV2 } from "./document/forensics/evidence-receipt-verifier";
`);

await bundleSource("ui", `
  export { Button } from "./components/Button";
  export { Dialog } from "./components/Dialog";
  export { SaveState } from "./components/SaveState";
`);
