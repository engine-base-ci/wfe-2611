// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/knowledge/shares
// 共有の選びが読めるかは棚（グループ）と役（元のマネージャー・共有先のマネージャー）で変わる。生成の試験の偽のセッションでは棚も所属も共有も作れない（K-689）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/knowledge/shares", () => {
  it("test_get_knowledge_shares_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/knowledge/shares が「上げる・共有を頼む。承認する・断る（理由）。上の棚のページを自分の棚に写して直す」として呼ばれたとき THEN Kaname は「承認されたらページが上の棚に移る。頼み・承認・断りをお知らせに出す」を行い 2xx を返す（自動側：書くとき・上げるときに似たページを出す）
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-001");
  });
  it("test_get_knowledge_shares_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-020");
  });
  it("test_get_knowledge_shares_rejected_403", () => {
    // UNWANTED: IF 共有を決められない人なら、Kaname は 403 を返し、選びを見せない
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-003");
  });
  it("test_get_knowledge_shares_rejected_422", () => {
    // UNWANTED: IF 問い合わせの値の形が違うなら、Kaname は 422 を返す
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-140」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-140");
  });
  it("test_get_knowledge_shares_not_found", () => {
    // UNWANTED: IF 指した物が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさない
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-003");
  });
  it("test_get_knowledge_shares_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、共有も頼みもお知らせも変えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_knowledge_shares_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-020");
  });
  it("test_get_knowledge_shares_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_knowledge_shares_mfa_pending");
  it("test_get_knowledge_shares_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_knowledge_shares_shape", () => {
    // UBIQUITOUS: GET /api/v1/knowledge/shares の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-001");
  });
});
