"use client";
// 詳細のパネルで会社の項目を 1 つずつ保存する道具（K-1153）。更新の口 updateTicket（K-564）に { fields: { <id>: 値 } } を 1 項目だけ送る。
//   送っている間は次を送らない（送っている印は描き直しを待たずに立てる＝二度押しで口は 1 回）。
//   断りの振り分け（D-148.30〜38）：409（E-FLD-001〜004）・422 → 欄の下／404 → 欄の下＋読み直し／403 → 知らせ（戻す）／503 ほか → 知らせ（残す）。
//   文は正本（errors.json）から引く。画面は役の名前で出し分けず、口の答えで出し分ける
import { useCallback, useRef, useState } from "react";
import { errorText } from "@/components/k/error-of";
import { CATALOG } from "@kaname/errors/catalog";
import { call } from "@/lib/api/call";
import type { FieldValue, TicketField } from "./field-values";

export type SaveResult =
  | { kind: "ok" }
  /** その行の欄の下に出す文 */
  | { kind: "field"; text: string }
  /** 小さな知らせ。revert なら元の値に戻して入力を閉じる（403）・でなければ入力を残す（503） */
  | { kind: "toast"; text: string; revert: boolean }
  /** 項目が消された（404）。欄の下に文を出し、詳細を読み直す */
  | { kind: "gone"; text: string }
  /** ほかの項目を送っている途中（送らなかった） */
  | { kind: "busy" };

export const FORBIDDEN_TEXT = "この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください";
const FIELD_CODES = new Set(["E-FLD-001", "E-FLD-002", "E-FLD-003", "E-FLD-004"]);
const NOT_FOUND = "E-PAGE-001";
const DOWN = "E-PAGE-003";
const BAD_SHAPE = "E-FLD-003";

const textOf = (code: string): string => errorText(code).entry.message;

function sort(r: { status: number; code: string }): SaveResult {
  if (r.status === 403) return { kind: "toast", text: FORBIDDEN_TEXT, revert: true };
  if (r.status === 404) return { kind: "gone", text: textOf(NOT_FOUND) };
  if (r.status === 409) return { kind: "field", text: textOf(FIELD_CODES.has(r.code) ? r.code : BAD_SHAPE) };
  if (r.status === 422) return { kind: "field", text: textOf(BAD_SHAPE) };
  return {
    kind: "toast",
    text: textOf(r.code in CATALOG && r.code.startsWith("E-PAGE") ? r.code : DOWN),
    revert: false,
  };
}

export function useFieldSave(ticketId: string): {
  save: (field: TicketField, value: FieldValue) => Promise<SaveResult>;
  busy: string | null;
} {
  const sending = useRef<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const save = useCallback(
    async (field: TicketField, value: FieldValue): Promise<SaveResult> => {
      if (sending.current !== null) return { kind: "busy" };
      sending.current = field.id;
      setBusy(field.id);
      try {
        const r = await call("updateTicket", {
          params: { id: ticketId },
          body: { fields: { [field.id]: value } },
          screenId: "tickets",
        });
        return r.ok ? { kind: "ok" } : sort(r);
      } catch {
        return { kind: "toast", text: textOf(DOWN), revert: false };
      } finally {
        sending.current = null;
        setBusy(null);
      }
    },
    [ticketId],
  );
  return { save, busy };
}
