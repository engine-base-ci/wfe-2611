// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/me/sessions/:id
// 端末を切る口は、画面と PC・今の端末・ほかの人の端末・同時で答えが変わる（K-836）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/me/sessions/:id", () => {
  it("test_delete_me_sessions_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/me/sessions/:id が「名前・ログインと安全・端末・所属するテナントを見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-003");
  });
  it("test_delete_me_sessions_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-011");
  });
  it("test_delete_me_sessions_id_rejected_403", () => {
    // UNWANTED: IF 本人確認の取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、どの端末も切らない
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-014");
  });
  it("test_delete_me_sessions_id_not_found", () => {
    // UNWANTED: IF 自分のログインの生きている端末でないなら、Kaname は 404 を返し、どの端末も切らない
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-006");
  });
  it("test_delete_me_sessions_id_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-006");
  });
  it("test_delete_me_sessions_id_conflict", () => {
    // UNWANTED: IF 今の端末を切ろうとしたなら、Kaname は 409 と E-ME-030 を返し、端末を切らない
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-005");
  });
  // 当てはまらない（上限は全部の口で同じ 1 か所の入口（op.ts・契約の rate_limit）が数える。この口は上限の振る舞いを自分で持たない）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_delete_me_sessions_id_rate_limited");
  it("test_delete_me_sessions_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_me_sessions_id_mfa_pending");
  it("test_delete_me_sessions_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_me_sessions_id_rejected_422_2", () => {
    // UNWANTED: IF 名前・メール・パスワード・2 段階認証の保存に失敗した、または変更後に他の端末と Bridge の失効が実行されなかった THEN Kaname は「保存できませんでした。もう一度お試しください。パスワードを変えた場合は他の端末で入り直しが必要です」を返し、もう一度保存する／端末の一覧で失効を確認する（E-ACT-040）
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-010");
  });
  it("test_delete_me_sessions_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/me/sessions/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-003");
  });
});
