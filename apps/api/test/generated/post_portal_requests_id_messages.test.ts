// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/portal/requests/:id/messages
// 返事を書く口は、ゲストの所属・依頼の状態・届け先の人・メールで答えが変わる。生成の試験の種ではゲストも依頼も作れない（K-908）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/portal/requests/:id/messages", () => {
  it("test_post_portal_requests_id_messages_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/portal/requests/:id/messages が「依頼を書いて出す・やり取りする」として呼ばれたとき THEN Kaname は「ゲストの依頼を会社に知らせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F11/portal-request-message.test.ts の「K908-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request-message.test.ts", "utf8")).toContain("K908-API-001");
  });
  it("test_post_portal_requests_id_messages_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/portal-request-message.test.ts の「K908-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request-message.test.ts", "utf8")).toContain("K908-API-009");
  });
  it("test_post_portal_requests_id_messages_rejected_403", () => {
    // UNWANTED: IF 呼んだ人がゲストのグループに入った今のゲストでないなら、Kaname は 403 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F11/portal-request-message.test.ts の「K908-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request-message.test.ts", "utf8")).toContain("K908-API-009");
  });
  it("test_post_portal_requests_id_messages_not_found", () => {
    // UNWANTED: IF 依頼が自分のゲストのグループの物でないなら、Kaname は 404 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F11/portal-request-message.test.ts の「K908-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request-message.test.ts", "utf8")).toContain("K908-API-005");
  });
  it("test_post_portal_requests_id_messages_conflict", () => {
    // UNWANTED: IF 依頼の state が new・asking でないなら、Kaname は 409 と E-GST-170 を返し、返事も知らせも作らない
    // 本物の試験：apps/api/test/features/F11/portal-request-message.test.ts の「K908-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request-message.test.ts", "utf8")).toContain("K908-API-003");
  });
  it("test_post_portal_requests_id_messages_rejected_422", () => {
    // UNWANTED: IF 本文の値が決まりの外なら、Kaname は 422 と欄の理由を返し、何も書かない
    // 本物の試験：apps/api/test/features/F11/portal-request-message.test.ts の「K908-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request-message.test.ts", "utf8")).toContain("K908-API-002");
  });
  it("test_post_portal_requests_id_messages_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_portal_requests_id_messages_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F11/portal-request-message.test.ts の「K908-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request-message.test.ts", "utf8")).toContain("K908-API-010");
  });
  it("test_post_portal_requests_id_messages_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_portal_requests_id_messages_mfa_pending");
  it("test_post_portal_requests_id_messages_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_portal_requests_id_messages_shape", () => {
    // UBIQUITOUS: POST /api/v1/portal/requests/:id/messages の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/portal-request-message.test.ts の「K908-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request-message.test.ts", "utf8")).toContain("K908-API-001");
  });
});
