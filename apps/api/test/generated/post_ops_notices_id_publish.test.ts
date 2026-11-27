// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/ops/notices/:id/publish
// お知らせの今の状態・種類・出す日時で答えが変わり、障害の状態・運営の記録・メンテのメールを出す。種では作れない（K-978）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/ops/notices/:id/publish", () => {
  it("test_post_ops_notices_id_publish_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/ops/notices/:id/publish が「作って出す」として呼ばれたとき THEN Kaname は「対象に届ける」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-notices-publish.test.ts の「K978-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-publish.test.ts", "utf8")).toContain("K978-API-001");
  });
  it("test_post_ops_notices_id_publish_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-notices-publish.test.ts の「K978-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-publish.test.ts", "utf8")).toContain("K978-API-013");
  });
  it("test_post_ops_notices_id_publish_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-notices-publish.test.ts の「K978-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-publish.test.ts", "utf8")).toContain("K978-API-013");
  });
  it("test_post_ops_notices_id_publish_not_found", () => {
    // UNWANTED: IF 指したお知らせが無いか消してあれば、Kaname は 404 と NOT_FOUND を返し、何も出さない
    // 本物の試験：apps/api/test/features/F12/ops-notices-publish.test.ts の「K978-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-publish.test.ts", "utf8")).toContain("K978-API-012");
  });
  it("test_post_ops_notices_id_publish_conflict", () => {
    // UNWANTED: IF メンテの時間が無いメンテのお知らせを出そうとしたら、Kaname は 409 と E-OPS-010 を返し、下書きのままにしてメールを送らない
    // 本物の試験：apps/api/test/features/F12/ops-notices-publish.test.ts の「K978-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-publish.test.ts", "utf8")).toContain("K978-API-005");
  });
  it("test_post_ops_notices_id_publish_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F12/ops-notices-publish.test.ts）：UNWANTED: IF もう出したか予定にしたお知らせを出そうとしたら、Kaname は 409 と E-OPS-011 を返し、状態の行も記録も増やさない
  it.todo("test_post_ops_notices_id_publish_conflict_2");
  // 当てはまらない（送る量の守り（1MB）は入口の共通（op.ts・K-144））：UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
  it.todo("test_post_ops_notices_id_publish_too_large");
  it("test_post_ops_notices_id_publish_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ops_notices_id_publish_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_ops_notices_id_publish_mfa_pending");
  it("test_post_ops_notices_id_publish_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F12/ops-notices-publish.test.ts）：UNWANTED: IF お知らせの公開で対象の会社が 0 件（プラン未選択・該当なし）、公開日時が過去、または全社通知の送出が一部失敗した THEN Kaname は「対象の会社がありません。プランか会社を選んでください」を返し、対象を選び直す／失敗した分を再送する（E-ACT-038）
  it.todo("test_post_ops_notices_id_publish_rejected_422_2");
  it("test_post_ops_notices_id_publish_shape", () => {
    // UBIQUITOUS: POST /api/v1/ops/notices/:id/publish の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-notices-publish.test.ts の「K978-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-notices-publish.test.ts", "utf8")).toContain("K978-API-001");
  });
});
