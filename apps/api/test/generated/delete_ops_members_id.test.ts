// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/ops/members/:id
// 外すとパスキー・セッション・担当まで変わる。種では作れない（K-1009）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/ops/members/:id", () => {
  it("test_delete_ops_members_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/ops/members/:id が「運営の人ごとに 問い合わせ・中を見る・お金・止める・お知らせ・配るもの・値段の案・値段を決める・運営の人 を付ける」として呼ばれたとき THEN Kaname は「運営の人はパスキーでしか入れない」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-team-edit.test.ts の「K1009-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team-edit.test.ts", "utf8")).toContain("K1009-API-005");
  });
  it("test_delete_ops_members_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-team-edit.test.ts の「K1009-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team-edit.test.ts", "utf8")).toContain("K1009-API-009");
  });
  it("test_delete_ops_members_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-team-edit.test.ts の「K1009-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team-edit.test.ts", "utf8")).toContain("K1009-API-009");
  });
  it("test_delete_ops_members_id_not_found", () => {
    // UNWANTED: IF 運営の人が無いか外してあるなら、Kaname は 404 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F12/ops-team-edit.test.ts の「K1009-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team-edit.test.ts", "utf8")).toContain("K1009-API-008");
  });
  // 当てはまらない（体を受けない（道の id の形は K1009-API-010 が受ける））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_delete_ops_members_id_rejected_422");
  it("test_delete_ops_members_id_conflict", () => {
    // UNWANTED: IF 自分を外そうとしたなら、Kaname は 409 と E-OPS-017 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F12/ops-team-edit.test.ts の「K1009-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team-edit.test.ts", "utf8")).toContain("K1009-API-006");
  });
  it("test_delete_ops_members_id_conflict_2", () => {
    // UNWANTED: IF 外すと「運営の人」か「値段を決める」を持つ人が居なくなるなら、Kaname は 409 と E-OPS-018 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F12/ops-team-edit.test.ts の「K1009-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team-edit.test.ts", "utf8")).toContain("K1009-API-007");
  });
  it("test_delete_ops_members_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-team-edit.test.ts の「K1009-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team-edit.test.ts", "utf8")).toContain("K1009-API-013");
  });
  // 当てはまらない（運営の人は顧客の規約の同意を持たない（K-944））：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_delete_ops_members_id_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_ops_members_id_mfa_pending");
  it("test_delete_ops_members_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_ops_members_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/ops/members/:id の副作用は関門 C2・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-team-edit.test.ts の「K1009-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team-edit.test.ts", "utf8")).toContain("K1009-API-005");
  });
});
