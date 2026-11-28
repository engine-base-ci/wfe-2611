// メンバー（K-420・K-818・members）。ワークスペースの管理の中の 1 画面：グループごとの人の並び・役割の ▾・行の「⋯」・「＋ 招く」。
//   中身は apps/web/features/F10/invite/members-page.tsx（D-148.1）。チケット・承認待ちと同じ (work)＝はじめの設定の門の外：PC をつないでいなくても人は招ける。
//   見られない役の人には、入れ物が外枠の中で「この画面を見る権限がありません」を出す（K-818・screen-derivation §6）
import { MembersPage } from "@/features/F10/invite/members-page";

export default function Members() {
  return <MembersPage />;
}
