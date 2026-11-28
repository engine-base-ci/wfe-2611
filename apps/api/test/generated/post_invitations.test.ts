// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/invitations
// 招く口は、宛ての形・もう入っている人・重ねた招待・本人確認の取り直し・メールの成否で答えが変わる（K-419）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/invitations", () => {
  it("test_post_invitations_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/invitations が「メールと層と権限の束を選んで招く」として呼ばれたとき THEN Kaname は「招待（7 日）を送る」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/invite-create.test.ts の「K419-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-create.test.ts", "utf8")).toContain("K419-API-007");
  });
  it("test_post_invitations_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/invite-create.test.ts の「K419-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-create.test.ts", "utf8")).toContain("K419-API-019");
  });
  it("test_post_invitations_rejected_403", () => {
    // UNWANTED: IF 管理者として招くのに取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、招待もメールも作らない
    // 本物の試験：apps/api/test/features/F10/invite-create.test.ts の「K419-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-create.test.ts", "utf8")).toContain("K419-API-018");
  });
  it("test_post_invitations_conflict", () => {
    // UNWANTED: IF 宛てにもうこのワークスペースに入っている人がいるなら、Kaname は 409 と E-INV-010 と入っている宛ての一覧（detail）を返し、どの宛ても招かずメールも送らない
    // 本物の試験：apps/api/test/features/F10/invite-create.test.ts の「K419-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-create.test.ts", "utf8")).toContain("K419-API-011");
  });
  it("test_post_invitations_rejected_422", () => {
    // UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と宛てごとの理由を返し、どの宛ても招かずメールも送らない
    // 本物の試験：apps/api/test/features/F10/invite-create.test.ts の「K419-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-create.test.ts", "utf8")).toContain("K419-API-010");
  });
  it("test_post_invitations_not_found", () => {
    // UNWANTED: IF 選んだグループがこの会社に無い、または消してあるなら、Kaname は 404 と E-INV-011 を返し、どの宛ても招かずメールも送らない
    // 本物の試験：apps/api/test/features/F10/invite-create.test.ts の「K419-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-create.test.ts", "utf8")).toContain("K419-API-014");
  });
  it("test_post_invitations_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F10/invite-create.test.ts）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_invitations_rate_limited");
  // 本物の試験はまだ無い（apps/api/test/features/F10/invite-create.test.ts）：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_invitations_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_invitations_mfa_pending");
  it("test_post_invitations_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_invitations_shape", () => {
    // UBIQUITOUS: POST /api/v1/invitations の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/invite-create.test.ts の「K419-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-create.test.ts", "utf8")).toContain("K419-API-007");
  });
});
