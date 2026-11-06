// ログインしていない人の画面の枠（キャンバスの AuthSignup・AuthVerify・04_design/canvas_gen/auth.py の authpage）。
//   名前の札（Kaname）・中の札・下の行き先（利用規約・プライバシー・困ったとき）
import Link from "next/link";
import type { ReactNode } from "react";
import { pendingRoute } from "@/lib/pending-route";
import "./sign-up.css";

// 規約の版の行き先は K-53（getCurrentTerms で今の版の名前とリンクを渡す）。それまでは仮の道（まだ画面が無い）
export const TERMS_HREF = pendingRoute("/legal/terms", "K-53");
export const PRIVACY_HREF = pendingRoute("/legal/privacy", "K-53");
// ログインしていない人の「困ったとき」の画面はまだ切っていない（ログイン後は 問い合わせ・お知らせ）
export const HELP_HREF = pendingRoute("/help", "困ったとき（未切り出し）");

/** foot="help" は下の行き先を「困ったとき」だけにする（確認のリンクを開いた画面・K-52。規約への同意は登録の画面で済んでいる） */
export function AuthFrame({ children, foot = "all" }: { children: ReactNode; foot?: "all" | "help" }) {
  return (
    <div className="k-root k-auth">
      <div className="k-auth-logo" aria-hidden="true">
        <span className="k-auth-mark">K</span>
        <b>Kaname</b>
      </div>
      <main className="k-auth-card">{children}</main>
      <nav className="k-auth-foot" aria-label="Kaname について">
        {foot === "all" ? (
          <>
            <Link href={TERMS_HREF} target="_blank" rel="noopener">
              利用規約
            </Link>
            <Link href={PRIVACY_HREF} target="_blank" rel="noopener">
              プライバシー
            </Link>
          </>
        ) : null}
        <Link href={HELP_HREF}>困ったとき</Link>
      </nav>
    </div>
  );
}
