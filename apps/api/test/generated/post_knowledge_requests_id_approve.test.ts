// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/knowledge/requests/:id/approve
// 承認できるかは承認する人・頼みの状態・頼んだ人の所属で変わる。生成の試験の偽のセッションでは頼みを作れない（K-688）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/knowledge/requests/:id/approve", () => {
  it("test_post_knowledge_requests_id_approve_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/knowledge/requests/:id/approve が「上げる・共有を頼む。承認する・断る（理由）。上の棚のページを自分の棚に写して直す」として呼ばれたとき THEN Kaname は「承認されたらページが上の棚に移る。頼み・承認・断りをお知らせに出す」を行い 2xx を返す（自動側：書くとき・上げるときに似たページを出す）
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-005");
  });
  it("test_post_knowledge_requests_id_approve_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-024");
  });
  it("test_post_knowledge_requests_id_approve_rejected_403", () => {
    // UNWANTED: IF 承認する人でないなら、Kaname は 403 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-009");
  });
  it("test_post_knowledge_requests_id_approve_not_found", () => {
    // UNWANTED: IF 頼みが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-009");
  });
  it("test_post_knowledge_requests_id_approve_conflict", () => {
    // UNWANTED: IF 頼みがもう決まっている（承認・断り・取り下げ済み・同時に押した負けた方）なら、Kaname は 409 と E-KNW-110 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-010");
  });
  it("test_post_knowledge_requests_id_approve_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-013");
  });
  it("test_post_knowledge_requests_id_approve_conflict_2", () => {
    // UNWANTED: IF 自分の棚のページを上げる頼みで、頼んだ人がもう先のグループにいないなら、Kaname は 409 と E-KNW-111 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-011");
  });
  // 当てはまらない（E-KNW-103 は頼んだあとにフォルダが別の棚へ付け替わったときの引き金の印（KNW_FOLDER_SHELF）を言い換えるだけ。付け替えは画面からは起きず、同じ番号の作りは K-687 の K687-API-004 が受ける）：UNWANTED: IF 入れるフォルダが先の棚に無い（頼んだあとにフォルダが付け替わった）なら、Kaname は 409 と E-KNW-103 を返し、頼みもお知らせもページも変えない
  it.todo("test_post_knowledge_requests_id_approve_conflict_3");
  it("test_post_knowledge_requests_id_approve_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-020");
  });
  it("test_post_knowledge_requests_id_approve_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_knowledge_requests_id_approve_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-025");
  });
  it("test_post_knowledge_requests_id_approve_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_knowledge_requests_id_approve_mfa_pending");
  it("test_post_knowledge_requests_id_approve_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_knowledge_requests_id_approve_shape", () => {
    // UBIQUITOUS: POST /api/v1/knowledge/requests/:id/approve の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-approvals.test.ts の「K688-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-approvals.test.ts", "utf8")).toContain("K688-API-005");
  });
});
