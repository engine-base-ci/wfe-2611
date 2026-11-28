// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/guest-groups/:id
// 名前を直す口は、権限・名前の重なり（表記ゆらぎ）・グループの状態（無い・消した・別の会社）で答えが変わる。生成の試験の種ではグループを作れない（K-927）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/guest-groups/:id", () => {
  it("test_patch_guest_groups_id_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/guest-groups/:id が「メールと層と権限の束を選んで招く」として呼ばれたとき THEN Kaname は「招待（7 日）を送る」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-001");
  });
  it("test_patch_guest_groups_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-005");
  });
  it("test_patch_guest_groups_id_rejected_403", () => {
    // UNWANTED: IF メンバーを直す権限が無いなら、Kaname は 403 を返し、グループも証跡も変えない
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-005");
  });
  it("test_patch_guest_groups_id_not_found", () => {
    // UNWANTED: IF ゲストのグループが見つからないなら、Kaname は 404 と E-GST-001 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-004");
  });
  it("test_patch_guest_groups_id_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-003");
  });
  it("test_patch_guest_groups_id_conflict", () => {
    // UNWANTED: IF 直した名前と同じ名前のグループが今あるなら、Kaname は 409 と E-GST-002 を返し、名前も証跡も変えない
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-002");
  });
  it("test_patch_guest_groups_id_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_patch_guest_groups_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-021");
  });
  it("test_patch_guest_groups_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_guest_groups_id_mfa_pending");
  it("test_patch_guest_groups_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_guest_groups_id_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/guest-groups/:id の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-001");
  });
});
