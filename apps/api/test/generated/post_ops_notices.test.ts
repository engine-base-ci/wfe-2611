// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。POST /api/v1/ops/notices
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("POST /api/v1/ops/notices", () => {
  // EVENT-DRIVEN: WHEN POST /api/v1/ops/notices が「作って出す」として呼ばれたとき THEN Kaname は「対象に届ける」を行い 2xx を返す
  it.todo("test_post_ops_notices_ok");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_post_ops_notices_rejected_401");
  // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_post_ops_notices_rejected_403");
  // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
  it.todo("test_post_ops_notices_rejected_422");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_ops_notices_rejected_422_2");
  // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_ops_notices_rate_limited");
  // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_ops_notices_terms_pending");
  // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
  it.todo("test_post_ops_notices_session_unresolved");
  // UNWANTED: IF お知らせの公開で対象の会社が 0 件（プラン未選択・該当なし）、公開日時が過去、または全社通知の送出が一部失敗した THEN Kaname は「対象の会社がありません。プランか会社を選んでください」を返し、対象を選び直す／失敗した分を再送する（E-ACT-038）
  it.todo("test_post_ops_notices_rejected_422_3");
  // UBIQUITOUS: POST /api/v1/ops/notices の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_post_ops_notices_shape");
});
