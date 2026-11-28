import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { Showcase } from "./showcase";

// 見本の画面（K-28）：新しい外枠の中に、部品・4 つの状態・エラーを全部並べる。キャンバスと比べる的（.qa/visual-fidelity/K-28）。
//   新しい画面は、この形（外枠＋部品）の上に作る
export default async function KShowcasePage() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return <Showcase theme={theme} />;
}
