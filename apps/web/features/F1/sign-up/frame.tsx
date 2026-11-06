// ログインしていない人の画面の枠（キャンバスの AuthSignup・AuthVerify・04_design/canvas_gen/auth.py の authpage）。
//   名前の札（Kaname）・中の札・下の行き先（利用規約・プライバシー・困ったとき）
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { pendingRoute } from "@/lib/pending-route";
import "./sign-up.css";

// 規約の版の行き先（K-53）。画面は今の版の口（getCurrentTerms）が返す url を使う（features/F1/consent-terms/current-terms.ts）。
//   口の答えが来るまで・来なかったときは、文面のページの一番新しい版（/legal/terms・/legal/privacy）
export const TERMS_HREF = "/legal/terms" as Route;
export const PRIVACY_HREF = "/legal/privacy" as Route;
/** 規約の 2 つの行き先 */
export interface TermsLinks {
  terms: string;
  privacy: string;
}
export const DEFAULT_TERMS_LINKS: TermsLinks = { terms: TERMS_HREF, privacy: PRIVACY_HREF };
// ログインしていない人の「困ったとき」の画面はまだ切っていない（ログイン後は 問い合わせ・お知らせ）
export const HELP_HREF = pendingRoute("/help", "困ったとき（未切り出し）");

/** foot="help" は下の行き先を「困ったとき」だけにする（確認のリンクを開いた画面・K-52。規約への同意は登録の画面で済んでいる） */
//   links は規約の 2 つの行き先（今の版の url・K-53）。wide は文面のページ（本文を広く読む）
export function AuthFrame({
  children,
  foot = "all",
  links = DEFAULT_TERMS_LINKS,
  wide = false,
}: {
  children: ReactNode;
  foot?: "all" | "help";
  links?: TermsLinks;
  wide?: boolean;
}) {
  return (
    <div className="k-root k-auth" data-wide={wide ? "" : undefined}>
      <div className="k-auth-logo" aria-hidden="true">
        <span className="k-auth-mark">K</span>
        <b>Kaname</b>
      </div>
      <main className="k-auth-card">{children}</main>
      <nav className="k-auth-foot" aria-label="Kaname について">
        {foot === "all" ? (
          <>
            <Link href={links.terms as Route} target="_blank" rel="noopener">
              利用規約
            </Link>
            <Link href={links.privacy as Route} target="_blank" rel="noopener">
              プライバシー
            </Link>
          </>
        ) : null}
        <Link href={HELP_HREF}>困ったとき</Link>
      </nav>
    </div>
  );
}
