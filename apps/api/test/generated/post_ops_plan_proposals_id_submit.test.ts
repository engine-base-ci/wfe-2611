// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/ops/plan_proposals/:id/submit
// 作った人と案の状態で答えが変わる（K-988）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/ops/plan_proposals/:id/submit", () => {
  it("test_post_ops_plan_proposals_id_submit_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/ops/plan_proposals/:id/submit が「新しい版の案（前後の差・いまの顧客の扱い・理由）を作り、値段を決められる別の人が影響を見て決めるか差し戻す」として呼ばれたとき THEN Kaname は「決めるといまの顧客にお知らせを出し、記録に残す（消せない）」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-007");
  });
  it("test_post_ops_plan_proposals_id_submit_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-010");
  });
  it("test_post_ops_plan_proposals_id_submit_rejected_403", () => {
    // UNWANTED: IF 案を作った人でないなら、Kaname は 403 を返し、案も記録も変えない
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-007");
  });
  it("test_post_ops_plan_proposals_id_submit_not_found", () => {
    // UNWANTED: IF 無い案か消した案を指したなら、Kaname は 404 を返し、案も記録も変えない
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-009");
  });
  it("test_post_ops_plan_proposals_id_submit_conflict", () => {
    // UNWANTED: IF いま直せない・回せない状態の案なら、Kaname は 409 と E-OPS-021 を返し、案も記録も変えない
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-007");
  });
  // 当てはまらない（体を受けない（道の id の形は K988-API-008））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_ops_plan_proposals_id_submit_rejected_422");
  // 当てはまらない（送る量の守り（1MB）は入口の共通（op.ts・K-144））：UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
  it.todo("test_post_ops_plan_proposals_id_submit_too_large");
  it("test_post_ops_plan_proposals_id_submit_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-013");
  });
  // 当てはまらない（運営の人は顧客の規約の同意を持たない（K-944））：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_ops_plan_proposals_id_submit_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_ops_plan_proposals_id_submit_mfa_pending");
  it("test_post_ops_plan_proposals_id_submit_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ops_plan_proposals_id_submit_shape", () => {
    // UBIQUITOUS: POST /api/v1/ops/plan_proposals/:id/submit の副作用は関門 C2・C4・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-plans-write.test.ts の「K988-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-plans-write.test.ts", "utf8")).toContain("K988-API-007");
  });
});
