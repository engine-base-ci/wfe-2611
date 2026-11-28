"use client";
// 自分で直す（K-486・A57・D-151.17）：確認の小窓の状態と口 takeoverActionRun（K-485）の呼び出し・断りの出し分け・読み直し。
//   送っている間は busy（押し直しを止め、小窓は閉じない）。201 で小窓を閉じ、お知らせ「自分で進めることにしました」（5 秒・D-148.30）と読み直し。
//   断りは番号で出し分け、字は正本（errors.json）から引く。E-STP-001〜004 は正本の文、それ以外・5xx・つながらないは E-PAGE-007 の 1 文目。
//   E-STP-002・E-STP-004 はすぐ読み直す（小窓は開いたまま）。E-STP-003（別のタブで先に引き取った）は、読み直すと帯ごと小窓が消えるので、
//   小窓を閉じたときに読み直す（閉じると AI に任せるの白い箱が出る）
import { useRef, useState } from "react";
import { useNotify } from "@/components/k";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import { call } from "@/lib/api/call";

/** 正本の文をそのまま出す断り */
const STP_CODES = new Set(["E-STP-001", "E-STP-002", "E-STP-003", "E-STP-004"]);
/** 断りの後にすぐ読み直す番号（小窓は開いたまま） */
const RELOAD_NOW = new Set(["E-STP-002", "E-STP-004"]);
/** 閉じたときに読み直す番号 */
const RELOAD_ON_CLOSE = "E-STP-003";
const DONE = "自分で進めることにしました";

export interface StoppedHand {
  open: boolean;
  busy: boolean;
  notice: string | undefined;
  /** 「自分で直す」を押した */
  start: () => void;
  /** 小窓の開け閉め（やめる・Esc） */
  onOpenChange: (open: boolean) => void;
  /** 確認の「自分で直す」 */
  confirm: () => void;
}

function noticeOf(code: string): string {
  if (STP_CODES.has(code)) return errorText(code).entry.message;
  return errorText(PAGE_ERROR.loadFailed).title;
}

export function useStoppedHand(runId: string, onChanged: () => Promise<void>): StoppedHand {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const sending = useRef(false);
  const reloadOnClose = useRef(false);

  const onOpenChange = (next: boolean) => {
    if (!next && sending.current) return; // 答えを待つ間は閉じない
    setOpen(next);
    if (next) return;
    setNotice(undefined);
    if (reloadOnClose.current) {
      reloadOnClose.current = false;
      void onChanged();
    }
  };

  const confirm = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      const r = await call("takeoverActionRun", { params: { id: runId }, body: {}, screenId: "tickets" });
      if (r.ok) {
        sending.current = false;
        setOpen(false);
        notify(DONE);
        await onChanged();
        return;
      }
      if (r.status === 401) return; // 入り直しへ（共通の扱い）
      const code = errorCodeOf(r);
      setNotice(noticeOf(code));
      if (RELOAD_NOW.has(code)) await onChanged();
      else if (code === RELOAD_ON_CLOSE) reloadOnClose.current = true;
    } catch {
      setNotice(noticeOf(PAGE_ERROR.loadFailed));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return {
    open,
    busy,
    notice,
    start: () => {
      setNotice(undefined);
      setOpen(true);
    },
    onOpenChange,
    confirm: () => void confirm(),
  };
}
