// 文面のページの見た目（キャンバスの LegalPage）。ログインしていない人の枠（AuthFrame）の中に、ひな形を埋めた文面を出す。
//   埋める値が足りないときは文面を出さず、正本の E-PAGE-003 と「文面を準備しています」を出す（{{ }} のまま出さない）
import { CATALOG } from "@kaname/errors/catalog";
import { AuthFrame } from "../sign-up/frame";
import { LegalMarkdown } from "./legal-markdown";
import type { LegalText } from "./legal-text";
import "./consent-terms.css";

export function LegalPage({ text }: { text: Exclude<LegalText, { kind: "not_found" }> }) {
  if (text.kind === "not_ready")
    return (
      <AuthFrame foot="help">
        <h1>文面を準備しています</h1>
        <div className="k-callout" data-tone="warn" role="status">
          <div>{CATALOG["E-PAGE-003"]?.message ?? "E-PAGE-003"}</div>
        </div>
      </AuthFrame>
    );
  return (
    <AuthFrame foot="help" wide>
      <article className="k-legal">
        <LegalMarkdown text={text.markdown} />
      </article>
    </AuthFrame>
  );
}
