// PC をつなぐ（K-57・bridge-setup）。中身は apps/web/features/F3/connect-pc/（流れと操作ごとのフォルダ・D-128.130）。
//   前の画面（T-U-09）は消さずに /setup/bridge/legacy に残し（D-128.150・D-128.164）、この画面の「前の設定の画面」から開ける。
//   Claude Code を入れる・ブラウザを選ぶ・PC を外すは K-89・K-90・K-91 が移すまで前の画面にある。?from=<中の道> で開いた画面へ戻る（同じ origin の道だけ）
import { ConnectPc } from "@/features/F3/connect-pc/connect-pc";

export default async function ConnectPcPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  return <ConnectPc from={q["from"] ?? null} />;
}
