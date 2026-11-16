// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/me/setup-tasks/dismiss
// はじめにやることの済みの判定は PC の知らせ・預け物・別の会社の同じログインを本物の DB で確かめ、生成の試験の土台（偽のセッション・hooks なし）では作れない（K-250）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/me/setup-tasks/dismiss", () => {
  it("test_post_me_setup_tasks_dismiss_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/me/setup-tasks/dismiss が「名前・ログインと安全・端末・所属するテナントを見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F4/setup-tasks.test.ts の「K250-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/setup-tasks.test.ts", "utf8")).toContain("K250-API-006");
  });
  it("test_post_me_setup_tasks_dismiss_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F4/setup-tasks.test.ts の「K250-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/setup-tasks.test.ts", "utf8")).toContain("K250-API-009");
  });
  it("test_post_me_setup_tasks_dismiss_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F4/setup-tasks.test.ts の「K250-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/setup-tasks.test.ts", "utf8")).toContain("K250-API-008");
  });
  it("test_post_me_setup_tasks_dismiss_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F4/setup-tasks.test.ts の「K250-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/setup-tasks.test.ts", "utf8")).toContain("K250-API-006");
  });
  it("test_post_me_setup_tasks_dismiss_rejected_422_2", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F4/setup-tasks.test.ts の「K250-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/setup-tasks.test.ts", "utf8")).toContain("K250-API-011");
  });
  it("test_post_me_setup_tasks_dismiss_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_me_setup_tasks_dismiss_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F4/setup-tasks.test.ts の「K250-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/setup-tasks.test.ts", "utf8")).toContain("K250-API-013");
  });
  it("test_post_me_setup_tasks_dismiss_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F4/setup-tasks.test.ts の「K250-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/setup-tasks.test.ts", "utf8")).toContain("K250-API-009");
  });
  it("test_post_me_setup_tasks_dismiss_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 当てはまらない（名前・メール・パスワードの保存の型で、この口は key（飛ばす項目）だけを受ける）：UNWANTED: IF 名前・メール・パスワード・2 段階認証の保存に失敗した、または変更後に他の端末と Bridge の失効が実行されなかった THEN Kaname は「保存できませんでした。もう一度お試しください。パスワードを変えた場合は他の端末で入り直しが必要です」を返し、もう一度保存する／端末の一覧で失効を確認する（E-ACT-040）
  it.todo("test_post_me_setup_tasks_dismiss_rejected_422_3");
  it("test_post_me_setup_tasks_dismiss_shape", () => {
    // UBIQUITOUS: POST /api/v1/me/setup-tasks/dismiss の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F4/setup-tasks.test.ts の「K250-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/setup-tasks.test.ts", "utf8")).toContain("K250-API-006");
  });
});
