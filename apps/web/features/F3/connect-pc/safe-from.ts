/** 戻る先は中の道だけ（外の道は捨てる・TP-AUTH-08）。ブラウザと同じ読み方（new URL(v, 今の origin)）で読み、
 *  同じ origin のときだけ使う（タブ・改行を落とすと "//外" になる・"/\\外"・"//外" も外として捨てる）。返すのは道・問い・#だけ */
export function safeFrom(
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
  // 道を整えると "//外" "/\\外" になるもの（/.//外・/..//外・/a/..//外・/%2e//外・/./\\外）は、href に置くと外の origin になる。捨てる
  if (out.startsWith("//") || out.startsWith("/\\")) return null;
  // 返す値そのものを、もう一度同じ読み方で読み直して同じ origin か確かめる
  try {
    return new URL(out, origin).origin === origin ? out : null;
  } catch {
    return null;
  }
}
