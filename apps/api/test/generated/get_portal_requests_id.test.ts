// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/portal/requests/:id
// 依頼を読む口は、依頼のグループ・状態・やり取りの種類で答えが変わる。生成の試験の種ではゲストも依頼も作れない（K-907）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/portal/requests/:id", () => {
  it("test_get_portal_requests_id_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/portal/requests/:id が「依頼を書いて出す・やり取りする」として呼ばれたとき THEN Kaname は「ゲストの依頼を会社に知らせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F11/portal-request.test.ts の「K907-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request.test.ts", "utf8")).toContain("K907-API-015");
  });
  it("test_get_portal_requests_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/portal-request.test.ts の「K907-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request.test.ts", "utf8")).toContain("K907-API-019");
  });
  it("test_get_portal_requests_id_rejected_403", () => {
    // UNWANTED: IF 呼んだ人がゲストのグループに入った今のゲストでないなら、Kaname は 403 を返し、何も返さず何も書かない
    // 本物の試験：apps/api/test/features/F11/portal-request.test.ts の「K907-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request.test.ts", "utf8")).toContain("K907-API-019");
  });
  it("test_get_portal_requests_id_not_found", () => {
    // UNWANTED: IF 依頼が自分のゲストのグループの物でないなら、Kaname は 404 を返し、題も本文も返さない
    // 本物の試験：apps/api/test/features/F11/portal-request.test.ts の「K907-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request.test.ts", "utf8")).toContain("K907-API-018");
  });
  it("test_get_portal_requests_id_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144.d/K-907.ts の「K144-API-1207」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-907.ts", "utf8")).toContain("K144-API-1207");
  });
  // 当てはまらない（読むだけの口で、数え方は入口の共通（K-144）。出す口の上限は K907-API-012 が受ける）：UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_portal_requests_id_rate_limited");
  it("test_get_portal_requests_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_portal_requests_id_mfa_pending");
  it("test_get_portal_requests_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_portal_requests_id_shape", () => {
    // UBIQUITOUS: GET /api/v1/portal/requests/:id の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/portal-request.test.ts の「K907-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-request.test.ts", "utf8")).toContain("K907-API-015");
  });
});
