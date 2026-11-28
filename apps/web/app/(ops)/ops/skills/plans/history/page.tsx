import { PlanHistoryScreen } from "@/features/F12/ops2/plan-history-screen";

// 配るもの › プラン › 記録（K-991・?plan=<key> で絞る）
export default async function OpsPlanHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const { plan } = await searchParams;
  return <PlanHistoryScreen plan={typeof plan === "string" ? plan : null} />;
}
