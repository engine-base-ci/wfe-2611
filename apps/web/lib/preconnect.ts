// 口へ先につなぐ（K-235）。口の住所（WEB_ENV.apiBase）が画面と別の出どころなら、その出どころ（道を除く）を返す。
//   画面は JS を読んで描いてから口を呼ぶので、HTML の頭で先に DNS・TCP・TLS を始めておく（根の layout が <link rel="preconnect"> を置く）。
//   空（画面と同じ住所・K-262 の後）・形が違う・http と https 以外（URL.origin が文字の "null" になる物）は null（何も出さない）
//   React の preconnect() は Next.js では答えの Link の頭書き（HTTP ヘッダ）に回り HTML に出ないので、<link> を直に描く（React 19 が頭に上げる）

export function apiPreconnect(apiBase: string): string | null {
  if (!apiBase) return null;
  let url: URL;
  try {
    url = new URL(apiBase);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.origin;
}
