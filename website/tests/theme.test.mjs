import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { after, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const dir = await mkdtemp(fileURLToPath(new URL("../.oqm-theme-test-", import.meta.url)));
for (const [name, location] of [["theme", "lib/theme.ts"], ["ThemeProvider", "components/ThemeProvider.tsx"]]) {
  const source = (await readFile(new URL(`../src/${location}`, import.meta.url), "utf8")).replace('"@/lib/theme"', '"./theme.mjs"');
  await writeFile(path.join(dir, `${name}.mjs`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: location,
  }).outputText);
}
const { THEME_KEY, THEME_BOOTSTRAP, getThemeSnapshot, getServerTheme, setTheme, subscribeTheme } = await import(pathToFileURL(path.join(dir, "theme.mjs")));
const { default: ThemeProvider, ThemeToggle } = await import(pathToFileURL(path.join(dir, "ThemeProvider.mjs")));
const globals = new Map(["window", "document", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
after(async () => {
  for (const [key, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
  await rm(dir, { recursive: true, force: true });
});

function browser() {
  const saved = new Map();
  const win = new EventTarget();
  const doc = { documentElement: { dataset: {} } };
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return { saved, win, doc, storage };
}

test("first visits default to light and invalid stored choices cannot activate another theme", () => {
  const { saved } = browser();
  const beforePaint = new Function(THEME_BOOTSTRAP);
  beforePaint();
  assert.equal(getThemeSnapshot(), "light");
  assert.equal(getServerTheme(), "light");
  saved.set(THEME_KEY, "invalid-value");
  beforePaint();
  assert.equal(getThemeSnapshot(), "light");
});

test("toggle choices persist across reloads and listeners clean up", () => {
  const { saved, doc } = browser();
  let updates = 0;
  const unsubscribe = subscribeTheme(() => updates++);
  setTheme("dark");
  assert.equal(getThemeSnapshot(), "dark");
  assert.equal(saved.get(THEME_KEY), "dark");
  assert.equal(updates, 1);
  doc.documentElement.dataset.theme = "light";
  new Function(THEME_BOOTSTRAP)();
  assert.equal(getThemeSnapshot(), "dark");
  setTheme("light");
  assert.equal(getThemeSnapshot(), "light");
  assert.equal(saved.get(THEME_KEY), "light");
  unsubscribe();
  setTheme("dark");
  assert.equal(updates, 2);
});

test("theme preferences synchronize across tabs and reset to light when cleared", () => {
  const { win } = browser();
  let updates = 0;
  const unsubscribe = subscribeTheme(() => updates++);
  function storage(key, value) {
    const event = new Event("storage");
    Object.defineProperties(event, { key: { value: key }, newValue: { value } });
    win.dispatchEvent(event);
  }
  storage(THEME_KEY, "dark");
  assert.equal(getThemeSnapshot(), "dark");
  storage("unrelated", "light");
  assert.equal(getThemeSnapshot(), "dark");
  assert.equal(updates, 1);
  storage(null, null);
  assert.equal(getThemeSnapshot(), "light");
  unsubscribe();
});

test("blocked storage still allows the theme switch to work", () => {
  const { storage } = browser();
  storage.setItem = () => { throw new Error("blocked"); };
  storage.getItem = () => { throw new Error("blocked"); };
  assert.doesNotThrow(() => setTheme("dark"));
  assert.equal(getThemeSnapshot(), "dark");
  assert.doesNotThrow(() => new Function(THEME_BOOTSTRAP)());
  assert.equal(getThemeSnapshot(), "light");
});

test("the header switch offers dark mode on first render", () => {
  const light = renderToStaticMarkup(createElement(ThemeProvider, null, createElement(ThemeToggle)));
  assert.match(light, /Switch to dark mode/);

});
