"use client";
// 差し込み口の先：決めた履歴（持ち主の葉 K-751。器 slots.tsx と承認待ちのファイルは触らない）。
//   ［決めた履歴］（道具の行は小さい形・空の画面はふつうの形）を押すと、右から決めた履歴の板（features/F5/history/history-sheet.tsx）。
//   板の開け閉めと知らせは頁の中で 1 つ（どちらの入口から開いても同じ板）。
//   取り下げの断りの知らせは、承認待ちの画面の上（本文 .k-ap-body のいちばん上）に Callout で出す（器と承認待ちのファイルを変えずに置く）
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button, Callout } from "@/components/k";
import { HistorySheet, openHistory, resetHistory, useHistoryShared } from "@/features/F5/history/history-sheet";
import type { QueueHistoryProps } from "../slots";
// 前は style 属性で書いていた並び・重なりのクラス（k-more-bulk-note・k-more-contents・k-more-focus-layer）。承認待ちの頁でも読む小さい CSS
import "@/features/F5/more/fills.css";

/** 頁の中に置かれた先の数（0 になったら板と知らせを戻す。道具の行と空の画面の入れ替わりでは戻さない） */
let mounted = 0;

export function QueueHistoryFill({ where }: QueueHistoryProps): ReactNode {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mounted += 1;
    return () => {
      mounted -= 1;
      setTimeout(() => {
        if (mounted === 0) resetHistory();
      }, 0);
    };
  }, []);
  return (
    <>
      <Button
        ref={btn}
        variant="outlined"
        {...(where === "tools" ? { size: "sm" as const } : {})}
        onClick={() => openHistory(true)}
      >
        決めた履歴
      </Button>
      <HistorySheet finalFocus={btn} />
      <HistoryNotice anchor={btn} />
    </>
  );
}

/** 取り下げの断りの知らせ：承認待ちの本文のいちばん上に置く（知らせが在る間だけ置き場を作る） */
function HistoryNotice({ anchor }: { anchor: RefObject<HTMLButtonElement | null> }): ReactNode {
  const { notice } = useHistoryShared();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!notice) return;
    const body = anchor.current?.closest(".k-ap-body");
    if (!body) return;
    const el = document.createElement("div");
    el.className = "k-more-contents"; // 置き場そのものは並びに加わらない（Callout が本文の並びの 1 つ目になる）
    body.prepend(el);
    setHost(el);
    return () => {
      el.remove();
      setHost(null);
    };
  }, [notice, anchor]);
  return notice && host ? createPortal(<Callout tone="danger">{notice}</Callout>, host) : null;
}
