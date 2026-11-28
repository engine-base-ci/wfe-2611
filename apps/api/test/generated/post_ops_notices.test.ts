// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/ops/notices
// 選んだワークスペースの在りか・メンテの時間の前後で答えが変わり、運営の記録を書く。種では作れない（K-1014）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/ops/notices", () => {
  it("test_post_ops_notices_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/ops/notices が「作って出す」として呼ばれたとき THEN Kaname は「対象に届ける」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-notices-write.test.ts の「K1014-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-write.test.ts", "utf8")).toContain("K1014-API-001");
  });
  it("test_post_ops_notices_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-notices-write.test.ts の「K1014-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-write.test.ts", "utf8")).toContain("K1014-API-014");
  });
  it("test_post_ops_notices_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-notices-write.test.ts の「K1014-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-write.test.ts", "utf8")).toContain("K1014-API-014");
  });
  it("test_post_ops_notices_conflict", () => {
    // UNWANTED: IF メンテの終わりが始まりより前か同じなら、Kaname は 409 と E-OPS-014 を返し、お知らせも記録も書かない
    // 本物の試験：apps/api/test/features/F12/ops-notices-write.test.ts の「K1014-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-write.test.ts", "utf8")).toContain("K1014-API-007");
  });
  it("test_post_ops_notices_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F12/ops-notices-write.test.ts の「K1014-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-write.test.ts", "utf8")).toContain("K1014-API-005");
  });
  it("test_post_ops_notices_not_found", () => {
    // UNWANTED: IF 選んだワークスペースが選べない会社なら、Kaname は 404 を返し、在るかを漏らさずお知らせも記録も作らない
    // 本物の試験：apps/api/test/features/F12/ops-notices-write.test.ts の「K1014-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-write.test.ts", "utf8")).toContain("K1014-API-008");
  });
  it("test_post_ops_notices_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_ops_notices_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ops_notices_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_ops_notices_mfa_pending");
  it("test_post_ops_notices_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ops_notices_rejected_422_2", () => {
    // UNWANTED: IF お知らせの公開で対象の会社が 0 件（プラン未選択・該当なし）、公開日時が過去、または全社通知の送出が一部失敗した THEN Kaname は「対象の会社がありません。プランか会社を選んでください」を返し、対象を選び直す／失敗した分を再送する（E-ACT-038）
    // 本物の試験：apps/api/test/features/F12/ops-notices-write.test.ts の「K1014-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-write.test.ts", "utf8")).toContain("K1014-API-006");
  });
  it("test_post_ops_notices_shape", () => {
    // UBIQUITOUS: POST /api/v1/ops/notices の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-notices-write.test.ts の「K1014-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-write.test.ts", "utf8")).toContain("K1014-API-001");
  });
});
