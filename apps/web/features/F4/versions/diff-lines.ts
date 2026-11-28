// 版と差分の行の差分（K-449）。純粋な関数だけ（入力を書き換えない・画面にも口にも触らない）。
//   本文：素の文字を改行で行に分け、行の最長共通部分で「同じ・削除・追加」に分ける。同じ区切りの中は削除が先・追加が後。
//     前後の同じ行は先に外してから比べる（長い本文で直した所が少ないときの手間を減らす）
//   項目の変更：口の diff（変わった項目だけ）を、削除（前の値）・追加（後の値）の行にする
//   コピー：1 行目「本文：版 2 → 版 3」、続けて見えている行に「同じ：」「削除：」「追加：」の頭を付けて 1 行ずつ

export type DiffKind = "same" | "add" | "del";
export interface DiffLine {
  readonly kind: DiffKind;
  readonly text: string;
}
/** 口の項目の変更の 1 行（listTicketItemChanges の data.diff） */
export interface ItemDiffRow {
  readonly field: string;
  readonly name: string;
  readonly from: string | null;
  readonly to: string | null;
}
export type DiffField = "本文" | "項目の変更";

/** 読み上げとコピーの頭 */
export const KIND_LABEL: Record<DiffKind, string> = { same: "同じ：", del: "削除：", add: "追加：" };

/**
 * 真ん中の表のマスの上限（行数の積）。400 万マスで表は約 16MB（2 千行×2 千行が全部違うとき手元で約 50ms）。
 *   本文の上限 1MB（2 万行前後）で直した所が多いと 4 億マス（約 1.6GB）になり頁が落ちるので、超えたら比べない
 */
export const MAX_DIFF_CELLS = 4_000_000;

/** 真ん中（前後の同じ行を外した残り）の最長共通部分。dp[i][j] は a[i..] と b[j..] の長さ。
 *   表が上限を超えるときは比べずに、削除を全部・追加を全部の順に並べる（落ちない形） */
function middle(a: readonly string[], b: readonly string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  if ((n + 1) * (m + 1) > MAX_DIFF_CELLS)
    return [
      ...a.map((text): DiffLine => ({ kind: "del", text })),
      ...b.map((text): DiffLine => ({ kind: "add", text })),
    ];
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    const row = dp[i]!;
    const next = dp[i + 1]!;
    for (let j = m - 1; j >= 0; j -= 1) {
      row[j] = a[i] === b[j] ? next[j + 1]! + 1 : Math.max(next[j]!, row[j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ kind: "del", text: a[i]! });
      i += 1;
    } else {
      out.push({ kind: "add", text: b[j]! });
      j += 1;
    }
  }
  for (; i < n; i += 1) out.push({ kind: "del", text: a[i]! });
  for (; j < m; j += 1) out.push({ kind: "add", text: b[j]! });
  return out;
}

/** 本文の 2 つの版の行の差分 */
export function diffLines(from: string, to: string): DiffLine[] {
  const a = from.split("\n");
  const b = to.split("\n");
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail])
    tail += 1;
  const same = (xs: readonly string[]): DiffLine[] => xs.map((text) => ({ kind: "same", text }));
  return [
    ...same(a.slice(0, head)),
    ...middle(a.slice(head, a.length - tail), b.slice(head, b.length - tail)),
    ...same(a.slice(a.length - tail)),
  ];
}

/** 項目の変更の差分（口が返す変わった項目だけ）を行にする：前の値は削除・後の値は追加 */
export function itemDiffLines(rows: readonly ItemDiffRow[]): DiffLine[] {
  return rows.flatMap((r): DiffLine[] => [
    ...(r.from !== null ? [{ kind: "del" as const, text: `${r.name}：${r.from}` }] : []),
    ...(r.to !== null ? [{ kind: "add" as const, text: `${r.name}：${r.to}` }] : []),
  ]);
}

/** 比べ方の 1 行（見出しとコピーの 1 行目） */
export const compareTitle = (field: DiffField, from: number, to: number): string => `${field}：版 ${from} → 版 ${to}`;

/** コピーする文字 */
export function copyText(field: DiffField, from: number, to: number, lines: readonly DiffLine[]): string {
  return [compareTitle(field, from, to), ...lines.map((l) => `${KIND_LABEL[l.kind]}${l.text}`)].join("\n");
}
