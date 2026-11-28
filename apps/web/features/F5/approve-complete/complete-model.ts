// 完了にする（K-183・K-572）の画面が読む形：完了した時刻と押した人の 1 行・口の 422 の明細。
//   未チェックの数え方は unchecked.ts（口の app.ticket_body_unchecked と同じ定義・K-566）

/** getTicket の答えの完了（K165 が足す）。by は押した人の表示名（引けなければ null） */
export interface Completed {
  at: string;
  by: string | null;
}
const JST_MS = 9 * 3600_000;
const pad = (n: number): string => String(n).padStart(2, "0");

/** 日本時間の「11/08 15:20」 */
export function jstStamp(iso: string): string {
  const d = new Date(new Date(iso).getTime() + JST_MS);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 帯の ⑦：「完了しました（高本・11/08 15:20）」。名前か時刻が引けなければ、引けた方だけを出す */
export function completedLine(c: Completed): string {
  const who = [c.by, jstStamp(c.at)].filter(Boolean).join("・");
  return who ? `完了しました（${who}）` : "完了しました";
}

/** 完了の口の 422 の明細（残りの項目・終わっていない子）。子は id があればそのチケットへのリンクにする */
export interface Problem {
  message: string;
  items: { text: string; href?: string }[];
}
