// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/ticket_kinds/:id
// 種別を足す・直す・消す・並べるは、権限（ticket_kinds の edit）・名前の一意・使っているチケットの数で答えが変わる。生成の試験の偽のセッションでは管理者の権限もチケットも作れない（K-704）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/ticket_kinds/:id", () => {
  it("test_delete_ticket_kinds_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/ticket_kinds/:id が「種別・状態・項目を、タブごとに足す・直す・並べる・消す」として呼ばれたとき THEN Kaname は「使っているチケットがある種別・状態は消せない。消した項目の値は見えなくなる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/ticket-kinds-write.test.ts の「K704-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-kinds-write.test.ts", "utf8")).toContain("K704-API-012");
  });
  it("test_delete_ticket_kinds_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/ticket-kinds-write.test.ts の「K704-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-kinds-write.test.ts", "utf8")).toContain("K704-API-017");
  });
  it("test_delete_ticket_kinds_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F9/ticket-kinds-write.test.ts の「K704-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-kinds-write.test.ts", "utf8")).toContain("K704-API-017");
  });
  it("test_delete_ticket_kinds_id_not_found", () => {
    // UNWANTED: IF 消す種別が無い・消した・別の会社なら、Kaname は 404 と E-PAGE-001 を返し（欄・details なし）、種別を何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-kinds-write.test.ts の「K704-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-kinds-write.test.ts", "utf8")).toContain("K704-API-011");
  });
  it("test_delete_ticket_kinds_id_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F9/ticket-kinds-write.test.ts の「K704-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-kinds-write.test.ts", "utf8")).toContain("K704-API-011");
  });
  it("test_delete_ticket_kinds_id_conflict", () => {
    // UNWANTED: IF 使っているチケットが在る種別を消そうとしたなら、Kaname は 409 と E-KND-003 を返し、種別を何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-kinds-write.test.ts の「K704-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-kinds-write.test.ts", "utf8")).toContain("K704-API-013");
  });
  it("test_delete_ticket_kinds_id_conflict_2", () => {
    // UNWANTED: IF 最後の 1 つの種別を消そうとしたなら、Kaname は 409 と E-KND-005 を返し、種別を何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-kinds-write.test.ts の「K704-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-kinds-write.test.ts", "utf8")).toContain("K704-API-014");
  });
  it("test_delete_ticket_kinds_id_session_unresolved", () => {
    // UNWANTED: IF 種別の行か証跡を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、種別も証跡も残さない
    // 本物の試験：apps/api/test/features/F9/ticket-kinds-write.test.ts の「K704-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-kinds-write.test.ts", "utf8")).toContain("K704-API-021");
  });
  it("test_delete_ticket_kinds_id_rate_limited", () => {
    // UNWANTED: IF 30/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/ticket-kinds-write.test.ts の「K704-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-kinds-write.test.ts", "utf8")).toContain("K704-API-019");
  });
  it("test_delete_ticket_kinds_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_ticket_kinds_id_mfa_pending");
  it("test_delete_ticket_kinds_id_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_ticket_kinds_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/ticket_kinds/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/ticket-kinds-write.test.ts の「K704-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-kinds-write.test.ts", "utf8")).toContain("K704-API-012");
  });
});
