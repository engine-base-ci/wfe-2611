// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/me/email-change
// メールを変える頼みは、宛ての形・使われている宛て・頼みすぎ・メールの送れない・本人確認で答えが変わる。生成の試験の種では作れない（K-835）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/me/email-change", () => {
  it("test_post_me_email_change_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/me/email-change が「名前・ログインと安全・端末・所属するテナントを見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-001");
  });
  it("test_post_me_email_change_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-016");
  });
  it("test_post_me_email_change_rejected_403", () => {
    // UNWANTED: IF 取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、メールも待っている変更も作らない
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-002");
  });
  it("test_post_me_email_change_conflict", () => {
    // UNWANTED: IF 宛てが今のメールと同じか、ほかのアカウントが使っているなら、Kaname は 409 と E-ME-026／E-ME-021 を返し、メールも待っている変更も作らない
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-004");
  });
  it("test_post_me_email_change_rejected_422", () => {
    // UNWANTED: IF 宛てがメールの形でないなら、Kaname は 422 と E-ME-020（欄 email）を返し、メールも待っている変更も作らない
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-003");
  });
  it("test_post_me_email_change_rate_limited", () => {
    // UNWANTED: IF 直近 1 時間にもう 5 回頼んでいるなら、Kaname は 429 と E-ME-024 を返し、メールを送らない
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-007");
  });
  it("test_post_me_email_change_upstream_failed", () => {
    // UNWANTED: IF 確かめのメールを送れなかったなら、Kaname は 502 と E-ME-025 を返し、待っている変更を残さない
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-008");
  });
  it("test_post_me_email_change_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（口ごとの 1 分の上限（60/分）は入口の共通（op.ts の limits）で数え、入口の共通の試験が見る。この口の頼みすぎ（1 時間に 5 回・E-ME-024）は K835-API-007）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_me_email_change_rate_limited_2");
  it("test_post_me_email_change_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_me_email_change_mfa_pending");
  it("test_post_me_email_change_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_me_email_change_rejected_422_2", () => {
    // UNWANTED: IF 名前・メール・パスワード・2 段階認証の保存に失敗した、または変更後に他の端末と Bridge の失効が実行されなかった THEN Kaname は「保存できませんでした。もう一度お試しください。パスワードを変えた場合は他の端末で入り直しが必要です」を返し、もう一度保存する／端末の一覧で失効を確認する（E-ACT-040）
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-003");
  });
  it("test_post_me_email_change_shape", () => {
    // UBIQUITOUS: POST /api/v1/me/email-change の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-001");
  });
});
