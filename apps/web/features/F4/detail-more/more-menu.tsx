"use client";
// 詳細の頭の「…」（K-458・D-150.25）。見た目の部品 MoreMenu（views.tsx・K-431）に開く・移る関数を渡してつなぐだけ。
//   動くのは 2 つ：「複製する」は複製の小窓（K-446 の DuplicateFlow）を開き、「版と差分を見る」は版と差分の頁（K-449・/tickets/:id/versions）へ移る。
//   ほかの項目は部品が押せない形で出す。複製の小窓はメニューの外に並べて置く（メニューが閉じても小窓が残る）。
//   小窓を閉じたら焦点を「…」へ戻す（開いた時点の焦点は消えていくメニューの項目なので、Base UI の戻し先が決まらない）。
//   口は呼ばない（複製の元は詳細を開いたときに読んだ答え・版の一覧は頁が読む）。onDelete は段 8 の K-590（消す）の差し込み口
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { DuplicateFlow, sourceOf } from "@/features/F4/duplicate/duplicate-button";
import { versionsHref } from "@/features/F4/versions/versions-href";
import { MoreMenu } from "./views";

export interface DetailMoreProps {
  ticket: SlotTicket;
  onDelete?: () => void;
}

/** 題名の行の「…」（無ければ何もしない：頁が替わった後など） */
const MORE_BTN = "header.k-page-head .k-f4-more-btn";
function focusMore(): void {
  document.querySelector<HTMLButtonElement>(MORE_BTN)?.focus();
}

export function DetailMore({ ticket, onDelete }: DetailMoreProps) {
  const router = useRouter();
  const [dup, setDup] = useState(false);
  const onDup = (open: boolean) => {
    setDup(open);
    if (open) return;
    // 閉じた直後と、次の描画のあと（Base UI が先に別の所へ戻しても、こちらが勝つ）
    focusMore();
    requestAnimationFrame(() => requestAnimationFrame(focusMore));
  };
  return (
    <>
      <MoreMenu
        onDuplicate={() => setDup(true)}
        onVersions={() => router.push(versionsHref(ticket.id) as Route)}
        {...(onDelete ? { onDelete } : {})}
      />
      <DuplicateFlow source={sourceOf(ticket.detail)} open={dup} onOpenChange={onDup} />
    </>
  );
}
