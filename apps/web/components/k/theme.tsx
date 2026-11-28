"use client";
// 見た目の切り替え（D-128.55）。押すとその場で <html data-theme> を替え、cookie に残す（次に開いたときもサーバーが同じ見た目で出す）
import { useState } from "react";
import { THEMES, THEME_LABEL, themeAttr, themeCookie, type Theme } from "@/lib/theme";

export function applyTheme(t: Theme): void {
  const a = themeAttr(t);
  if (a) document.documentElement.dataset["theme"] = a;
  else delete document.documentElement.dataset["theme"];
  document.cookie = themeCookie(t);
}

export function ThemeSwitch({ initial }: { initial: Theme }) {
  const [t, setT] = useState<Theme>(initial);
  return (
    <fieldset className="k-theme">
      <legend className="sr-only">見た目</legend>
      {THEMES.map((x) => (
        <label key={x}>
          <input
            type="radio"
            name="k-theme"
            value={x}
            checked={t === x}
            onChange={() => {
              setT(x);
              applyTheme(x);
            }}
          />
          {THEME_LABEL[x]}
        </label>
      ))}
    </fieldset>
  );
}
