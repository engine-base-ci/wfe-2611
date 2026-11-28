// 記録をことばで探す（K-850・listAuditEvents の q）。読むだけ（DB に書かない・外へ送らない・新しい DB の関数を足さない）。
//   探す相手は K-823 の app.audit_list が返す行だけ（権限の範囲・札・人・チケット・期間の絞りはその関数が見る）。範囲の外の行には当たらない。
//   新しい順に AUDIT_SCAN_BATCH 行ずつ読み、口の側で「画面に出る字」（人の名前・対象の名前・行の文・理由・端末・action）に当たる行を選ぶ。
//   当たりが limit + 1 件になったら止める（続きの印を付ける）。1 回の問い合わせで読むのは AUDIT_SCAN_MAX 行まで（G-16）。
//   上限に届いて読み終えていなければ、そこまでの当たりを返し scan_capped: true・続きの印は付けない（期間か札で狭めてもらう）
import type { AuditEntry } from "./list.js";
import { AUDIT_SCAN_BATCH, AUDIT_SCAN_MAX, encodeAuditCursor, normalizeWord, type AuditQuery } from "./patterns.js";

/** 走査で読む 1 行（続きの印を作るための時刻の字と id を持つ） */
export interface ScanRow {
  id: string;
  occurred_key: string;
}
/** 続きの位置から n 行（と 1 行余分）を新しい順に読む関数（K-823 の app.audit_list を 1 つの取引の中で呼ぶ） */
export type ReadBatch<R extends ScanRow> = (after: { at: string; id: string } | null, n: number) => Promise<R[]>;

export interface SearchResult {
  entries: AuditEntry[];
  next_cursor: string | null;
  scan_capped: boolean;
}

/** 1 行の、ことばで探される字（そろえて空白でつなぐ。語は空白を含まないので、字の境目をまたいで当たらない） */
const haystackOf = (e: AuditEntry): string =>
  [e.actor?.name, e.target?.label, e.text, e.reason, e.device, e.action]
    .filter((v): v is string => typeof v === "string" && v !== "")
    .map(normalizeWord)
    .join(" ");

/** 全部の語を含むか（AND・部分一致・% _ \ も字のまま） */
export const matches = (e: AuditEntry, words: readonly string[]): boolean => {
  const h = haystackOf(e);
  return words.every((w) => h.includes(w));
};

interface Hit {
  entry: AuditEntry;
  key: string;
  id: string;
}

/** 新しい順に読みながら当たりを選ぶ。DB の失敗は途中でもそのまま投げる（途中までの答えを返さない） */
export async function searchAudit<R extends ScanRow>(
  read: ReadBatch<R>,
  toEntry: (r: R) => AuditEntry,
  q: AuditQuery & { words: string[] },
): Promise<SearchResult> {
  const hits: Hit[] = [];
  let after = q.after;
  let scanned = 0;
  let exhausted = false;
  while (scanned < AUDIT_SCAN_MAX && hits.length <= q.limit) {
    const n = Math.min(AUDIT_SCAN_BATCH, AUDIT_SCAN_MAX - scanned);
    const rows = await read(after, n);
    const batch = rows.slice(0, n);
    for (const r of batch) {
      scanned += 1;
      const entry = toEntry(r);
      if (matches(entry, q.words)) hits.push({ entry, key: r.occurred_key, id: r.id });
      if (hits.length > q.limit) break;
    }
    const last = batch[batch.length - 1];
    if (rows.length <= n || !last) {
      exhausted = true;
      break;
    }
    after = { at: last.occurred_key, id: last.id };
  }
  const page = hits.slice(0, q.limit);
  const tail = page[page.length - 1];
  if (hits.length > q.limit && tail)
    return { entries: page.map((h) => h.entry), next_cursor: encodeAuditCursor(tail.key, tail.id), scan_capped: false };
  return { entries: page.map((h) => h.entry), next_cursor: null, scan_capped: !exhausted };
}
