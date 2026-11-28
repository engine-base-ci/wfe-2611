"use client";
// 決定を改める・取り消す小窓の流れ（K-398）。口は契約の updateTicketDecision だけ。見た目は views.tsx の ReviseDialog・CancelDecisionConfirm。
//   決定の一覧の読み直しと区画の頭の知らせは use-decisions.ts と同じ物を使う（失敗の分け方も send.ts で同じ）。
import { useCallback, useRef, useState } from "react";
import { catalogMessage } from "@/features/F5/approve-complete/message";
import { call } from "@/lib/api/call";
import { useSectionNotice } from "./use-decisions";
import { failureOf, networkNotice } from "./send";
import { callName, day, type DecisionRow } from "./to-view";
import type { ReviseValues } from "./views";

const SCREEN = "tickets";

interface Target {
  kind: "revise" | "cancel";
  row: DecisionRow;
}

export interface ReviseCancel {
  /** 決定の一覧の「改める」「取り消す」 */
  onRevise: (id: string) => void;
  onCancel: (id: string) => void;
  revise: {
    open: boolean;
    prev: { by: string; text: string };
    conflict: boolean;
    conflictText: string | undefined;
    notice: string | undefined;
    errors: { text?: string } | undefined;
    busy: boolean;
    onClose: () => void;
    onSubmit: (v: ReviseValues) => void;
  };
  cancel: {
    open: boolean;
    text: string;
    notice: string | undefined;
    errors: { reason?: string } | undefined;
    busy: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => void;
  };
}

/** reload は決定の一覧とやり取りを 1 回ずつ読み直す。onClosed は小窓を閉じた後（焦点を戻す・使わなければ Base UI が戻す） */
export function useReviseCancel(
  ticketId: string,
  rows: readonly DecisionRow[],
  reload: () => Promise<unknown>,
): ReviseCancel {
  // 閉じた後も対象は持ち続ける（閉じる間に字が消えないように）。開いているかは isOpen
  const [target, setTarget] = useState<Target | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [reviseErrors, setReviseErrors] = useState<{ text?: string } | undefined>(undefined);
  const [cancelErrors, setCancelErrors] = useState<{ reason?: string } | undefined>(undefined);
  const [, setSectionNotice] = useSectionNotice(ticketId);
  const sending = useRef(false); // 答えが来るまで 2 本目を送らない

  const open = (kind: Target["kind"]) => (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setConflict(undefined);
    setNotice(undefined);
    setReviseErrors(undefined);
    setCancelErrors(undefined);
    setSectionNotice(undefined);
    setTarget({ kind, row });
    setIsOpen(true);
  };
  // 閉じる：同時に改められていた形のまま閉じるときは、ほかの人の決定を読み直す
  const close = useCallback(() => {
    if (sending.current) return;
    setIsOpen(false);
    if (conflict) void reload();
    setConflict(undefined);
  }, [conflict, reload]);

  const send = async (
    body: { action: "revise"; text: string; reason: string | null } | { action: "cancel"; reason: string },
  ) => {
    if (!target || sending.current) return;
    sending.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      const r = await call("updateTicketDecision", { params: { id: target.row.id }, body, screenId: SCREEN });
      if (r.ok) {
        setIsOpen(false);
        await reload();
        return;
      }
      const f = failureOf(r);
      if (f.kind === "login") return; // 入り直し（共通の扱い）
      if (f.kind === "fields") {
        if (body.action === "revise" && f.text) return setReviseErrors({ text: f.text });
        if (body.action === "cancel" && f.reason) return setCancelErrors({ reason: f.reason });
        return setNotice(networkNotice());
      }
      if (f.kind === "conflict") {
        if (body.action === "revise") return setConflict(f.message); // 小窓の中に赤の箱・字は残す
        setIsOpen(false);
        setSectionNotice(f.message);
        await reload();
        return;
      }
      if (f.kind === "gone") {
        setIsOpen(false);
        setSectionNotice(f.message);
        await reload();
        return;
      }
      setNotice(f.message);
    } catch {
      setNotice(networkNotice()); // 網の切れ
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const row = target?.row;
  const prevBy = row
    ? `${row.decided_at ? day(row.decided_at) : ""} ${callName(row.decided_by?.display_name)}`.trim()
    : "";
  return {
    onRevise: open("revise"),
    onCancel: open("cancel"),
    revise: {
      open: isOpen && target?.kind === "revise",
      prev: { by: prevBy, text: row?.text ?? "" },
      conflict: conflict !== undefined,
      conflictText: conflict,
      notice,
      errors: reviseErrors,
      busy,
      onClose: close,
      onSubmit: (v) => {
        if (!v.text.trim()) return setReviseErrors({ text: catalogMessage("E-VAL-042") });
        void send({ action: "revise", text: v.text, reason: v.reason.trim() ? v.reason : null });
      },
    },
    cancel: {
      open: isOpen && target?.kind === "cancel",
      text: row?.text ?? "",
      notice,
      errors: cancelErrors,
      busy,
      onClose: close,
      onSubmit: (reason) => {
        if (!reason.trim()) return setCancelErrors({ reason: catalogMessage("E-VAL-045") });
        void send({ action: "cancel", reason });
      },
    },
  };
}
