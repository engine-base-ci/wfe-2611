// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/members/:id/suspend
// 止める口は、相手の状態・自分・最後の管理者・セッションと PC の仕事を切る・本人確認・同時の組み合わせで答えが変わる。生成の試験の種では作れない（K-814）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/members/:id/suspend", () => {
  it("test_post_members_id_suspend_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/members/:id/suspend が「担当中のチケットと承認を引き継いでから抜けさせる」として呼ばれたとき THEN Kaname は「セッションを失効」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-001");
  });
  it("test_post_members_id_suspend_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-011");
  });
  it("test_post_members_id_suspend_rejected_403", () => {
    // UNWANTED: IF 止めるのに取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-011");
  });
  it("test_post_members_id_suspend_not_found", () => {
    // UNWANTED: IF 止める相手が無いか別の会社か外した・消した人か AI なら、Kaname は 404 と E-MEM-002 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-005");
  });
  it("test_post_members_id_suspend_conflict", () => {
    // UNWANTED: IF 自分を止めようとしたなら、Kaname は 409 と E-MEM-005 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-004");
  });
  it("test_post_members_id_suspend_rejected_422", () => {
    // UNWANTED: IF 道の id が uuid でないか体に知らない項目があるなら、Kaname は 422 を返し、何も書かない
    // 本物の試験：apps/api/test/features/contract/k144.d/K-800.ts の「K144-API-1107」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-800.ts", "utf8")).toContain("K144-API-1107");
  });
  it("test_post_members_id_suspend_rejected_403_2", () => {
    // UNWANTED: IF members の edit を持たない人が止めるなら、Kaname は 403 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-011");
  });
  it("test_post_members_id_suspend_conflict_2", () => {
    // UNWANTED: IF 最後の管理者を止めようとしたなら、Kaname は 409 と E-MEM-004 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-004");
  });
  it("test_post_members_id_suspend_conflict_3", () => {
    // UNWANTED: IF もう止まっている人を止めようとしたなら、Kaname は 409 と E-MEM-009 を返し、証跡を増やさない
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-006");
  });
  it("test_post_members_id_suspend_session_unresolved", () => {
    // UNWANTED: IF 止める途中で DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止めもセッションも仕事も証跡も変えない
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-007");
  });
  it("test_post_members_id_suspend_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_members_id_suspend_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-011");
  });
  it("test_post_members_id_suspend_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_members_id_suspend_mfa_pending");
  it("test_post_members_id_suspend_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 当てはまらない（A62 の機能の文（抜ける人の依存の引き継ぎ・E-ACT-035）から来た行。止める・戻すは引き継ぎを求めない（担当・所属はそのまま・D-154.33）。外すときの引き継ぎは K-848 の removeMember）：UNWANTED: IF 抜ける人の依存（タスク・承認待ち・AI社員・層の長）に自分のAIが引き継ぎ先の案を出せない、または引き継ぎ先が未決のまま「無効にする」を押した THEN Kaname は「引き継ぎ先が決まっていないものがあります。決めるまで無効にできません」を返し、自分のAIの案を全部採る／1 件ずつ決める（E-ACT-035）
  it.todo("test_post_members_id_suspend_rejected_422_2");
  it("test_post_members_id_suspend_shape", () => {
    // UBIQUITOUS: POST /api/v1/members/:id/suspend の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/admin-member-suspend.test.ts の「K814-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-member-suspend.test.ts", "utf8")).toContain("K814-API-001");
  });
});
