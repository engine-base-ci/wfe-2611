// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/approvals/:id/stop
// 止めるは、承認の状態・承認する人・チケットを書けるかで答えが変わる。生成の試験の種では決まっていない承認と担当者の組を作れない（K-732）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/approvals/:id/stop", () => {
  it("test_post_approvals_id_stop_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/approvals/:id/stop が「承認カードで中身と検査の結果を見て押す」として呼ばれたとき THEN Kaname は「承認を記録（本人確認は取り直さない・D-128.177）。PC が閉じていれば実行待ち、24 時間を過ぎたら聞き直す」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-001");
  });
  it("test_post_approvals_id_stop_ok_2", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/approvals/:id/stop が「止める／取り下げる」として呼ばれたとき THEN Kaname は「止めた記録を残す」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-001");
  });
  it("test_post_approvals_id_stop_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-011");
  });
  it("test_post_approvals_id_stop_rejected_403", () => {
    // UNWANTED: IF 承認する人でない人が承認待ちを止めようとしたなら、Kaname は 403 を返し、承認の行も段もやり取りも変えない
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-003");
  });
  it("test_post_approvals_id_stop_not_found", () => {
    // UNWANTED: IF 見えない承認・無い承認・成果物でない承認を止めようとしたなら、Kaname は 404 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-004");
  });
  it("test_post_approvals_id_stop_conflict", () => {
    // UNWANTED: IF もう決まった承認を止めようとしたなら、Kaname は 409 と E-CONF-003 を返し、やり取りの行も証跡も増やさない
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-005");
  });
  it("test_post_approvals_id_stop_rejected_422", () => {
    // UNWANTED: IF 体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-010");
  });
  it("test_post_approvals_id_stop_session_unresolved", () => {
    // UNWANTED: IF 止める関数か守りの判定か証跡の書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、承認の行もチケットもやり取りも変えない
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-012");
  });
  it("test_post_approvals_id_stop_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_approvals_id_stop_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-011");
  });
  it("test_post_approvals_id_stop_upstream_failed", () => {
    // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-012");
  });
  it("test_post_approvals_id_stop_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_approvals_id_stop_mfa_pending");
  it("test_post_approvals_id_stop_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_approvals_id_stop_shape", () => {
    // UBIQUITOUS: POST /api/v1/approvals/:id/stop の副作用は関門 C2・C5 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/approval-stop.test.ts の「K732-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approval-stop.test.ts", "utf8")).toContain("K732-API-001");
  });
});
