// 分身の部屋のようす（K-755・ai-activity・/ai）。外枠と頭は RoomFrame、中身は RoomNow（apps/web/features/F5/room/）。
//   承認待ちと同じ (work)＝はじめの設定の門の外（PC がまだでも開ける・D-153.23）
import { RoomFrame } from "@/features/F5/room/room-frame";
import { RoomNow } from "@/features/F5/room/room-now";

export default function Room() {
  return (
    <RoomFrame tab="now">
      <RoomNow />
    </RoomFrame>
  );
}
