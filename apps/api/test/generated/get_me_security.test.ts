// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。GET /api/v1/me/security
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("GET /api/v1/me/security", () => {
  // EVENT-DRIVEN: WHEN GET /api/v1/me/security が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTPシークレットを暗号化保管」を行い 2xx を返す
  it.todo("test_get_me_security_ok");
  // EVENT-DRIVEN: WHEN GET /api/v1/me/security が「端末でパスキーを登録する／認証アプリを登録してバックアップコードを保管する」として呼ばれたとき THEN Kaname は「パスキーの公開鍵・TOTP の鍵を暗号化して保管」を行い 2xx を返す
  it.todo("test_get_me_security_ok_2");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_get_me_security_rejected_401");
  // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_me_security_rejected_403");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_me_security_rejected_422");
  // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_me_security_rate_limited");
  // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_get_me_security_terms_pending");
  // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
  it.todo("test_get_me_security_session_unresolved");
  // UBIQUITOUS: GET /api/v1/me/security の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_get_me_security_shape");
});
