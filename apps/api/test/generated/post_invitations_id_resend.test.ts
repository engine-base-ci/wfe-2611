// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/invitations/:id/resend
// 送り直す口は、招待の状態（期限切れ・使われた・取り消した）・1 日 1 回の境・メールの成否・同時の組み合わせで答えが変わる。生成の試験の種では作れない（K-807）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/invitations/:id/resend", () => {
  it("test_post_invitations_id_resend_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/invitations/:id/resend が「メールと層と権限の束を選んで招く」として呼ばれたとき THEN Kaname は「招待（7 日）を送る」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/admin-invite-manage.test.ts の「K807-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-invite-manage.test.ts", "utf8")).toContain("K807-API-001");
  });
  it("test_post_invitations_id_resend_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/admin-invite-manage.test.ts の「K807-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-invite-manage.test.ts", "utf8")).toContain("K807-API-008");
  });
  it("test_post_invitations_id_resend_rejected_403", () => {
    // UNWANTED: IF 招く権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-invite-manage.test.ts の「K807-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-invite-manage.test.ts", "utf8")).toContain("K807-API-008");
  });
  it("test_post_invitations_id_resend_not_found", () => {
    // UNWANTED: IF 招待が無いか別の会社か消してあるなら、Kaname は 404 と E-INV-016 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-invite-manage.test.ts の「K807-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-invite-manage.test.ts", "utf8")).toContain("K807-API-005");
  });
  it("test_post_invitations_id_resend_conflict", () => {
    // UNWANTED: IF 招待がもう使われたか取り消してあるか今日もう送り直したなら、Kaname は 409 と E-INV-017／018／019 を返し、何も書かずメールも送らない
    // 本物の試験：apps/api/test/features/F10/admin-invite-manage.test.ts の「K807-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-invite-manage.test.ts", "utf8")).toContain("K807-API-004");
  });
  it("test_post_invitations_id_resend_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144.d/K-800.ts の「K144-API-1102」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-800.ts", "utf8")).toContain("K144-API-1102");
  });
  it("test_post_invitations_id_resend_session_unresolved", () => {
    // UNWANTED: IF 招待を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_invitations_id_resend_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_invitations_id_resend_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F10/admin-invite-manage.test.ts の「K807-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-invite-manage.test.ts", "utf8")).toContain("K807-API-008");
  });
  it("test_post_invitations_id_resend_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_invitations_id_resend_mfa_pending");
  it("test_post_invitations_id_resend_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_invitations_id_resend_shape", () => {
    // UBIQUITOUS: POST /api/v1/invitations/:id/resend の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/admin-invite-manage.test.ts の「K807-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-invite-manage.test.ts", "utf8")).toContain("K807-API-001");
  });
});
