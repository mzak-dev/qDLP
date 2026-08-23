// Resolves and applies the theme preference (persisted the same way as
// every other setting — get_setting/set_setting, see ADR 0002) by toggling
// .dark on <html>. index.html hardcodes class="dark" as the pre-JS fallback,
// which matches the default below, so there's no flash for the common case.

import { useEffect, useState, type ReactNode } from "react";
import { getSetting, setSetting } from "@/lib/api";
import { ThemeContext, type ThemePreference } from "@/lib/theme";

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDark(preference: ThemePreference): boolean {
  return preference === "system" ? prefersDark() : preference === "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");

  useEffect(() => {
    void getSetting("theme").then((v) => {
      if (v === "light" || v === "dark" || v === "system") setPreferenceState(v);
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark(preference));
    if (preference !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => document.documentElement.classList.toggle("dark", mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    void setSetting("theme", next);
  };

  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>;
}
