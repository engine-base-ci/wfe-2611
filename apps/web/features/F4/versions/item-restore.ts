"use client";
// 「項目の変更を版 N に戻す」の道具（K-579）。口は restoreTicketItems（POST /tickets/:id/item-changes/restore・口の葉 K-576）。
//   押すとそのまま戻す（確かめの小窓を挟まない・本文の戻す K-449 と同じ）。体は { from, to }：from＝比べる元の点・to＝一覧の先頭の点（いまの最新）。
//   200 で changed なら知らせ・URL から from と to を外して項目の変更を読み直す。changed が false なら知らせだけ（点が増えないので読み直さない）。
//   戻せなかった項目は restoreNote に口の答えの順・訳のまま持つ（頁の中の並び）。並びと知らせは新しい値を作って入れ替える。
//   断り：409 E-ITM-002 は口の文のまま＋選びを固定して読み直す／E-ITM-001 は getTicket を読み直して押せない形に／E-ITM-003 は正本の文／
//   403 は権限の文／404・503・網切れは正本の文／401 は入り直し。文は正本 errors.json から引く（画面で作らない）
import { useCallback, useRef, useState } from "react";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import { useNotify } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { FORBIDDEN_TEXT } from "@/features/F4/items/use-field-save";
import type { Sel } from "./use-versions";

const SCREEN = "tickets";
const STALE = "E-ITM-002";
const DONE = "E-ITM-001";

export interface Skipped {
  readonly name: string;
  readonly why: string | null;
}
/** 戻した結果（done＝戻せた物が在る・none＝戻せる項目が無かった） */
export interface RestoreNote {
  readonly kind: "done" | "none";
  readonly from: number;
  readonly skipped: readonly Skipped[];
}

export const toastOf = (note: RestoreNote): string =>
  note.kind === "done" ? `項目の変更を版 ${note.from} の形に戻しました` : "戻せる項目がありませんでした";

export interface ItemRestoreArgs {
  readonly id: string;
  /** 一覧の先頭の点（いまの最新）の番号 */
  readonly pointsTop: number | null;
  /** 比べる元の点の番号 */
  readonly from: number | null;
  /** 今見ている比べる先（409 E-ITM-002 のとき選びを固定するのに使う） */
  readonly to: number | null;
  /** 押せる形か（書ける人・完了していない・差分が在る・点が 2 つ以上） */
  readonly canRestore: boolean;
  /** 選びと URL を替える（赤い箱と並びは消さない） */
  readonly place: (next: Sel) => void;
  /** 項目の変更を読み直す */
  readonly reload: () => void;
  /** getTicket を読み直す（完了後の 409 のときだけ） */
  readonly readHead: () => void;
  readonly goLogin: () => void;
}
export interface ItemRestore {
  readonly busy: boolean;
  /** 戻すの失敗の文（戻すボタンの下の赤い箱） */
  readonly error: string | null;
  readonly restoreNote: RestoreNote | null;
  restore: () => Promise<void>;
  /** 並びと赤い箱を消す（比べる物・元・先を選び直したとき） */
  clear: () => void;
}

const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};
const skippedOf = (v: unknown): Skipped[] =>
  (Array.isArray(v) ? v : []).map(obj).map((s) => ({
    name: String(s["name"] ?? ""),
    why: s["why"] === null || s["why"] === undefined ? null : String(s["why"]),
  }));

/** 断りの答え → 赤い箱の文 */
function failText(r: CallErr): string {
  if (r.code === STALE && r.message) return r.message;
  if (r.kind === "forbidden") return FORBIDDEN_TEXT;
  return errorText(errorCodeOf(r)).entry.message;
}

export function useItemRestore(a: ItemRestoreArgs): ItemRestore {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreNote, setRestoreNote] = useState<RestoreNote | null>(null);
  const sending = useRef(false);
  // 操作ごとの冪等キー（押し直しは答えが来てから新しいキー）
  const key = useRef<string | null>(null);

  const clear = useCallback(() => {
    setError(null);
    setRestoreNote(null);
  }, []);

  const { id, pointsTop, from, to, canRestore, place, reload, readHead, goLogin } = a;
  const restore = useCallback(async () => {
    if (sending.current || !canRestore || from === null || pointsTop === null) return;
    sending.current = true;
    key.current = crypto.randomUUID();
    setBusy(true);
    try {
      let r;
      try {
        r = await call("restoreTicketItems", {
          params: { id },
          body: { from, to: pointsTop },
          idempotencyKey: key.current,
          screenId: SCREEN,
        });
      } catch {
        setError(errorText(PAGE_ERROR.offline).entry.message);
        return;
      }
      if (r.ok) {
        const d = obj(r.data);
        const note: RestoreNote = {
          kind: d["changed"] === true ? "done" : "none",
          from,
          skipped: skippedOf(d["skipped"]),
        };
        setError(null);
        setRestoreNote(note);
        notify(toastOf(note));
        if (note.kind === "done") {
          place({ of: "items", from: null, to: null });
          reload();
        }
        return;
      }
      if (r.kind === "unauthenticated") return goLogin();
      setRestoreNote(null);
      // 先に項目が変えられた：読み直しで口の既定の組に移らないよう、今見ている組を先に固定する
      if (r.code === STALE) place({ of: "items", from, to });
      setError(failText(r));
      if (r.code === STALE) reload();
      if (r.code === DONE) readHead();
    } finally {
      sending.current = false;
      key.current = null;
      setBusy(false);
    }
  }, [id, pointsTop, from, to, canRestore, place, reload, readHead, goLogin, notify]);

  return { busy, error, restoreNote, restore, clear };
}
