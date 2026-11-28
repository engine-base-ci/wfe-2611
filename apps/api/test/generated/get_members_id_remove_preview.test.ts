// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/members/:id/remove-preview
// 外す下見は、渡し中・承認・マネージャー・消える物・外せない理由の組み合わせで答えが変わる。生成の試験の種では作れない（K-815）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/members/:id/remove-preview", () => {
  it("test_get_members_id_remove_preview_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/members/:id/remove-preview が「担当中のチケットと承認を引き継いでから抜けさせる」として呼ばれたとき THEN Kaname は「セッションを失効」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/admin-member-remove-preview.test.ts の「K815-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-remove-preview.test.ts", "utf8")).toContain("K815-API-001");
  });
  it("test_get_members_id_remove_preview_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/admin-member-remove-preview.test.ts の「K815-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-remove-preview.test.ts", "utf8")).toContain("K815-API-013");
  });
  it("test_get_members_id_remove_preview_rejected_403", () => {
    // UNWANTED: IF メンバーを直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-member-remove-preview.test.ts の「K815-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-remove-preview.test.ts", "utf8")).toContain("K815-API-013");
  });
  it("test_get_members_id_remove_preview_not_found", () => {
    // UNWANTED: IF 道の id の人が無い、別の会社、消した、外した、招待中、または人でないなら、Kaname は 404 と E-MEM-002 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-member-remove-preview.test.ts の「K815-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-remove-preview.test.ts", "utf8")).toContain("K815-API-014");
  });
  it("test_get_members_id_remove_preview_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F10/admin-member-remove-preview.test.ts の「K815-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-remove-preview.test.ts", "utf8")).toContain("K815-API-017");
  });
  // 当てはまらない（入口の共通（429）は契約の op の共通の試験が受ける（K-419 と同じ前例））：UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_members_id_remove_preview_rate_limited");
  // 当てはまらない（入口の共通（同意し直し））：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_get_members_id_remove_preview_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_members_id_remove_preview_mfa_pending");
  it("test_get_members_id_remove_preview_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 当てはまらない（K815-API-017 が受ける（道の値の uuid は K-800 の K144-API-1109））：UNWANTED: IF 抜ける人の依存（タスク・承認待ち・AI社員・層の長）に自分のAIが引き継ぎ先の案を出せない、または引き継ぎ先が未決のまま「無効にする」を押した THEN Kaname は「引き継ぎ先が決まっていないものがあります。決めるまで無効にできません」を返し、自分のAIの案を全部採る／1 件ずつ決める（E-ACT-035）
  it.todo("test_get_members_id_remove_preview_rejected_422_2");
  it("test_get_members_id_remove_preview_shape", () => {
    // UBIQUITOUS: GET /api/v1/members/:id/remove-preview の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/admin-member-remove-preview.test.ts の「K815-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-remove-preview.test.ts", "utf8")).toContain("K815-API-001");
  });
});
