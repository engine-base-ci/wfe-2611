"use client";
// 決めた履歴の板（K-751・D-153.31・D-153.21）。承認待ちの［決めた履歴］から右に出る板（下絵 history-*・形は K-62 の実行の記録の板 k62-run-sheet）。
//   札（すべて・承認・差し戻し・数は口の counts）・期間（この 1 週間・1 か月・3 か月）・日本時間の日ごとの行・下の注記。
//   取り下げられる行（can_withdraw）だけ［取り消す］→ 確かめの小窓 → 口 withdrawApproval（K-733）。
//   間に合わなかった（409・E-APR-010）は画面の字、ほかの断りは正本の文を、承認待ちの画面の上の知らせ（useHistoryNotice）に出す。
//   板の開け閉めと知らせは頁の中で 1 つ（道具の行と空の画面のどちらから開いても同じ板）。文は全部文字として出す
import { Dialog as D } from "@base-ui/react/dialog";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Button, Confirm } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { messageOf } from "@/features/F5/approve-complete/message";
import { queueKey } from "@/features/F5/approve-complete/queue";
// 板の枠（k62-run-sheet）と履歴の行（k-more-hist-*）の CSS。承認待ちの頁はこれを別に読まないので、ここで読む（K751-UI-005 ほか：板が透明で幕が上に乗っていた）
import "@/features/F5/delegate/delegate.css";
import "./history.css";

export interface HistoryRow {
  id: string;
  ticket_id: string;
  ticket_number: string;
  title: string;
  decision: "approve" | "return" | "stop";
  decided_at: string;
  reason: string | null;
  withdrawn_at: string | null;
  run_status: string | null;
  can_withdraw: boolean;
}
type Decision = "approve" | "return";
interface Counts {
  total: number;
  approve: number;
  return: number;
}
interface HistoryPage {
  rows: HistoryRow[];
  counts: Counts;
  cursor: string | null;
}

export const PERIODS = [
  { days: 7, label: "この 1 週間" },
  { days: 30, label: "この 1 か月" },
  { days: 90, label: "この 3 か月" },
] as const;
type Period = (typeof PERIODS)[number];

export const historyKey = ["k751", "history"] as const;
const LATE = "もう実行が始まっているので、取り消せません。差し戻しの書き込みで知らせてください";
const LOAD_FAILED = "決めた履歴を読み込めませんでした";
const NOTE = "「取り消す」は、実行がまだ始まっていない承認だけ。実行が始まったあとは、差し戻しの書き込みで";
const DECISION: Record<HistoryRow["decision"], string> = { approve: "承認", return: "差し戻し", stop: "止めた" };
const RUN: Record<string, string> = {
  queued: "実行の予定",
  running: "実行中",
  asking: "実行中",
  done: "送った",
  stopped: "止まった",
};
const WEEK = ["日", "月", "火", "水", "木", "金", "土"] as const;
const JST_MS = 9 * 3600_000;
const DAY_MS = 86_400_000;

/** 日本時間の今日から daysAgo 日前の「YYYY-MM-DD」 */
export function jstDate(daysAgo: number, now: number = Date.now()): string {
  return new Date(now + JST_MS - daysAgo * DAY_MS).toISOString().slice(0, 10);
}
/** 日本時間の「HH:MM」 */
const timeOf = (iso: string) => new Date(Date.parse(iso) + JST_MS).toISOString().slice(11, 16);

/** 日の見出し：今日は「今日」、ほかは「MM/DD（曜）」（日本時間） */
function dayLabel(date: string, today: string): string {
  if (date === today) return "今日";
  const wd = WEEK[new Date(`${date}T12:00:00+09:00`).getUTCDay()];
  return `${date.slice(5, 7)}/${date.slice(8, 10)}（${wd}）`;
}

/** 日本時間の日ごとに区切る（口の並び＝新しい順のまま） */
export function groupByDay(rows: readonly HistoryRow[], now: number = Date.now()) {
  const today = jstDate(0, now);
  const days: { label: string; rows: HistoryRow[] }[] = [];
  for (const r of rows) {
    const label = dayLabel(new Date(Date.parse(r.decided_at) + JST_MS).toISOString().slice(0, 10), today);
    const last = days.at(-1);
    if (last && last.label === label) days[days.length - 1] = { label, rows: [...last.rows, r] };
    else days.push({ label, rows: [r] });
  }
  return days;
}

