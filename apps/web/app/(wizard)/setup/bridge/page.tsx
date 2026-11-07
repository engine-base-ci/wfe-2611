// PC をつなぐ（K-57・bridge-setup）。中身は apps/web/features/F3/connect-pc/（流れと操作ごとのフォルダ・D-128.130）。
//   前の画面（T-U-09 の 780 行）はこのチケットで置き換えた。?from=<中の道> で開いた画面へ戻る（案内・会話の入口から）
import { ConnectPc } from "@/features/F3/connect-pc/connect-pc";

export default async function ConnectPcPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  return <ConnectPc from={q["from"] ?? null} />;
}
