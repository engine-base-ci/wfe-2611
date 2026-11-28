// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/me/two-factor/enable
// 2 段階を付ける口は、本物のログインの部品（Better Auth のセッション・2 段階の表・バックアップコード）と、認証アプリの 6 けた（鍵から作る）で確かめる。生成の試験の偽のセッションでは部品のセッションも鍵も無い（K-311）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/me/two-factor/enable", () => {
  it("test_post_me_two_factor_enable_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/me/two-factor/enable が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTPシークレットを暗号化保管」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-001");
  });
  it("test_post_me_two_factor_enable_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-019");
  });
  it("test_post_me_two_factor_enable_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-010");
  });
  it("test_post_me_two_factor_enable_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-009");
  });
  // 当てはまらない（入力の欄は password 1 つで、2 つ目の 422 の型が無い）：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_me_two_factor_enable_rejected_422_2");
  it("test_post_me_two_factor_enable_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（回数は入口の共通の数え。同じ型の確かめは confirmTwoFactor の K311-API-020 が持つ）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_me_two_factor_enable_rate_limited");
  it("test_post_me_two_factor_enable_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  it("test_post_me_two_factor_enable_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_me_two_factor_enable_shape", () => {
    // UBIQUITOUS: POST /api/v1/me/two-factor/enable の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-001");
  });
});
