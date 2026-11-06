// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。PATCH /api/v1/tickets/:id
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("PATCH /api/v1/tickets/:id", () => {
  // EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「責任者・期限・分類・親を決める」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：振り分けの案を出す）
  it.todo("test_patch_tickets_id_ok");
  // EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「印の付いたチケットを開いて手を打つ」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
  it.todo("test_patch_tickets_id_ok_2");
  // EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「理由と再開条件を書いて保留にする」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
  it.todo("test_patch_tickets_id_ok_3");
  // EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「作業の段を動かす」として呼ばれたとき THEN Kaname は「実績時間を記録」を行い 2xx を返す
  it.todo("test_patch_tickets_id_ok_4");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_patch_tickets_id_rejected_401");
  // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_patch_tickets_id_rejected_403");
  // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
  it.todo("test_patch_tickets_id_not_found");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_patch_tickets_id_rejected_422");
  // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_patch_tickets_id_rate_limited");
  // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_patch_tickets_id_terms_pending");
  // UBIQUITOUS: PATCH /api/v1/tickets/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_patch_tickets_id_shape");
});
