"use client";
// 確認の区画（K-740・下絵 /dev/mock/f5/checks-table・checks-failed・checks-none）。承認の帯の成果物の下（where="approval"）と、
//   止まった箱の下（where="stopped"）に出す。見せ方は数だけ（D-153.3）：要約は口の字そのまま「確認 〈字〉」（画面で数え直さない）、
//   行は ✓／□ と文だけ。だれが・いつ・AI の根拠は右のパネルの「やり取り」に出る（帯の下には描かない）。
//   読む物は帯がもう読んでいる鍵だけ：承認の 1 件（["k63","approval",id]）・今の実行（run.checks）・使わない理由（ticketKey）。口を増やさない。
//   下絵の部品 features/F5/more/checks.tsx の ChecksTable は見本の値（who）を持つので使い回さず、同じクラスの形をここに書く（PM の決め）
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { readTicket, ticketKey } from "@/features/F5/approve-complete/band";
import { CheckTable } from "@/features/F5/approve-complete/check-table";
import { useApprovalDetail } from "@/features/F5/approve-complete/decide";
import type { RunView } from "@/features/F5/delegate/use-run";

/** 口が返す確認の 1 行（getApproval の checks・getActionRun の checks.rows・K-739） */
export interface CheckLine {
  id: string;
  text: string;
  checked: boolean;
}
/** 承認の 1 件の答えのうち、この区画が読む所 */
export interface ApprovalChecks {
  checks?: unknown;
  check_summary?: string | null;
  ticket?: { id?: string | null } | null;
}

/** 口の行の並び。並びでなければ null（前の形の答え） */
export function checkLines(v: unknown): CheckLine[] | null {
  if (!Array.isArray(v)) return null;
  return v.map((x, i) => {
    const o = (x ?? {}) as { id?: unknown; text?: unknown; checked?: unknown };
    return { id: String(o.id ?? i), text: String(o.text ?? ""), checked: o.checked === true };
  });
}

const SUM_NONE = "確認 検査なし";
const reasonLine = (reason?: string | null): string => (reason ? `検査なし（${reason}）` : "検査なし");

interface ViewProps {
  summary: string;
  rows: readonly CheckLine[];
  reason?: string | null;
}

/** 純粋な描き手：要約・表「確認の結果」・行が 0 なら表の下に使わない理由 */
export function ChecksView({ summary, rows, reason }: ViewProps): ReactNode {
  return (
    <section className="k-more-checks" aria-label="確認">
      <p className="k-more-sum">{rows.length ? `確認 ${summary}`.trim() : SUM_NONE}</p>
      <div className="k-check-table">
        <table aria-label="確認の結果">
          <thead>
            <tr>
              <th scope="col">確認項目</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.id}-${i}`}>
                <td>
                  <span
                    className="k-more-mark"
                    data-on={r.checked ? "" : undefined}
                    aria-label={r.checked ? "チェック済み" : "まだ"}
                  >
                    {r.checked ? "✓" : "□"}
                  </span>
                  {r.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="k-more-reason">{reasonLine(reason)}</p> : null}
      </div>
    </section>
  );
}

interface Props {
  where: "stopped" | "approval";
  ticketId?: string;
  run?: RunView | null;
  approvalId?: string | null;
}

/** 行が 0 のときだけ使わない理由を読む（帯が読む詳細と同じ鍵・読めなければ理由なし） */
function useNoSpecReason(ticketId: string | undefined, need: boolean): string | null {
  const q = useQuery({
    queryKey: ticketKey(ticketId ?? ""),
    enabled: need && Boolean(ticketId),
    retry: false,
    queryFn: () => readTicket<{ no_spec_reason?: string | null }>(ticketId ?? ""),
  });
  const reason = (q.data as { no_spec_reason?: string | null } | undefined)?.no_spec_reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

export function ChecksSection({ where, ticketId, run, approvalId }: Props): ReactNode {
  const detail = useApprovalDetail(where === "approval" ? (approvalId ?? null) : null);
  const d = detail.data as ApprovalChecks | null | undefined;
  const runChecks = (run?.checks ?? null) as { rows?: unknown; summary?: unknown } | null;
  const rows = where === "approval" ? (d ? (checkLines(d.checks) ?? []) : null) : checkLines(runChecks?.rows);
  const tid = ticketId ?? d?.ticket?.id ?? undefined;
  const reason = useNoSpecReason(tid, rows !== null && rows.length === 0);

  if (where === "approval") {
    // 読めない間・読めなかったときは何も出さない（本当とは限らない数を言い切らない）
    if (!approvalId || !d || rows === null) return null;
    return <ChecksView summary={String(d.check_summary ?? "")} rows={rows} reason={reason} />;
  }
  if (!run) return null;
  // 前の口の答え（rows が無い）：今の表と「検査なし（まだ流していません）」
  if (rows === null) return <CheckTable />;
  return <ChecksView summary={String(runChecks?.summary ?? "")} rows={rows} reason={reason} />;
}