/** 行の下の 1 行 */
export function subOf(r: HistoryRow): string {
  if (r.decision === "return") return `理由：${r.reason ?? ""}`;
  if (r.decision === "stop") return "成果物は使っていません";
  if (r.withdrawn_at) return "取り下げた";
  return RUN[r.run_status ?? ""] ?? "";
}

// ---------------------------------------------------------------- 頁の中で 1 つの板と知らせ
interface Shared {
  open: boolean;
  notice: string | null;
}
let shared: Shared = { open: false, notice: null };
const listeners = new Set<() => void>();
function setShared(next: Partial<Shared>): void {
  shared = { ...shared, ...next };
  for (const l of listeners) l();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
const INITIAL: Shared = { open: false, notice: null };
export function useHistoryShared(): Shared {
  return useSyncExternalStore(
    subscribe,
    () => shared,
    () => INITIAL,
  );
}
export const openHistory = (open: boolean) => setShared({ open });
/** 承認待ちの画面を離れたとき（先が 1 つも無くなったとき）に戻す */
export const resetHistory = () => setShared({ open: false, notice: null });

// ---------------------------------------------------------------- 読む
async function readPage(decision: Decision | null, period: Period, cursor: string | null): Promise<HistoryPage> {
  const r = await call("listApprovalHistory", {
    query: { from: jstDate(period.days - 1), ...(decision ? { decision } : {}), ...(cursor ? { cursor } : {}) },
    screenId: "approvals",
  });
  if (!r.ok) throw new Error(r.code);
  const c = (r.meta["counts"] ?? {}) as Partial<Counts>;
  return {
    rows: r.data as unknown as HistoryRow[],
    counts: { total: Number(c.total ?? 0), approve: Number(c.approve ?? 0), return: Number(c.return ?? 0) },
    cursor: r.meta.cursor ?? null,
  };
}

export function useHistory(decision: Decision | null, period: Period, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...historyKey, decision ?? "all", period.days],
    enabled,
    retry: false,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => readPage(decision, period, pageParam),
    getNextPageParam: (last) => last.cursor,
  });
}

// ---------------------------------------------------------------- 板
export function HistorySheet({ finalFocus }: { finalFocus: RefObject<HTMLButtonElement | null> }) {
  const { open } = useHistoryShared();
  const sheet = useRef<HTMLDivElement>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [period, setPeriod] = useState<Period>(PERIODS[0]);
  const q = useHistory(decision, period, open);
  const counts = q.data?.pages[0]?.counts;
  const rows = (q.data?.pages ?? []).flatMap((p) => p.rows);
  const chips: [string, Decision | null, number | undefined][] = [
    ["すべて", null, counts?.total],
    ["承認", "approve", counts?.approve],
    ["差し戻し", "return", counts?.return],
  ];
  return (
    <D.Root open={open} onOpenChange={(o) => openHistory(o)}>
      <D.Portal>
        <D.Backdrop className="k-backdrop" />
        <D.Popup ref={sheet} className="k62-run-sheet" initialFocus={sheet} finalFocus={finalFocus}>
          <div className="k-dialog-head">
            <D.Title className="k-dialog-title">決めた履歴</D.Title>
            <D.Close className="k-dialog-close" aria-label="閉じる">
              <X aria-hidden="true" size={16} />
            </D.Close>
          </div>
          <div className="k-more-hist-head">
            <div role="group" aria-label="絞り込み" className="k62-run-chips">
              {chips.map(([label, d, n]) => (
                <button
                  key={label}
                  type="button"
                  className="k62-run-chip"
                  aria-pressed={decision === d}
                  onClick={() => setDecision(d)}
                >
                  {n === undefined ? label : `${label} ${n}`}
                </button>
              ))}
            </div>
            <PeriodPick value={period} onChange={setPeriod} />
          </div>
          <div className="k-dialog-body k-more-hist">
            {q.isError ? (
              <div className="k-state" role="alert">
                <p className="k-state-body">{LOAD_FAILED}</p>
                <div className="k-state-actions">
                  <Button onClick={() => void q.refetch()}>もう一度</Button>
                </div>
              </div>
            ) : q.data && rows.length === 0 ? (
              <p className="k-more-hist-note">{`${period.label}に決めたものはありません`}</p>
            ) : (
              <HistoryDays rows={rows} />
            )}
            {q.hasNextPage && !q.isError ? (
              <Button
                variant="secondary"
                loading={q.isFetchingNextPage}
                disabled={q.isFetchingNextPage}
                onClick={() => void q.fetchNextPage()}
              >
                もっと見る
              </Button>
            ) : null}
            <p className="k-more-hist-note">{NOTE}</p>
          </div>
        </D.Popup>
      </D.Portal>
    </D.Root>
  );
}

