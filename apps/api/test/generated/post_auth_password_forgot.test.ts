// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/auth/password/forgot
// 再設定を頼む口は、本物の DB の本人と verification・差し込んだ送出先（関門 C6）・答えの後の送りで確かめる（K-313）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/auth/password/forgot", () => {
  it("test_post_auth_password_forgot_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/auth/password/forgot が「メールを入れて届いたリンクから新しいパスワードを決める」として呼ばれたとき THEN Kaname は「登録の有無に関わらず同じ答え（accepted）を返し、登録されていれば答えの後に再設定のリンクを 1 通送る」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/password-forgot.test.ts の「K313-API-001 登録済みの人が頼む」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/password-forgot.test.ts", "utf8")).toContain("K313-API-001 登録済みの人が頼む");
  });
  it("test_post_auth_password_forgot_rejected_422", () => {
    // UNWANTED: IF メールアドレスが空か形が違うなら、Kaname は 422 と欄 email の理由を返し、何も送らない
    // 本物の試験：apps/api/test/features/F1/password-forgot.test.ts の「K313-API-006 メールが空・形が違う・欄が無い」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/password-forgot.test.ts", "utf8")).toContain("K313-API-006 メールが空・形が違う・欄が無い");
  });
  it("test_post_auth_password_forgot_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_auth_password_forgot_rate_limited", () => {
    // UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F1/password-forgot.test.ts の「K313-API-011 同じ IP から 1 分に 11 回」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/password-forgot.test.ts", "utf8")).toContain("K313-API-011 同じ IP から 1 分に 11 回");
  });
  it("test_post_auth_password_forgot_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_auth_password_forgot_shape", () => {
    // UBIQUITOUS: POST /api/v1/auth/password/forgot の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/password-forgot.test.ts の「K313-API-012 記録（関門 C2）」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/password-forgot.test.ts", "utf8")).toContain("K313-API-012 記録（関門 C2）");
  });
});
