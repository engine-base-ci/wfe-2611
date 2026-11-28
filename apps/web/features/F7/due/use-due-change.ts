"use client";
// 期限を変える小窓の状態と口の呼び出し（K-484・D-151.11）。K-481（カレンダー）・K-482（ガント）も同じ呼び方を使う。
//   送るのは契約の updateTicket の期限の組 { due_on, due_reason, expected_due_on }（K-483）。成功の答えの中身は使わず、getTicket を読み直す。
//   確かめは手元でも先にする（口と 2 層）：理由（NFKC と前後の空白の後で空・200 字超え）・過去日・今の期限と同じ日。
//   断りの置き場（D-148.31・D-148.32）：理由の誤り＝理由の欄の下／日付に関わる断り＝格子の下／口が断った＝小窓の上の赤い箱。どれも書いた中身は消さない
import { useCallback, useState } from "react";
import { PAGE_ERROR, errorCodeOf, errorText, useNotify } from "@/components/k";
import { call } from "@/lib/api/call";
import { CATALOG } from "@kaname/errors/catalog";
import {
  checkReason,
  initialPick,
  isPast,
  jstToday,
  label,
  monthOf,
  quickChoices,
  shiftMonth,
  type MonthView,
} from "./due-dates";
import type { DuePopoverProps } from "./due-popover";

/** 格子の下に出す日付の断り（手元の過去日も口の答えも同じ番号 E-VAL-012） */
const DATE_CODES = new Set(["E-VAL-012", "E-VAL-028", "E-DUE-005", "E-DUE-006"]);
/** 断られた直後に getTicket を読み直す番号（開き直すと今の期限が出る） */
const RELOAD_CODES = new Set(["E-DUE-007", "E-DUE-008"]);
/** 時刻は日付だけの期限なので読むだけ（送らない・D-145.9） */
const TIME = "18:00";
/** 今の期限と同じ日の「〇〇 にする」の訳 */
const SAME_DAY = "いまの期限と同じです";
/** 期限が無いときの「期限をなくす」の訳 */
const NO_DUE = "期限がありません";

const msgOf = (code: string): string => errorText(code).entry.message;

export interface DueTarget {
  id: string;
  /** 今の期限（YYYY-MM-DD か null） */
  due: string | null;
  /** 承認する人の名前（無ければ空） */
  approver: string;
  reload: () => Promise<void>;
}

interface Draft {
  expected: string | null;
  picked: string;
  month: MonthView;
  reason: string;
  reasonError?: string | undefined;
  dateError?: string | undefined;
  notice?: string | undefined;
}

function fresh(due: string | null, today: string): Draft {
  const picked = initialPick(due, today);
  return { expected: due, picked, month: monthOf(picked), reason: "" };
}

/** 口の断り → 置き場ごとの字 */
function refusal(r: { kind: Parameters<typeof errorCodeOf>[0]["kind"]; code: string; status: number }): {
  date?: string;
  notice?: string;
  gone?: boolean;
  reload?: boolean;
} {
  const code = r.status === 503 && !(r.code in CATALOG) ? PAGE_ERROR.down : errorCodeOf(r);
  if (code === PAGE_ERROR.notFound) return { gone: true };
  if (code === "E-DUE-001" || code === "E-DUE-002") return { notice: msgOf(code) };
  if (DATE_CODES.has(code)) return { date: msgOf(code) };
  if (RELOAD_CODES.has(code)) return { notice: msgOf(code), reload: true };
  if (code === PAGE_ERROR.forbidden || code === PAGE_ERROR.loadFailed) return { notice: errorText(code).title };
  return { notice: msgOf(code) };
}

export interface DueChange {
  open: boolean;
  toggle: () => void;
  close: () => void;
  /** 小窓に渡す値と動き */
  pop: DuePopoverProps;
}

export function useDueChange(t: DueTarget): DueChange {
  const notify = useNotify();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const today = jstToday(new Date());
  const set = useCallback((f: (d: Draft) => Draft) => setDraft((d) => (d ? f(d) : d)), []);

  const close = useCallback(() => setDraft(null), []);
  const toggle = useCallback(() => setDraft((d) => (d ? null : fresh(t.due, jstToday(new Date())))), [t.due]);

  const pick = (day: string) =>
    set((d) => ({
      ...d,
      picked: day,
      month: monthOf(day),
      dateError: isPast(day, today) ? msgOf("E-VAL-012") : undefined,
    }));

  const send = async (due_on: string | null) => {
    if (!draft || busy) return;
    const r = checkReason(draft.reason);
    const past = due_on !== null && isPast(due_on, today);
    if (r.code || past) {
      set((d) => ({
        ...d,
        reasonError: r.code ? msgOf(r.code) : undefined,
        dateError: past ? msgOf("E-VAL-012") : d.dateError,
      }));
      return;
    }
    setBusy(true);
    set((d) => ({ ...d, reasonError: undefined, notice: undefined }));
    try {
      const res = await call("updateTicket", {
        params: { id: t.id },
        body: { due_on, due_reason: r.value, expected_due_on: draft.expected },
        screenId: "tickets",
      });
      if (res.ok) {
        setDraft(null);
        notify(due_on === null ? "期限をなくしました" : `期限を ${label(due_on)} に変えました`);
        await t.reload();
        return;
      }
      const f = refusal(res);
      if (f.gone) {
        setDraft(null);
        await t.reload();
        return;
      }
      set((d) => ({ ...d, dateError: f.date ?? d.dateError, notice: f.notice }));
      if (f.reload) await t.reload();
    } catch {
      set((d) => ({ ...d, notice: errorText(PAGE_ERROR.loadFailed).title }));
    } finally {
      setBusy(false);
    }
  };

  const d = draft ?? fresh(t.due, today);
  const pop: DuePopoverProps = {
    today,
    picked: d.picked,
    month: d.month,
    quick: quickChoices(today),
    time: TIME,
    approver: t.approver,
    reason: d.reason,
    dateError: d.dateError,
    reasonError: d.reasonError,
    notice: d.notice,
    busy,
    onQuick: pick,
    onDay: pick,
    onMonth: (delta) => set((x) => ({ ...x, month: shiftMonth(x.month, delta) })),
    onReason: (text) => set((x) => ({ ...x, reason: text, reasonError: undefined })),
    onSubmit: () => void send(d.picked),
    onClear: () => void send(null),
    onClose: close,
    submitDisabled: d.expected !== null && d.picked === d.expected ? SAME_DAY : undefined,
    clearDisabled: d.expected === null ? NO_DUE : undefined,
  };
  return { open: draft !== null, toggle, close, pop };
}
