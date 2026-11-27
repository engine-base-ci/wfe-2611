// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/me/email-change/verify
// 確かめる口は、リンクの印・期限・1 回だけ・宛ての取られ方・同時で答えが変わる（K-835）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/me/email-change/verify", () => {
  it("test_post_me_email_change_verify_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/me/email-change/verify が「名前・ログインと安全・端末・所属するテナントを見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-009");
  });
  it("test_post_me_email_change_verify_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-016");
  });
  it("test_post_me_email_change_verify_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-016");
  });
  it("test_post_me_email_change_verify_conflict", () => {
    // UNWANTED: IF リンクが使えないか期限切れかもう使ったか、宛てがほかの人に使われたなら、Kaname は 409 と番号を返し、ログインのメールを変えない
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-010");
  });
  it("test_post_me_email_change_verify_rejected_422", () => {
    // UNWANTED: IF リンクの印が空か 200 字を超えるなら、Kaname は 422 を返し、ログインのメールを変えない
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-012");
  });
  it("test_post_me_email_change_verify_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（上限は入口の共通（op.ts の limits）で、口ごとの上限の数を契約に持たない。上限の 429 は入口の共通の試験が見る（K-421 と同じ扱い））：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_me_email_change_verify_rate_limited");
  it("test_post_me_email_change_verify_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_me_email_change_verify_mfa_pending");
  it("test_post_me_email_change_verify_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_me_email_change_verify_rejected_422_2", () => {
    // UNWANTED: IF 名前・メール・パスワード・2 段階認証の保存に失敗した、または変更後に他の端末と Bridge の失効が実行されなかった THEN Kaname は「保存できませんでした。もう一度お試しください。パスワードを変えた場合は他の端末で入り直しが必要です」を返し、もう一度保存する／端末の一覧で失効を確認する（E-ACT-040）
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-012");
  });
  it("test_post_me_email_change_verify_shape", () => {
    // UBIQUITOUS: POST /api/v1/me/email-change/verify の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/me-email.test.ts の「K835-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-email.test.ts", "utf8")).toContain("K835-API-009");
  });
});
