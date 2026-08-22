// Split out of theme-provider.tsx: a file that exports both a component and
// a hook/context defeats React Fast Refresh (full reload instead of HMR on
// every edit) — same convention as jobs-context.ts.

import { createContext, useContext } from "react";

export type ThemePreference = "light" | "dark" | "system";

export interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
