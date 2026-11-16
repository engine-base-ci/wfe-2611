// 文面のページの見た目（キャンバスの LegalPage・K-232）。ログインしていない人の枠（AuthFrame・箱 720px・足元 3 つ）の中に、
//   「← 戻る」とひな形を埋めた文面を出す。
//   埋める値が足りないときは文面を出さず、正本の E-PAGE-003 と「文面を準備しています」を出す（{{ }} のまま出さない）
import { CATALOG } from "@kaname/errors/catalog";
import { Callout } from "@/components/k";
import { AuthFrame } from "../sign-up/frame";
import { LegalBack } from "./legal-back";
import { LegalMarkdown } from "./legal-markdown";
import type { LegalText } from "./legal-text";
import "./legal-page.css";

export function LegalPage({ text }: { text: Exclude<LegalText, { kind: "not_found" }> }) {
  if (text.kind === "not_ready")
    return (
      <AuthFrame foot="all" wide>
        <LegalBack />
        <h1>文面を準備しています</h1>
        <Callout tone="warn">{CATALOG["E-PAGE-003"]?.message ?? "E-PAGE-003"}</Callout>
      </AuthFrame>
    );
  return (
    <AuthFrame foot="all" wide>
      <LegalBack />
      <article className="k-legal">
        <LegalMarkdown text={text.markdown} />
      </article>
    </AuthFrame>
  );
}
