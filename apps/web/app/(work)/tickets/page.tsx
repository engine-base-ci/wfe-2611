// チケット（K-60・tickets）。いまは「作る」の入口と、作ったチケットの並び。中身は apps/web/features/F4/create-ticket/（D-128.130）。
//   はじめの設定の門（RequireSetup）の外に置く：PC をつないでいなくてもチケットは作れる（D-127.8）
import { TicketsPage } from "@/features/F4/create-ticket/tickets-page";

export default async function Tickets({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return <TicketsPage openNew={q["new"] === "1"} />;
}
