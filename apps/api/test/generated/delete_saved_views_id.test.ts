// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/saved_views/:id
// 消せるかは、作った人・グループのマネージャー・見える範囲の組み合わせで答えが変わる。生成の試験の種ではグループの席とマネージャーを作れない（K-476）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/saved_views/:id", () => {
  it("test_delete_saved_views_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/saved_views/:id が「タブで切り替える・絞り込みを保存する」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F7/saved-views-edit.test.ts の「K476-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/saved-views-edit.test.ts", "utf8")).toContain("K476-API-017");
  });
  it("test_delete_saved_views_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F7/saved-views-edit.test.ts の「K476-API-022」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/saved-views-edit.test.ts", "utf8")).toContain("K476-API-022");
  });
  it("test_delete_saved_views_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F7/saved-views-edit.test.ts の「K476-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/saved-views-edit.test.ts", "utf8")).toContain("K476-API-008");
  });
  it("test_delete_saved_views_id_not_found", () => {
    // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
    // 本物の試験：apps/api/test/features/F7/saved-views-edit.test.ts の「K476-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/saved-views-edit.test.ts", "utf8")).toContain("K476-API-009");
  });
  // 当てはまらない（体を受けない DELETE。道の値 :id が uuid でない 422 は入口の共通（K144-API-866））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_delete_saved_views_id_rejected_422");
  it("test_delete_saved_views_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F7/saved-views-edit.test.ts の「K476-API-023」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/saved-views-edit.test.ts", "utf8")).toContain("K476-API-023");
  });
  it("test_delete_saved_views_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_saved_views_id_mfa_pending");
  it("test_delete_saved_views_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_saved_views_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/saved_views/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F7/saved-views-edit.test.ts の「K476-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/saved-views-edit.test.ts", "utf8")).toContain("K476-API-017");
  });
});
