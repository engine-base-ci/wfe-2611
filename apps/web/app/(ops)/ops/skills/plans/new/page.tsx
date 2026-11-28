import { PlanProposalScreen } from "@/features/F12/ops2/plan-proposal-screen";

// 配るもの › プラン › 値段を変える案を作る（K-991・?plan=<key>）
export default async function OpsPlanNewPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const { plan } = await searchParams;
  return <PlanProposalScreen id={null} plan={typeof plan === "string" ? plan : null} />;
}
