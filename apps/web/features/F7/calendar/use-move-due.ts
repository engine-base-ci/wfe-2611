"use client";
// カレンダーの「日を動かす」の状態と口の呼び出し（K-481・D-151.11：理由が必須）。送るのは updateTicket の期限の組
//   { due_on, due_reason, expected_due_on }（K-483）。成功の答えの中身は使わず、呼ぶ側が月を読み直す（onMoved）。
//   手元の確かめは K-484 の道具（checkReason・isPast）を呼ぶ（同じ確かめを 2 か所に持たない）。口の断りは番号で置き場を決める：
//   理由の誤り（E-DUE-001・002）＝理由の欄の下／今日より前（E-VAL-012）＝動かす先の欄の下／ほか＝editor の上の赤い箱。どれも書いた中身を消さない
import { useCallback, useRef, useState } from "react";
import { PAGE_ERROR, errorCodeOf, errorText, useNotify } from "@/components/k";
import { call } from "@/lib/api/call";
import { checkReason, isPast, jstToday, label } from "../due/due-dates";

/** 断られた後に月を読み直す番号（今の期限を見てからやり直せる） */
const RELOAD_CODES = new Set(["E-DUE-008"]);
/** 今の期限と同じ日の「動かす」の訳 */
const SAME_DAY = "いまの期限と同じです";

const msgOf = (code: string): string => errorText(code).entry.message;
const newKey = (): string => crypto.randomUUID();

export interface MoveTarget {
  id: string;
  number: string;
  /** 今の期限（無ければ null＝期限が決まっていない） */
  due: string | null;
}

export interface MoveDraft extends MoveTarget {
  to: string;
  reason: string;
  toError?: string | undefined;
  reasonError?: string | undefined;
  notice?: string | undefined;
}

export interface MoveDue {
  draft: MoveDraft | null;
  busy: boolean;
  /** 「動かす」を押せない訳（押せる間は undefined） */
  submitDisabled: string | undefined;
  open: (t: MoveTarget, to?: string) => void;
  cancel: () => void;
  setTo: (to: string) => void;
  setReason: (reason: string) => void;
  submit: () => void;
}

export interface MoveDueOptions {
  /** 動かせた（月を読み直す）。期限が無かった行なら noDate が真 */
  onMoved: (noDate: boolean) => void;
  /** 先に変えられたなどで、今の期限を読み直す */
  onStale: () => void;
}

/** 口の断り → 置き場 */
function placeOf(code: string): "reason" | "to" | "notice" {
  if (code === "E-DUE-001" || code === "E-DUE-002") return "reason";
  if (code === "E-VAL-012") return "to";
  return "notice";
}
const noticeOf = (code: string): string =>
  code === PAGE_ERROR.forbidden || code === PAGE_ERROR.loadFailed ? errorText(code).title : msgOf(code);

export function useMoveDue({ onMoved, onStale }: MoveDueOptions): MoveDue {
  const notify = useNotify();
  const [draft, setDraft] = useState<MoveDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  // editor を開いた時に 1 つ（届いたか分からない失敗の送り直しを 2 回にしない）。口がはっきり断ったら次の送りは新しい鍵
  const key = useRef(newKey());
  const set = useCallback((f: (d: MoveDraft) => MoveDraft) => setDraft((d) => (d ? f(d) : d)), []);

  const open = useCallback((t: MoveTarget, to?: string) => {
    key.current = newKey();
    setDraft({ ...t, to: to ?? t.due ?? jstToday(new Date()), reason: "" });
  }, []);
  const cancel = useCallback(() => setDraft(null), []);
  const setTo = useCallback((to: string) => set((d) => ({ ...d, to, toError: undefined })), [set]);
  const setReason = useCallback((reason: string) => set((d) => ({ ...d, reason, reasonError: undefined })), [set]);

  const same = draft !== null && draft.due !== null && draft.to === draft.due;
  const submitDisabled = same ? SAME_DAY : undefined;

  const send = async (d: MoveDraft) => {
    const r = checkReason(d.reason);
    const past = isPast(d.to, jstToday(new Date()));
    if (r.code || past) {
      set((x) => ({
        ...x,
        reasonError: r.code ? msgOf(r.code) : undefined,
        toError: past ? msgOf("E-VAL-012") : undefined,
        notice: undefined,
      }));
      return;
    }
    sending.current = true;
    setBusy(true);
    set((x) => ({ ...x, reasonError: undefined, toError: undefined, notice: undefined }));
    try {
      const res = await call("updateTicket", {
        params: { id: d.id },
        body: { due_on: d.to, due_reason: r.value, expected_due_on: d.due },
        idempotencyKey: key.current,
        screenId: "tickets",
      });
      if (res.ok) {
        setDraft(null);
        notify(`期限を ${label(d.to)} に変えました`);
        onMoved(d.due === null);
        return;
      }
      const code = errorCodeOf(res);
      if (res.status < 500) key.current = newKey();
      if (code === PAGE_ERROR.notFound) {
        setDraft(null);
        onStale();
        return;
      }
      const at = placeOf(code);
      set((x) => ({
        ...x,
        ...(at === "reason" ? { reasonError: msgOf(code) } : at === "to" ? { toError: msgOf(code) } : {}),
        notice: at === "notice" ? noticeOf(code) : undefined,
      }));
      if (RELOAD_CODES.has(code)) onStale();
    } catch {
      set((x) => ({ ...x, notice: errorText(PAGE_ERROR.loadFailed).title }));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const submit = () => {
    if (!draft || sending.current || submitDisabled || !draft.to) return;
    void send(draft);
  };

  return { draft, busy, submitDisabled, open, cancel, setTo, setReason, submit };
}
