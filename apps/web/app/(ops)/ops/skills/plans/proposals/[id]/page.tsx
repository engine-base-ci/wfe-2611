import { PlanProposalScreen } from "@/features/F12/ops2/plan-proposal-screen";

// 配るもの › プラン › 案（K-991）。下書き・差し戻された案は作る形、待っている・決めた案は決める人の形
export default async function OpsPlanProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanProposalScreen id={id} plan={null} />;
}
