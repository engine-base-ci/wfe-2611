// 端末・国・IP を要求から読む（K-20・D-128.120）。端末は「ブラウザの種類／OS」まで（版の数字は見ない：更新のたびに入り直しにしない）
import { UAParser } from "ua-parser-js";

const BROWSERS: Record<string, string> = {
  chrome: "chrome",
  "chrome headless": "chrome",
  "mobile chrome": "chrome",
  chromium: "chrome",
  edge: "edge",
  firefox: "firefox",
  "mobile firefox": "firefox",
  safari: "safari",
  "mobile safari": "safari",
};
const OSES: Record<string, string> = {
  "mac os": "macos",
  macos: "macos",
  ios: "ios",
  ipados: "ios",
  android: "android",
  windows: "windows",
  linux: "linux",
  ubuntu: "linux",
  debian: "linux",
  fedora: "linux",
  "chrome os": "chromeos",
};

// 端末の読み取りは ua-parser-js（1 系・MIT。2 系は AGPL なので使わない）に任せる。Kaname の Bridge と API の呼び手だけは自分の印で見分ける
export function deviceOf(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const r = new UAParser(ua).getResult();
  const own = /Kaname-Bridge/i.test(ua) ? "bridge" : /Kaname-API/i.test(ua) ? "api" : null;
  const browser = own ?? BROWSERS[(r.browser.name ?? "").toLowerCase()] ?? "other";
  const osName = (r.os.name ?? "").toLowerCase();
  const os =
    OSES[osName] ??
    (/iPhone|iPad|iPod/.test(ua)
      ? "ios"
      : /Android/.test(ua)
        ? "android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macos"
          : /Windows/.test(ua)
            ? "windows"
            : /Linux/.test(ua)
              ? "linux"
              : "other");
  return `${browser}/${os}`;
}

/** 国：配布先（Vercel）が付ける印だけを信じる。無い所（ローカル・Docker）では null（国では判定しない） */
export function countryOf(h: Headers): string | null {
  const c = h.get("x-vercel-ip-country");
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : null;
}

export function ipOf(h: Headers): string | null {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}
