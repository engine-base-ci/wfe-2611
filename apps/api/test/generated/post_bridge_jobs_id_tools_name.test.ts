// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/bridge/jobs/:id/tools/:name
// K-62 の PC の口は、本物の PC の印（引き取りで返った kpc_…）と、その仕事を受け取った PC（taken_session_id）・道具の鍵・チケットの区画を本物の DB で確かめる。生成の試験の土台（偽のセッション・表の種の入力）では確かめられない（K-62）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/bridge/jobs/:id/tools/:name", () => {
  it("test_post_bridge_jobs_id_tools_name_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/bridge/jobs/:id/tools/:name が「「AI に任せる」を押す」として呼ばれたとき THEN Kaname は「チケットのセッションを開く・実行を記録する」を行い 2xx を返す（自動側：責任者の自分の AI が、選んだ業務の型とルールで成果物を作る。①機械の検査はサーバー、②AI の判定は別のセッションで 2 回）
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-009");
  });
  it("test_post_bridge_jobs_id_tools_name_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-018");
  });
  it("test_post_bridge_jobs_id_tools_name_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-036」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-036");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F5/delegate-bridge.test.ts）：UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
  it.todo("test_post_bridge_jobs_id_tools_name_not_found");
  // 本物の試験はまだ無い（apps/api/test/features/F5/delegate-bridge.test.ts）：UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
  it.todo("test_post_bridge_jobs_id_tools_name_rejected_422");
  it("test_post_bridge_jobs_id_tools_name_rejected_422_2", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-032");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F5/delegate-bridge.test.ts）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_bridge_jobs_id_tools_name_rate_limited");
  // 本物の試験はまだ無い（apps/api/test/features/F5/delegate-bridge.test.ts）：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_bridge_jobs_id_tools_name_upstream_failed");
  it("test_post_bridge_jobs_id_tools_name_shape", () => {
    // UBIQUITOUS: POST /api/v1/bridge/jobs/:id/tools/:name の副作用は関門 C2・C3・C5 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-009");
  });
});
