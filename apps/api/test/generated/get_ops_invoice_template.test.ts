// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/ops/invoice-template
// 保存の前は設定の値・後は DB の行で答えが変わる。種では作れない（K-1107）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/ops/invoice-template", () => {
  it("test_get_ops_invoice_template_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/ops/invoice-template が「月ごとに全社の請求書をまとめて出し、入金を 1 件ずつ記録する。期限を過ぎたものは前の月の分も上に出す」として呼ばれたとき THEN Kaname は「記録すると顧客の請求書の画面も払われたになる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-001");
  });
  it("test_get_ops_invoice_template_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-009");
  });
  it("test_get_ops_invoice_template_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-009");
  });
  // 当てはまらない（入力を受けない GET）：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_ops_invoice_template_rejected_422");
  // 本物の試験はまだ無い（apps/api/test/features/F12/ops-invoice-template.test.ts）：UNWANTED: IF 運営の DB の関数が行が無いと知らせたなら、Kaname は 404 を返し、何も変えない
  it.todo("test_get_ops_invoice_template_not_found");
  it("test_get_ops_invoice_template_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-014");
  });
  // 当てはまらない（運営の人は顧客の規約の同意を持たない（K-944））：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_get_ops_invoice_template_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_ops_invoice_template_mfa_pending");
  it("test_get_ops_invoice_template_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_ops_invoice_template_shape", () => {
    // UBIQUITOUS: GET /api/v1/ops/invoice-template の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-invoice-template.test.ts の「K1107-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-invoice-template.test.ts", "utf8")).toContain("K1107-API-001");
  });
});
