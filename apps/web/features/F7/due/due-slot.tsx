"use client";
// 詳細の「期限を変える」の差し込み口の先（K-599 が置き・K-484 が本物にする・D-151.11）。
//   期限が今日より前で完了でなければ炎（LateMark・読み上げ「期限切れ」）。炎は読むだけの印なので書けない人にも出す。
//   getTicket の can.due が真のときだけ押せる ▾ と小窓（役の名前で決めない）。偽・無しなら今の押せない ▾（children）のまま。
//   小窓は「日付と時間」の区（.k-f7-due-anchor）の直下に重ねる（区の中へ描く）。閉じ方は Esc・外を押す・もう一度 ▾。閉じると書きかけは捨て、焦点は ▾ に戻る。
//   一覧の右の詳細（layout side）にはパネルが無いので、ここは呼ばれない（呼ばれても今のまま返す）
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/k";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { jstToday } from "./due-dates";
import { useDueChange } from "./use-due-change";
import { DuePopover, LateMark } from "./views";

/** 本物にする葉（K-484）が true にする */
export const READY = true;

export interface DueSlotProps {
  ticket: SlotTicket;
  children: ReactNode;
}

interface DueDetail {
  ticket?: { due_on?: string | null };
  stage?: { key?: string | null } | null;
  can?: { due?: boolean };
  approval?: { approver_name?: string | null } | null;
  assignee?: { display_name?: string | null } | null;
}

export function DueSlot({ ticket, children }: DueSlotProps): ReactNode {
  const d = ticket.detail as DueDetail;
  const due = d.ticket?.due_on ?? null;
  const done = d.stage?.key === "done";
  const late = due !== null && !done && due < jstToday(new Date());
  if (ticket.layout === "side") return children;
  return (
    <>
      {late ? <LateMark /> : null}
      {d.can?.due === true ? (
        <DueChanger
          id={ticket.id}
          due={due}
          approver={d.approval?.approver_name || d.assignee?.display_name || ""}
          reload={ticket.reload}
        />
      ) : (
        children
      )}
    </>
  );
}

function DueChanger(p: { id: string; due: string | null; approver: string; reload: () => Promise<void> }) {
  const c = useDueChange(p);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Element | null>(null);
  const { open, close } = c;

  useEffect(() => {
    setAnchor(btn.current?.closest(".k-f7-due-anchor") ?? null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const shut = () => {
      close();
      btn.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") shut();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (pop.current?.contains(t) || btn.current?.contains(t))) return;
      shut();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  const box = open ? (
    <div ref={pop}>
      <DuePopover {...c.pop} />
    </div>
  ) : null;
  return (
    <>
      <Button
        ref={btn}
        variant="outlined"
        size="sm"
        className="k-detail-due-btn"
        aria-label="期限を変える"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={c.toggle}
      >
        ▾
      </Button>
      {box ? (anchor ? createPortal(box, anchor) : box) : null}
    </>
  );
}
