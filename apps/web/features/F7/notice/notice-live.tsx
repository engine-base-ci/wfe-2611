"use client";
// 鈴を押して開くお知らせ（K-467）：部品（NoticePanel・NoticeSheet）に本物の値と動きをつなぐ。
//   幅 767 以下は全面（NoticeSheet）・それより広いと右上の箱（NoticePanel）。木には幅に合う方だけを置く（読み上げと試験が二重に見ないため）。
//   閉じる：鈴をもう一度（差し込み口）・Esc・箱の外を押す・戻る・行き先のある行を押して移る。閉じたら焦点は鈴へ。
import { useEffect, useRef, useState } from "react";
import { BELL_SELECTOR } from "./notice-focus";
import { NoticePanel } from "./notice-panel";
import { NoticeSheet, type NoticeSheetFilter } from "./notice-sheet";
import { noticeItemOf } from "./notice-text";
import type { NoticeItem } from "./notice-types";
import { useNoticeData } from "./use-notices";

const NARROW_QUERY = "(max-width: 767px)";
/** 箱の外を押しても閉じない所（鈴・人の候補の箱・小さなお知らせ） */
const KEEP_OPEN = `${BELL_SELECTOR}, [role="menu"], [data-sonner-toaster]`;

/** 767 以下か（分かるまでは null） */
function useNarrow(): boolean | null {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const m = window.matchMedia(NARROW_QUERY);
    const sync = () => setNarrow(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, []);
  return narrow;
}

export interface NoticeLiveProps {
  /** 外枠の鈴の数（getShell）。まだ分からなければ読んだ行から数える */
  unread: number | undefined;
  /** 閉じる。focus が true なら焦点を鈴へ戻す */
  onClose: (focus: boolean) => void;
}

export function NoticeLive({ unread, onClose }: NoticeLiveProps) {
  const narrow = useNarrow();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [personId, setPersonId] = useState<string | null>(null);
  const [mentionOnly, setMentionOnly] = useState(false);
  const data = useNoticeData({ onlyUnread, personId });
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.target instanceof Element && e.target.closest('[role="menu"]')) return;
      close.current(true);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (box.current?.contains(t) || t.closest(KEEP_OPEN)) return;
      close.current(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  const now = new Date();
  const items = data.rows.map((r) => noticeItemOf(r, now));
  const past = data.past?.map((r) => noticeItemOf(r, now));
  const count = unread ?? [...items, ...(past ?? [])].filter((x) => x.unread).length;

  const onOpen = (item: NoticeItem) => {
    data.markRead(item.id);
    if (item.href) onClose(false); // 行き先は Link が移る
  };
  const filters = {
    people: data.people,
    personId,
    onPerson: setPersonId,
    onlyUnread,
    onOnlyUnread: (v: boolean) => {
      setOnlyUnread(v);
      setMentionOnly(false);
    },
  };

  if (narrow === null) return null;
  if (narrow) {
    const sheetFilter: NoticeSheetFilter = mentionOnly ? "mention" : onlyUnread ? "unread" : "all";
    const onFilter = (k: NoticeSheetFilter) => {
      setOnlyUnread(k === "unread");
      setMentionOnly(k === "mention");
    };
    return (
      <div ref={box}>
        <NoticeSheet
          {...filters}
          items={mentionOnly ? items.filter((x) => x.kind === "mention") : items}
          filter={sheetFilter}
          unread={count}
          mentions={items.filter((x) => x.kind === "mention").length}
          status={data.status}
          onFilter={onFilter}
          onBack={() => onClose(true)}
          onMarkAll={data.markAll}
          onOpen={onOpen}
          onRetry={data.retry}
        />
      </div>
    );
  }
  return (
    <div ref={box}>
      <NoticePanel
        {...filters}
        items={items}
        past={past}
        canOpenPast={data.canOpenPast}
        unread={count}
        status={data.status}
        onMarkAll={data.markAll}
        onOpenPast={data.loadPast}
        onOpen={onOpen}
        onRetry={data.retry}
      />
    </div>
  );
}
