// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/knowledge/review
// 見直すページは役（管理者・マネージャー）と棚・時刻（90 日・30 日）・破られた数で答えが変わる。生成の試験の偽のセッションでは棚も所属も破られた数も作れない（K-695）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/knowledge/review", () => {
  it("test_get_knowledge_review_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/knowledge/review が「管理の一覧で見直すページを開き、直す・外す・書き方を直す」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：使われていない・食い違い・破られた数を数えて出す）
    // 本物の試験：apps/api/test/features/F9/knowledge-review.test.ts の「K695-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-review.test.ts", "utf8")).toContain("K695-API-001");
  });
  it("test_get_knowledge_review_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-review.test.ts の「K695-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-review.test.ts", "utf8")).toContain("K695-API-020");
  });
  it("test_get_knowledge_review_rejected_403", () => {
    // UNWANTED: IF 管理者でもマネージャーでもないなら、Kaname は 403 を返し、見直すページを見せない
    // 本物の試験：apps/api/test/features/F9/knowledge-review.test.ts の「K695-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-review.test.ts", "utf8")).toContain("K695-API-002");
  });
  // 当てはまらない（入力の無い口（問い合わせの欄も体も受けない・QUERIES は空）。値の形で 422 になる欄が無い）：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_knowledge_review_rejected_422");
  it("test_get_knowledge_review_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-review.test.ts の「K695-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-review.test.ts", "utf8")).toContain("K695-API-021");
  });
  it("test_get_knowledge_review_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_knowledge_review_mfa_pending");
  it("test_get_knowledge_review_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_knowledge_review_shape", () => {
    // UBIQUITOUS: GET /api/v1/knowledge/review の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-review.test.ts の「K695-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-review.test.ts", "utf8")).toContain("K695-API-001");
  });
});
