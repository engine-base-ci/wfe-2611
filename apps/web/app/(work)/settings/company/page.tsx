// 設定（K-831・company-settings）。ワークスペースの管理の中の 1 画面：名前・ロゴ・プランと支払い・誰ができるか・ワークスペースを消す。
//   中身は apps/web/features/F10/ws/（D-148.1）。(work)＝はじめの設定の門の外：PC をつないでいなくても開く。
//   見られない人（閲覧のみ・口が 403）は入れ物が「この画面を見る権限がありません」を出す
import { SettingsScreen } from "@/features/F10/ws/settings-screen";

export default function CompanySettings() {
  return <SettingsScreen />;
}
