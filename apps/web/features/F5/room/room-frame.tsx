"use client";
// 分身の部屋の外枠（K-755）：承認待ちと同じ外枠（TicketShell）→ 頭（顔・名前・ひとこと・タブ）→ 本文。
//   話す（K-762・tab="talk"）・やったこと（K-756・tab="done"）も同じ外枠と同じ頭の読み（鍵 clone-me）を使う。
//   頭が読み中・読めないあいだは見出し「あなたのAI」・ひとことは空・タブは出す（本文が読み込み中か読めない箱を出す）。
//   PC の状態は頭の答え（pc.state）を外枠に渡す（外枠に PC の一覧を読ませない・二重に読まない）
import { useEffect, type ReactNode } from "react";
import { PageBody } from "@/components/k";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { getToken } from "@/lib/api/client";
import { RoomHead, type RoomTab } from "./head";
import { jstDate, roomName, roomSub, roomSubShort } from "./room-words";
import { useCloneMe } from "./use-clone";

/** 部屋のタブの道（1 か所） */
export const ROOM_LINKS: Record<RoomTab, string> = { now: "/ai", talk: "/ai/talk", done: "/ai/done" };
export const KNOWLEDGE_HREF = "/knowledge";
const TAB_LABEL: Record<RoomTab, string> = { now: "ようす", talk: "話す", done: "やったこと" };

export interface RoomFrameProps {
  tab: RoomTab;
  /** スマホで会話の画面を開いている（頭を畳む・K-762） */
  mobileChat?: boolean;
  children: ReactNode;
}

export function RoomFrame({ tab, mobileChat = false, children }: RoomFrameProps) {
  const me = useCloneMe();
  useEffect(() => {
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent(ROOM_LINKS[tab])}`);
  }, [tab]);
  const data = me.isSuccess ? me.data : undefined;
  const name = roomName(data);
  return (
    <TicketShell
      screen={tab === "talk" ? "clone-chat" : "ai-activity"}
      crumbs={[{ label: name }, { label: TAB_LABEL[tab] }]}
      bridgeConnected={data ? data.pc.state === "live" : null}
    >
      <PageBody labelledBy="room-title">
        <RoomHead
          name={name}
          initial={data?.name.slice(0, 1) ?? ""}
          sub={data ? roomSub(data, jstDate(new Date())) : ""}
          subShort={data ? roomSubShort(data) : ""}
          active={tab}
          mobileChat={mobileChat}
          links={ROOM_LINKS}
          knowledgeHref={KNOWLEDGE_HREF}
        />
        <div className="k-room-body">{children}</div>
      </PageBody>
    </TicketShell>
  );
}
