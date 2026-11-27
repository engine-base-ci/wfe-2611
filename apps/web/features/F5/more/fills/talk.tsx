"use client";
// 差し込み口の先：AI と話す・右のパネルの「〈名〉のAI」（持ち主の葉 K-764・この先を本物に替える。器 slots.tsx と帯・右のパネルのファイルは触らない）。
//   最初は今の本線と同じ物：［AI と話す］は押せない形（止まった帯の［直し方を AI に伝える］は置かない・answer=4d049789b537）・タブ「〈名〉のAI」は押せない形・タブの中身は何も出さない
import { Bot } from "lucide-react";
import type { ReactNode } from "react";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import type { TalkActProps, TicketAiTabButtonProps, TicketAiTabProps } from "../slots";

export function TalkActFill(props: TalkActProps): ReactNode {
  void props; // 最初は何も読まない（持ち主の葉 K-764 が本物に替える）
  return <InertButton>AI と話す</InertButton>;
}
export function TicketAiTabButtonFill({ me }: TicketAiTabButtonProps): ReactNode {
  return (
    <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
      <Bot size={14} aria-hidden="true" />
      {`${me}のAI`}
    </button>
  );
}
export function TicketAiTabFill(props: TicketAiTabProps): ReactNode {
  void props; // 最初は何も読まない（持ち主の葉が本物に替える）
  return null;
}
