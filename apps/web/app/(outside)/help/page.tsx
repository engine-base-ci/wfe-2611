// 困ったとき（/help・K-315・A135）。ログインを求めない（ログイン中の人にも同じものを出す）。
//   運営の宛先は設定（@kaname/config の legalValues().operator.email・環境の OPS_EMAIL）をサーバーの側で読んで渡す。画面に宛先を直書きしない
import { legalValues } from "@kaname/config";
import { HelpScreen } from "@/features/F1/help/help-screen";

export const dynamic = "force-dynamic";

export default function Page() {
  return <HelpScreen opsEmail={legalValues().operator.email} />;
}
