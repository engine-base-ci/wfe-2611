"use client";
// 親を決める小窓の状態（K-443）。開閉・探す字（pick/use-ticket-search.ts）・選んだ候補・「写す」・送っている間・
//   小窓の上の赤い箱の文・親の期限の注意を持つ。口を呼ぶのは探す道具だけで、決める口は呼ぶ側（parent-field.tsx）が呼ぶ。
//   小窓は開く前にも開いた直後にも口を呼ばない（探す字を打ってから）。冪等キーは小窓を開いたときに 1 つ作り、押し直しでも同じ
import { useCallback, useRef, useState } from "react";
import { mmdd, mmddWeek } from "@/features/F4/due/dates";
import { useTicketSearch, type TicketSearchRow } from "@/features/F4/pick/use-ticket-search";
import type { ParentDialogProps, PickItem } from "./views";

/** 3 段目のチケットの下には作れない（親子は 3 段まで） */
const MAX_DEPTH = 3;
export const DEEP_TEXT = "3 段目のチケットの下には作れません";

export type ParentPickMode = "create" | "detail";

const newKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/** 候補の下の小さな字：「<グループ名> ・ <段名>」（2 段目から「 ・ <n> 段目」を足す） */
function metaOf(r: TicketSearchRow): string | undefined {
  const parts = [r.scope?.name, r.stage?.name].filter((x): x is string => Boolean(x));
  if (r.depth >= 2) parts.push(`${r.depth} 段目`);
  return parts.length ? parts.join(" ・ ") : undefined;
}

function itemOf(r: TicketSearchRow, chosenId: string | null): PickItem {
  const meta = metaOf(r);
  return {
    id: r.id,
    lead: r.number,
    title: r.title,
    ...(meta ? { meta } : {}),
    selected: r.id === chosenId,
    ...(r.depth >= MAX_DEPTH ? { blocked: DEEP_TEXT } : {}),
  };
}

/** この子の期限が親の期限より後のときの注意（作る面は直してもらう・詳細は先に直してもらう） */
function lateNoteOf(mode: ParentPickMode, selfDue: string | null, parentDue: string | null): string | undefined {
  if (!selfDue || !parentDue || parentDue >= selfDue) return undefined;
  const head = `この子の期限（${mmddWeek(selfDue)}）が親の期限（${mmddWeek(parentDue)}）より後です。`;
  return mode === "create"
    ? `${head}親にしたあと、期限を ${mmdd(parentDue)} までに直してください`
    : `${head}先に期限を ${mmdd(parentDue)} までに直してから、親にしてください`;
}

export interface ParentPick {
  /** 開いている間の冪等キー（押し直しでも同じ） */
  key: string;
  chosen: TicketSearchRow | null;
  copy: boolean;
  busy: boolean;
  open: () => void;
  close: () => void;
  setBusy: (b: boolean) => void;
  setFailure: (text: string | undefined) => void;
  /** 小窓（ParentDialog）に渡す値。onConfirm は呼ぶ側が足す */
  dialog: Omit<ParentDialogProps, "onConfirm">;
}

export function useParentPick({ mode, selfDue }: { mode: ParentPickMode; selfDue: string | null }): ParentPick {
  const search = useTicketSearch();
  const { reset } = search;
  const [isOpen, setOpen] = useState(false);
  const [chosen, setChosen] = useState<TicketSearchRow | null>(null);
  const [copy, setCopy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const key = useRef("");

  const open = useCallback(() => {
    reset();
    setChosen(null);
    setCopy(true);
    setBusy(false);
    setFailure(undefined);
    key.current = newKey();
    setOpen(true);
  }, [reset]);
  const close = useCallback(() => {
    setOpen(false);
    setBusy(false);
    setFailure(undefined);
  }, []);

  const onPick = (id: string) => {
    const r = search.rows.find((x) => x.id === id);
    if (r && r.depth < MAX_DEPTH) setChosen(r);
  };
  const lateNote = lateNoteOf(mode, selfDue, chosen?.due_on ?? null);
  const dialog: Omit<ParentDialogProps, "onConfirm"> = {
    open: isOpen,
    mode,
    query: search.text,
    items: search.rows.map((r) => itemOf(r, chosen?.id ?? null)),
    state: search.state,
    copyChecked: copy,
    busy,
    confirmDisabled: mode === "detail" && Boolean(lateNote),
    onQuery: search.setText,
    onPick,
    onCopy: setCopy,
    onClose: close,
    ...(chosen?.due_on ? { parentDue: mmddWeek(chosen.due_on) } : {}),
    ...(lateNote ? { lateNote } : {}),
    ...(failure ? { failure } : {}),
  };
  return { key: key.current, chosen, copy, busy, open, close, setBusy, setFailure, dialog };
}
