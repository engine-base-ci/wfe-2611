"use client";
// 分身の部屋「話す」（K-762・clone-chat・/ai/talk）。外枠と頭は RoomFrame、中身は RoomTalk（apps/web/features/F5/room/）。
//   ?c=<会話の id>・?new=1 を読むので Suspense の中に置く（本番ビルドの prerender で useSearchParams が落ちないように）
import { Suspense } from "react";
import { RoomTalkPage } from "@/features/F5/room/room-talk";

export default function Talk() {
  return (
    <Suspense fallback={null}>
      <RoomTalkPage />
    </Suspense>
  );
}
