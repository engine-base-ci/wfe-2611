// まとめて承認（K-769）の画面の字。1 か所に集め、どれも新しい文字列を作って返す（受けた値は変えない）。
//   答えの理由の言葉（decided など）は画面に出さず、ここで文に替える（K-768 の申し送り）
export type BulkScope = "all" | "selected";

/** 選べる数の上限（口の上限・D-153.37） */
export const BULK_LIMIT = 50;

export const PICK_ALL_LABEL = "まとめて選べるものをすべて選ぶ";
export const LIMIT_TITLE = `まとめて承認は ${BULK_LIMIT} 件までです`;
export const ONE_BY_ONE_TITLE = "1 件ずつ決める";
export const ALL_LABEL = "まとめて承認（全部）";
export const PICKED_LABEL = "選んだものを承認";
export const BAR_REGION = "選んだもの";
export const NOTHING_TEXT = "まとめて承認できるものがありません";
export const PENDING_DETAIL = "1 件ずつ中身を見ていない承認も含まれます。付けなくても承認できます";

export const pickLabel = (number: string): string => `${number} を選ぶ`;
export const pickedText = (n: number): string => `${n} 件を選んでいます`;
export const confirmTitle = (scope: BulkScope, count: number): string =>
  scope === "all" ? `AI の成果物 ${count} 件をまとめて承認します` : `選んだ ${count} 件をまとめて承認します`;
export const confirmLabel = (count: number): string => `${count} 件を承認する`;
export const irreversibleText = (n: number): string => `取り消せない物が ${n} 件含まれます`;
export const uncheckedText = (n: number): string => `チェックの無い確認項目が ${n} 件あります`;

/** 承認できなかった訳の文（口の reason → 画面の字） */
export const REASON_TEXT: Readonly<Record<string, string>> = {
  decided: "先にほかの人が決めていました",
  not_approver: "担当者が変わっていました",
  not_writable: "この物を直す権限が無くなっていました",
};

export interface UpdatedItem {
  number?: string | null;
}
export interface SkippedItem {
  number?: string | null;
  title?: string | null;
  reason?: string | null;
}

const numbersOf = (items: readonly UpdatedItem[]): string =>
  items
    .map((u) => u.number ?? "")
    .filter((n) => n !== "")
    .join("・");

/** 承認した後（全部できた）：「N 件を承認しました。実行は 1 件ずつ順に始まります（番号の並び）。決めた履歴から確かめられます」 */
export function doneText(updated: readonly UpdatedItem[]): string {
  return `${updated.length} 件を承認しました。実行は 1 件ずつ順に始まります（${numbersOf(updated)}）。決めた履歴から確かめられます`;
}

/** 一部（か全部）できなかった：番号の在る物を 1 件ずつ・番号の無い物は数だけ・最後に承認できた物 */
export function skippedText(skipped: readonly SkippedItem[], updated: readonly UpdatedItem[]): string {
  const known = skipped.filter((s) => s.number);
  const lost = skipped.length - known.length;
  const parts: string[] = [];
  if (known.length > 0) {
    const each = known
      .map((s) => `${s.number} ${s.title ?? ""} は、${REASON_TEXT[s.reason ?? ""] ?? REASON_TEXT["decided"]}`)
      .join("・");
    parts.push(`${known.length} 件は承認できませんでした：${each}`);
  }
  if (lost > 0) parts.push(`${lost} 件は見つかりませんでした`);
  if (updated.length > 0) parts.push(`${numbersOf(updated)} は承認しました`);
  return parts.join("。");
}
