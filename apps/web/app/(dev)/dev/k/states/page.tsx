import { States } from "./states";

// 4 つの状態とエラーの画面の見本（KN-106）。?page=E-PAGE-001 で画面いっぱいのエラー、?boom=1 で描いている途中で落とす
export default async function KStatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  if (q["boom"] === "1") throw new Error("見本：描いている途中で落とす");
  return <States page={q["page"] ?? null} />;
}
