// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/auth/step-up
// 本人確認の取り直しは、ログインの部品（Better Auth）の本物のセッションでパスワードを確かめる。偽のセッションでは確かめられない（K-19）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/auth/step-up", () => {
  it("test_post_auth_step_up_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/auth/step-up が「パスキーで入る／メールとパスワードと 6 桁で入る」として呼ばれたとき THEN Kaname は「セッション（操作が無ければ 12 時間・長くて 7 日）。5 回失敗で 15 分止める」を行い 2xx を返す
    // 本物の試験：apps/api/test/step_up.test.ts の「正しいパスワードで時刻が付き」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/step_up.test.ts", "utf8")).toContain("正しいパスワードで時刻が付き");
  });
  it("test_post_auth_step_up_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/step_up.test.ts の「パスワードが空なら 422・ログインしていなければ 401」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/step_up.test.ts", "utf8")).toContain("パスワードが空なら 422・ログインしていなければ 401");
  });
  // 本物の試験はまだ無い（apps/api/test/step_up.test.ts）：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_post_auth_step_up_rejected_403");
  // 本物の試験はまだ無い（apps/api/test/step_up.test.ts）：UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
  it.todo("test_post_auth_step_up_rejected_422");
  it("test_post_auth_step_up_rejected_422_2", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/step_up.test.ts の「パスワードが空なら 422」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/step_up.test.ts", "utf8")).toContain("パスワードが空なら 422");
  });
  // 本物の試験はまだ無い（apps/api/test/step_up.test.ts）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_auth_step_up_rate_limited");
  it("test_post_auth_step_up_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/step_up.test.ts の「K53-API-005（stepUp の分）」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/step_up.test.ts", "utf8")).toContain("K53-API-005（stepUp の分）");
  });
  it("test_post_auth_step_up_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 本物の試験はまだ無い（apps/api/test/step_up.test.ts）：UBIQUITOUS: POST /api/v1/auth/step-up の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_post_auth_step_up_shape");
});
