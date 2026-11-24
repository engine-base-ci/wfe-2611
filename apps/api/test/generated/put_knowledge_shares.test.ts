// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PUT /api/v1/knowledge/shares
// 共有を頼む・やめるは棚・役・相手のグループのマネージャーの有無・頼みの状態で変わる。生成の試験の偽のセッションでは棚も所属も作れない（K-689）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PUT /api/v1/knowledge/shares", () => {
  it("test_put_knowledge_shares_ok", () => {
    // EVENT-DRIVEN: WHEN PUT /api/v1/knowledge/shares が「上げる・共有を頼む。承認する・断る（理由）。上の棚のページを自分の棚に写して直す」として呼ばれたとき THEN Kaname は「承認されたらページが上の棚に移る。頼み・承認・断りをお知らせに出す」を行い 2xx を返す（自動側：書くとき・上げるときに似たページを出す）
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-004");
  });
  it("test_put_knowledge_shares_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-020");
  });
  it("test_put_knowledge_shares_rejected_403", () => {
    // UNWANTED: IF 共有を決められない人なら、Kaname は 403 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-010");
  });
  it("test_put_knowledge_shares_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-011");
  });
  it("test_put_knowledge_shares_not_found", () => {
    // UNWANTED: IF 物か選んだグループが無いか見えないなら、Kaname は 404 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-010");
  });
  it("test_put_knowledge_shares_conflict", () => {
    // UNWANTED: IF ページがまだ書き終わっていない（下書きだけ）なら、Kaname は 409 と E-KNW-010 を返し、共有も頼みもお知らせも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-010");
  });
  it("test_put_knowledge_shares_conflict_2", () => {
    // UNWANTED: IF 上げる頼みが承認待ちなら、Kaname は 409 と E-KNW-011 を返し、共有も頼みもお知らせも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-010");
  });
  it("test_put_knowledge_shares_conflict_3", () => {
    // UNWANTED: IF 元のグループを共有先に選んだなら、Kaname は 409 と E-KNW-120 を返し、共有も頼みもお知らせも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-010");
  });
  it("test_put_knowledge_shares_conflict_4", () => {
    // UNWANTED: IF グループの棚の物でない（会社の棚・自分の棚）なら、Kaname は 409 と E-KNW-121 を返し、共有も頼みもお知らせも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-010");
  });
  it("test_put_knowledge_shares_conflict_5", () => {
    // UNWANTED: IF 足す共有先のグループに承認できる人（マネージャー）がいないなら、Kaname は 409 と E-KNW-122 を返し、共有も頼みもお知らせも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-010");
  });
  it("test_put_knowledge_shares_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、共有も頼みもお知らせも変えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 当てはまらない（体の大きさの上限は入口の共通（K-144・この口の体は 4 欄））：UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
  it.todo("test_put_knowledge_shares_too_large");
  it("test_put_knowledge_shares_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-021");
  });
  it("test_put_knowledge_shares_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_put_knowledge_shares_mfa_pending");
  it("test_put_knowledge_shares_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_put_knowledge_shares_shape", () => {
    // UBIQUITOUS: PUT /api/v1/knowledge/shares の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-shares.test.ts の「K689-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-shares.test.ts", "utf8")).toContain("K689-API-004");
  });
});
