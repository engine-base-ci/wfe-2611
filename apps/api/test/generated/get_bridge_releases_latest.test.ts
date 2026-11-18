// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/bridge/releases/latest
// K-57 の口は本物の PC の印の解決と本物の振る舞い（hooks）・接続コードの期限と 1 回だけ・配布物の置き場が要る。生成の試験の土台（偽のセッション・表の種の入力）では確かめられない（K-57）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/bridge/releases/latest", () => {
  it("test_get_bridge_releases_latest_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/bridge/releases/latest が「Bridge を入れてつなぐ」として呼ばれたとき THEN Kaname は「Bridge と本人を結ぶ。つながったら自分の AI が話せる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-021");
  });
  it("test_get_bridge_releases_latest_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-045」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-045");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F3/connect-pc.test.ts）：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_bridge_releases_latest_rejected_403");
  it("test_get_bridge_releases_latest_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-023」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-023");
  });
  it("test_get_bridge_releases_latest_unavailable", () => {
    // UNWANTED: IF 配布物の置き場に届かないなら、Kaname は 503 と E-PAGE-007 を返し、「配っていない」と答えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-004");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F3/connect-pc.test.ts）：UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_bridge_releases_latest_rate_limited");
  it("test_get_bridge_releases_latest_upstream_failed", () => {
    // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-024");
  });
  it("test_get_bridge_releases_latest_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-050」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-050");
  });
  it("test_get_bridge_releases_latest_mfa_pending", () => {
    // UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/mfa-gate.test.ts の「K321-API-001」（入口 1 か所の止め・同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/mfa-gate.test.ts", "utf8")).toContain("K321-API-001");
  });
  it("test_get_bridge_releases_latest_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_bridge_releases_latest_shape", () => {
    // UBIQUITOUS: GET /api/v1/bridge/releases/latest の副作用は関門 C1・C2・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F3/connect-pc.test.ts の「K57-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/connect-pc.test.ts", "utf8")).toContain("K57-API-021");
  });
});
