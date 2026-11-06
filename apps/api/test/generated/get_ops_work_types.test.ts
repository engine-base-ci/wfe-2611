// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。GET /api/v1/ops/work_types
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("GET /api/v1/ops/work_types", () => {
  // EVENT-DRIVEN: WHEN GET /api/v1/ops/work_types が「汎用の操作と業務の型を上げる・版を出す。会社向けは対象（会社・層・個人）を選ぶ」として呼ばれたとき THEN Kaname は「運営の型は検査とテスト 5 場面を全部通す。記録した動かし方は値を消して全社で共有」を行い 2xx を返す
  it.todo("test_get_ops_work_types_ok");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_get_ops_work_types_rejected_401");
  // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_ops_work_types_rejected_403");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_ops_work_types_rejected_422");
  // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_ops_work_types_rate_limited");
  // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_get_ops_work_types_terms_pending");
  // UNWANTED: IF スキルの一式に資格情報・会社名・個人名が混ざっている、テストの場面が 1 つでも失敗している、または版のメモが空のまま「出す」を押した THEN Kaname は「この版は出せません。テストで失敗した場面があります（外部サービスの規約変更）。直して再テストしてください」を返し、失敗した場面を見る／直して「上げてテストで動かす」（E-ACT-041）
  it.todo("test_get_ops_work_types_rejected_422_2");
  // UBIQUITOUS: GET /api/v1/ops/work_types の副作用は関門 C2・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_get_ops_work_types_shape");
});
