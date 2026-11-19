// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/me/two-factor/confirm
// 2 段階を付ける口は、本物のログインの部品（Better Auth のセッション・2 段階の表・バックアップコード）と、認証アプリの 6 けた（鍵から作る）で確かめる。生成の試験の偽のセッションでは部品のセッションも鍵も無い（K-311）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/me/two-factor/confirm", () => {
  it("test_post_me_two_factor_confirm_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/me/two-factor/confirm が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTPシークレットを暗号化保管」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-002");
  });
  it("test_post_me_two_factor_confirm_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-019");
  });
  // 当てはまらない（取り直しの要らない本人の口で、役を見ない）：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_post_me_two_factor_confirm_rejected_403");
  it("test_post_me_two_factor_confirm_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-007");
  });
  it("test_post_me_two_factor_confirm_rejected_422_2", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-008");
  });
  it("test_post_me_two_factor_confirm_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_me_two_factor_confirm_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-020");
  });
  it("test_post_me_two_factor_confirm_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  it("test_post_me_two_factor_confirm_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_me_two_factor_confirm_shape", () => {
    // UBIQUITOUS: POST /api/v1/me/two-factor/confirm の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/two-factor-enable.test.ts の「K311-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/two-factor-enable.test.ts", "utf8")).toContain("K311-API-002");
  });
});
