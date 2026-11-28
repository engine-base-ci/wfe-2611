// K-587「本文の道具の書式」のうち、画面を使わない確かめ：写した hook の頭に出どころと MIT の表示が在ること（features/F4/doc/editor/bar/）。
//   行 ID は 11_tickets/K-587.md の行の表（K587-UN-001）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 写した hook の頭（20 行）に出どころと MIT の表示が在る（自前で書き直した物は「自前」と書く） */
const BAR_DIR = new URL("../features/F4/doc/editor/bar/", import.meta.url);
const headOf = (file: string): string => {
  const url = new URL(file, BAR_DIR);
  // まだ無いときは、読み込みの失敗（ENOENT）でなく確かめの赤にする（準備の赤と見分ける）
  expect(existsSync(url), `${file} が在る`).toBe(true);
  return readFileSync(url, "utf8").split("\n").slice(0, 20).join("\n");
};
function expectOrigin(file: string): void {
  const h = headOf(file);
  if (/^\s*(\/\/|\*)\s*自前/m.test(h)) return;
  expect(h, `${file}：写し元のリポジトリ`).toMatch(/ueberdosis\/tiptap-ui-components/);
  expect(h, `${file}：写し元の版（コミット）`).toMatch(/\b[0-9a-f]{7,40}\b/);
  expect(h, `${file}：元のファイルの道`).toMatch(/apps\/web\/src\/components\/tiptap-ui\/[\w-]+\//);
  expect(h, `${file}：MIT の表示`).toMatch(/MIT/);
  expect(h, `${file}：著作権の表示`).toMatch(/Copyright/i);
}

describe("写した部品の関数 の出どころの表示（K-587）", () => {
  it("K587-UN-001 写した部品の関数（use-heading・use-list・use-text-align・use-block-button）の頭に、出どころ（リポジトリ・版＝コミット・元のファイルの道）と MIT の許諾の表示が在る。自前で書き直した物は頭に「自前」と書く", () => {
    for (const f of ["use-heading.ts", "use-list.ts", "use-text-align.ts", "use-block-button.ts"]) expectOrigin(f);
  });
});
