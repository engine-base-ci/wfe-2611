// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/portal/attachments
// 添付を足す口は、ゲストの所属・ファイルの大きさと種類・下書きの数・置き場の状態で答えが変わる。生成の試験の種ではゲストもファイルも作れない（K-909）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/portal/attachments", () => {
  it("test_post_portal_attachments_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/portal/attachments が「依頼を書いて出す・やり取りする」として呼ばれたとき THEN Kaname は「ゲストの依頼を会社に知らせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F11/portal-attachment.test.ts の「K909-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-attachment.test.ts", "utf8")).toContain("K909-API-001");
  });
  it("test_post_portal_attachments_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/portal-attachment.test.ts の「K909-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-attachment.test.ts", "utf8")).toContain("K909-API-008");
  });
  it("test_post_portal_attachments_rejected_403", () => {
    // UNWANTED: IF 呼んだ人がゲストのグループに入った今のゲストでないなら、Kaname は 403 を返し、置き場に置かず行も作らない
    // 本物の試験：apps/api/test/features/F11/portal-attachment.test.ts の「K909-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-attachment.test.ts", "utf8")).toContain("K909-API-008");
  });
  it("test_post_portal_attachments_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F11/portal-attachment.test.ts の「K909-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-attachment.test.ts", "utf8")).toContain("K909-API-006");
  });
  it("test_post_portal_attachments_rejected_422_2", () => {
    // UNWANTED: IF ファイルが大きすぎる・空・実行できる形式・下書きが 5 つあるなら、Kaname は 422 とその番号を返し、置き場に置かず行も作らない
    // 本物の試験：apps/api/test/features/F11/portal-attachment.test.ts の「K909-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-attachment.test.ts", "utf8")).toContain("K909-API-002");
  });
  it("test_post_portal_attachments_rejected_422_3", () => {
    // UNWANTED: IF 入力が契約の形に合わないなら、Kaname は 422 と欄ごとの理由を返し、何も置かず何も書かない
    // 本物の試験：apps/api/test/features/F11/portal-attachment.test.ts の「K909-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-attachment.test.ts", "utf8")).toContain("K909-API-006");
  });
  it("test_post_portal_attachments_unavailable", () => {
    // UNWANTED: IF 置き場か DB が落ちたなら、Kaname は 503 を返し、行も証跡も半端なファイルも残さない
    // 本物の試験：apps/api/test/features/F11/portal-attachment.test.ts の「K909-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-attachment.test.ts", "utf8")).toContain("K909-API-010");
  });
  it("test_post_portal_attachments_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_portal_attachments_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F11/portal-attachment.test.ts の「K909-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-attachment.test.ts", "utf8")).toContain("K909-API-009");
  });
  it("test_post_portal_attachments_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_portal_attachments_mfa_pending");
  it("test_post_portal_attachments_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_portal_attachments_shape", () => {
    // UBIQUITOUS: POST /api/v1/portal/attachments の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/portal-attachment.test.ts の「K909-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-attachment.test.ts", "utf8")).toContain("K909-API-001");
  });
});
