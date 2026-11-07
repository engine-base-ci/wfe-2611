"use client";
// AI に任せる（K-62）：右の「実行の記録」。新しい順に、誰の AI か・状態・始めた時刻（日本時間）だけを出す。
//   途中の様子・止まった理由は帯（作る段は K-62・承認の後の実行は K-63）が出す（同じことを 2 か所で言わない・D-128.177）
import { jst, type RunView } from "./use-run";

const STATUS: Record<string, string> = {
  queued: "待っています",
  running: "動いています",
  asking: "確認を待っています",
  done: "終わりました",
  stopped: "止まりました",
  cancelled: "やめました",
};
const PHASE: Record<string, string> = { make: "作る", execute: "承認の後の実行" };

export function RunLog({ runs }: { runs: RunView[] | null }) {
  return (
    <section aria-label="実行の記録" className="k62-runlog k-section">
      <h2>実行の記録</h2>
      {runs === null ? <p className="k-desc">読み込んでいます</p> : null}
      {runs !== null && runs.length === 0 ? <p className="k-desc">まだ AI に任せていません</p> : null}
      <ul>
        {(runs ?? []).map((r) => (
          <li key={r.id} data-run-id={r.id}>
            <span>{`${r.by?.display_name ?? "自分"}のAI`}</span>
            <span>{PHASE[r.phase ?? "make"] ?? ""}</span>
            <span>{STATUS[r.status] ?? r.status}</span>
            <time dateTime={r.started_at ?? undefined}>{jst(r.started_at)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
