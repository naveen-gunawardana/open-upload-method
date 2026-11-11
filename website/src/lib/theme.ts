export type Theme = "light" | "dark";
export const THEME_KEY = "oqm-theme";
const THEME_EVENT = "oqm-theme-change";

// Apply a saved choice before paint; a new visitor always gets light mode.
export const THEME_BOOTSTRAP = `(()=>{try{document.documentElement.dataset.theme=localStorage.getItem('oqm-theme')==='dark'?'dark':'light'}catch{document.documentElement.dataset.theme='light'}})()`;

export function getThemeSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* The toggle still works when storage is blocked. */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeTheme(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY && event.key !== null) return;
    document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    callback();
  };
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export const getServerTheme = (): Theme => "light";
