// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PUT /api/v1/ops/invoice-template
// 版と今の値で答えが変わり、表と運営の記録を書く。種では作れない（K-1107）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PUT /api/v1/ops/invoice-template", () => {
  it("test_put_ops_invoice_template_ok", () => {
    // EVENT-DRIVEN: WHEN PUT /api/v1/ops/invoice-template が「月ごとに全社の請求書をまとめて出し、入金を 1 件ずつ記録する。期限を過ぎたものは前の月の分も上に出す」として呼ばれたとき THEN Kaname は「記録すると顧客の請求書の画面も払われたになる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-002");
  });
  it("test_put_ops_invoice_template_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-009");
  });
  it("test_put_ops_invoice_template_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-008");
  });
  it("test_put_ops_invoice_template_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-004");
  });
  it("test_put_ops_invoice_template_conflict", () => {
    // UNWANTED: IF 送られた版が請求書の型の今の版と違うなら、Kaname は 409 と E-BILL-007 を返し、型も記録も書かない
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-005");
  });
  // 当てはまらない（送る量の守り（1MB）は入口の共通（op.ts・K-144））：UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
  it.todo("test_put_ops_invoice_template_too_large");
  it("test_put_ops_invoice_template_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-014");
  });
  // 当てはまらない（運営の人は顧客の規約の同意を持たない（K-944））：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_put_ops_invoice_template_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_put_ops_invoice_template_mfa_pending");
  it("test_put_ops_invoice_template_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_put_ops_invoice_template_shape", () => {
    // UBIQUITOUS: PUT /api/v1/ops/invoice-template の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-002");
  });
});
