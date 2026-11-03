// 見た目（D-128.55：システムに合わせる・明るい・暗い）。選んだものは cookie に残し、サーバーが <html data-theme> に付ける
//   画面に小さなスクリプトを差し込まない（CSP の nonce に頼らない・ZT11）。「システム」のときは data-theme を付けず、CSS の prefers-color-scheme に任せる
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "k-theme";
export const THEME_LABEL: Record<Theme, string> = { system: "システム", light: "明るい", dark: "暗い" };

export function parseTheme(v: string | undefined | null): Theme {
  return (THEMES as readonly string[]).includes(v ?? "") ? (v as Theme) : "system";
}
/** <html data-theme> に付ける値。システムのときは付けない */
export function themeAttr(t: Theme): "light" | "dark" | undefined {
  return t === "system" ? undefined : t;
}
/** 1 年残す。画面の JS から読む必要は無いが、書くのは画面（document.cookie）なので HttpOnly にはしない */
export function themeCookie(t: Theme): string {
  return `${THEME_COOKIE}=${t}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
