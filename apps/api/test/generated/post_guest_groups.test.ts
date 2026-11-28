// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/guest-groups
// グループを作る口は、届け先の社内のグループ（無い・消した・別の会社）と名前の重なり（表記ゆらぎ）と権限（招く権限だけの人も作れる）で答えが変わる。生成の試験の種では作れない（K-876）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/guest-groups", () => {
  it("test_post_guest_groups_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/guest-groups が「メールと層と権限の束を選んで招く」として呼ばれたとき THEN Kaname は「招待（7 日）を送る」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-007");
  });
  it("test_post_guest_groups_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-011");
  });
  it("test_post_guest_groups_rejected_403", () => {
    // UNWANTED: IF メンバーを招く権限も直す権限も無いなら、Kaname は 403 を返し、グループも証跡も作らない
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-011");
  });
  it("test_post_guest_groups_conflict", () => {
    // UNWANTED: IF 同じ名前のゲストのグループが今あるなら、Kaname は 409 と E-GST-002 を返し、グループも証跡も作らない
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-008");
  });
  it("test_post_guest_groups_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も作らない
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-010");
  });
  it("test_post_guest_groups_not_found", () => {
    // UNWANTED: IF 届け先の社内のグループが見つからないなら、Kaname は 404 と E-GST-003 を返し、グループも証跡も作らない
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-009");
  });
  it("test_post_guest_groups_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（上限は全部の口で同じ 1 か所の入口（op.ts・契約の rate_limit）が数える。この口は上限の振る舞いを自分で持たない）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_guest_groups_rate_limited");
  it("test_post_guest_groups_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_guest_groups_mfa_pending");
  it("test_post_guest_groups_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_guest_groups_shape", () => {
    // UBIQUITOUS: POST /api/v1/guest-groups の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-007");
  });
});
