"use client";
// 棒を動かす確かめの小窓の状態と口の呼び出し（K-482・D-151.11・D-151.12）。棒をつかんで離すと openMove が呼ばれ、小窓に渡す値を作る。
//   左の端だけ（開始日だけ）を動かしたときは小窓を開かず、小さなお知らせだけ（この画面では開始日だけを変えない）。
//   期限は「土日を飛ばす」（既定は入り）で土日なら次の月曜に直す。棒ごと動かしたときの開始日は直さない（土日に始まってよい・口は曜日を問わない）。
//   親の期限を過ぎる日は「にする」を押せない形（口も 409 E-DUE-005 で守る）。送るのは updateTicket の
//   { due_on, start_on・expected_start_on（棒ごとのときだけ）, due_reason, expected_due_on }。成功は棒の口を読み直して描く（答えの中身は使わない）。
//   日付の計算・理由の確かめは K-484 の due-dates.ts を呼ぶ（写さない）
import { useCallback, useRef, useState } from "react";
import { PAGE_ERROR, errorCodeOf, errorText, useNotify } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { CATALOG } from "@kaname/errors/catalog";
import { addDays, checkReason, exceedsParent, label, skipWeekend } from "../due/due-dates";
import type { GanttMove, GanttScale } from "./gantt-inner";

const DOW = ["日", "月", "火", "水", "木", "金", "土"] as const;
const DAY_MS = 86_400_000;
/** 左の端だけを動かしたときのお知らせ（開始日だけは、この画面では変えない） */
export const START_ONLY = "開始日だけは、ここでは変えられません。期限といっしょに動かしてください";
/** あとに続くものの枠の 1 行（つながりに「続く」がまだ無い） */
export const NO_FOLLOW = "つながりの「続く」はまだ使えません";
/** 断られた後に棒の口を読み直す番号（先に変えられた・消えた） */
const RELOAD_CODES = new Set(["E-DUE-007", "E-DUE-008"]);

const toDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
/** 「11/05（木）」 */
export const dayLabel = (ymd: string): string => `${label(ymd)}（${DOW[toDate(ymd).getUTCDay()]}）`;
/** 2 つの日の差（日） */
export const daysBetween = (from: string, to: string): number =>
  Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);

/** 目盛りの数だけ日をずらす（日・週＝7 日・月＝同じ日付の月。月の終わりを越えれば月の最後の日） */
export function shiftBy(ymd: string, n: number, scale: GanttScale): string {
  if (scale === "day") return addDays(ymd, n);
  if (scale === "week") return addDays(ymd, n * 7);
  const d = toDate(ymd);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const out = new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
  return out.toISOString().slice(0, 10);
}

/** 正本の文 */
export const msgOf = (code: string): string => errorText(code).entry.message;
/** 正本の文（first なら 1 文目） */
export const textOf = (code: string, first = false): string => (first ? errorText(code).title : msgOf(code));

/** 口の断り → 置き場ごとの字（理由の欄・日付の欄・小窓の上）と、読み直す。どれも小窓は開いたまま（md「欄の確かめと断り」）。
 *  403 は E-PAGE-002、ほかの E-PAGE-*（404 の E-PAGE-001・落ちた・止まっている 等）は E-PAGE-007 の 1 文目。
 *  消えていた（404）ときは E-DUE-008 と同じく、小窓は開いたまま棒の口を読み直す */
export function refusalOf(r: Pick<CallErr, "kind" | "code" | "status">): {
  reason?: string;
  date?: string;
  notice?: string;
  reload?: boolean;
} {
  const code = r.status === 503 && !(r.code in CATALOG) ? PAGE_ERROR.down : errorCodeOf(r);
  if (code === "E-DUE-001" || code === "E-DUE-002") return { reason: msgOf(code) };
  if (code === "E-VAL-012") return { date: msgOf(code), notice: msgOf(code) };
  if (RELOAD_CODES.has(code)) return { notice: msgOf(code), reload: true };
  if (code === PAGE_ERROR.forbidden) return { notice: textOf(code, true) };
  if (code === PAGE_ERROR.notFound) return { notice: textOf(PAGE_ERROR.loadFailed, true), reload: true };
  if (code.startsWith("E-PAGE-")) return { notice: textOf(PAGE_ERROR.loadFailed, true) };
  return { notice: msgOf(code) };
}

/** 動かす棒の行（gantt-view.tsx の行から） */
export interface MoveRow {
  id: string;
  number: string;
  title: string;
  owner: string;
  /** 開始日（無ければ null）・期限（YYYY-MM-DD） */
  start: string | null;
  due: string;
  parent: { number: string; due: string | null } | null;
}

