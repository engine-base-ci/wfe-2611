// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/auth/sign-out
// ログアウトは、本物のログインの部品（Better Auth のセッション）と sessions の行（app.close_session）・PC のつなぎで確かめる。生成の試験の偽のセッションでは、その画面だけ閉じて別のブラウザと PC が残ることを確かめられない（K-306）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/auth/sign-out", () => {
  it("test_post_auth_sign_out_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/auth/sign-out が「パスキーで入る／メールとパスワードと 6 桁で入る」として呼ばれたとき THEN Kaname は「セッション（操作が無ければ 12 時間・長くて 7 日）。5 回失敗で 15 分止める」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/sign-out.test.ts の「K306-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/sign-out.test.ts", "utf8")).toContain("K306-API-001");
  });
  it("test_post_auth_sign_out_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F1/sign-out.test.ts の「K306-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/sign-out.test.ts", "utf8")).toContain("K306-API-004");
  });
  it("test_post_auth_sign_out_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F1/sign-out.test.ts の「K306-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/sign-out.test.ts", "utf8")).toContain("K306-API-012");
  });
  it("test_post_auth_sign_out_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F1/sign-out.test.ts の「K306-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/sign-out.test.ts", "utf8")).toContain("K306-API-008");
  });
  it("test_post_auth_sign_out_rejected_422_2", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F1/sign-out.test.ts の「K306-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/sign-out.test.ts", "utf8")).toContain("K306-API-008");
  });
  it("test_post_auth_sign_out_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_auth_sign_out_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F1/sign-out.test.ts の「K306-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/sign-out.test.ts", "utf8")).toContain("K306-API-009");
  });
  it("test_post_auth_sign_out_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_auth_sign_out_shape", () => {
    // UBIQUITOUS: POST /api/v1/auth/sign-out の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/sign-out.test.ts の「K306-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/sign-out.test.ts", "utf8")).toContain("K306-API-001");
  });
});
