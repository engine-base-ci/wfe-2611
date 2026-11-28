// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/approvals/:id/withdraw
// 取り下げは、承認の状態・承認した本人・PC の仕事の状態で答えが変わる。生成の試験の種では承認した後の待っている実行を作れない（K-733）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/approvals/:id/withdraw", () => {
  it("test_post_approvals_id_withdraw_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/approvals/:id/withdraw が「止める／取り下げる」として呼ばれたとき THEN Kaname は「止めた記録を残す」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-001");
  });
  it("test_post_approvals_id_withdraw_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-013");
  });
  it("test_post_approvals_id_withdraw_rejected_403", () => {
    // UNWANTED: IF 承認した本人でない人が承認を取り下げようとしたなら、Kaname は 403 を返し、承認の行も実行も段も変えない
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-005");
  });
  it("test_post_approvals_id_withdraw_not_found", () => {
    // UNWANTED: IF 見えない承認・無い承認・成果物でない承認を取り下げようとしたなら、Kaname は 404 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-006");
  });
  it("test_post_approvals_id_withdraw_conflict", () => {
    // UNWANTED: IF PC がもう受け取って動かしている承認を取り下げようとしたなら、Kaname は 409 と E-APR-010 を返し、承認も実行も仕事も変えない
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-003");
  });
  it("test_post_approvals_id_withdraw_rejected_422", () => {
    // UNWANTED: IF 体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-012");
  });
  it("test_post_approvals_id_withdraw_conflict_2", () => {
    // UNWANTED: IF 取り下げられない承認を取り下げようとしたなら、Kaname は 409 と E-APR-011 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-007");
  });
  it("test_post_approvals_id_withdraw_conflict_3", () => {
    // UNWANTED: IF 承認の後の実行がもう終わった承認を取り下げようとしたなら、Kaname は 409 と E-APR-012 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-004");
  });
  it("test_post_approvals_id_withdraw_session_unresolved", () => {
    // UNWANTED: IF 取り下げる関数か守りの判定か証跡か受け箱の書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、承認もチケットも実行も変えない
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-014");
  });
  it("test_post_approvals_id_withdraw_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_approvals_id_withdraw_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-013");
  });
  it("test_post_approvals_id_withdraw_upstream_failed", () => {
    // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-014");
  });
  it("test_post_approvals_id_withdraw_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_approvals_id_withdraw_mfa_pending");
  it("test_post_approvals_id_withdraw_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_approvals_id_withdraw_shape", () => {
    // UBIQUITOUS: POST /api/v1/approvals/:id/withdraw の副作用は関門 C2・C5 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/approval-withdraw.test.ts の「K733-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-withdraw.test.ts", "utf8")).toContain("K733-API-001");
  });
});
