import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import ts from "typescript";

// Compile the actual port with the project's TypeScript dependency; no browser or test framework required.
const source = await readFile(new URL("../src/lib/oqm/patch.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { ALL_PATCHES, DEFAULT_PATCH, REFERENCE, Box, isPatchReady, parseBoxes, patchVideo, readTopLevel } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

let dir;
let clip;
let silent;
let noEditList;

function command(name, args, options = {}) {
  const result = spawnSync(name, args, options);
  assert.equal(result.status, 0, `${name} failed: ${result.error ?? result.stderr}`);
  return result.stdout;
}

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "oqm-patch-test-"));
  async function make(name, extra = [], audio = true) {
    const filename = path.join(dir, name);
    const args = ["-v", "error", "-f", "lavfi", "-i", "testsrc2=s=320x568:r=30:d=0.6"];
    if (audio) args.push("-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:d=0.6");
    args.push("-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p");
    if (audio) args.push("-c:a", "aac", "-shortest");
    args.push("-movflags", "+faststart", ...extra, filename);
    command("ffmpeg", args);
    return new Blob([await readFile(filename)]);
  }
  clip = await make("source.mp4");
  silent = await make("silent.mp4", [], false);
  noEditList = await make("no-edit-list.mp4", ["-use_editlist", "0"]);
});

after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

async function mediaBytes(blob) {
  const mdat = (await readTopLevel(blob)).find((box) => box.type === "mdat");
  assert.ok(mdat);
  return Buffer.from(await blob.slice(mdat.start + mdat.header, mdat.start + mdat.size).arrayBuffer());
}

const profiles = {
  reference: REFERENCE,
  control: ["faststart"],
  minimal: ["faststart", "decoy-audio"],
  structure: REFERENCE.filter((id) => id !== "decoy-audio"),
  "video decoy": ALL_PATCHES,
};

for (const [name, enabled] of Object.entries(profiles)) {
  test(`${name}: matches Python byte for byte and preserves the compressed media`, async () => {
    const result = await patchVideo(clip, { ...DEFAULT_PATCH, enabled });
    assert.deepEqual(result.checks.filter((check) => !check.ok && !check.warn), []);
    assert.deepEqual(await mediaBytes(result.blob), await mediaBytes(clip));
    const python = command("python3", ["-c", [
      "import json, sys",
      "from oqm import mp4, patches",
      "_, boxes = mp4.read_file(sys.argv[1])",
      "out, _ = patches.patch_boxes(boxes, patches.PatchOptions(enabled=set(json.loads(sys.argv[2]))))",
      "sys.stdout.buffer.write(out)",
    ].join("\n"), path.join(dir, "source.mp4"), JSON.stringify(enabled)], {
      cwd: new URL("../../program/", import.meta.url),
    });
    assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()), python);
  });
}

test("padding boxes are preserved until Strip padding boxes is enabled", async () => {
  const skip = new Box("skip", { payload: new Uint8Array([1, 2, 3, 4]) }).serialize();
  const input = new Blob([clip, skip]);
  for (const strip of [false, true]) {
    const result = await patchVideo(input, { ...DEFAULT_PATCH, enabled: strip ? ["faststart", "strip-free"] : ["faststart"] });
    const boxes = await readTopLevel(result.blob);
    assert.equal(boxes.some((box) => box.type === "skip"), !strip);
    assert.deepEqual(await mediaBytes(result.blob), await mediaBytes(input));
    assert.ok(result.checks.every((check) => check.ok));
  }
});

test("silent videos skip the audio decoy and keep the video intact", async () => {
  const result = await patchVideo(silent);
  assert.ok(result.skipped.some((id) => id.startsWith("decoy-audio")));
  assert.ok(result.checks.every((check) => check.ok));
  assert.deepEqual(await mediaBytes(result.blob), await mediaBytes(silent));
});

test("an encode without an edit list gets a one-tick extension", async () => {
  const result = await patchVideo(noEditList);
  assert.ok(result.applied.includes("video-elst-plus-one"));
  const moov = (await readTopLevel(result.blob)).find((box) => box.type === "moov");
  const tree = parseBoxes(new Uint8Array(await result.blob.slice(moov.start, moov.start + moov.size).arrayBuffer()))[0];
  assert.ok(tree.findAll("trak").some((track) => track.find("edts", "elst")));
  assert.deepEqual(await mediaBytes(result.blob), await mediaBytes(noEditList));
});

test("a second video track forces remux before patching", async () => {
  assert.equal(await isPatchReady(clip), true);
  const result = await patchVideo(clip, { ...DEFAULT_PATCH, enabled: ALL_PATCHES });
  assert.equal(await isPatchReady(result.blob), false);
});

test("invalid and fragmented files fail with an actionable error", async () => {
  await assert.rejects(patchVideo(new Blob(["not a video"])), /MP4 or MOV/);
  const fragment = new Box("moof").serialize();
  await assert.rejects(patchVideo(new Blob([clip, fragment])), /fragmented MP4/);
});
