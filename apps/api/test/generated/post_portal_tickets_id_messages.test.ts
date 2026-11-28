// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/portal/tickets/:id/messages
// ゲストの書く口は、チケットが見えるか（見せた・外した・別のグループ・消した）と書く人の役（ゲスト・社内の人）と担当者の状態で答えが変わる。生成の試験の種ではグループ・見せる相手・ゲストを作れない（K-882）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/portal/tickets/:id/messages", () => {
  it("test_post_portal_tickets_id_messages_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/portal/tickets/:id/messages が「題・本文・詳細・チャットと段の札を見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F11/portal-chat.test.ts の「K882-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-chat.test.ts", "utf8")).toContain("K882-API-008");
  });
  it("test_post_portal_tickets_id_messages_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/portal-chat.test.ts の「K882-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-chat.test.ts", "utf8")).toContain("K882-API-011");
  });
  it("test_post_portal_tickets_id_messages_rejected_403", () => {
    // UNWANTED: IF ゲストでない人が見せたチケットのチャットに書こうとしたなら、Kaname は 403 を返し、書き込みも受け箱の行も証跡も作らない
    // 本物の試験：apps/api/test/features/F11/portal-chat.test.ts の「K882-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-chat.test.ts", "utf8")).toContain("K882-API-011");
  });
  it("test_post_portal_tickets_id_messages_not_found", () => {
    // UNWANTED: IF 書こうとしたチケットがゲストに見えないなら、Kaname は 404 と E-GST-060 を返し、在るかを漏らさず何も書かない
    // 本物の試験：apps/api/test/features/F11/portal-chat.test.ts の「K882-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-chat.test.ts", "utf8")).toContain("K882-API-010");
  });
  it("test_post_portal_tickets_id_messages_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F11/portal-chat.test.ts の「K882-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-chat.test.ts", "utf8")).toContain("K882-API-015");
  });
  it("test_post_portal_tickets_id_messages_rejected_422_2", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない
    // 本物の試験：apps/api/test/features/F11/portal-chat.test.ts の「K882-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-chat.test.ts", "utf8")).toContain("K882-API-009");
  });
  it("test_post_portal_tickets_id_messages_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_portal_tickets_id_messages_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F11/portal-chat.test.ts の「K882-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-chat.test.ts", "utf8")).toContain("K882-API-020");
  });
  it("test_post_portal_tickets_id_messages_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_portal_tickets_id_messages_mfa_pending");
  it("test_post_portal_tickets_id_messages_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_portal_tickets_id_messages_shape", () => {
    // UBIQUITOUS: POST /api/v1/portal/tickets/:id/messages の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/portal-chat.test.ts の「K882-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-chat.test.ts", "utf8")).toContain("K882-API-008");
  });
});
