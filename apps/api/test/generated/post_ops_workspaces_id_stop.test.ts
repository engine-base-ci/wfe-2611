// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/ops/workspaces/:id/stop
// 今の止める印・止める日・本人確認の取り直しで答えが変わり、管理者へお知らせと運営の記録を書く。種では作れない（K-970）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/ops/workspaces/:id/stop", () => {
  it("test_post_ops_workspaces_id_stop_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/ops/workspaces/:id/stop が「理由を書いて止める／再開する」として呼ばれたとき THEN Kaname は「止めている間はその会社の人がログインできない」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-stop.test.ts の「K970-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-stop.test.ts", "utf8")).toContain("K970-API-001");
  });
  it("test_post_ops_workspaces_id_stop_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-stop.test.ts の「K970-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-stop.test.ts", "utf8")).toContain("K970-API-012");
  });
  it("test_post_ops_workspaces_id_stop_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-stop.test.ts の「K970-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-stop.test.ts", "utf8")).toContain("K970-API-012");
  });
  it("test_post_ops_workspaces_id_stop_not_found", () => {
    // UNWANTED: IF 指した会社が無いか運営の会社なら、Kaname は 404 と NOT_FOUND を返し、止める印を書かない
    // 本物の試験：apps/api/test/features/F12/ops-stop.test.ts の「K970-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-stop.test.ts", "utf8")).toContain("K970-API-012");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F12/ops-stop.test.ts）：UNWANTED: IF もう止めているか止める日が決まっている会社に日を決め直したら、Kaname は 409 と E-OPS-003 を返し、止める日を変えない
  it.todo("test_post_ops_workspaces_id_stop_conflict");
  it("test_post_ops_workspaces_id_stop_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F12/ops-stop.test.ts の「K970-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-stop.test.ts", "utf8")).toContain("K970-API-008");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F12/ops-stop.test.ts）：UNWANTED: IF 止める日が今日以前なら、Kaname は 409 と E-OPS-006 を返し、止める印を書かない
  it.todo("test_post_ops_workspaces_id_stop_conflict_2");
  it("test_post_ops_workspaces_id_stop_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_ops_workspaces_id_stop_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-stop.test.ts の「K970-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-stop.test.ts", "utf8")).toContain("K970-API-017");
  });
  it("test_post_ops_workspaces_id_stop_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_ops_workspaces_id_stop_mfa_pending");
  it("test_post_ops_workspaces_id_stop_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ops_workspaces_id_stop_shape", () => {
    // UBIQUITOUS: POST /api/v1/ops/workspaces/:id/stop の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-stop.test.ts の「K970-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-stop.test.ts", "utf8")).toContain("K970-API-001");
  });
});
