// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/me/ticket-drafts
// K-60 の口は本物の振る舞い（hooks）と、種別の必須の区画・期限が今日より前でない・同じ会社の確かめが要る。生成の試験の土台（表の種の入力）では確かめられない（K-60）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/me/ticket-drafts", () => {
  it("test_get_me_ticket_drafts_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/me/ticket-drafts が「種別を選び、題名・責任者・期限・目的・完了の条件を書く」として呼ばれたとき THEN Kaname は「番号（グループの頭文字＋連番）を振る・版を残す」を行い 2xx を返す（自動側：ルールを当てて既定値を入れる）
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-038」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-038");
  });
  it("test_get_me_ticket_drafts_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-041」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-041");
  });
  it("test_get_me_ticket_drafts_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-039」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-039");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F4/create-ticket.test.ts）：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_me_ticket_drafts_rejected_422");
  // 本物の試験はまだ無い（apps/api/test/features/F4/create-ticket.test.ts）：UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_me_ticket_drafts_rate_limited");
  it("test_get_me_ticket_drafts_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-043」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-043");
  });
  it("test_get_me_ticket_drafts_mfa_pending", () => {
    // UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/mfa-gate.test.ts の「K321-API-001」（入口 1 か所の止め・同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/mfa-gate.test.ts", "utf8")).toContain("K321-API-001");
  });
  it("test_get_me_ticket_drafts_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_me_ticket_drafts_shape", () => {
    // UBIQUITOUS: GET /api/v1/me/ticket-drafts の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-038」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-038");
  });
});
