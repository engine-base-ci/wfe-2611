// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/approvals/:id/approve
// 承認と完了は、本物の DB の関数（app.approval_decide・app.ticket_complete）と本物の PC の印（K-57）と差し込んだ受け箱（関門 C6）で確かめる。生成の試験の偽のセッションと土台では確かめられない（K-63 の孫 K-161〜K-166・行は孫ごとのファイル）。同意し直し（terms_pending）は K-53 の共通の前処理が全部の口に効き、K-63 の行は無い（it.todo のまま）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/approvals/:id/approve", () => {
  it("test_post_approvals_id_approve_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/approvals/:id/approve が「承認カードで中身と検査の結果を見て押す」として呼ばれたとき THEN Kaname は「承認を記録（本人確認は取り直さない・D-128.177）。PC が閉じていれば実行待ち、24 時間を過ぎたら聞き直す」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F5/approve-complete-approve.test.ts の「K63-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-approve.test.ts", "utf8")).toContain("K63-API-002");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-approve.test.ts）：UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_post_approvals_id_approve_rejected_401");
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-approve.test.ts）：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_post_approvals_id_approve_rejected_403");
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-approve.test.ts）：UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
  it.todo("test_post_approvals_id_approve_not_found");
  it("test_post_approvals_id_approve_conflict", () => {
    // UNWANTED: IF もう処理された承認がもう一度来たら、Kaname は 409 と E-CONF-003 を返し、実行の仕事を積まない
    // 本物の試験：apps/api/test/features/F5/approve-complete-approve.test.ts の「K63-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-approve.test.ts", "utf8")).toContain("K63-API-016");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-approve.test.ts）：UNWANTED: IF 本文に知らない欄があるなら、Kaname は 422 と項目ごとの理由を返し、何も書かない
  it.todo("test_post_approvals_id_approve_rejected_422");
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-approve.test.ts）：UNWANTED: IF 承認の id が uuid でないなら、Kaname は 422 と欄 id を返し、何も書かない
  it.todo("test_post_approvals_id_approve_rejected_422_2");
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-approve.test.ts）：UNWANTED: IF 守りの判定ができなかったなら、Kaname は 503 を返し、止める側に倒して何も書かない（守りの判定の例外）
  it.todo("test_post_approvals_id_approve_unavailable");
  it("test_post_approvals_id_approve_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-approve.test.ts）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_approvals_id_approve_rate_limited");
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-approve.test.ts）：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_approvals_id_approve_terms_pending");
  it("test_post_approvals_id_approve_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-approve.test.ts）：UBIQUITOUS: POST /api/v1/approvals/:id/approve の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_post_approvals_id_approve_shape");
});
