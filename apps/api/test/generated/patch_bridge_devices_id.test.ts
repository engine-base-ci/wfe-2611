// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/bridge/devices/:id
// PC はアカウントのもので、持ち主は口と DB の関数の 2 重で確かめる（D-128.166）。生成の試験の種では PC の引き取り（接続コード）・別のワークスペースの自分・他の人の PC を作れない（K-364）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/bridge/devices/:id", () => {
  it("test_patch_bridge_devices_id_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/bridge/devices/:id が「Bridge を入れてつなぐ」として呼ばれたとき THEN Kaname は「Bridge と本人を結ぶ。つながったら自分の AI が話せる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F3/ai-browser-pick.test.ts の「K364-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-pick.test.ts", "utf8")).toContain("K364-API-002");
  });
  it("test_patch_bridge_devices_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F3/ai-browser-pick.test.ts の「K364-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-pick.test.ts", "utf8")).toContain("K364-API-015");
  });
  it("test_patch_bridge_devices_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F3/ai-browser-pick.test.ts の「K364-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-pick.test.ts", "utf8")).toContain("K364-API-015");
  });
  it("test_patch_bridge_devices_id_not_found", () => {
    // UNWANTED: IF 自分のアカウントの PC でないなら、Kaname は 404 と NOT_FOUND を返し、どの PC のブラウザも変えない
    // 本物の試験：apps/api/test/features/F3/ai-browser-pick.test.ts の「K364-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-pick.test.ts", "utf8")).toContain("K364-API-008");
  });
  it("test_patch_bridge_devices_id_rejected_422", () => {
    // UNWANTED: IF browser が 3 つのどれでもないか知らない欄があるなら、Kaname は 422 と欄 browser の理由を返し、PC のブラウザを変えない
    // 本物の試験：apps/api/test/features/F3/ai-browser-pick.test.ts の「K364-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-pick.test.ts", "utf8")).toContain("K364-API-011");
  });
  it("test_patch_bridge_devices_id_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_patch_bridge_devices_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F3/ai-browser-pick.test.ts の「K364-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-pick.test.ts", "utf8")).toContain("K364-API-016");
  });
  it("test_patch_bridge_devices_id_upstream_failed", () => {
    // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
    // 本物の試験：apps/api/test/features/F3/ai-browser-pick.test.ts の「K364-API-022」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-pick.test.ts", "utf8")).toContain("K364-API-022");
  });
  it("test_patch_bridge_devices_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F3/ai-browser-pick.test.ts の「K364-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-pick.test.ts", "utf8")).toContain("K364-API-015");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_bridge_devices_id_mfa_pending");
  it("test_patch_bridge_devices_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_bridge_devices_id_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/bridge/devices/:id の副作用は関門 C1・C2・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F3/ai-browser-pick.test.ts の「K364-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-pick.test.ts", "utf8")).toContain("K364-API-019");
  });
});
