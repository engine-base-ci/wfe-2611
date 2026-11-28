// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/ticket-fields
// 会社の項目の一覧は、種別の指定・消した項目・別の会社の行で答えが変わる。生成の試験の偽のセッションでは項目も種別も作れない（K-563）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/ticket-fields", () => {
  it("test_get_ticket_fields_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/ticket-fields が「責任者・期限・分類・親を決める」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：振り分けの案を出す）
    // 本物の試験：apps/api/test/features/F4/ticket-fields.test.ts の「K563-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-fields.test.ts", "utf8")).toContain("K563-API-001");
  });
  it("test_get_ticket_fields_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F4/ticket-fields.test.ts の「K563-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-fields.test.ts", "utf8")).toContain("K563-API-008");
  });
  // 当てはまらない（読むだけの口で、会社のメンバーなら誰でも読める（行の守りの外の人は入口が 401・404 で止める。受けは K563-API-005・008））：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_ticket_fields_rejected_403");
  it("test_get_ticket_fields_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144.d/K-563.ts の「K144-API-530」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-563.ts", "utf8")).toContain("K144-API-530");
  });
  it("test_get_ticket_fields_not_found", () => {
    // UNWANTED: IF kind_id の種別が無い・消された・別の会社なら、Kaname は 404 と NOT_FOUND を返し、項目を返さない
    // 本物の試験：apps/api/test/features/F4/ticket-fields.test.ts の「K563-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-fields.test.ts", "utf8")).toContain("K563-API-006");
  });
  it("test_get_ticket_fields_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F4/ticket-fields.test.ts の「K563-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-fields.test.ts", "utf8")).toContain("K563-API-009");
  });
  it("test_get_ticket_fields_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_ticket_fields_mfa_pending");
  it("test_get_ticket_fields_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_ticket_fields_shape", () => {
    // UBIQUITOUS: GET /api/v1/ticket-fields の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F4/ticket-fields.test.ts の「K563-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-fields.test.ts", "utf8")).toContain("K563-API-001");
  });
});
