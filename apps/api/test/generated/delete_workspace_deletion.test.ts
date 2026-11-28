// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/workspace/deletion
// 取り消しは、14 日の境・手続き中かどうか・押せる人で答えが変わる（K-830）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/workspace/deletion", () => {
  it("test_delete_workspace_deletion_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/workspace/deletion が「会社名・請求先・期限間近の日数・実行待ちの聞き直しの時間 など」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/workspace-deletion.test.ts の「K830-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/workspace-deletion.test.ts", "utf8")).toContain("K830-API-014");
  });
  it("test_delete_workspace_deletion_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/workspace-deletion.test.ts の「K830-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/workspace-deletion.test.ts", "utf8")).toContain("K830-API-018");
  });
  it("test_delete_workspace_deletion_rejected_403", () => {
    // UNWANTED: IF 消す権限の無い人が呼んだなら、Kaname は 403 を返し、手続きも記録も受け箱も変えない
    // 本物の試験：apps/api/test/features/F10/workspace-deletion.test.ts の「K830-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/workspace-deletion.test.ts", "utf8")).toContain("K830-API-018");
  });
  it("test_delete_workspace_deletion_rejected_403_2", () => {
    // UNWANTED: IF 取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、手続きを変えない
    // 本物の試験：apps/api/test/features/F10/workspace-deletion.test.ts の「K830-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/workspace-deletion.test.ts", "utf8")).toContain("K830-API-018");
  });
  it("test_delete_workspace_deletion_conflict", () => {
    // UNWANTED: IF 14 日を過ぎたか、手続き中でないなら、Kaname は 409 を返し、手続きも記録も変えない
    // 本物の試験：apps/api/test/features/F10/workspace-deletion.test.ts の「K830-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/workspace-deletion.test.ts", "utf8")).toContain("K830-API-016");
  });
  it("test_delete_workspace_deletion_session_unresolved", () => {
    // UNWANTED: IF 手続き・受け箱・記録を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も残さない
    // 本物の試験：apps/api/test/features/F10/workspace-deletion.test.ts の「K830-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/workspace-deletion.test.ts", "utf8")).toContain("K830-API-020");
  });
  // 当てはまらない（上限は入口の共通（op.ts の limits）で、口ごとの上限の数を契約に持たない。上限の 429 は入口の共通の試験が見る（K-419・K-421・K-829 の口と同じ扱い））：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_delete_workspace_deletion_rate_limited");
  it("test_delete_workspace_deletion_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_workspace_deletion_mfa_pending");
  it("test_delete_workspace_deletion_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_workspace_deletion_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/workspace/deletion の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/workspace-deletion.test.ts の「K830-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/workspace-deletion.test.ts", "utf8")).toContain("K830-API-014");
  });
});
