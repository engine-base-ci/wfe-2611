"use client";
// パネルの「担当者」の値（K-411 の pass・K-415 の distribute の入口）。名前に ▾ を付け、押すと相手を選ぶ小窓を開く。
//   担当者がいなければ今の表示（fallback）。pass の入口は ▾（AI が動いている・承認待ちでも押せ、訳は小窓に出す・D-148.24）。
//   distribute の ▾ は K-415 がこのファイルに足す（それまでは読むだけ）。名前の下の「→ 〇〇（返事待ち）」は note があるときだけ
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/k";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { PassFlow } from "./pass-dialog";
import type { HandoverEntry } from "./use-handovers";
import { AssigneeValue } from "./views";

export interface AssigneeActionProps {
  ticket: SlotTicket;
  /** 入口（pass・distribute）。入口が無い人（offer・null）でも、担当者がいれば読むだけ（plain）の欄を描く */
  entry: HandoverEntry | null;
  /** 名前の下の「→ 〇〇（返事待ち）」の〇〇（待っていなければ null） */
  note: string | null;
  /** AI が動いている・承認待ち（渡せない・D-148.6）。▾ は押せる形のまま、小窓に訳を出す */
  blocked: boolean;
  /** 今の名前の表示（children） */
  fallback: ReactNode;
}

const BLOCKED_REASON = "AI の実行が終わってから渡してください";

/** getTicket の担当者の名前（無い・読めなければ null） */
function assigneeNameOf(detail: SlotTicket["detail"]): string | null {
  const a = detail["assignee"];
  if (typeof a !== "object" || a === null) return null;
  const name = (a as Record<string, unknown>)["display_name"];
  return typeof name === "string" && name !== "" ? name : null;
}

export function AssigneeAction({ ticket, entry, note, blocked, fallback }: AssigneeActionProps): ReactNode {
  const [open, setOpen] = useState(false);
  const name = assigneeNameOf(ticket.detail);
  if (name === null) return fallback;
  const canPass = entry === "pass";
  return (
    // 「渡しました」の小さな知らせの置き場（詳細の画面には前から無い）
    <Toaster>
      <AssigneeValue
        name={name}
        mode={canPass ? (blocked ? "blocked" : "can") : "plain"}
        {...(note ? { waitingFor: note } : {})}
        {...(canPass && blocked ? { reason: BLOCKED_REASON } : {})}
        {...(canPass ? { onOpen: () => setOpen(true) } : {})}
      />
      {canPass ? <PassFlow ticket={ticket} open={open} onClose={() => setOpen(false)} /> : null}
    </Toaster>
  );
}
