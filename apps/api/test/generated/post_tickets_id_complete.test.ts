// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/tickets/:id/complete
// 承認と完了は、本物の DB の関数（app.approval_decide・app.ticket_complete）と本物の PC の印（K-57）と差し込んだ受け箱（関門 C6）で確かめる。生成の試験の偽のセッションと土台では確かめられない（K-63）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/tickets/:id/complete", () => {
  it("test_post_tickets_id_complete_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/complete が「完了の条件と申し送りを確かめて完了にする」として呼ばれたとき THEN Kaname は「完了を記録・知らせる・セッションを閉じる」を行い 2xx を返す（自動側：ナレッジ更新の候補を出す・実行後の確認の結果を添える）
    // 本物の試験：apps/api/test/features/F5/approve-complete.test.ts の「K63-API-027」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete.test.ts", "utf8")).toContain("K63-API-027");
  });
  it("test_post_tickets_id_complete_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/approve-complete.test.ts の「K63-API-026」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete.test.ts", "utf8")).toContain("K63-API-026");
  });
  it("test_post_tickets_id_complete_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F5/approve-complete.test.ts の「K63-API-034」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete.test.ts", "utf8")).toContain("K63-API-034");
  });
  it("test_post_tickets_id_complete_not_found", () => {
    // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
    // 本物の試験：apps/api/test/features/F5/approve-complete.test.ts の「K63-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete.test.ts", "utf8")).toContain("K63-API-025");
  });
  it("test_post_tickets_id_complete_conflict", () => {
    // UNWANTED: IF チケットが承認待ち・実行中・確認中か、実施事項が書き換わったか、もう完了しているなら、Kaname は 409 と理由（E-CONF-016・E-CONF-017・E-CONF-018）を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approve-complete.test.ts の「K63-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete.test.ts", "utf8")).toContain("K63-API-032");
  });
  it("test_post_tickets_id_complete_rejected_422", () => {
    // UNWANTED: IF 実施事項が残っているか、完了の条件を確かめていないか、終わっていない子があるなら、Kaname は 422 と項目ごとの理由（E-VAL-022〜024）を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approve-complete.test.ts の「K63-API-028」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete.test.ts", "utf8")).toContain("K63-API-028");
  });
  it("test_post_tickets_id_complete_rejected_422_2", () => {
    // UNWANTED: IF 守りの判定の所で例外になったなら、Kaname は 503 と E-PAGE-003 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approve-complete.test.ts の「K63-API-063」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete.test.ts", "utf8")).toContain("K63-API-063");
  });
  it("test_post_tickets_id_complete_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/approve-complete.test.ts の「K63-API-045」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete.test.ts", "utf8")).toContain("K63-API-045");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete.test.ts）：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_tickets_id_complete_terms_pending");
  it("test_post_tickets_id_complete_shape", () => {
    // UBIQUITOUS: POST /api/v1/tickets/:id/complete の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/approve-complete.test.ts の「K63-API-027」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete.test.ts", "utf8")).toContain("K63-API-027");
  });
});
