// 実ブラウザの試験の型（K-36・G28）：操作要素 1 つ＝仕様の 1 行＝試験 1 本。新しい画面の試験はこの型で書く
//   ・試験の名前は「行 ID ＋ テスト項目」。op_gate.py が名前の行 ID で証拠を引く（説明文の PASS を赤にする）
//   ・押した後の画面を証拠として報告に添える（行 ID の名前の画像）
//   ・仕様（07_qa/test-specs/**.md）の行を読み、画面の操作要素に行の無いものを赤にする（controlsOf と rowsOf を比べる）
import { readFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

export interface SpecRow {
  id: string;
  role: string;
  name: string;
  item: string;
  expect: string;
}

/** 仕様の表から行を読む。テスト項目の「（役割）「名前」」を鍵にする */
export function rowsOf(mdPath: string): SpecRow[] {
  const out: SpecRow[] = [];
  for (const ln of readFileSync(mdPath, "utf8").split("\n")) {
    if (!ln.startsWith("| ") || ln.startsWith("| ID ")) continue;
    const c = ln
      .slice(1, -1)
      .split("|")
      .map((x) => x.trim());
    if (c.length < 11 || !/^[A-Z]/.test(c[0]!)) continue;
    const m = /（([a-z]+)）「(.+)」/.exec(c[3]!);
    out.push({ id: c[0]!, role: m?.[1] ?? "", name: m?.[2] ?? "", item: c[3]!, expect: c[6]! });
  }
  return out;
}

/** 行 1 つの試験。名前に行 ID が入り、終わったら証拠の画面を添える */
export function row(r: SpecRow | undefined, body: (page: Page, info: TestInfo) => Promise<void>) {
  if (!r) throw new Error("仕様に無い行の試験は書けない（先に仕様に行を足す）");
  test(`${r.id} ${r.item}：${r.expect}`, async ({ page }, info) => {
    await body(page, info);
    await info.attach(`${r.id}.png`, { body: await page.screenshot(), contentType: "image/png" });
  });
}

const CONTROL =
  /^\s*- (button|link|tab|radio|textbox|searchbox|combobox|checkbox|switch|menuitem|option|slider|spinbutton) "((?:[^"\\]|\\.)*)"/;
/** 画面の操作要素（読み上げの木にある、押せる・入れられるもの）を（役割, 名前）で集める。
 *  scope で範囲を絞れる（前からある外枠に載せた画面は、外枠の要素を外枠の試験に任せ、本文だけを見る） */
export async function controlsOf(page: Page, scope = "body"): Promise<{ role: string; name: string }[]> {
  const snap = await page.locator(scope).ariaSnapshot();
  const out = new Map<string, { role: string; name: string }>();
  for (const ln of snap.split("\n")) {
    const m = CONTROL.exec(ln);
    if (m) out.set(`${m[1]}|${m[2]}`, { role: m[1]!, name: m[2]!.replace(/\\"/g, '"') });
  }
  return [...out.values()];
}

/** 操作要素のうち、仕様に行の無いもの */
export async function missingRows(page: Page, rows: SpecRow[], scope = "body"): Promise<string[]> {
  const have = new Set(rows.map((r) => `${r.role}|${r.name}`));
  return (await controlsOf(page, scope))
    .filter((c) => !have.has(`${c.role}|${c.name}`))
    .map((c) => `（${c.role}）「${c.name}」`);
}

export { expect };
