// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/knowledge_pages/:id/raise
// 上げる頼みが出せるかは棚（会社・グループ・自分）と役・先の承認する人・フォルダで変わる。生成の試験の偽のセッションでは棚も所属も作れない（K-687）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/knowledge_pages/:id/raise", () => {
  it("test_post_knowledge_pages_id_raise_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/knowledge_pages/:id/raise が「上げる・共有を頼む。承認する・断る（理由）。上の棚のページを自分の棚に写して直す」として呼ばれたとき THEN Kaname は「承認されたらページが上の棚に移る。頼み・承認・断りをお知らせに出す」を行い 2xx を返す（自動側：書くとき・上げるときに似たページを出す）
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-001");
  });
  it("test_post_knowledge_pages_id_raise_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-024");
  });
  it("test_post_knowledge_pages_id_raise_rejected_403", () => {
    // UNWANTED: IF ページに書けない人なら、Kaname は 403 を返し、頼みを作らない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-008");
  });
  it("test_post_knowledge_pages_id_raise_not_found", () => {
    // UNWANTED: IF ページか上げる先が無いか見えないなら、Kaname は 404 を返し、頼みを作らない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-008");
  });
  it("test_post_knowledge_pages_id_raise_conflict", () => {
    // UNWANTED: IF ページがまだ書き終わっていない（下書きだけ）なら、Kaname は 409 と E-KNW-010 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-006");
  });
  it("test_post_knowledge_pages_id_raise_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、頼みを作らない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-009");
  });
  it("test_post_knowledge_pages_id_raise_conflict_2", () => {
    // UNWANTED: IF 上げる・共有する頼みが承認待ちなら、Kaname は 409 と E-KNW-011 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-006");
  });
  it("test_post_knowledge_pages_id_raise_conflict_3", () => {
    // UNWANTED: IF ページが会社の棚にあり、これより上の棚が無いなら、Kaname は 409 と E-KNW-100 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-005");
  });
  it("test_post_knowledge_pages_id_raise_conflict_4", () => {
    // UNWANTED: IF 自分の棚のページで上げる先のグループを選んでいないなら、Kaname は 409 と E-KNW-101 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-005");
  });
  it("test_post_knowledge_pages_id_raise_conflict_5", () => {
    // UNWANTED: IF 上げる先に承認できる人がいないなら、Kaname は 409 と E-KNW-102 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-007");
  });
  it("test_post_knowledge_pages_id_raise_conflict_6", () => {
    // UNWANTED: IF 入れるフォルダが上げる先の棚に無いなら、Kaname は 409 と E-KNW-103 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-004");
  });
  // 当てはまらない（共有しているページ（E-KNW-106）は共有の置き場（K-689）と確かめ（K-719 が page-guards/shared.ts を差し替える）が入ってから。K-719 が自分の試験に行を足す）：UNWANTED: IF ページ（か上のフォルダ）をほかのグループに共有しているなら、Kaname は 409 と E-KNW-106 を返し、頼みもお知らせもページも変えない
  it.todo("test_post_knowledge_pages_id_raise_conflict_7");
  it("test_post_knowledge_pages_id_raise_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、頼みもお知らせもページも変えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_knowledge_pages_id_raise_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_knowledge_pages_id_raise_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-025");
  });
  it("test_post_knowledge_pages_id_raise_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_knowledge_pages_id_raise_mfa_pending");
  it("test_post_knowledge_pages_id_raise_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_knowledge_pages_id_raise_shape", () => {
    // UBIQUITOUS: POST /api/v1/knowledge_pages/:id/raise の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-raise.test.ts の「K687-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-raise.test.ts", "utf8")).toContain("K687-API-001");
  });
});
