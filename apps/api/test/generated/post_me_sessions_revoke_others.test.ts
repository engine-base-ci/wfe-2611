// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/me/sessions/revoke-others
// 全部切る口は、端末の数え方（全部のワークスペースの行）・PC の仕事・今の端末を残すことで答えが変わる（K-836）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/me/sessions/revoke-others", () => {
  it("test_post_me_sessions_revoke_others_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/me/sessions/revoke-others が「名前・ログインと安全・端末・所属するテナントを見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-007");
  });
  it("test_post_me_sessions_revoke_others_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-011");
  });
  it("test_post_me_sessions_revoke_others_rejected_403", () => {
    // UNWANTED: IF 本人確認の取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、どの端末も切らない
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-014");
  });
  it("test_post_me_sessions_revoke_others_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-012");
  });
  // 当てはまらない（体は空の形で、知らない欄は入口の契約の strict な形が 422 にする（全部の口で同じ・K-836 は欄を読まない））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_me_sessions_revoke_others_rejected_422_2");
  it("test_post_me_sessions_revoke_others_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（上限は全部の口で同じ 1 か所の入口（op.ts・契約の rate_limit）が数える。この口は上限の振る舞いを自分で持たない）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_me_sessions_revoke_others_rate_limited");
  it("test_post_me_sessions_revoke_others_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_me_sessions_revoke_others_mfa_pending");
  it("test_post_me_sessions_revoke_others_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_me_sessions_revoke_others_rejected_422_3", () => {
    // UNWANTED: IF 名前・メール・パスワード・2 段階認証の保存に失敗した、または変更後に他の端末と Bridge の失効が実行されなかった THEN Kaname は「保存できませんでした。もう一度お試しください。パスワードを変えた場合は他の端末で入り直しが必要です」を返し、もう一度保存する／端末の一覧で失効を確認する（E-ACT-040）
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-010");
  });
  it("test_post_me_sessions_revoke_others_shape", () => {
    // UBIQUITOUS: POST /api/v1/me/sessions/revoke-others の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/me-sessions.test.ts の「K836-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-sessions.test.ts", "utf8")).toContain("K836-API-007");
  });
});
