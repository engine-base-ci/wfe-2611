// 運営のパスキーを付ける画面（K-1003・メールのリンク /ops/setup#token=…）。運営の外枠で包まない（ログインの画面と同じ箱 k-auth）。ここは入れ物を置くだけ
import { OpsSetupScreen } from "@/features/F12/ops/ops-setup-screen";

export default function OpsSetupRoute() {
  return <OpsSetupScreen />;
}
