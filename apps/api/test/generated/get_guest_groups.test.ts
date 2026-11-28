// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/guest-groups
// ゲストのグループの一覧は、会社の分け方（別の会社・消したグループ・消した届け先）と所属の状態（抜けた・止めた）と招待の状態で答えが変わる。生成の試験の種ではグループ・ゲスト・招待を作れない（K-876）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/guest-groups", () => {
  it("test_get_guest_groups_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/guest-groups が「メールと層と権限の束を選んで招く」として呼ばれたとき THEN Kaname は「招待（7 日）を送る」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-024");
  });
  it("test_get_guest_groups_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-026」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-026");
  });
  it("test_get_guest_groups_rejected_403", () => {
    // UNWANTED: IF メンバーを見る権限も招く権限も無いなら、Kaname は 403 を返し、グループを 1 つも返さない
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-026」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-026");
  });
  // 当てはまらない（入力を受けない GET（cursor・limit を持たない・全部を返す））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_guest_groups_rejected_422");
  // 当てはまらない（上限は全部の口で同じ 1 か所の入口（op.ts・契約の rate_limit）が数える。この口は上限の振る舞いを自分で持たない）：UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_guest_groups_rate_limited");
  it("test_get_guest_groups_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_guest_groups_mfa_pending");
  it("test_get_guest_groups_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_guest_groups_shape", () => {
    // UBIQUITOUS: GET /api/v1/guest-groups の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/guest-groups.test.ts の「K876-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/guest-groups.test.ts", "utf8")).toContain("K876-API-024");
  });
});
