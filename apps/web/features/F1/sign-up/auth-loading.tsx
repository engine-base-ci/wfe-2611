// 入れ物の Suspense の待ち。入口の枠（frame.tsx）とは別のファイルに置く：共通の部品の束（@/components/k）は口を呼ぶコードに届くので、
//   「API を呼ばない画面」（規約の文面）が使う入口の枠には読ませない（K-245）
import { Loading } from "@/components/k";
import { AuthFrame } from "./frame";

/** 入れ物の Suspense の待ち（K-211）。画面の JS が動く前の HTML にも、箱の中の真ん中に回る印と「読み込んでいます…」を出す */
export function AuthLoading() {
  return (
    <AuthFrame foot="help">
      <Loading delayMs={0} />
    </AuthFrame>
  );
}
