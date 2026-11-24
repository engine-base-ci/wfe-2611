// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/knowledge/requests/:id/dismiss
// 断りの帯を消せるかは頼んだ人と頼みの状態で変わる。生成の試験の偽のセッションでは頼みを作れない（K-687）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/knowledge/requests/:id/dismiss", () => {
  it("test_post_knowledge_requests_id_dismiss_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/knowledge/requests/:id/dismiss が「上げる・共有を頼む。承認する・断る（理由）。上の棚のページを自分の棚に写して直す」として呼ばれたとき THEN Kaname は「承認されたらページが上の棚に移る。頼み・承認・断りをお知らせに出す」を行い 2xx を返す（自動側：書くとき・上げるときに似たページを出す）
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-012");
  });
  it("test_post_knowledge_requests_id_dismiss_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-024");
  });
  it("test_post_knowledge_requests_id_dismiss_rejected_403", () => {
    // UNWANTED: IF 頼んだ人でないなら、Kaname は 403 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-012");
  });
  it("test_post_knowledge_requests_id_dismiss_not_found", () => {
    // UNWANTED: IF 頼みが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-012");
  });
  it("test_post_knowledge_requests_id_dismiss_conflict", () => {
    // UNWANTED: IF 断られた頼みの帯でない（承認待ち・承認済み・取り下げ済み・もう消した）なら、Kaname は 409 と E-KNW-105 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-012");
  });
  it("test_post_knowledge_requests_id_dismiss_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-009");
  });
  it("test_post_knowledge_requests_id_dismiss_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 当てはまらない（体の大きさの上限は入口の共通（K-144・この口の体は空））：UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
  it.todo("test_post_knowledge_requests_id_dismiss_too_large");
  it("test_post_knowledge_requests_id_dismiss_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-025");
  });
  it("test_post_knowledge_requests_id_dismiss_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_knowledge_requests_id_dismiss_mfa_pending");
  it("test_post_knowledge_requests_id_dismiss_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_knowledge_requests_id_dismiss_shape", () => {
    // UBIQUITOUS: POST /api/v1/knowledge/requests/:id/dismiss の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-012");
  });
});
