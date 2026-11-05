// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。POST /api/v1/auth/password/reset
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("POST /api/v1/auth/password/reset", () => {
  // EVENT-DRIVEN: WHEN POST /api/v1/auth/password/reset が「メールを入れて届いたリンクから新しいパスワードを決める」として呼ばれたとき THEN Kaname は「全部のセッション（Bridge も）を失効」を行い 2xx を返す
  it.todo("test_post_auth_password_reset_ok");
  // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
  it.todo("test_post_auth_password_reset_rejected_422");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_auth_password_reset_rejected_422_2");
  // UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_auth_password_reset_rate_limited");
  // UBIQUITOUS: POST /api/v1/auth/password/reset の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_post_auth_password_reset_shape");
});
