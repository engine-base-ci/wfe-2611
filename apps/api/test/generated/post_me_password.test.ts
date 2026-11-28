// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/me/password
// パスワードを変える・決める口は、本物のログインの部品（Better Auth のセッション・kaname_auth.account のパスワードの行）と、全部のワークスペースのセッションで確かめる。生成の試験の偽のセッションでは部品のセッションもパスワードの行も無い（K-312）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/me/password", () => {
  it("test_post_me_password_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/me/password が「端末でパスキーを登録する／認証アプリを登録してバックアップコードを保管する」として呼ばれたとき THEN Kaname は「パスキーの公開鍵・TOTP の鍵を暗号化して保管」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-015");
  });
  it("test_post_me_password_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-019");
  });
  it("test_post_me_password_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-018");
  });
  it("test_post_me_password_conflict", () => {
    // UNWANTED: IF もうパスワードがあるなら、Kaname は 409 を返し、パスワードを変えない
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-016");
  });
  it("test_post_me_password_rejected_422", () => {
    // UNWANTED: IF 新しいパスワードが決まりに合わないなら、Kaname は 422 と欄 new_password の理由を返し、パスワードを決めない
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-017");
  });
  it("test_post_me_password_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（回数は入口の共通の数え。同じ型の確かめは changePassword の K312-API-013 が持つ）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_me_password_rate_limited");
  it("test_post_me_password_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_me_password_mfa_pending");
  it("test_post_me_password_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_me_password_shape", () => {
    // UBIQUITOUS: POST /api/v1/me/password の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/change-password.test.ts の「K312-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/change-password.test.ts", "utf8")).toContain("K312-API-015");
  });
});
