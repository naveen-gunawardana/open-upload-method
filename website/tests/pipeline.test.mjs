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
const analytics = await readFile(new URL("../src/lib/conversion-analytics.ts", import.meta.url), "utf8");
await writeFile(path.join(dir, "conversion-analytics.mjs"), ts.transpileModule(analytics, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
for (const name of ["patch", "silentTail", "pipeline"]) {
  const source = (await readFile(new URL(`../src/lib/oqm/${name}.ts`, import.meta.url), "utf8"))
    .replaceAll('"./patch"', '"./patch.mjs"').replaceAll('"./silentTail"', '"./silentTail.mjs"');
  await writeFile(path.join(dir, `${name}.mjs`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const { prepareInputDecoders, convert, prepareComparison, targetSize, targetFrameRate, COMPARISON_PRESETS, DEFAULT_RECIPE, PRESETS } = await import(pathToFileURL(path.join(dir, "pipeline.mjs")));
test("latest standalone UI exposes the experimental option before selecting a video", async () => {
  const help = await readFile(new URL("../src/components/SettingHelp.tsx", import.meta.url), "utf8");
  await writeFile(path.join(dir, "SettingHelp.mjs"), ts.transpileModule(help, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: "SettingHelp.tsx",
  }).outputText);
  const source = (await readFile(new URL("../src/components/Converter.tsx", import.meta.url), "utf8"))
    .replaceAll('"@/lib/oqm/patch"', '"./patch.mjs"').replaceAll('"@/lib/oqm/pipeline"', '"./pipeline.mjs"')
    .replaceAll('"@/components/SettingHelp"', '"./SettingHelp.mjs"').replaceAll('"@/lib/conversion-analytics"', '"./conversion-analytics.mjs"');
  await writeFile(path.join(dir, "Converter.mjs"), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: "Converter.tsx",
  }).outputText);
  const { default: Converter } = await import(pathToFileURL(path.join(dir, "Converter.mjs")));
  const html = renderToStaticMarkup(createElement(Converter, { standalone: true }));
  assert.match(html, /role="region"/);
  const presetSelect = html.match(/<label>Preset(<select>.*?<\/select>)<\/label>/)?.[1];
  assert.ok(presetSelect, "Preset settings are available before choosing a video");
  assert.match(presetSelect, /<option value="silent-tail" selected="">Silent-tail \(default\)<\/option>/);
  assert.match(presetSelect, /<option value="current">Original OQM<\/option>/);
  assert.match(presetSelect, /<option value="1080p">1080p — high quality<\/option>/);
  assert.match(presetSelect, /<option value="4k">4K — experimental<\/option>/);
  assert.equal((presetSelect.match(/selected=""/g) ?? []).length, 1);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Make local comparison \(3\)<\/button>/);
  assert.match(html, /<button[^>]*class="btn btn-convert btn-start"[^>]*disabled=""[^>]*>Start<svg/);
  const selected = renderToStaticMarkup(createElement(Converter, {
    standalone: true, file: new File(["test"], "selected-test.mp4", { type: "video/mp4" }),
  }));
  assert.match(selected, /selected-test\.mp4/);
  assert.match(selected, /Change video/);
  assert.match(selected, /<button[^>]*class="btn btn-convert btn-start"[^>]*>Start<svg/);
  assert.doesNotMatch(selected.match(/<button[^>]*class="btn btn-convert btn-start"[^>]*>/)?.[0] ?? "", /disabled/);
  assert.doesNotMatch(selected, /Start again|run-running|Working…|studio-upload/);
});
test("resolution presets downscale in both orientations without upscaling or changing the default", () => {
  const hd = PRESETS.find(p => p.id === "1080p").recipe;
  const uhd = PRESETS.find(p => p.id === "4k").recipe;
  assert.deepEqual(targetSize({ width: 3840, height: 2160 }, hd.encode.size), { width: 1920, height: 1080 });
  assert.deepEqual(targetSize({ width: 2160, height: 3840 }, hd.encode.size), { width: 1080, height: 1920 });
  assert.deepEqual(targetSize({ width: 7680, height: 4320 }, uhd.encode.size), { width: 3840, height: 2160 });
  assert.deepEqual(targetSize({ width: 4320, height: 7680 }, uhd.encode.size), { width: 2160, height: 3840 });
  assert.deepEqual(targetSize({ width: 1920, height: 1080 }, uhd.encode.size), {});
  assert.deepEqual(targetSize({ width: 1280, height: 720 }, hd.encode.size), {});
  for (const recipe of [hd, uhd]) {
    assert.equal(recipe.encode.codec, "avc");
    assert.equal(recipe.encode.reencode, true);
    assert.equal(recipe.encode.rate, "bitrate");
    assert.equal(recipe.encode.keyframeSec, 2);
    assert.equal(recipe.encode.audioKbps, 320);
    assert.notEqual(recipe.method, "silent-tail");
    for (const fps of [24, 29.97, 30, 59.94, 60]) assert.equal(targetFrameRate(fps, recipe.encode.fps), undefined);
    for (const fps of [90, 120]) assert.equal(targetFrameRate(fps, recipe.encode.fps), 60);
  }
  assert.equal(hd.encode.mbps, 20);
  assert.equal(uhd.encode.mbps, 60);
  assert.equal(targetFrameRate(120, null), undefined);
  assert.equal(targetFrameRate(24, 60), 60);
  assert.equal(PRESETS[0].recipe, DEFAULT_RECIPE);
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
  assert.equal(DEFAULT_RECIPE.method, "silent-tail");
  assert.equal(DEFAULT_RECIPE.encode.reencode, true);
  assert.equal(DEFAULT_RECIPE.encode.codec, "avc");
  assert.deepEqual(DEFAULT_RECIPE.patch.enabled, []);
  const original = PRESETS.find(p => p.id === "current").recipe;
  assert.notEqual(original.method, "silent-tail");
  assert.ok(original.patch.enabled.includes("decoy-audio"));
});

// Decode real ProRes + PCM data with the production registration path, not a mocked browser codec.
test("ProRes MOV loads its decoder on demand and preserves decodable PCM audio", async () => {
  const { Input, BlobSource, ALL_FORMATS, VideoSampleSink, AudioSampleSink } = await import("mediabunny");
  const source = path.join(dir, "prores.mov");
  const made = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=s=128x72:r=30:d=0.1",
    "-f", "lavfi", "-i", "sine=sample_rate=48000:d=0.1", "-ac", "2", "-c:v", "prores_ks", "-profile:v", "1",
    "-pix_fmt", "yuv422p10le", "-c:a", "pcm_s16le", "-shortest", source]);
  assert.equal(made.status, 0, made.stderr?.toString());
  const input = new Input({ source: new BlobSource(new Blob([await readFile(source)])), formats: ALL_FORMATS });
  try {
    const stages = [];
    await prepareInputDecoders(input, stage => stages.push(stage.label));
    assert.ok(stages.includes("Loading ProRes support"));
    const video = await input.getPrimaryVideoTrack();
    assert.equal(video.codec, "prores");
    assert.equal(await video.canDecode(), true);
    let frames = 0;
    for await (const sample of new VideoSampleSink(video).samples()) {
      assert.equal(sample.displayWidth, 128);
      assert.equal(sample.displayHeight, 72);
      sample.close();
      frames++;
    }
    assert.equal(frames, 3);
    const audio = await input.getPrimaryAudioTrack();
    assert.equal(await audio.canDecode(), true);
    const sample = await new AudioSampleSink(audio).getSample(0);
    assert.ok(sample);
    assert.equal(sample.numberOfChannels, 2);
    sample.close();
    await assert.rejects(prepareInputDecoders(input, () => {}, AbortSignal.abort()), /Stopped/);
  } finally { input.dispose(); }
});
