import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, test } from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Use the real Mediabunny MP4 reader and stream-copy path, with no browser encoder.
const dir = await mkdtemp(fileURLToPath(new URL("../.oqm-pipeline-test-", import.meta.url)));
after(() => rm(dir, { recursive: true, force: true }));
for (const name of ["patch", "silentTail", "pipeline"]) {
  const source = (await readFile(new URL(`../src/lib/oqm/${name}.ts`, import.meta.url), "utf8"))
    .replaceAll('"./patch"', '"./patch.mjs"').replaceAll('"./silentTail"', '"./silentTail.mjs"');
  await writeFile(path.join(dir, `${name}.mjs`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const { convert, prepareComparison, COMPARISON_PRESETS, DEFAULT_RECIPE, PRESETS } = await import(pathToFileURL(path.join(dir, "pipeline.mjs")));
test("latest standalone UI exposes the experimental option before selecting a video", async () => {
  const source = (await readFile(new URL("../src/components/Converter.tsx", import.meta.url), "utf8"))
    .replaceAll('"@/lib/oqm/patch"', '"./patch.mjs"').replaceAll('"@/lib/oqm/pipeline"', '"./pipeline.mjs"');
  await writeFile(path.join(dir, "Converter.mjs"), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: "Converter.tsx",
  }).outputText);
  const { default: Converter } = await import(pathToFileURL(path.join(dir, "Converter.mjs")));
  const html = renderToStaticMarkup(createElement(Converter, { standalone: true }));
  assert.match(html, /role="region"/);
  assert.match(html, /Choose your settings, then add a video/);
  assert.match(html, /Current OQM \(default\)/);
  assert.match(html, /Silent-tail \(experimental\)/);
  assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 1);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Make local comparison \(3\)<\/button>/);
});
test("comparison prepares one shared MP4 and reads back all three methods", async () => {
  const source = path.join(dir, "source.mp4");
  const made = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=s=320x568:r=60:d=0.5",
    "-f", "lavfi", "-i", "sine=sample_rate=48000:d=0.5", "-ac", "2", "-c:v", "libx264", "-preset", "ultrafast",
    "-c:a", "aac", "-shortest", "-movflags", "+faststart", source]);
  assert.equal(made.status, 0, made.stderr?.toString());
  const base = await prepareComparison(new File([await readFile(source)], "source.mp4"), { ...DEFAULT_RECIPE.encode, reencode: false }, () => {});
  for (const arm of COMPARISON_PRESETS) {
    const result = await convert(base, arm.recipe);
    assert.deepEqual(result.checks.filter(c => !c.ok && !c.warn), [], arm.title);
    assert.equal(result.info.width, 320);
    assert.equal(result.info.height, 568);
    assert.ok(Math.abs(result.info.fps - 60) < 0.01, `${arm.title}: ${result.info.fps}`);
    assert.equal(result.info.reencoded, false);
    assert.ok(result.info.mbps > 0);
  }
  assert.equal(PRESETS[0].recipe, DEFAULT_RECIPE);
  assert.notEqual(DEFAULT_RECIPE.method, "silent-tail");
});
