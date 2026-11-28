"use client";
// 確認の表（段 6・束 B・K-740 の下絵）。見せ方は「数だけ」（聞くこと 2）：「4 ／ 5 済み」と、行は チェック＋文 だけ。
//   だれが・いつ・AI の根拠の 1 行は、表ではなく やり取り（ログ）の行に出す（ActivityLog）。
//   確認項目を使わないチケットは「検査なし」と理由（D-150.45）。値は props で受け取り、描くだけ。
import { TrailLine } from "./bands";
import "./more.css";

/** だれがチェックを付けたか：AI／人（名前）／まだ（null） */
export type CheckWho = "ai" | { human: string } | null;
export interface CheckRow {
  text: string;
  who: CheckWho;
  /** 付けた時刻（「11/01 09:12」）。まだなら無し（やり取りの行にだけ出る） */
  at?: string;
  /** AI の根拠の 1 行（AI が付けた行だけ・やり取りの行にだけ出る） */
  basis?: string;
}

export function checkCounts(rows: readonly CheckRow[]): { done: number; total: number } {
  return { done: rows.filter((r) => r.who !== null).length, total: rows.length };
}

/** 「4 ／ 5 済み」 */
export function checksSummary(rows: readonly CheckRow[]): string {
  const c = checkCounts(rows);
  return `${c.done} ／ ${c.total} 済み`;
}

interface Props {
  rows: readonly CheckRow[];
  /** 表の上の 1 行（自分で直した後：「成果物は 高本 が直しました（版 3）」） */
  edited?: string;
  /** 確認項目を使わないときの理由（行が 0 のとき表の下に出す） */
  noneReason?: string;
}

export function ChecksTable({ rows, edited, noneReason }: Props) {
  return (
    <section className="k-more-checks" aria-label="確認">
      {edited ? <p className="k-more-edited">{edited}</p> : null}
      <p className="k-more-sum">{rows.length ? `確認 ${checksSummary(rows)}` : "確認 検査なし"}</p>
      <div className="k-check-table">
        <table aria-label="確認の結果">
          <thead>
            <tr>
              <th scope="col">確認項目</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.text}>
                <td>
                  <span
                    className="k-more-mark"
                    data-on={r.who ? "" : undefined}
                    aria-label={r.who ? "チェック済み" : "まだ"}
                  >
                    {r.who ? "✓" : "□"}
                  </span>
                  {r.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="k-more-reason">{`検査なし${noneReason ? `（${noneReason}）` : ""}`}</p>
        ) : null}
      </div>
    </section>
  );
}

const whoName = (w: CheckWho): string => (w === "ai" ? "高本のAI" : w ? w.human : "");

/** やり取り（ログ）の行：だれが・いつ・AI の根拠 1 行。チェックの付いた行だけ出る */
export function ActivityLog({ rows }: { rows: readonly CheckRow[] }) {
  const done = rows.filter((r) => r.who && r.at);
  return (
    <section className="k-more-log" aria-label="やり取り">
      <h3>やり取り</h3>
      {done.map((r) => (
        <TrailLine key={r.text} time={r.at ?? ""}>
          {`${whoName(r.who)} が『${r.text}』にチェック${r.basis ? ` — 根拠：${r.basis}` : ""}`}
        </TrailLine>
      ))}
    </section>
  );
}
