// ゲストの場所で依頼を出す /portal/requests/new（K-912）。中身は apps/web/features/F11/portal/new-request-page.tsx
import { NewRequestPage } from "@/features/F11/portal/new-request-page";

export default function PortalNewRequest() {
  return <NewRequestPage />;
}
