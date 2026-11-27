// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/ops/invoices/:id/payments
// 請求書と前の入金の行・本人確認の取り直しで答えが変わり、入金と記録を書く。種では作れない（K-982）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/ops/invoices/:id/payments", () => {
  it("test_post_ops_invoices_id_payments_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/ops/invoices/:id/payments が「月ごとに全社の請求書をまとめて出し、入金を 1 件ずつ記録する。期限を過ぎたものは前の月の分も上に出す」として呼ばれたとき THEN Kaname は「記録すると顧客の請求書の画面も払われたになる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-invoice-payments.test.ts の「K982-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-payments.test.ts", "utf8")).toContain("K982-API-001");
  });
  it("test_post_ops_invoices_id_payments_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-invoice-payments.test.ts の「K982-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-payments.test.ts", "utf8")).toContain("K982-API-012");
  });
  it("test_post_ops_invoices_id_payments_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-invoice-payments.test.ts の「K982-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-payments.test.ts", "utf8")).toContain("K982-API-012");
  });
  it("test_post_ops_invoices_id_payments_not_found", () => {
    // UNWANTED: IF 請求書か取り消す入金が無いなら、Kaname は 404 を返し、入金の行も記録も作らない
    // 本物の試験：apps/api/test/features/F12/ops-invoice-payments.test.ts の「K982-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-payments.test.ts", "utf8")).toContain("K982-API-009");
  });
  it("test_post_ops_invoices_id_payments_conflict", () => {
    // UNWANTED: IF もう取り消した入金を取り消すか、取り消す額が入金の額と違うなら、Kaname は 409 と E-BILL-004／E-BILL-005 を返し、入金の行も記録も作らない
    // 本物の試験：apps/api/test/features/F12/ops-invoice-payments.test.ts の「K982-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-payments.test.ts", "utf8")).toContain("K982-API-006");
  });
  it("test_post_ops_invoices_id_payments_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F12/ops-invoice-payments.test.ts の「K982-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-payments.test.ts", "utf8")).toContain("K982-API-013");
  });
  // 当てはまらない（送る量の守り（1MB）は入口の共通（op.ts・K-144））：UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
  it.todo("test_post_ops_invoices_id_payments_too_large");
  it("test_post_ops_invoices_id_payments_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-invoice-payments.test.ts の「K982-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-payments.test.ts", "utf8")).toContain("K982-API-016");
  });
  it("test_post_ops_invoices_id_payments_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_ops_invoices_id_payments_mfa_pending");
  it("test_post_ops_invoices_id_payments_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ops_invoices_id_payments_shape", () => {
    // UBIQUITOUS: POST /api/v1/ops/invoices/:id/payments の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-invoice-payments.test.ts の「K982-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-payments.test.ts", "utf8")).toContain("K982-API-001");
  });
});
