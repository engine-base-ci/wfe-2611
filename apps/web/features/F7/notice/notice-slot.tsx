"use client";
// 外枠の鈴の差し込み口（K-599 が置き・K-467 が本物にした）。useNoticeSlot は Shell に渡す props（shellProps）と Shell の中に置く箱（node）を返す。
//   鈴を押すと開き、もう一度押すと閉じる。開いている間だけ箱（NoticeLive）を置く＝開くたびに一覧を 1 回読む。
//   箱の部品は鈴を最初に押したときに読む（動的 import・画面の JS を増やさない）。ログイン前（enabled が false）は鈴を押せない形のまま
import dynamic from "next/dynamic";
import { useCallback, useState, type ReactNode } from "react";
import { focusBell } from "./notice-focus";

/** 本物にする葉（K-467）が true にした */
export const READY = true;

export interface NoticeSlotInput {
  /** まだ読んでいない知らせの数（K-466 が getShell の値に替える） */
  unread: number | undefined;
  /** ログイン済みのとき true（ログイン前に口を呼ばない） */
  enabled: boolean;
}
export interface NoticeSlotState {
  shellProps: { onNotices?: () => void; bellExpanded?: boolean };
  node: ReactNode;
}

const NoticeLive = dynamic(() => import("./notice-live").then((m) => m.NoticeLive), { ssr: false });

export function useNoticeSlot({ unread, enabled }: NoticeSlotInput): NoticeSlotState {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback((focus: boolean) => {
    setOpen(false);
    if (focus) focusBell();
  }, []);
  if (!enabled) return { shellProps: {}, node: null };
  return {
    shellProps: { onNotices: toggle, bellExpanded: open },
    node: open ? <NoticeLive unread={unread} onClose={close} /> : null,
  };
}

export function NoticeSlot({ slot }: { slot: NoticeSlotState }): ReactNode {
  return slot.node;
}
