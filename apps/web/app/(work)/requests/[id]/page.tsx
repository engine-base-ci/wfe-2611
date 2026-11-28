// 届いた依頼の 1 件（K-898）。PC は左に一覧、スマホ（767 以下）は開いた依頼だけ。中身は apps/web/features/F11/requests/requests-page.tsx
import { RequestsPage } from "@/features/F11/requests/requests-page";

export default async function Request({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestsPage id={id} />;
}
