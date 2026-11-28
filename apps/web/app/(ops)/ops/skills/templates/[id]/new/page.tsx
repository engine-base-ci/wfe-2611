import { TemplateEditScreen } from "@/features/F12/ops2/template-edit-screen";

// 配るもの › ひな形 › 新しい版の中身を直す（K-1111）。今の版を写して直し、出す確かめを通して出す
export default async function OpsTemplateNewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateEditScreen id={id} />;
}
