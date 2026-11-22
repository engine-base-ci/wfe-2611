// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/bridge/devices/:id/browser-check
// PC はアカウントのもので、持ち主は口と DB の関数の 2 重で確かめる（D-128.166）。生成の試験の種では PC の引き取り（接続コード）・生きている知らせ・別のワークスペースの自分・他の人の PC を作れない（K-365）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/bridge/devices/:id/browser-check", () => {
  it("test_post_bridge_devices_id_browser_check_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/bridge/devices/:id/browser-check が「Bridge を入れてつなぐ」として呼ばれたとき THEN Kaname は「Bridge と本人を結ぶ。つながったら自分の AI が話せる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F3/ai-browser-check.test.ts の「K365-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-check.test.ts", "utf8")).toContain("K365-API-001");
  });
  it("test_post_bridge_devices_id_browser_check_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F3/ai-browser-check.test.ts の「K365-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-check.test.ts", "utf8")).toContain("K365-API-010");
  });
  it("test_post_bridge_devices_id_browser_check_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F3/ai-browser-check.test.ts の「K365-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-check.test.ts", "utf8")).toContain("K365-API-010");
  });
  it("test_post_bridge_devices_id_browser_check_not_found", () => {
    // UNWANTED: IF 自分のアカウントの PC でないなら、Kaname は 404 と NOT_FOUND を返し、確かめの仕事を積まない
    // 本物の試験：apps/api/test/features/F3/ai-browser-check.test.ts の「K365-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-check.test.ts", "utf8")).toContain("K365-API-009");
  });
  it("test_post_bridge_devices_id_browser_check_conflict", () => {
    // UNWANTED: IF PC の Bridge が動いていない（状態 browser_check_asleep）なら、Kaname は 409 と E-CONN-018 を返し、確かめの仕事を積まない
    // 本物の試験：apps/api/test/features/F3/ai-browser-check.test.ts の「K365-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-check.test.ts", "utf8")).toContain("K365-API-004");
  });
  it("test_post_bridge_devices_id_browser_check_rejected_422", () => {
    // UNWANTED: IF 体に知らない欄があるか :id が uuid でないなら、Kaname は 422 を返し、確かめの仕事を積まない
    // 本物の試験：apps/api/test/features/F3/ai-browser-check.test.ts の「K365-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-check.test.ts", "utf8")).toContain("K365-API-011");
  });
  it("test_post_bridge_devices_id_browser_check_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_bridge_devices_id_browser_check_rate_limited", () => {
    // UNWANTED: IF 10/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F3/ai-browser-check.test.ts の「K365-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-check.test.ts", "utf8")).toContain("K365-API-012");
  });
  it("test_post_bridge_devices_id_browser_check_upstream_failed", () => {
    // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
    // 本物の試験：apps/api/test/features/F3/ai-browser-check.test.ts の「K365-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-check.test.ts", "utf8")).toContain("K365-API-013");
  });
  it("test_post_bridge_devices_id_browser_check_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F3/ai-browser-check.test.ts の「K365-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-check.test.ts", "utf8")).toContain("K365-API-010");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_bridge_devices_id_browser_check_mfa_pending");
  it("test_post_bridge_devices_id_browser_check_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_bridge_devices_id_browser_check_shape", () => {
    // UBIQUITOUS: POST /api/v1/bridge/devices/:id/browser-check の副作用は関門 C1・C2・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F3/ai-browser-check.test.ts の「K365-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/ai-browser-check.test.ts", "utf8")).toContain("K365-API-018");
  });
});
