// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/tickets
// K-60 の口は本物の振る舞い（hooks）と、種別の必須の区画・期限が今日より前でない・同じ会社の確かめが要る。生成の試験の土台（表の種の入力）では確かめられない（K-60）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/tickets", () => {
  it("test_post_tickets_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/tickets が「過去のチケットを選んで複製し、日付と値だけ直す」として呼ばれたとき THEN Kaname は「新しい番号で写しを作る（元へのつながりを残す）」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-001");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F4/create-ticket.test.ts）：EVENT-DRIVEN: WHEN POST /api/v1/tickets が「見本（自分宛にメールを送る など）を開いて AI に任せてみる」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：見本のチケットを最初から並べる）
  it.todo("test_post_tickets_ok_2");
  it("test_post_tickets_ok_3", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/tickets が「種別を選び、題名・責任者・期限・目的・完了の条件を書く」として呼ばれたとき THEN Kaname は「番号（グループの頭文字＋連番）を振る・版を残す」を行い 2xx を返す（自動側：ルールを当てて既定値を入れる）
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-001");
  });
  it("test_post_tickets_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-042");
  });
  it("test_post_tickets_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-005");
  });
  it("test_post_tickets_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-008");
  });
  it("test_post_tickets_rejected_422_2", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-025");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F4/create-ticket.test.ts）：UNWANTED: IF 親のチケットが無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、チケットを作らない
  it.todo("test_post_tickets_not_found");
  it("test_post_tickets_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-031」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-031");
  });
  it("test_post_tickets_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-043」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-043");
  });
  it("test_post_tickets_shape", () => {
    // UBIQUITOUS: POST /api/v1/tickets の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-001");
  });
});
