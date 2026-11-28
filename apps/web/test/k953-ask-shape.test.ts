// K-953「問い合わせる小窓」の単体の試験（画面の外の、決まった形だけ）：入力の確かめ・付けるファイルの確かめ・いま見ている画面の情報
//   （features/F12/help/ask-shape.ts）。ブラウザ・口は使わない。行 ID は 11_tickets/K-953.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { askContext, askProblems, fileProblem, MAX_FILES, MAX_FILE_BYTES } from "../features/F12/help/ask-shape";

const f = (name: string, type: string, size: number) => ({ name, type, size });

describe("K-953 小窓の確かめ", () => {
  it("K953-UN-001 付けるファイル：10MB ちょうどと画像・PDF・zip は付けられる・10MB を 1 バイト超える・6 つ目・ほかの種類・0 バイトは理由の字", () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_FILES).toBe(5);
    for (const t of ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "application/zip"])
      expect(fileProblem(f("a", t, MAX_FILE_BYTES), 0), t).toBeNull();
    const big = "大きすぎて付けられません（1 つ 10MB まで・5 つまで）";
    expect(fileProblem(f("a.zip", "application/zip", MAX_FILE_BYTES + 1), 0)).toBe(big);
    expect(fileProblem(f("a.png", "image/png", 10), 5)).toBe(big);
    expect(fileProblem(f("a.exe", "application/x-msdownload", 10), 0)).toBe(
      "この種類は付けられません（画像・PDF・zip）",
    );
    expect(fileProblem(f("a.png", "", 10), 0)).toBe("この種類は付けられません（画像・PDF・zip）");
    expect(fileProblem(f("a.png", "image/png", 0), 0)).toBe("中身が空のファイルは付けられません");
  });

  it("K953-UN-002 題と内容：空・空白だけ（全角も）は「題を書いてください」「内容を書いてください」・題 101 字・内容 4001 字は上限の字・100 字と 4000 字は通る・絵文字は 1 字", () => {
    expect(askProblems({ title: "", body: "" })).toEqual({ title: "題を書いてください", body: "内容を書いてください" });
    expect(askProblems({ title: "　 \t", body: "\n" })).toEqual({
      title: "題を書いてください",
      body: "内容を書いてください",
    });
    expect(askProblems({ title: "あ".repeat(101), body: "い".repeat(4001) })).toEqual({
      title: "題は 100 字までです",
      body: "内容は 4000 字までです",
    });
    expect(askProblems({ title: "😀".repeat(100), body: "い".repeat(4000) })).toEqual({});
  });

  it("K953-UN-003 いま見ている画面の情報：同じ場所の道だけ（外の URL・// で始まる道は付けた場所にする）・時刻・ブラウザの名前と版・PC のつながり（分からなければ欄なし）", () => {
    const at = new Date("2025-11-02T00:38:00Z");
    const ua = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
    expect(askContext({ from: "/tickets/abc", here: "/inquiry", ua, pc: true, at })).toEqual({
      path: "/tickets/abc",
      at: "2025-11-02T00:38:00.000Z",
      browser: "Chrome 130",
      pc: true,
    });
    expect(askContext({ from: "https://evil.example/x", here: "/inquiry", ua, pc: false, at }).path).toBe("/inquiry");
    expect(askContext({ from: "//evil.example/x", here: "/inquiry", ua, pc: false, at }).path).toBe("/inquiry");
    expect(askContext({ from: null, here: "/inquiry", ua: "curl/8", pc: null, at })).toEqual({
      path: "/inquiry",
      at: "2025-11-02T00:38:00.000Z",
      browser: "curl/8",
    });
  });
});
