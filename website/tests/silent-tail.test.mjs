import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import ts from "typescript";

const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString("base64")}`;
const patchUrl = url(await readFile(new URL("../src/lib/oqm/patch.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/lib/oqm/silentTail.ts", import.meta.url), "utf8")).replace('"./patch"', JSON.stringify(patchUrl));
const { silentTail } = await import(url(source));
const { readTopLevel } = await import(patchUrl);
let dir;
function command(exe, args, opts = {}) {
  const r = spawnSync(exe, args, { maxBuffer: 32 * 1024 * 1024, ...opts });
  assert.equal(r.status, 0, `${exe}: ${r.error ?? r.stderr}`);
  return r.stdout;
}
before(async () => { dir = await mkdtemp(path.join(tmpdir(), "oqm-silent-tail-")); });
after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

async function fixture(name, rate = 48000, channels = 2, extra = []) {
  const file = path.join(dir, name);
  command("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=s=320x568:r=60:d=0.6",
    "-f", "lavfi", "-i", `sine=sample_rate=${rate}:d=0.6`, "-ac", String(channels),
    "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", ...extra, file]);
  return { file, blob: new Blob([await readFile(file)]) };
}
for (const [name, rate, extra] of [
  ["48k-tail-index", 48000, []], ["44k-faststart", 44100, ["-movflags", "+faststart"]],
  ["no-edit-list", 48000, ["-use_editlist", "0"]],
]) {
  test(`silent-tail ${name}: pinned Python byte parity, packet identity, decoded frames, both audio tracks`, async () => {
    const input = await fixture(`${name}.mp4`, rate, 2, extra);
    const result = await silentTail(input.blob);
    const expected = command("python3", ["-c", "import sys; from oqm._silent_tail_reference import patch_bytes_slsr; sys.stdout.buffer.write(patch_bytes_slsr(open(sys.argv[1], 'rb').read()))", input.file], { cwd: new URL("../../program/", import.meta.url) });
    assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()), expected);
    const out = path.join(dir, `${name}-output.mp4`);
    await writeFile(out, Buffer.from(await result.blob.arrayBuffer()));
    const checks = JSON.parse(command("python3", ["-c", "import json,sys; from oqm.verify import verify; print(json.dumps([vars(c) for c in verify(sys.argv[1],sys.argv[2],silent_tail=True)]))", input.file, out], { cwd: new URL("../../program/", import.meta.url) }));
    assert.deepEqual(checks.filter(c => !c.ok && !c.warn), []);
    assert.ok(checks.some(c => c.name === "original audio packets + silent tail" && c.ok));
    await assert.rejects(() => silentTail(result.blob), /requires one video and one audio/);
  });
}
test("silent-tail rejects mono, truncated and non-MP4 input", async () => {
  const input = await fixture("mono.mp4", 48000, 1);
  await assert.rejects(() => silentTail(input.blob), /AAC-LC stereo|AAC stereo/);
  await assert.rejects(() => silentTail(input.blob.slice(0, 100)), /Silent-tail/);
  await assert.rejects(() => silentTail(new Blob(["invalid media"])), /Silent-tail/);
});
test("silent-tail rejects truncated children inside an otherwise bounded movie index", async () => {
  const input = await fixture("nested-truncated.mp4");
  const top = await readTopLevel(input.blob), movie = top.find(b => b.type === "moov");
  assert.equal(movie.start + movie.size, input.blob.size);
  const bytes = Buffer.concat([Buffer.from(await input.blob.arrayBuffer()), Buffer.alloc(4)]);
  bytes.writeUInt32BE(movie.size + 4, movie.start);
  await assert.rejects(() => silentTail(new Blob([bytes])), /truncated child box/);
});
