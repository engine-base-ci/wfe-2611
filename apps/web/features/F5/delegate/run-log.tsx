"use client";
// AI に任せる（K-62）の実行の記録。K-226 でキャンバス TicketDetail・TdRunLog の形にした：
//   ・右のパネルの「実行の記録（最新）」：いちばん新しい 1 件だけを「〈名前〉のAI ・ MM/DD HH:MM → HH:MM（N 分）」で。
//     走っている実行は終わりの時刻と分を出さない。無ければ「まだ AI に任せていません」。読み終えた件数を data-runs に（読み中は付けない）
//   ・「実行の記録をすべて見る」で開く小窓「実行の記録」：全部を新しい順に、誰の AI か・作る／承認の後の実行・状態・始めた時刻だけ。
//     絞り込みの札はキャンバスに在るがまだ使えない（押せない形・D-145.9）
//   途中の様子・止まった理由は帯（作る段は K-62・承認の後の実行は K-63）が出す（同じことを 2 か所で言わない・D-128.178）
import { useState } from "react";
import { Button, Dialog } from "@/components/k";
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
const MINUTE_MS = 60_000;

/** 日本時間の部品（2 桁） */
const PARTS = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function partsOf(iso: string): Record<string, string> {
  return Object.fromEntries(PARTS.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
}
/** 「11/01 09:00」 */
const dayTime = (iso: string) => {
  const p = partsOf(iso);
  return `${p["month"]}/${p["day"]} ${p["hour"]}:${p["minute"]}`;
};
/** 「09:12」 */
const timeOf = (iso: string) => {
  const p = partsOf(iso);
  return `${p["hour"]}:${p["minute"]}`;
};
const whoOf = (r: RunView) => `${r.by?.display_name ?? "自分"}のAI`;

/** 最新 1 件の 1 行（キャンバス TicketDetail の「実行の記録（最新）」） */
export function latestLine(r: RunView): string {
  const who = whoOf(r);
  if (!r.started_at) return who;
  const start = dayTime(r.started_at);
  if (!r.finished_at) return `${who} ・ ${start} →`;
  const minutes = Math.max(0, Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / MINUTE_MS));
  return `${who} ・ ${start} → ${timeOf(r.finished_at)}（${minutes} 分）`;
}

/** 右のパネルの「実行の記録（最新）」と、全部を出す小窓 */
export function RunLatest({ runs }: { runs: RunView[] | null }) {
  const [open, setOpen] = useState(false);
  const latest = runs?.[0] ?? null;
  return (
    <section
      aria-label="実行の記録（最新）"
      className="k-detail-panel-sec k62-runlog"
      {...(runs !== null ? { "data-runs": String(runs.length) } : {})}
    >
      <h2>実行の記録（最新）</h2>
      {runs === null ? <p className="k-desc">読み込んでいます</p> : null}
      {runs !== null && !latest ? <p className="k-desc">まだ AI に任せていません</p> : null}
      {latest ? <p className="k62-run-latest">{latestLine(latest)}</p> : null}
      <Button variant="ghost" size="sm" className="k62-run-all" onClick={() => setOpen(true)}>
        実行の記録をすべて見る
      </Button>
      <RunLogDialog runs={runs} open={open} onOpenChange={setOpen} />
    </section>
  );
}

const CHIPS = ["通った", "落ちた"] as const;

/** 小窓「実行の記録」（キャンバス TdRunLog）。全部の実行を新しい順に */
export function RunLogDialog({
  runs,
  open,
  onOpenChange,
}: {
  runs: RunView[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const list = runs ?? [];
  return (
    <Dialog title="実行の記録" open={open} onOpenChange={onOpenChange}>
      <div role="group" aria-label="絞り込み" className="k62-run-chips">
        {[`すべて ${list.length}`, ...CHIPS].map((c) => (
          <button
            key={c}
            type="button"
            className="k62-run-chip"
            aria-disabled="true"
            tabIndex={-1}
            title={`${c}（まだ使えません）`}
          >
            {c}
          </button>
        ))}
      </div>
      {runs === null ? <p className="k-desc">読み込んでいます</p> : null}
      {runs !== null && list.length === 0 ? <p className="k-desc">まだ AI に任せていません</p> : null}
      <ul className="k62-run-list">
        {list.map((r) => (
          <li key={r.id} data-run-id={r.id}>
            <span>{whoOf(r)}</span>
            <span>{PHASE[r.phase ?? "make"] ?? ""}</span>
            <span>{STATUS[r.status] ?? r.status}</span>
            <time dateTime={r.started_at ?? undefined}>{jst(r.started_at)}</time>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