/** 期間：「この 1 週間 ▾」を押すと箱（listbox「期間」）。選ぶと閉じる */
function PeriodPick({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [open, setOpen] = useState(false);
  const pick = (p: Period) => {
    setOpen(false);
    onChange(p);
  };
  return (
    <>
      <button
        type="button"
        className="k-ap-sort"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {`${value.label} ▾`}
      </button>
      {open ? (
        <ul className="k-select-popup" role="listbox" aria-label="期間">
          {PERIODS.map((p) => (
            <li
              key={p.days}
              role="option"
              className="k-select-item"
              aria-selected={p.days === value.days}
              {...(p.days === value.days ? { "data-selected": "" } : {})}
              tabIndex={0}
              onClick={() => pick(p)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick(p);
                }
              }}
            >
              {p.label}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** 日ごとの見出しと行・［取り消す］とその確かめの小窓 */
function HistoryDays({ rows }: { rows: HistoryRow[] }) {
  const qc = useQueryClient();
  const [undoing, setUndoing] = useState<HistoryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false); // 答えが来るまで 2 本目を送らない
  const withdraw = async (row: HistoryRow) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setShared({ notice: null });
    try {
      const r = await call("withdrawApproval", { params: { id: row.id }, body: {}, screenId: "approvals" });
      setUndoing(null);
      if (r.ok) await qc.invalidateQueries({ queryKey: queueKey });
      else if (r.status !== 401) setShared({ notice: refusal(r) }); // 401 は入り直し（共通の扱い）
      await qc.invalidateQueries({ queryKey: historyKey });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      {groupByDay(rows).map((d) => (
        <section key={d.label} aria-label={d.label}>
          <h3 className="k-more-day">{d.label}</h3>
          <ul className="k-more-hist-list">
            {d.rows.map((r) => (
              <li key={r.id} className="k-more-hist-row">
                <time dateTime={r.decided_at}>{timeOf(r.decided_at)}</time>
                <span className="k-more-hist-title">
                  <span>
                    <b>{DECISION[r.decision]}</b>
                    {` ${r.ticket_number} ${r.title}`}
                  </span>
                  <span className="k-more-hist-sub">{subOf(r)}</span>
                </span>
                {r.can_withdraw ? (
                  <Button size="sm" variant="outlined" onClick={() => setUndoing(r)}>
                    取り消す
                  </Button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Confirm
        open={undoing !== null}
        onOpenChange={(o) => {
          if (!o && !busy) setUndoing(null);
        }}
        title="この承認を取り下げます"
        description={
          undoing
            ? `${undoing.ticket_number} ${undoing.title}。実行はまだ始まっていないので、承認待ちに戻せます`
            : undefined
        }
        confirmLabel="取り下げる"
        tone="primary"
        busy={busy}
        onConfirm={() => {
          if (undoing) void withdraw(undoing);
        }}
      />
    </>
  );
}

/** 取り下げの断り：間に合わなかった（409・E-APR-010）は画面の字（下絵 history-undo-late）、ほかは正本の文 */
function refusal(r: CallErr): string {
  return r.status === 409 && r.code === "E-APR-010" ? LATE : messageOf(r);
}
