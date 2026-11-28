// チケットの設定（K-707・画面 masters）。ワークスペースの管理の中の 1 画面：種別・状態・項目のタブ。中身は apps/web/features/F9/settings/。
//   (work)＝はじめの設定の門の外：PC をつないでいなくても開く。管理者だけ（見られない人は入れ物が「見る権限がありません」を出す）
import { TicketSettingsPage } from "@/features/F9/settings/settings-page";
import { tabOf } from "@/features/F9/settings/settings-tabs";

export default async function TicketSettings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  return <TicketSettingsPage tab={tabOf(q["tab"])} id={q["id"]} />;
}
