// PC をつなぐ（K-57・bridge-setup）。中身は apps/web/features/F3/connect-pc/（流れと操作ごとのフォルダ・D-128.130）。
//   前の画面（T-U-09）は、Claude Code を入れる・ブラウザを選ぶ・PC を外すがこの画面に移ったので K-367 で消した（D-128.164）。
//   ?from=<中の道> で開いた画面へ戻る（同じ origin の道だけ）
import { ConnectPc } from "@/features/F3/connect-pc/connect-pc";

export default async function ConnectPcPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  return <ConnectPc from={q["from"] ?? null} />;
}
