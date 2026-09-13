#!/usr/bin/env bun
/**
 * Builds the single-file browser receipt verifier.
 *
 *   bun scripts/build-web-verifier.ts
 *
 * Bundles `web-verifier/main.ts` - which imports the app's own
 * `receiptExport.ts` - and inlines the result into `web-verifier/template.html`,
 * producing one self-contained HTML file with no external requests. It can be
 * opened from disk, emailed, or served as a static page, and it verifies
 * receipts with the network switched off.
 *
 * Inlining matters: a verifier that pulls its crypto from a CDN is asking you
 * to trust that CDN, which defeats the point of the exercise.
 */

import { writeFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const srcDir = join(root, "web-verifier");
const outDir = join(srcDir, "dist");
const outFile = join(outDir, "verify.html");

const PLACEHOLDER = "/*__PRIVATUM_VERIFIER_BUNDLE__*/";

const result = await Bun.build({
  entrypoints: [join(srcDir, "main.ts")],
  target: "browser",
  format: "iife",
  minify: true,
  sourcemap: "none",
});

if (!result.success) {
  console.error("Bundle failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

if (result.outputs.length !== 1) {
  console.error(`Expected a single bundled chunk, got ${result.outputs.length}.`);
  process.exit(1);
}

const js = await result.outputs[0].text();

const template = readFileSync(join(srcDir, "template.html"), "utf-8");
if (!template.includes(PLACEHOLDER)) {
  console.error(`template.html no longer contains ${PLACEHOLDER}`);
  process.exit(1);
}

// Guard against the bundle closing the inline <script> early.
if (js.includes("</script")) {
  console.error("Bundle contains a literal </script sequence; cannot inline safely.");
  process.exit(1);
}

// A page that reaches out at runtime is not an offline verifier. Checked before
// anything is written, so a failing build never leaves an artifact on disk.
for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /new\s+WebSocket/, /importScripts/]) {
  if (pattern.test(js)) {
    console.error(`Bundle contains a network primitive matching ${pattern}; refusing to ship.`);
    process.exit(1);
  }
}

// Replacer FUNCTION, not a string. A minified bundle contains sequences like
// `$&` and `$'` (bitwise ops on a variable named `$`), and String.replace reads
// those in a string replacement as "the matched text" / "the text after the
// match" - silently splicing the placeholder into the middle of the code and
// shipping a broken page. A function replacement disables that interpretation.
const html = template.replace(PLACEHOLDER, () => js);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html, "utf-8");

const kb = (statSync(outFile).size / 1024).toFixed(1);
console.log(`Built ${outFile}`);
console.log(`  ${kb} KB, fully self-contained, no external requests.`);
