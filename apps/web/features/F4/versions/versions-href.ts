// 版と差分の頁の道（K-449）。入口（詳細の頭・「…」・本文の「比べる」）はどれもここで道を作る（文字列で道を書かない）
export interface VersionsQuery {
  /** 項目の変更を比べる（無ければ本文） */
  of?: "items";
  from?: number;
  to?: number;
}

export function versionsHref(ticketId: string, query: VersionsQuery = {}): string {
  const q = new URLSearchParams();
  if (query.of) q.set("of", query.of);
  if (query.from !== undefined) q.set("from", String(query.from));
  if (query.to !== undefined) q.set("to", String(query.to));
  const s = q.toString();
  return `/tickets/${encodeURIComponent(ticketId)}/versions${s ? `?${s}` : ""}`;
}
