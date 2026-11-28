"use client";
// 「確認項目を足す」の合図を聞く（K-450・K-573 の流れ・D-150.58）。window の kaname:f4:open-spec-add（CustomEvent・detail は { ticketId }）を聞き、
//   ticketId が自分のチケットと同じときだけ onOpen を呼ぶ。名前と形は K-573 の features/F5/delegate/spec-add-event.ts と同じ字
//   （K-573 がこの葉に依存するので import しない）。ticketId が null なら聞かない。口は呼ばない
import { useEffect, useRef } from "react";

export const OPEN_SPEC_ADD_EVENT = "kaname:f4:open-spec-add";
export interface OpenSpecAddDetail {
  ticketId: string;
}

export function useOpenAddSignal(ticketId: string | null | undefined, onOpen: () => void): void {
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);
  useEffect(() => {
    if (!ticketId) return;
    const listener = (e: Event): void => {
      const detail = (e as CustomEvent<Partial<OpenSpecAddDetail> | null>).detail;
      if (detail && detail.ticketId === ticketId) onOpenRef.current();
    };
    window.addEventListener(OPEN_SPEC_ADD_EVENT, listener);
    return () => window.removeEventListener(OPEN_SPEC_ADD_EVENT, listener);
  }, [ticketId]);
}
