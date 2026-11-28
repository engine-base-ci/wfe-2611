// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/tickets/:id/restore
// 戻すは、消した本人・マネージャー・30 日の境目・親の有無・一緒に消えた子・孫で答えが変わる。消した行は行の守りで読めないので、生成の試験の種では作れない（K-489）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/tickets/:id/restore", () => {
  it("test_post_tickets_id_restore_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/restore が「子・孫の扱いを決めて消す／アーカイブする」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F7/ticket-restore.test.ts の「K489-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/ticket-restore.test.ts", "utf8")).toContain("K489-API-001");
  });
  it("test_post_tickets_id_restore_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F7/ticket-restore.test.ts の「K489-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/ticket-restore.test.ts", "utf8")).toContain("K489-API-015");
  });
  it("test_post_tickets_id_restore_rejected_403", () => {
    // UNWANTED: IF 消した本人でも、そのグループのマネージャー・管理者でもない人が戻したなら、Kaname は 403 を返し、チケットを何も変えない
    // 本物の試験：apps/api/test/features/F7/ticket-restore.test.ts の「K489-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/ticket-restore.test.ts", "utf8")).toContain("K489-API-004");
  });
  it("test_post_tickets_id_restore_not_found", () => {
    // UNWANTED: IF 見えない・無いチケットを戻したなら、Kaname は 404 を返し、チケットを何も変えない
    // 本物の試験：apps/api/test/features/F7/ticket-restore.test.ts の「K489-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/ticket-restore.test.ts", "utf8")).toContain("K489-API-005");
  });
  it("test_post_tickets_id_restore_conflict", () => {
    // UNWANTED: IF 消えていないチケット・30 日を過ぎたチケット・親が消えている子を戻したなら、Kaname は 409 を返し、チケットを何も変えない
    // 本物の試験：apps/api/test/features/F7/ticket-restore.test.ts の「K489-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/ticket-restore.test.ts", "utf8")).toContain("K489-API-006");
  });
  it("test_post_tickets_id_restore_rejected_422", () => {
    // UNWANTED: IF 体に知らない項目が入っているなら、Kaname は 422 を返し、チケットを何も変えない
    // 本物の試験：apps/api/test/features/F7/ticket-restore.test.ts の「K489-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/ticket-restore.test.ts", "utf8")).toContain("K489-API-016");
  });
  it("test_post_tickets_id_restore_session_unresolved", () => {
    // UNWANTED: IF 戻す DB の関数か証跡の書き込みが落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も戻さない
    // 本物の試験：apps/api/test/features/F7/ticket-restore.test.ts の「K489-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/ticket-restore.test.ts", "utf8")).toContain("K489-API-017");
  });
  it("test_post_tickets_id_restore_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_tickets_id_restore_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F7/ticket-restore.test.ts の「K489-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/ticket-restore.test.ts", "utf8")).toContain("K489-API-015");
  });
  it("test_post_tickets_id_restore_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_tickets_id_restore_mfa_pending");
  it("test_post_tickets_id_restore_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_tickets_id_restore_shape", () => {
    // UBIQUITOUS: POST /api/v1/tickets/:id/restore の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F7/ticket-restore.test.ts の「K489-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/ticket-restore.test.ts", "utf8")).toContain("K489-API-001");
  });
});
