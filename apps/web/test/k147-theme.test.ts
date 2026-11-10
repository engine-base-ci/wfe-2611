// K-147「見た目の最初を明るいにする」の部品の試験（D-129.45）。画面の試験は tests/k/k147-theme.spec.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTheme, themeAttr } from "../lib/theme";

const APP = join(__dirname, "..", "app");

describe("K-147 選んでいなければ明るい", () => {
  it("K147-WEB-001 知らない値・無い値は明るい（OS に引っ張られない）。選んだ値はそのまま", () => {
    expect(parseTheme(undefined)).toBe("light");
    expect(parseTheme("")).toBe("light");
    expect(parseTheme("blue")).toBe("light");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("dark")).toBe("dark");
    expect(themeAttr(parseTheme(undefined))).toBe("light"); // 選んでいない人にも data-theme=light を付ける
  });
  it("K147-WEB-002 根で落ちたときの画面（global-error）も、根の layout と同じ parseTheme・themeAttr で data-theme を付ける", () => {
    const s = readFileSync(join(APP, "global-error.tsx"), "utf8");
    expect(s).toMatch(/themeAttr\(parseTheme\(/);
    expect(s).toMatch(/<html lang="ja" data-theme="light">/);
  });
});
