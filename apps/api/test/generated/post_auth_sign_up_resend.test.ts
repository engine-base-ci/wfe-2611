// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/auth/sign-up/resend
// 登録は、申し込みの印・漏れたパスワードの照合（関門 C1）・確認のメール（関門 C6）を本物の DB と差し込んだ送出先で確かめる。生成の試験の偽のセッションと土台では確かめられない（K-51）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/auth/sign-up/resend", () => {
  it("test_post_auth_sign_up_resend_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/auth/sign-up/resend が「名前・メール・パスワード・会社名（空でもよい）を入れる」として呼ばれたとき THEN Kaname は「テナント（会社／個人）と本人を作る。保留の申し込みを暗号化して 30 分」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/sign-up.test.ts の「K51-API-009 送り直す（期限内・印で）」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/sign-up.test.ts", "utf8")).toContain("K51-API-009 送り直す（期限内・印で）");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F1/sign-up.test.ts）：UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
  it.todo("test_post_auth_sign_up_resend_rejected_422");
  it("test_post_auth_sign_up_resend_rejected_422_2", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F1/sign-up.test.ts の「K51-API-030 送り直しをメールで頼む」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/sign-up.test.ts", "utf8")).toContain("K51-API-030 送り直しをメールで頼む");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F1/sign-up.test.ts）：UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_auth_sign_up_resend_rate_limited");
  // 本物の試験はまだ無い（apps/api/test/features/F1/sign-up.test.ts）：UBIQUITOUS: POST /api/v1/auth/sign-up/resend の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_post_auth_sign_up_resend_shape");
});
