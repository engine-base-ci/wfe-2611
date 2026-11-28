// 問い合わせる小窓（K-953・画面 inquiry）。困ったとき・お知らせ（/notices・K-956）の上に小窓を開いた形。中身は apps/web/features/F12/help/。
//   ?from=<道> は来た画面（同じ場所の道だけを画面の情報に付ける・確かめは ask-shape.ts）。1 件のやり取り（/inquiry/[id]）は K-1007
import { AskScreen } from "@/features/F12/help/ask-screen";

export default async function Inquiry({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const from = typeof q["from"] === "string" ? q["from"] : null;
  return <AskScreen from={from} />;
}
