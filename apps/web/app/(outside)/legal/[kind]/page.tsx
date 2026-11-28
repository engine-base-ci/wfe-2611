// 規約・プライバシーポリシーの文面（/legal/terms・/legal/privacy・K-53・A96）。ログインを求めない。
//   中身はひな形（content/legal/<kind>-v<版>.md）を設定で埋めたもの（features/F1/consent-terms/legal-text.ts）。DB も API も読まない。
//   ?v=<版> でその版、無ければ一番新しい版。無い種類・無い版・数でない v は 404。値が足りない環境では文面を出さず E-PAGE-003 と「文面を準備しています」
import { notFound } from "next/navigation";
import { LegalPage } from "@/features/F1/consent-terms/legal-page";
import { legalText } from "@/features/F1/consent-terms/legal-text";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kind } = await params;
  const sp = await searchParams;
  const v = Array.isArray(sp["v"]) ? sp["v"][0] : sp["v"];
  const t = legalText(kind, v);
  if (t.kind === "not_found") notFound();
  if (t.kind === "not_ready") console.error(`[legal] ${kind} の文面に入れる値が足りない: ${t.missing.join(", ")}`);
  return <LegalPage text={t} />;
}
