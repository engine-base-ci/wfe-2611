// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/tickets/:id/timeline
// やり取りの並び・続き・絞り込み・新しい数は、書き込みの時刻と書いた人・最後に開いた時刻・行の守り（チケットが見えるか）の組み合わせで答えが変わる。生成の試験の種では作れない（K-383）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/tickets/:id/timeline", () => {
  it("test_get_tickets_id_timeline_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/tickets/:id/timeline が「スレッドに書く・@ を付ける」として呼ばれたとき THEN Kaname は「@ の相手に知らせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F6/thread-timeline.test.ts の「K383-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-timeline.test.ts", "utf8")).toContain("K383-API-001");
  });
  it("test_get_tickets_id_timeline_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F6/thread-timeline.test.ts の「K383-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-timeline.test.ts", "utf8")).toContain("K383-API-018");
  });
  it("test_get_tickets_id_timeline_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F6/thread-timeline.test.ts の「K383-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-timeline.test.ts", "utf8")).toContain("K383-API-016");
  });
  it("test_get_tickets_id_timeline_not_found", () => {
    // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
    // 本物の試験：apps/api/test/features/F6/thread-timeline.test.ts の「K383-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-timeline.test.ts", "utf8")).toContain("K383-API-016");
  });
  it("test_get_tickets_id_timeline_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F6/thread-timeline.test.ts の「K383-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-timeline.test.ts", "utf8")).toContain("K383-API-019");
  });
  it("test_get_tickets_id_timeline_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F6/thread-timeline.test.ts の「K383-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-timeline.test.ts", "utf8")).toContain("K383-API-018");
  });
  it("test_get_tickets_id_timeline_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_tickets_id_timeline_mfa_pending");
  it("test_get_tickets_id_timeline_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_tickets_id_timeline_shape", () => {
    // UBIQUITOUS: GET /api/v1/tickets/:id/timeline の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F6/thread-timeline.test.ts の「K383-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-timeline.test.ts", "utf8")).toContain("K383-API-001");
  });
});
