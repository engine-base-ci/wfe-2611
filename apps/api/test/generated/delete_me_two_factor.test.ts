// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。DELETE /api/v1/me/two-factor
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("DELETE /api/v1/me/two-factor", () => {
  // EVENT-DRIVEN: WHEN DELETE /api/v1/me/two-factor が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTPシークレットを暗号化保管」を行い 2xx を返す
  it.todo("test_delete_me_two_factor_ok");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_delete_me_two_factor_rejected_401");
  // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_delete_me_two_factor_rejected_403");
  // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_delete_me_two_factor_rate_limited");
  // UBIQUITOUS: DELETE /api/v1/me/two-factor の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_delete_me_two_factor_shape");
});
