// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/bridge/jobs/:id/control
// K-62 の PC の口は、本物の PC の印（引き取りで返った kpc_…）と、その仕事を受け取った PC（taken_session_id）・道具の鍵・チケットの区画を本物の DB で確かめる。生成の試験の土台（偽のセッション・表の種の入力）では確かめられない（K-62）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/bridge/jobs/:id/control", () => {
  it("test_get_bridge_jobs_id_control_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/bridge/jobs/:id/control が「「AI に任せる」を押す」として呼ばれたとき THEN Kaname は「チケットのセッションを開く・実行を記録する」を行い 2xx を返す（自動側：責任者の自分の AI が、選んだ業務の型とルールで成果物を作る。①機械の検査はサーバー、②AI の判定は別のセッションで 2 回）
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-015");
  });
  it("test_get_bridge_jobs_id_control_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-039」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-039");
  });
  it("test_get_bridge_jobs_id_control_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-062」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-062");
  });
  it("test_get_bridge_jobs_id_control_not_found", () => {
    // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-050」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-050");
  });
  it("test_get_bridge_jobs_id_control_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-032");
  });
  it("test_get_bridge_jobs_id_control_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-053」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-053");
  });
  // 当てはまらない（この口はサーバーの外を呼ばない（PC から届いた知らせを DB に書くだけ・D-097）。PC が完了信号を出さない・空を返すことの扱いは K62-API-011・K62-API-013・K62-BRG-003 が受ける）：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_get_bridge_jobs_id_control_upstream_failed");
  it("test_get_bridge_jobs_id_control_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_bridge_jobs_id_control_shape", () => {
    // UBIQUITOUS: GET /api/v1/bridge/jobs/:id/control の副作用は関門 C2・C3・C5 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/delegate-bridge.test.ts の「K62-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/delegate-bridge.test.ts", "utf8")).toContain("K62-API-015");
  });
});
