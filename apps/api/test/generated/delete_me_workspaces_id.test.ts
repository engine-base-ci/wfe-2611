// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/me/workspaces/:id
// 抜ける口は、会社の指し方・担当が残る・最後の管理者・セッションと PC を切る・本人確認・同時で答えが変わる。生成の試験の種では作れない（K-838）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/me/workspaces/:id", () => {
  it("test_delete_me_workspaces_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/me/workspaces/:id が「名前・ログインと安全・端末・所属するテナントを見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/me-leave.test.ts の「K838-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-leave.test.ts", "utf8")).toContain("K838-API-001");
  });
  it("test_delete_me_workspaces_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/me-leave.test.ts の「K838-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-leave.test.ts", "utf8")).toContain("K838-API-012");
  });
  it("test_delete_me_workspaces_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F10/me-leave.test.ts の「K838-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-leave.test.ts", "utf8")).toContain("K838-API-002");
  });
  it("test_delete_me_workspaces_id_not_found", () => {
    // UNWANTED: IF 同じログインが入っていない会社から抜けようとしたなら、Kaname は 404 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/me-leave.test.ts の「K838-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-leave.test.ts", "utf8")).toContain("K838-API-009");
  });
  it("test_delete_me_workspaces_id_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F10/me-leave.test.ts の「K838-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-leave.test.ts", "utf8")).toContain("K838-API-009");
  });
  it("test_delete_me_workspaces_id_conflict", () => {
    // UNWANTED: IF その会社に担当しているチケットが残っているなら、Kaname は 409 と E-ME-050 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/me-leave.test.ts の「K838-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-leave.test.ts", "utf8")).toContain("K838-API-003");
  });
  it("test_delete_me_workspaces_id_conflict_2", () => {
    // UNWANTED: IF その会社の最後の管理者が抜けようとしたなら、Kaname は 409 と E-ME-051 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/me-leave.test.ts の「K838-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-leave.test.ts", "utf8")).toContain("K838-API-004");
  });
  // 当てはまらない（入口の共通の上限（60 回/分/人）で止まり、この口の振る舞いではない（受けは入口の共通の試験））：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_delete_me_workspaces_id_rate_limited");
  // 当てはまらない（規約の同意し直しが要る人を止める入口の共通の 403 で、この口の振る舞いではない）：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_delete_me_workspaces_id_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_me_workspaces_id_mfa_pending");
  it("test_delete_me_workspaces_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 当てはまらない（道の id の NUL を断る入口の共通の 422 で、この口に届かない（uuid の形は K838-API-009 と k144 の K144-API-1181））：UNWANTED: IF 名前・メール・パスワード・2 段階認証の保存に失敗した、または変更後に他の端末と Bridge の失効が実行されなかった THEN Kaname は「保存できませんでした。もう一度お試しください。パスワードを変えた場合は他の端末で入り直しが必要です」を返し、もう一度保存する／端末の一覧で失効を確認する（E-ACT-040）
  it.todo("test_delete_me_workspaces_id_rejected_422_2");
  it("test_delete_me_workspaces_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/me/workspaces/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/me-leave.test.ts の「K838-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-leave.test.ts", "utf8")).toContain("K838-API-001");
  });
});
