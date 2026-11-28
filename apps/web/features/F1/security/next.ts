// ログインと安全（K-318）：戻る先 ?next= は中の道だけ（TP-AUTH-08）。features/F3/connect-pc/connect-pc.tsx の safeFrom と同じ読み方
//   （ブラウザと同じ new URL(v, 今の origin) で読み、同じ origin のときだけ道・問い・# を返す。整えると "//外" "/\\外" になる物は捨てる）
export function safeNext(
  v: string | null,
  origin: string = typeof window === "undefined" ? "" : window.location.origin,
): string | null {
  if (!v || !origin || !v.startsWith("/")) return null;
  let out: string;
  try {
    const u = new URL(v, origin);
    if (u.origin !== origin) return null;
    out = `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
  if (out.startsWith("//") || out.startsWith("/\\")) return null;
  try {
    return new URL(out, origin).origin === origin ? out : null;
  } catch {
    return null;
  }
}
