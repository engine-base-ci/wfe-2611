// 預けたログイン情報の「使える場所」の名前の取り出しと合わせ方（K-352・代表の答え answer=449e72553c59）。
//   口（預ける・上書き・PC が取り出す・確かめ）と Bridge で同じ 1 つの決まりにする。
//   Bridge は ESM の部品を読めないので、下の区切りの中と 1 字も違わない写しを apps/bridge/src/host.ts に置く（K-354 の試験が 2 つを比べる）。
//   だから区切りの中は外の部品を import しない。公開の接尾辞の一覧は区切りの外（input.ts）に置く（Bridge は使わない）

// ---- 名前の取り出しと合わせ方（apps/bridge/src/host.ts と同じ字） ----
/** URL か名前から、宛先の名前（小文字・末尾の点なし・日本語は punycode）を取り出す。取り出せなければ null。
 *  userinfo（@ の前）・道・問い合わせ・断片・ポートは名前に入らない（new URL の hostname だけを使う） */
export function hostnameOf(v: string): string | null {
  const s = v.normalize("NFKC").trim();
  if (s === "" || /\s/.test(s)) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return host === "" ? null : host;
}

/** 使える場所の 1 つを整える。頭の「*.」（下の名前だけに当てる印）は外して整え、付け直す */
export function destinationOf(v: string): string | null {
  const s = v.normalize("NFKC").trim();
  const wild = s.startsWith("*.");
  const host = hostnameOf(wild ? s.slice(2) : s);
  if (host === null) return null;
  return wild ? `*.${host}` : host;
}

/** 宛先が使える場所に入っているか。「*.名前」は下の名前だけ（名前そのものは当たらない）。「名前」は同じか、その下の名前。空の並びは false */
export function hostAllowed(target: string, destinations: readonly string[]): boolean {
  const host = hostnameOf(target);
  if (host === null) return false;
  for (const d of destinations) {
    if (d.startsWith("*.")) {
      if (host.endsWith(d.slice(1))) return true;
    } else if (host === d || host.endsWith(`.${d}`)) return true;
  }
  return false;
}
// ---- ここまで ----
