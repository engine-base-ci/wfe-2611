// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/bridge/claim
// K-57 の口は本物の PC の印の解決と本物の振る舞い（hooks）・接続コードの期限と 1 回だけ・配布物の置き場が要る。生成の試験の土台（偽のセッション・表の種の入力）では確かめられない（K-57）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/bridge/claim", () => {
  it("test_post_bridge_claim_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/bridge/claim が「Bridge を入れてつなぐ」として呼ばれたとき THEN Kaname は「Bridge と本人を結ぶ。つながったら自分の AI が話せる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-003");
  });
  it("test_post_bridge_claim_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-036」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-036");
  });
  it("test_post_bridge_claim_rejected_422_2", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-028」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-028");
  });
  it("test_post_bridge_claim_rate_limited", () => {
    // UNWANTED: IF 5/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-038」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-038");
  });
  it("test_post_bridge_claim_upstream_failed", () => {
    // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-033」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-033");
  });
  it("test_post_bridge_claim_shape", () => {
    // UBIQUITOUS: POST /api/v1/bridge/claim の副作用は関門 C1・C2・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-003");
  });
});
