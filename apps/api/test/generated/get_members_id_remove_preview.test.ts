// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。GET /api/v1/members/:id/remove-preview
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("GET /api/v1/members/:id/remove-preview", () => {
  // EVENT-DRIVEN: WHEN GET /api/v1/members/:id/remove-preview が「担当中のチケットと承認を引き継いでから抜けさせる」として呼ばれたとき THEN Kaname は「セッションを失効」を行い 2xx を返す
  it.todo("test_get_members_id_remove_preview_ok");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_get_members_id_remove_preview_rejected_401");
  // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_members_id_remove_preview_rejected_403");
  // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
  it.todo("test_get_members_id_remove_preview_not_found");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_members_id_remove_preview_rejected_422");
  // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_members_id_remove_preview_rate_limited");
  // UNWANTED: IF 抜ける人の依存（タスク・承認待ち・AI社員・層の長）に自分のAIが引き継ぎ先の案を出せない、または引き継ぎ先が未決のまま「無効にする」を押した THEN Kaname は「引き継ぎ先が決まっていないものがあります。決めるまで無効にできません」を返し、自分のAIの案を全部採る／1 件ずつ決める（E-ACT-035）
  it.todo("test_get_members_id_remove_preview_rejected_422_2");
  // UBIQUITOUS: GET /api/v1/members/:id/remove-preview の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_get_members_id_remove_preview_shape");
});
