import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/usage-count.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { usageCount } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

// Read-only query adapter: fail if the counter tries to mutate or load desktop event contents.
function database(state) {
  return { from(table) { return { select(fields, options) {
    if (table === "download_stats") {
      assert.equal(fields, "count");
      return { eq(key, value) {
        assert.equal(key, "id"); assert.equal(value, 1);
        return { single: async () => ({ data: state.base == null ? null : { count: state.base }, error: state.baseError }) };
      } };
    }
    assert.equal(table, "patch_events");
    assert.equal(fields, "id");
    assert.deepEqual(options, { count: "exact", head: true });
    return { eq(key, value) {
      assert.equal(key, "ok"); assert.equal(value, true);
      return Promise.resolve({ count: state.missingDesktop ? null : state.events.filter(event => event.ok).length, error: state.desktopError });
    } };
  } }; } };
}

test("past and future successful app patches join the shared total exactly once", async () => {
  const state = { base: 240, events: [...Array.from({ length: 21 }, () => ({ ok: true })), { ok: false }] };
  const db = database(state);
  assert.equal(await usageCount(db), 261);
  assert.equal(await usageCount(db), 261);
  state.events.push({ ok: false });
  assert.equal(await usageCount(db), 261);
  state.events.push({ ok: true });
  assert.equal(await usageCount(db), 262);
  state.base++; // A web conversion uses the existing counter increment.
  assert.equal(await usageCount(db), 263);
  assert.equal(await usageCount(db), 263);
});

test("no desktop events preserves the baseline, and unavailable data is not invented", async () => {
  assert.equal(await usageCount(database({ base: 240, events: [] })), 240);
  assert.equal(await usageCount(database({ base: null, events: [] })), null);
  assert.equal(await usageCount(database({ base: 240, events: [], missingDesktop: true })), null);
});

test("database errors propagate instead of presenting a misleading lower total", async () => {
  await assert.rejects(() => usageCount(database({ base: 240, events: [], desktopError: new Error("desktop lookup failed") })), /desktop lookup failed/);
  await assert.rejects(() => usageCount(database({ base: 240, events: [], baseError: new Error("base lookup failed") })), /base lookup failed/);
});
