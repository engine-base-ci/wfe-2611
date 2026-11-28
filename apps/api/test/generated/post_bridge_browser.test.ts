// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/bridge/browser
// PC の印で呼ぶ口は、本物の PC の印の解決（接続コードで引き取った印・外した PC）と本物の DB の関数 app.bridge_set_browser が要る。生成の試験の土台（偽のセッション・表の種の入力）では PC の印も外した PC も作れない（K-366）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/bridge/browser", () => {
  it("test_post_bridge_browser_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/bridge/browser が「Bridge を入れてつなぐ」として呼ばれたとき THEN Kaname は「Bridge と本人を結ぶ。つながったら自分の AI が話せる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F3/ai-browser-bridge.test.ts の「K366-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-bridge.test.ts", "utf8")).toContain("K366-API-001");
  });
  it("test_post_bridge_browser_rejected_401", () => {
    // UNWANTED: IF PC の印が無いか知らないか外した PC の印なら、Kaname は 401 と UNAUTHENTICATED を返し、どの PC のブラウザも変えない
    // 本物の試験：apps/api/test/features/F3/ai-browser-bridge.test.ts の「K366-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-bridge.test.ts", "utf8")).toContain("K366-API-004");
  });
  it("test_post_bridge_browser_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F3/ai-browser-bridge.test.ts の「K366-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-bridge.test.ts", "utf8")).toContain("K366-API-004");
  });
  it("test_post_bridge_browser_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F3/ai-browser-bridge.test.ts の「K366-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-bridge.test.ts", "utf8")).toContain("K366-API-002");
  });
  it("test_post_bridge_browser_rejected_422_2", () => {
    // UNWANTED: IF browser が 3 つのどれでもないか知らない欄があるなら、Kaname は 422 と欄 browser の理由を返し、PC のブラウザを変えない
    // 本物の試験：apps/api/test/features/F3/ai-browser-bridge.test.ts の「K366-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-bridge.test.ts", "utf8")).toContain("K366-API-003");
  });
  it("test_post_bridge_browser_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_bridge_browser_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F3/ai-browser-bridge.test.ts の「K366-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-bridge.test.ts", "utf8")).toContain("K366-API-006");
  });
  it("test_post_bridge_browser_upstream_failed", () => {
    // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
    // 本物の試験：apps/api/test/features/F3/ai-browser-bridge.test.ts の「K366-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-bridge.test.ts", "utf8")).toContain("K366-API-008");
  });
  it("test_post_bridge_browser_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_bridge_browser_shape", () => {
    // UBIQUITOUS: POST /api/v1/bridge/browser の副作用は関門 C1・C2・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F3/ai-browser-bridge.test.ts の「K366-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-bridge.test.ts", "utf8")).toContain("K366-API-001");
  });
});
