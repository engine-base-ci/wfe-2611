// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。GET /api/v1/ops/invoices
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("GET /api/v1/ops/invoices", () => {
  // EVENT-DRIVEN: WHEN GET /api/v1/ops/invoices が「月ごとに全社の請求書をまとめて出し、入金を 1 件ずつ記録する。期限を過ぎたものは前の月の分も上に出す」として呼ばれたとき THEN Kaname は「記録すると顧客の請求書の画面も払われたになる」を行い 2xx を返す
  it.todo("test_get_ops_invoices_ok");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_get_ops_invoices_rejected_401");
  // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_ops_invoices_rejected_403");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_ops_invoices_rejected_422");
  // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_ops_invoices_rate_limited");
  // UBIQUITOUS: GET /api/v1/ops/invoices の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_get_ops_invoices_shape");
});
