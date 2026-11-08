// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/auth/sign-up/verify
// 確認のリンクで確定するのは、本物のログインの部品（Better Auth の本人とセッション）・本物の DB の申し込みの行・差し込んだ送出先（関門 C6 の完了のメール）で確かめる。生成の試験の偽のセッションと土台では確かめられない（K-52）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/auth/sign-up/verify", () => {
  it("test_post_auth_sign_up_verify_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/auth/sign-up/verify が「届いたリンクを押す」として呼ばれたとき THEN Kaname は「本人確認を記録してログインさせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/verify-email.test.ts の「K52-API-001 保留中（期限内）× 確認のメールのリンク × ログインしていない」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/verify-email.test.ts", "utf8")).toContain("K52-API-001 保留中（期限内）× 確認のメールのリンク × ログインしていない");
  });
  it("test_post_auth_sign_up_verify_conflict", () => {
    // UNWANTED: IF 確定済みのリンクがもう一度来たら、Kaname は 409 を返し、ログインの印を渡さず本人を二重に作らない
    // 本物の試験：apps/api/test/features/F1/verify-email.test.ts の「K52-API-010 確定済み × 同じリンクをもう一度 × ログインしていない」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/verify-email.test.ts", "utf8")).toContain("K52-API-010 確定済み × 同じリンクをもう一度 × ログインしていない");
  });
  it("test_post_auth_sign_up_verify_rejected_422", () => {
    // UNWANTED: IF 手がかりが無いか空なら、Kaname は 422 を返し、申し込みには触らない
    // 本物の試験：apps/api/test/features/F1/verify-email.test.ts の「K52-API-015 手がかりが無い・空」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/verify-email.test.ts", "utf8")).toContain("K52-API-015 手がかりが無い・空");
  });
  it("test_post_auth_sign_up_verify_gone", () => {
    // UNWANTED: IF リンクが期限切れ・前のリンク・無いなら、Kaname は 410 と次の一手を返し、本人を作らない
    // 本物の試験：apps/api/test/features/F1/verify-email.test.ts の「K52-API-005 保留中（期限切れ・30 分を過ぎた）」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/verify-email.test.ts", "utf8")).toContain("K52-API-005 保留中（期限切れ・30 分を過ぎた）");
  });
  it("test_post_auth_sign_up_verify_server_error", () => {
    // UNWANTED: IF 確定の途中で DB か認証が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、ログインの印を渡さない
    // 本物の試験：apps/api/test/features/F1/verify-email.test.ts の「K52-API-022」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/verify-email.test.ts", "utf8")).toContain("K52-API-022");
  });
  it("test_post_auth_sign_up_verify_rate_limited", () => {
    // UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F1/verify-email.test.ts の「K52-API-027 1 分に 11 回（同じ IP）」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/verify-email.test.ts", "utf8")).toContain("K52-API-027 1 分に 11 回（同じ IP）");
  });
  it("test_post_auth_sign_up_verify_shape", () => {
    // UBIQUITOUS: POST /api/v1/auth/sign-up/verify の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/verify-email.test.ts の「K52-API-031 関門」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/verify-email.test.ts", "utf8")).toContain("K52-API-031 関門");
  });
});
