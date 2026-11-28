// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/ops/plan_proposals
// 今の版と開いた案で答えが変わり、運営の記録を書く。種では作れない（K-988）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/ops/plan_proposals", () => {
  it("test_post_ops_plan_proposals_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/ops/plan_proposals が「新しい版の案（前後の差・いまの顧客の扱い・理由）を作り、値段を決められる別の人が影響を見て決めるか差し戻す」として呼ばれたとき THEN Kaname は「決めるといまの顧客にお知らせを出し、記録に残す（消せない）」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-001");
  });
  it("test_post_ops_plan_proposals_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-010");
  });
  it("test_post_ops_plan_proposals_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-010");
  });
  it("test_post_ops_plan_proposals_conflict", () => {
    // UNWANTED: IF そのプランに開いた案が在るなら、Kaname は 409 と E-OPS-019 を返し、案も記録も増やさない
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-003");
  });
  it("test_post_ops_plan_proposals_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-008");
  });
  it("test_post_ops_plan_proposals_conflict_2", () => {
    // UNWANTED: IF 値段と人数が今のプランと同じなら、Kaname は 409 と E-OPS-020 を返し、案も記録も変えない
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-004");
  });
  it("test_post_ops_plan_proposals_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_ops_plan_proposals_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-013");
  });
  // 当てはまらない（運営の人は顧客の規約の同意を持たない（K-944））：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_ops_plan_proposals_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_ops_plan_proposals_mfa_pending");
  it("test_post_ops_plan_proposals_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ops_plan_proposals_shape", () => {
    // UBIQUITOUS: POST /api/v1/ops/plan_proposals の副作用は関門 C2・C4・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-001");
  });
});
