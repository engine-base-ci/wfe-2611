// 端末・国・IP を要求から読む（KN-57・D-128.120）。端末は「ブラウザの種類／OS」まで（版の数字は見ない：更新のたびに入り直しにしない）
export function deviceOf(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser = /Kaname-Bridge/i.test(ua)
    ? "bridge"
    : /Kaname-API/i.test(ua)
      ? "api"
      : /Edg\//.test(ua)
        ? "edge"
        : /Firefox\//.test(ua)
          ? "firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "chrome"
            : /Safari\//.test(ua)
              ? "safari"
              : "other";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "ios"
    : /Android/.test(ua)
      ? "android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macos"
        : /Windows/.test(ua)
          ? "windows"
          : /Linux/.test(ua)
            ? "linux"
            : "other";
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
