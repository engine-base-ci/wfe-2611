// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/tickets/:id/guest-shares
// 付け外しは、書ける人・見えない人・ゲストのグループの状態（無い・消した・別の会社）・20 の上限で答えが変わる。生成の試験の種では作れない（K-881）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/tickets/:id/guest-shares", () => {
  it("test_patch_tickets_id_guest_shares_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id/guest-shares が「見せる相手にゲストのグループを選ぶ」として呼ばれたとき THEN Kaname は「ゲストの受け箱に 1 件（メールなし）」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F11/ticket-guest-shares.test.ts の「K881-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/ticket-guest-shares.test.ts", "utf8")).toContain("K881-API-004");
  });
  it("test_patch_tickets_id_guest_shares_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/ticket-guest-shares.test.ts の「K881-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/ticket-guest-shares.test.ts", "utf8")).toContain("K881-API-011");
  });
  it("test_patch_tickets_id_guest_shares_rejected_403", () => {
    // UNWANTED: IF チケットに書けないなら、Kaname は 403 を返し、見せる相手も証跡も変えない
    // 本物の試験：apps/api/test/features/F11/ticket-guest-shares.test.ts の「K881-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/ticket-guest-shares.test.ts", "utf8")).toContain("K881-API-011");
  });
  it("test_patch_tickets_id_guest_shares_not_found", () => {
    // UNWANTED: IF 選んだゲストのグループが見つからないなら、Kaname は 404 と E-GST-040 を返し、見せる相手も証跡も変えない
    // 本物の試験：apps/api/test/features/F11/ticket-guest-shares.test.ts の「K881-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/ticket-guest-shares.test.ts", "utf8")).toContain("K881-API-009");
  });
  it("test_patch_tickets_id_guest_shares_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F11/ticket-guest-shares.test.ts の「K881-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/ticket-guest-shares.test.ts", "utf8")).toContain("K881-API-008");
  });
  it("test_patch_tickets_id_guest_shares_conflict", () => {
    // UNWANTED: IF 見せる相手が 20 を超えるなら、Kaname は 409 と E-GST-041 を返し、見せる相手も証跡も変えない
    // 本物の試験：apps/api/test/features/F11/ticket-guest-shares.test.ts の「K881-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/ticket-guest-shares.test.ts", "utf8")).toContain("K881-API-010");
  });
  it("test_patch_tickets_id_guest_shares_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_patch_tickets_id_guest_shares_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F11/ticket-guest-shares.test.ts の「K881-API-023」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/ticket-guest-shares.test.ts", "utf8")).toContain("K881-API-023");
  });
  it("test_patch_tickets_id_guest_shares_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_tickets_id_guest_shares_mfa_pending");
  it("test_patch_tickets_id_guest_shares_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_tickets_id_guest_shares_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/tickets/:id/guest-shares の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/ticket-guest-shares.test.ts の「K881-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/ticket-guest-shares.test.ts", "utf8")).toContain("K881-API-004");
  });
});