interface Draft {
  row: MoveRow;
  edge: GanttMove["edge"];
  /** 動かした先（土日を直す前） */
  rawDue: string;
  start: string | null;
  weekend: boolean;
  reason: string;
  reasonError?: string | undefined;
  notice?: string | undefined;
  key: string;
}

export interface MoveDialogState {
  ticket: { number: string; title: string };
  from: string;
  to: string;
  shift: string;
  parent?: { number: string; due: string; fits: boolean };
  weekend: { checked: boolean; note: string };
  owner: string;
  reason: string;
  reasonError: string | null;
  notice: string | null;
  confirmDate: string;
  busy: boolean;
}

const newKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

const finalDue = (d: Draft): string => (d.weekend ? skipWeekend(d.rawDue).day : d.rawDue);

function view(d: Draft, busy: boolean): MoveDialogState {
  const due = finalDue(d);
  const shift = daysBetween(d.row.due, d.rawDue);
  const fixed = d.weekend ? skipWeekend(d.rawDue) : { day: d.rawDue, moved: false };
  const p = d.row.parent;
  return {
    ticket: { number: d.row.number, title: d.row.title },
    from: dayLabel(d.row.due),
    to: dayLabel(d.rawDue),
    shift: shift >= 0 ? `${shift} 日後ろへ` : `${-shift} 日前へ`,
    ...(p && p.due ? { parent: { number: p.number, due: label(p.due), fits: !exceedsParent(due, p.due) } } : {}),
    weekend: { checked: d.weekend, note: fixed.moved ? `${dayLabel(d.rawDue)}→ ${dayLabel(fixed.day)}になる` : "" },
    owner: d.row.owner,
    reason: d.reason,
    reasonError: d.reasonError ?? null,
    notice: d.notice ?? null,
    confirmDate: label(due),
    busy,
  };
}

export interface MoveBars {
  dialog: MoveDialogState | null;
  openMove: (row: MoveRow, move: GanttMove, scale: GanttScale) => void;
  onReason: (text: string) => void;
  onWeekend: (checked: boolean) => void;
  submit: () => void;
  cancel: () => void;
}

export function useMoveBars({ onMoved }: { onMoved: () => void }): MoveBars {
  const notify = useNotify();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const set = useCallback((f: (d: Draft) => Draft) => setDraft((d) => (d ? f(d) : d)), []);

  const openMove = useCallback(
    (row: MoveRow, move: GanttMove, scale: GanttScale) => {
      if (move.edge === "start") {
        notify(START_ONLY);
        return;
      }
      const rawDue = shiftBy(row.due, move.diff, scale);
      const start = move.edge === "move" && row.start ? shiftBy(row.start, move.diff, scale) : null;
      setDraft({ row, edge: move.edge, rawDue, start, weekend: true, reason: "", key: newKey() });
    },
    [notify],
  );

  const submit = async () => {
    if (!draft || sending.current) return;
    const due = finalDue(draft);
    const p = draft.row.parent;
    if (p?.due && exceedsParent(due, p.due)) return;
    const r = checkReason(draft.reason);
    if (r.code) {
      set((d) => ({ ...d, reasonError: msgOf(r.code!) }));
      return;
    }
    sending.current = true;
    setBusy(true);
    set((d) => ({ ...d, reasonError: undefined, notice: undefined }));
    const withStart = draft.start !== null;
    try {
      const res = await call("updateTicket", {
        params: { id: draft.row.id },
        body: {
          due_on: due,
          ...(withStart ? { start_on: draft.start } : {}),
          due_reason: r.value,
          expected_due_on: draft.row.due,
          ...(withStart ? { expected_start_on: draft.row.start } : {}),
        },
        idempotencyKey: draft.key,
        screenId: "tickets",
      });
      if (res.ok) {
        setDraft(null);
        notify(`期限を ${label(due)} に変えました`);
        onMoved();
        return;
      }
      const f = refusalOf(res);
      // 断られた後の送り直しは別の操作（同じ鍵だと最初の断りが返る）なので鍵を替える
      set((d) => ({ ...d, key: newKey(), ...(f.reason ? { reasonError: f.reason } : { notice: f.notice }) }));
      if (f.reload) onMoved();
    } catch {
      set((d) => ({ ...d, notice: textOf(PAGE_ERROR.loadFailed, true) }));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return {
    dialog: draft ? view(draft, busy) : null,
    openMove,
    onReason: (text) => set((d) => ({ ...d, reason: text, reasonError: undefined })),
    onWeekend: (checked) => set((d) => ({ ...d, weekend: checked })),
    submit: () => void submit(),
    cancel: () => {
      if (!sending.current) setDraft(null);
    },
  };
}
