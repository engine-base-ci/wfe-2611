// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/guest-groups/:id
// 消す口は、権限・グループの状態と、中のゲスト・招待・見せる相手の有無で起きる事が変わる。生成の試験の種ではゲスト・見せる相手を作れない（K-927）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/guest-groups/:id", () => {
  it("test_delete_guest_groups_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/guest-groups/:id が「メールと層と権限の束を選んで招く」として呼ばれたとき THEN Kaname は「招待（7 日）を送る」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-006");
  });
  it("test_delete_guest_groups_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-012");
  });
  it("test_delete_guest_groups_id_rejected_403", () => {
    // UNWANTED: IF メンバーを直す権限が無いなら、Kaname は 403 を返し、グループも証跡も変えない
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-012");
  });
  it("test_delete_guest_groups_id_not_found", () => {
    // UNWANTED: IF ゲストのグループが見つからないなら、Kaname は 404 と E-GST-001 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-011");
  });
  // 当てはまらない（体を受けない DELETE（道の値の uuid は k144.d の行 K144-API-1228 が受ける））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_delete_guest_groups_id_rejected_422");
  it("test_delete_guest_groups_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-021");
  });
  it("test_delete_guest_groups_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_guest_groups_id_mfa_pending");
  it("test_delete_guest_groups_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_guest_groups_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/guest-groups/:id の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/guest-group-edit.test.ts の「K927-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-group-edit.test.ts", "utf8")).toContain("K927-API-006");
  });
});
