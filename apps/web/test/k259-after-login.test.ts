// K-259「ログインの後の行き先（next）で外のサイトへ移れる（開いた転送）」の単体の試験。
//   afterLogin(next) は、next をこの画面の出どころ（window.location.origin）を基にした URL の決まりで読み、
//   出どころが同じときだけ 道（pathname）＋問い合わせ（search）＋#（hash）を返す。違えば既定の行き先 "/"（入口が今の時点で振り分ける）。
//   バックスラッシュ・タブ・改行・%5C・%2F%2F・大文字小文字・javascript: などの変形もまとめて止まること。
//   ブラウザでの移り方（ログインの後・招待の受諾の後）は apps/web/tests/k/k259-open-redirect.spec.ts が持つ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterLogin } from "../lib/after-login";

const ORIGIN = "https://app.kaname.example";

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: ORIGIN, href: `${ORIGIN}/login` } });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** 返った行き先を、この画面の上でブラウザが解く形にする（出どころが同じかを見るため） */
const resolved = (to: string): URL => new URL(to, ORIGIN);

describe("K-259 afterLogin（ログインの後の行き先）", () => {
  it("K259-LIB-001 next が無い（null・undefined・空の文字）なら既定の行き先 / を返す", () => {
    expect(afterLogin(null)).toBe("/");
    expect(afterLogin(undefined)).toBe("/");
    expect(afterLogin()).toBe("/");
    expect(afterLogin("")).toBe("/");
  });

  it("K259-LIB-002 同じ出どころの道は、道・問い合わせ・# をそのまま返す", () => {
    expect(afterLogin("/tickets")).toBe("/tickets");
    expect(afterLogin("/tickets/abc?tab=1#c")).toBe("/tickets/abc?tab=1#c");
    expect(afterLogin("/ai/chat?c=123")).toBe("/ai/chat?c=123");
  });

  it("K259-LIB-003 同じ出どころの絶対の URL は、道・問い合わせ・# だけにして返す（出どころの部分を落とす）", () => {
    expect(afterLogin(`${ORIGIN}/settings?x=1#y`)).toBe("/settings?x=1#y");
  });

  it("K259-LIB-004 符号にした日本語の道は通す（%E6%97%A5 は制御文字でも \\ でもない）", () => {
    expect(afterLogin("/%E6%97%A5%E5%A0%B1")).toBe("/%E6%97%A5%E5%A0%B1");
  });

  it("K259-LIB-005 // で始まる道（出どころを省いた外の URL）は / にする", () => {
    for (const n of ["//evil.com", "//evil.com/x", "///evil.com"]) expect(afterLogin(n), n).toBe("/");
  });

  it("K259-LIB-006 バックスラッシュの変形（/\\evil.com・\\\\evil.com・/%5Cevil.com・/%5cevil.com）は / にする", () => {
    for (const n of ["/\\evil.com", "\\\\evil.com", "/\\/evil.com", "/%5Cevil.com", "/%5cevil.com", "/%5C%5Cevil.com"])
      expect(afterLogin(n), JSON.stringify(n)).toBe("/");
  });

  it("K259-LIB-007 タブ・改行・復帰の変形（生の文字と %09・%0A・%0D）は / にする", () => {
    for (const n of [
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r/evil.com",
      "\t//evil.com",
      "/%09/evil.com",
      "/%0A/evil.com",
      "/%0a/evil.com",
      "/%0D/evil.com",
      "/%00/evil.com",
    ])
      expect(afterLogin(n), JSON.stringify(n)).toBe("/");
  });

  it("K259-LIB-008 符号にしたスラッシュ（/%2F%2Fevil.com・/%2f/evil.com・%2F%2Fevil.com）は / にする", () => {
    for (const n of ["/%2F%2Fevil.com", "/%2f%2fevil.com", "/%2f/evil.com", "%2F%2Fevil.com"])
      expect(afterLogin(n), n).toBe("/");
  });

  it("K259-LIB-009 外の出どころの絶対の URL（大文字小文字・別の港・利用者名の @ を含む）は / にする", () => {
    for (const n of [
      "https://evil.com/x",
      "HTTPS://EVIL.COM/",
      "http://app.kaname.example/x", // 同じ名前でも http は別の出どころ
      "https://app.kaname.example:8443/x", // 別の港
      "https://app.kaname.example.evil.com/x",
      "https://app.kaname.example@evil.com/x",
    ])
      expect(afterLogin(n), n).toBe("/");
  });

  it("K259-LIB-010 javascript:・data:・vbscript: などの道でない URL（大文字小文字の変形も）は / にする", () => {
    for (const n of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      " javascript:alert(1)",
      "data:text/html,x",
      "vbscript:x",
    ])
      expect(afterLogin(n), JSON.stringify(n)).toBe("/");
  });

  it("K259-LIB-011 符号の誤った道（/%E0%A4%A）は例外にせず / にする", () => {
    expect(() => afterLogin("/%E0%A4%A")).not.toThrow();
    expect(afterLogin("/%E0%A4%A")).toBe("/");
  });

  it("K259-LIB-012 返した行き先は、どの入力でもこの画面と同じ出どころに解ける（悪い next をまとめて）", () => {
    const bad = [
      "//evil.com",
      "/\\evil.com",
      "/%5Cevil.com",
      "/%09/evil.com",
      "/\t/evil.com",
      "/%2F%2Fevil.com",
      "https://evil.com",
      "javascript:alert(1)",
      "\\\\evil.com",
    ];
    for (const n of bad) {
      const to = afterLogin(n);
      expect(to.startsWith("/") && !to.startsWith("//"), JSON.stringify(n)).toBe(true);
      expect(resolved(to).origin, JSON.stringify(n)).toBe(ORIGIN);
    }
  });

  it("K259-LIB-013 画面の外（window が無い・組み立ての途中）では、next に何があっても / を返す", () => {
    vi.unstubAllGlobals();
    expect(typeof window).toBe("undefined");
    expect(afterLogin("/tickets")).toBe("/");
    expect(afterLogin("//evil.com")).toBe("/");
  });
});
