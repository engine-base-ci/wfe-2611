// Next.js の決まったファイル（K-30・D-128.123）：落ちたとき・無いときの受け皿がそろっている
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..", "app");

describe("落ちたとき・無いときの受け皿（K-30）", () => {
  it.each(["error.tsx", "global-error.tsx", "not-found.tsx"])("app/%s がある", (f) => {
    expect(existsSync(join(APP, f))).toBe(true);
  });
  it("落ちたときの受け皿は、正本のエラー（ErrorPage と正本の ID）を出す。文言を作らない", () => {
    for (const f of ["error.tsx", "global-error.tsx"]) {
      const s = readFileSync(join(APP, f), "utf8");
      expect(s, f).toMatch(/ErrorPage code=\{PAGE_ERROR\.\w+\}/);
    }
  });
  it("根で落ちたときの受け皿は、自分で <html> を持ち、見た目と書体を読む（根の layout が読まれないため）", () => {
    const s = readFileSync(join(APP, "global-error.tsx"), "utf8");
    expect(s).toMatch(/<html lang="ja"/);
    expect(s).toMatch(/import "\.\/globals\.css"/);
    expect(s).toMatch(/import "@fontsource(-variable)?\//);
  });
  it("根の layout をわざと落とす仕掛けは、開発用の見本が開けるとき（KANAME_DEV_PAGES）だけ効く", () => {
    const s = readFileSync(join(APP, "layout.tsx"), "utf8");
    expect(s).toMatch(/if \(WEB_ENV\.devPages && jar\.get\("k-boom-root"\)/);
  });
});
