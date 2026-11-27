// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/audit_events
// 記録の一覧は、権限（管理者・マネージャー・兼務）・札・絞り・続きで答えが変わる。生成の試験の種では作れない（K-823）。ことば（q）で探すのは apps/api/test/features/F10/audit-search.test.ts（K-850）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/audit_events", () => {
  it("test_get_audit_events_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/audit_events が「誰がいつ何をしたかを見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/audit-list.test.ts の「K823-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/audit-list.test.ts", "utf8")).toContain("K823-API-001");
  });
  it("test_get_audit_events_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/audit-list.test.ts の「K823-API-022」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/audit-list.test.ts", "utf8")).toContain("K823-API-022");
  });
  it("test_get_audit_events_rejected_403", () => {
    // UNWANTED: IF 管理者でもマネージャーでもない人が記録を読もうとしたなら、Kaname は 403 を返し、記録の行を 1 つも返さない
    // 本物の試験：apps/api/test/features/F10/audit-list.test.ts の「K823-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/audit-list.test.ts", "utf8")).toContain("K823-API-020");
  });
  it("test_get_audit_events_rejected_422", () => {
    // UNWANTED: IF 絞りの形が違うなら、Kaname は 422 と E-AUD-001 を欄ごとの理由つきで返し、記録を読まない
    // 本物の試験：apps/api/test/features/F10/audit-list.test.ts の「K823-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/audit-list.test.ts", "utf8")).toContain("K823-API-005");
  });
  it("test_get_audit_events_rejected_422_2", () => {
    // UNWANTED: IF 続きの印の形が違うなら、Kaname は 422 と E-AUD-002 を返し、記録を読まない
    // 本物の試験：apps/api/test/features/F10/audit-list.test.ts の「K823-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/audit-list.test.ts", "utf8")).toContain("K823-API-011");
  });
  it("test_get_audit_events_rejected_422_3", () => {
    // UNWANTED: IF 探すことばが空・空白だけ・101 字以上なら、Kaname は 422 と E-AUD-010 を欄 q の理由つきで返し、記録を読まない
    // 本物の試験：apps/api/test/features/F10/audit-search.test.ts の「K850-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/audit-search.test.ts", "utf8")).toContain("K850-API-010");
  });
  // 当てはまらない（入口の上限は契約の共通の試験が持つ）：UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_audit_events_rate_limited");
  // 当てはまらない（入口の共通の試験が持つ）：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_get_audit_events_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_audit_events_mfa_pending");
  // 当てはまらない（入口の共通の試験が持つ）：UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
  it.todo("test_get_audit_events_session_unresolved");
});
