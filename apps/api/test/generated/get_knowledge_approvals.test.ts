// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/knowledge/approvals
// 承認待ちの一覧は役（管理者・マネージャー）と先の棚で答えが変わる。生成の試験の偽のセッションでは棚も所属も頼みも作れない（K-688）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/knowledge/approvals", () => {
  it("test_get_knowledge_approvals_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/knowledge/approvals が「上げる・共有を頼む。承認する・断る（理由）。上の棚のページを自分の棚に写して直す」として呼ばれたとき THEN Kaname は「承認されたらページが上の棚に移る。頼み・承認・断りをお知らせに出す」を行い 2xx を返す（自動側：書くとき・上げるときに似たページを出す）
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-001");
  });
  it("test_get_knowledge_approvals_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-024");
  });
  it("test_get_knowledge_approvals_rejected_403", () => {
    // UNWANTED: IF 承認できる人でないなら、Kaname は 403 を返し、承認待ちを見せない
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-002");
  });
  it("test_get_knowledge_approvals_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-026」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-026");
  });
  it("test_get_knowledge_approvals_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_knowledge_approvals_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-025");
  });
  it("test_get_knowledge_approvals_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_knowledge_approvals_mfa_pending");
  // 当てはまらない（読む口の DB の失敗は入口の共通の 503（K144-API-032 が受ける）。この口に固有の 503 の作りは無い（取引 1 つ・読むだけ））：UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
  it.todo("test_get_knowledge_approvals_session_unresolved_2");
  it("test_get_knowledge_approvals_shape", () => {
    // UBIQUITOUS: GET /api/v1/knowledge/approvals の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-001");
  });
});
