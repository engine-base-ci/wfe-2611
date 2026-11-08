// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。POST /api/v1/conversations/:id/permissions/:pid
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("POST /api/v1/conversations/:id/permissions/:pid", () => {
  // EVENT-DRIVEN: WHEN POST /api/v1/conversations/:id/permissions/:pid が「許可に答える・許可のモードを選ぶ」として呼ばれたとき THEN Kaname は「答えは bridge_job_events と証跡に。「いつも」は permission_rules に。全部許可は本人が選んだときだけ・既定にしない」を行い 2xx を返す（自動側：Claude Code の許可の問いを会話に出す（今回だけ／いつも／しない＋一言）。モードは Claude Code の公式の選択肢をそのまま渡す）
  it.todo("test_post_conversations_id_permissions_pid_ok");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_post_conversations_id_permissions_pid_rejected_401");
  // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_post_conversations_id_permissions_pid_rejected_403");
  // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
  it.todo("test_post_conversations_id_permissions_pid_not_found");
  // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
  it.todo("test_post_conversations_id_permissions_pid_rejected_422");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_conversations_id_permissions_pid_rejected_422_2");
  // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_conversations_id_permissions_pid_rate_limited");
  // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_conversations_id_permissions_pid_upstream_failed");
  // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_conversations_id_permissions_pid_terms_pending");
  // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
  it.todo("test_post_conversations_id_permissions_pid_session_unresolved");
  // UBIQUITOUS: POST /api/v1/conversations/:id/permissions/:pid の副作用は関門 C2・C5 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_post_conversations_id_permissions_pid_shape");
});
