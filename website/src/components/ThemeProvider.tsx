"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { getServerTheme, getThemeSnapshot, setTheme, subscribeTheme, type Theme } from "@/lib/theme";

const ThemeContext = createContext<Theme>("light");
export const useTheme = () => useContext(ThemeContext);

export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "light" ? "dark" : "light";
  return (
    <button className="theme-toggle" type="button" onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === "light" ? <path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" /> : <>
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>}
      </svg>
      <span>{next === "dark" ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerTheme);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
