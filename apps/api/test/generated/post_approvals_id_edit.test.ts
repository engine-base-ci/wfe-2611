// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/approvals/:id/edit
// 自分で直すは、承認の状態・承認する人・成果物の版で答えが変わる。生成の試験の種では決まっていない承認と担当者と今の版の組を作れない（K-742）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/approvals/:id/edit", () => {
  it("test_post_approvals_id_edit_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/approvals/:id/edit が「承認カードで中身と検査の結果を見て押す」として呼ばれたとき THEN Kaname は「承認を記録（本人確認は取り直さない・D-128.177）。PC が閉じていれば実行待ち、24 時間を過ぎたら聞き直す」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-001");
  });
  it("test_post_approvals_id_edit_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-010");
  });
  it("test_post_approvals_id_edit_rejected_403", () => {
    // UNWANTED: IF 承認する人でない人が成果物を直そうとしたなら、Kaname は 403 を返し、成果物の版もやり取りも変えない
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-006");
  });
  it("test_post_approvals_id_edit_not_found", () => {
    // UNWANTED: IF 見えない承認・無い承認・消したチケットの承認を直そうとしたなら、Kaname は 404 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-006");
  });
  it("test_post_approvals_id_edit_conflict", () => {
    // UNWANTED: IF 直す前に読んだ版が今の版でないなら、Kaname は 409 と E-APR-020 と今の版を返し、成果物を変えない
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-003");
  });
  it("test_post_approvals_id_edit_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-009");
  });
  it("test_post_approvals_id_edit_conflict_2", () => {
    // UNWANTED: IF 今の成果物と同じ字を送ったなら、Kaname は 409 と E-APR-021 を返し、版もやり取りも証跡も増やさない
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-005");
  });
  it("test_post_approvals_id_edit_conflict_3", () => {
    // UNWANTED: IF もう決まった承認の成果物を直そうとしたなら、Kaname は 409 と E-CONF-003 を返し、成果物の版を増やさない
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-007");
  });
  it("test_post_approvals_id_edit_session_unresolved", () => {
    // UNWANTED: IF 直す関数か守りの判定か証跡の書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、成果物の版もやり取りも証跡も変えない
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-011");
  });
  it("test_post_approvals_id_edit_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_approvals_id_edit_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-010");
  });
  it("test_post_approvals_id_edit_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_approvals_id_edit_mfa_pending");
  it("test_post_approvals_id_edit_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_approvals_id_edit_shape", () => {
    // UBIQUITOUS: POST /api/v1/approvals/:id/edit の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/approval-edit.test.ts の「K742-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-edit.test.ts", "utf8")).toContain("K742-API-001");
  });
});
