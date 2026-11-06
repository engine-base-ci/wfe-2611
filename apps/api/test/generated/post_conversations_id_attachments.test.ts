// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。POST /api/v1/conversations/:id/attachments
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("POST /api/v1/conversations/:id/attachments", () => {
  // EVENT-DRIVEN: WHEN POST /api/v1/conversations/:id/attachments が「資料や画像を付けて渡す」として呼ばれたとき THEN Kaname は「attachments に 1 行、実体は会社の置き場（関門 C4）。messages.attachments は参照だけ」を行い 2xx を返す（自動側：Bridge が期限つきの署名 URL で受け取り、本人の PC の作業場所に置いて自分のAI に渡す（保存先の鍵は AI に見せない））
  it.todo("test_post_conversations_id_attachments_ok");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_post_conversations_id_attachments_rejected_401");
  // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_post_conversations_id_attachments_rejected_403");
  // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
  it.todo("test_post_conversations_id_attachments_not_found");
  // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
  it.todo("test_post_conversations_id_attachments_rejected_422");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_conversations_id_attachments_rejected_422_2");
  // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_conversations_id_attachments_rate_limited");
  // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_conversations_id_attachments_upstream_failed");
  // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_conversations_id_attachments_terms_pending");
  // UBIQUITOUS: POST /api/v1/conversations/:id/attachments の副作用は関門 C2・C4・C5 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_post_conversations_id_attachments_shape");
});
