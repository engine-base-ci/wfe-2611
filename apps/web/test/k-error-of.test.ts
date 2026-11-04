// エラーの出し方（KN-106・D-069）：文言は正本（errors.json）の 1 件だけ。API の答え → 正本の ID
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAGE_ERROR, errorCodeOf, errorText } from "../components/k/error-of";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SRC = JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
  errors: { id: string; message?: string; action?: string }[];
};

describe("エラーの出し方（KN-106）", () => {
  it("共通のエラー 8 件は全部正本にあり、文言と一手が正本と同じ", () => {
    for (const code of Object.values(PAGE_ERROR)) {
      const src = SRC.errors.find((e) => e.id === code);
      expect(src, code).toBeTruthy();
      const t = errorText(code);
      expect(t.title + t.body).toBe(src!.message);
      expect(t.actions.join("／")).toBe(src!.action!.replace(/\s*／\s*/g, "／"));
    }
  });
  it("正本に無い ID は止める（画面で文言を作らせない）", () => {
    expect(() => errorText("E-XXX-999")).toThrow(/正本/);
  });
  it("API の答え → 正本の ID（サーバーが正本の ID を返したらそれ）", () => {
    expect(errorCodeOf({ kind: "not_found", code: "NOT_FOUND", status: 404 })).toBe(PAGE_ERROR.notFound);
    expect(errorCodeOf({ kind: "forbidden", code: "FORBIDDEN", status: 403 })).toBe(PAGE_ERROR.forbidden);
    expect(errorCodeOf({ kind: "unauthenticated", code: "UNAUTHENTICATED", status: 401 })).toBe(
      PAGE_ERROR.sessionExpired,
    );
    expect(errorCodeOf({ kind: "failed", code: "MAINTENANCE", status: 503 })).toBe(PAGE_ERROR.maintenance);
    expect(errorCodeOf({ kind: "failed", code: "INTERNAL", status: 500 })).toBe(PAGE_ERROR.loadFailed);
    expect(errorCodeOf({ kind: "invalid", code: "E-AUTH-001", status: 422 })).toBe("E-AUTH-001");
  });
  it("見出しは最初の 1 文、続きは本文", () => {
    const t = errorText(PAGE_ERROR.sessionExpired);
    expect(t.title).toBe("ログインが切れました。");
    expect(t.body).toMatch(/書きかけ/);
  });
});
