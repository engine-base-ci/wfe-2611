// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/auth/recovery/admin-request
// 管理者に頼むは、本物のログインの部品の待ちの印・本物の DB の頼みの関数・差し込んだメールの送出先で確かめる。生成の試験の偽のセッションでは確かめられない（K-305）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/auth/recovery/admin-request", () => {
  it("test_post_auth_recovery_admin_request_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/auth/recovery/admin-request が「パスキーで入る／メールとパスワードと 6 桁で入る」として呼ばれたとき THEN Kaname は「セッション（操作が無ければ 12 時間・長くて 7 日）。5 回失敗で 15 分止める」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/admin-recovery.test.ts の「K305-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/admin-recovery.test.ts", "utf8")).toContain("K305-API-001");
  });
  it("test_post_auth_recovery_admin_request_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F1/admin-recovery.test.ts の「K305-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/admin-recovery.test.ts", "utf8")).toContain("K305-API-013");
  });
  it("test_post_auth_recovery_admin_request_rejected_422_2", () => {
    // UNWANTED: IF 待ちの印が無いか本文に知らない欄があるなら、Kaname は 422 と項目ごとの理由を返し、何も書かない
    // 本物の試験：apps/api/test/features/F1/admin-recovery.test.ts の「K305-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/admin-recovery.test.ts", "utf8")).toContain("K305-API-011");
  });
  it("test_post_auth_recovery_admin_request_rejected_401", () => {
    // UNWANTED: IF 待ちの印が切れているかでたらめなら、Kaname は 401 を返し、管理者に何も送らない
    // 本物の試験：apps/api/test/features/F1/admin-recovery.test.ts の「K305-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/admin-recovery.test.ts", "utf8")).toContain("K305-API-012");
  });
  it("test_post_auth_recovery_admin_request_server_error", () => {
    // UNWANTED: IF 頼みを書く DB が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、何も送らない
    // 本物の試験：apps/api/test/features/F1/admin-recovery.test.ts の「K305-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/admin-recovery.test.ts", "utf8")).toContain("K305-API-017");
  });
  it("test_post_auth_recovery_admin_request_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_auth_recovery_admin_request_rate_limited", () => {
    // UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F1/admin-recovery.test.ts の「K305-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/admin-recovery.test.ts", "utf8")).toContain("K305-API-014");
  });
  it("test_post_auth_recovery_admin_request_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_auth_recovery_admin_request_shape", () => {
    // UBIQUITOUS: POST /api/v1/auth/recovery/admin-request の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/admin-recovery.test.ts の「K305-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/admin-recovery.test.ts", "utf8")).toContain("K305-API-018");
  });
});
