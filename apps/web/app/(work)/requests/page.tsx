// 届いた依頼（K-898・requests）。ゲストのグループから届いた依頼の一覧と、開いた 1 件。中身は apps/web/features/F11/requests/（D-155.42）。
//   PC は先頭の依頼を右に開く。スマホ（767 以下）は一覧だけ
import { RequestsPage } from "@/features/F11/requests/requests-page";

export default function Requests() {
  return <RequestsPage />;
}
