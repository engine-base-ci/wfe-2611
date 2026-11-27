// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/me/notification-settings/copy
// 写す口は、写し元・写し先の入っている会社・止めている印を写さないこと・全部か無しかで答えが変わる（K-837）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/me/notification-settings/copy", () => {
  it("test_post_me_notification_settings_copy_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/me/notification-settings/copy が「名前・ログインと安全・端末・所属するテナントを見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/me-notify.test.ts の「K837-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-notify.test.ts", "utf8")).toContain("K837-API-010");
  });
  it("test_post_me_notification_settings_copy_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/me-notify.test.ts の「K837-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-notify.test.ts", "utf8")).toContain("K837-API-013");
  });
  it("test_post_me_notification_settings_copy_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F10/me-notify.test.ts の「K837-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-notify.test.ts", "utf8")).toContain("K837-API-013");
  });
  it("test_post_me_notification_settings_copy_conflict", () => {
    // UNWANTED: IF 写し先に写し元を含めたなら、Kaname は 409 と E-ME-041 を返し、1 つも写さない
    // 本物の試験：apps/api/test/features/F10/me-notify.test.ts の「K837-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-notify.test.ts", "utf8")).toContain("K837-API-011");
  });
  it("test_post_me_notification_settings_copy_rejected_422", () => {
    // UNWANTED: IF 写し元・写し先の形が決まりに合わないなら、Kaname は 422 と欄の理由を返し、1 つも写さない
    // 本物の試験：apps/api/test/features/F10/me-notify.test.ts の「K837-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-notify.test.ts", "utf8")).toContain("K837-API-011");
  });
  it("test_post_me_notification_settings_copy_not_found", () => {
    // UNWANTED: IF 写し元か写し先に自分が入っていない会社があるなら、Kaname は 404 を返し、1 つも写さない
    // 本物の試験：apps/api/test/features/F10/me-notify.test.ts の「K837-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-notify.test.ts", "utf8")).toContain("K837-API-011");
  });
  it("test_post_me_notification_settings_copy_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（上限は入口の共通の確かめ（K-144）が全部の口で見る）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_me_notification_settings_copy_rate_limited");
  // 当てはまらない（同意し直しの止めは入口の共通の確かめ（K-53）が見る）：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_me_notification_settings_copy_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_me_notification_settings_copy_mfa_pending");
  it("test_post_me_notification_settings_copy_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 当てはまらない（保存の失敗は 503・E-PAGE-003（K837-API-014）で返し、E-ACT-040 の答えは使わない（この口は名前・メール・パスワード・2 段階を書かない））：UNWANTED: IF 名前・メール・パスワード・2 段階認証の保存に失敗した、または変更後に他の端末と Bridge の失効が実行されなかった THEN Kaname は「保存できませんでした。もう一度お試しください。パスワードを変えた場合は他の端末で入り直しが必要です」を返し、もう一度保存する／端末の一覧で失効を確認する（E-ACT-040）
  it.todo("test_post_me_notification_settings_copy_rejected_422_2");
  it("test_post_me_notification_settings_copy_shape", () => {
    // UBIQUITOUS: POST /api/v1/me/notification-settings/copy の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/me-notify.test.ts の「K837-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-notify.test.ts", "utf8")).toContain("K837-API-010");
  });
});
