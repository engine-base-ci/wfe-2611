// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/me/password
// パスワードを変える・決める口は、本物のログインの部品（Better Auth のセッション・kaname_auth.account のパスワードの行）と、全部のワークスペースのセッションで確かめる。生成の試験の偽のセッションでは部品のセッションもパスワードの行も無い（K-312）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/me/password", () => {
  it("test_patch_me_password_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/me/password が「端末でパスキーを登録する／認証アプリを登録してバックアップコードを保管する」として呼ばれたとき THEN Kaname は「パスキーの公開鍵・TOTP の鍵を暗号化して保管」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-001");
  });
  it("test_patch_me_password_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-012");
  });
  it("test_patch_me_password_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-008");
  });
  it("test_patch_me_password_rejected_422", () => {
    // UNWANTED: IF 新しいパスワードが決まりに合わないか今のパスワードが違うなら、Kaname は 422 と欄の理由を返し、端末を切らずパスワードを変えない
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-005");
  });
  it("test_patch_me_password_session_unresolved", () => {
    // UNWANTED: IF ほかの端末を切る所で落ちたなら、Kaname は 503 と E-PAGE-003 を返し、パスワードを変えない
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-011");
  });
  it("test_patch_me_password_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_patch_me_password_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-013");
  });
  it("test_patch_me_password_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  it("test_patch_me_password_mfa_pending", () => {
    // UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/mfa-gate.test.ts の「K321-API-001」（入口 1 か所の止め・同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/mfa-gate.test.ts", "utf8")).toContain("K321-API-001");
  });
  it("test_patch_me_password_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_me_password_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/me/password の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-001");
  });
});
