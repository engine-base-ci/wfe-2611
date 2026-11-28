// 規約・プライバシーポリシーの文面（K-53・/legal/terms・/legal/privacy）を、ひな形（content/legal/<kind>-v<版>.md）と設定から作る（server だけ）。
//   DB も API も読まない（画面だけを立ち上げる CI の段でも開ける。?v=1 で古い版を開いても、その版のひな形の施行日が出る）。
//   ひな形の先頭の注釈（施行日の行 `<!-- 施行日：YYYY-MM-DD -->` を読んだ後）を外してから、決まった名前の {{NAME}} を値で埋める。
//   値が無い・埋めた後に {{NAME}} が残る（本番で未設定・K-85／K-86 の前）なら文面を出さない（{{ }} のまま出さない）。足りない名前を返す
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { legalValues, type LegalValues } from "@kaname/config";

/** 文面のページで出す種類（特商法の表示はひな形ができるまで出さない） */
export const LEGAL_KINDS = ["terms", "privacy"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];
const DIR = join(process.cwd(), "content", "legal");
const EFFECTIVE = /^<!-- 施行日：(\d{4})-(\d{2})-(\d{2}) -->$/m;
const NAME = /\{\{([A-Z_]+)\}\}/g;

export type LegalText =
  { kind: "ok"; markdown: string; version: number } | { kind: "not_found" } | { kind: "not_ready"; missing: string[] };

/** ある版のひな形の場所。無い版は null */
const fileOf = (kind: LegalKind, v: number) => {
  const p = join(DIR, `${kind}-v${v}.md`);
  return existsSync(p) ? p : null;
};
/** いちばん大きい番号の版（ひな形の置き場にあるもの） */
const latestOf = (kind: LegalKind): number | null => {
  const vs = readdirSync(DIR)
    .map((f) => new RegExp(`^${kind}-v(\\d+)\\.md$`).exec(f)?.[1])
    .filter((x): x is string => !!x)
    .map(Number);
  return vs.length ? Math.max(...vs) : null;
};
/** {{NAME}} に入れる値。無い値は null（文面を出さない） */
const valuesOf = (v: LegalValues, publishedOn: string | null): Record<string, string | null> => ({
  OPERATOR_COMPANY: v.operator.company,
  OPERATOR_REPRESENTATIVE: v.operator.representative,
  OPERATOR_ADDRESS: v.operator.address,
  MAIL_REPLY_TO: v.mailReplyTo,
  PUBLISHED_ON: publishedOn,
  COURT: v.legal.court,
  HOSTING_PROVIDER: v.legal.hostingProvider,
  MAIL_PROVIDER: v.legal.mailProvider,
  SECRETS_PROVIDER: v.legal.secretsProvider,
  STORAGE_PROVIDER: v.legal.storageProvider,
});

/** 文面を作る。version は ?v= の値（無ければ一番新しい版）。数でない・無い版は not_found */
export function legalText(
  kind: string,
  version: string | undefined,
  env?: Record<string, string | undefined>,
): LegalText {
  if (!(LEGAL_KINDS as readonly string[]).includes(kind)) return { kind: "not_found" };
  const k = kind as LegalKind;
  let v: number | null;
  if (version === undefined) v = latestOf(k);
  else v = /^[1-9][0-9]{0,5}$/.test(version) ? Number(version) : null;
  const path = v === null ? null : fileOf(k, v);
  if (v === null || !path) return { kind: "not_found" };
  const raw = readFileSync(path, "utf8");
  const m = EFFECTIVE.exec(raw);
  const publishedOn = m ? `${Number(m[1])} 年 ${Number(m[2])} 月 ${Number(m[3])} 日` : null;
  // 先頭の注釈（説明と施行日の行）を外してから埋める（注釈の中の文字で「残っている」と見誤らない）
  const body = raw.replace(/^(?:\s*<!--[\s\S]*?-->\s*\n)+/, "");
  const values = valuesOf(env ? legalValues(env) : legalValues(), publishedOn);
  const missing = new Set<string>();
  const filled = body.replace(NAME, (all, name: string) => {
    const x = values[name];
    if (x === undefined || x === null || x === "") {
      missing.add(name);
      return all;
    }
    return x;
  });
  for (const left of filled.matchAll(NAME)) missing.add(left[1]!);
  return missing.size
    ? { kind: "not_ready", missing: [...missing].sort() }
    : { kind: "ok", markdown: filled, version: v };
}
