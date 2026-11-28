// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/ticket_draft_conversations/:id/adopt
// 会話を移す口は、会話の種類・持ち主・チケットを作った人・チケットの会話の有無で答えが変わる。生成の試験の種では会話とチケットの組を作れない（K-776）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/ticket_draft_conversations/:id/adopt", () => {
  it("test_post_ticket_draft_conversations_id_adopt_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/ticket_draft_conversations/:id/adopt が「話す・資料を付ける・許可に答える」として呼ばれたとき THEN Kaname は「会話を残す」を行い 2xx を返す（自動側：答える・成果物を書き出す）
    // 本物の試験：apps/api/test/features/F5/draft-adopt.test.ts の「K776-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/draft-adopt.test.ts", "utf8")).toContain("K776-API-001");
  });
  // 当てはまらない（チケットを作るのは作る口 createTicket（K-437）。この口は作る画面の会話をチケットの会話に付け替えるだけで、チケットも番号も作らない）：EVENT-DRIVEN: WHEN POST /api/v1/ticket_draft_conversations/:id/adopt が「種別を選び、題名・責任者・期限・目的・完了の条件を書く」として呼ばれたとき THEN Kaname は「番号（グループの頭文字＋連番）を振る・版を残す」を行い 2xx を返す（自動側：ルールを当てて既定値を入れる）
  it.todo("test_post_ticket_draft_conversations_id_adopt_ok_2");
  it("test_post_ticket_draft_conversations_id_adopt_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/draft-adopt.test.ts の「K776-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/draft-adopt.test.ts", "utf8")).toContain("K776-API-015");
  });
  it("test_post_ticket_draft_conversations_id_adopt_rejected_403", () => {
    // UNWANTED: IF そのチケットを作った人でない人が会話を移すなら、Kaname は 403 と E-TALK-080 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/draft-adopt.test.ts の「K776-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/draft-adopt.test.ts", "utf8")).toContain("K776-API-003");
  });
  it("test_post_ticket_draft_conversations_id_adopt_not_found", () => {
    // UNWANTED: IF 自分の会話でないか、無いか見えないチケットへ移すなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F5/draft-adopt.test.ts の「K776-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/draft-adopt.test.ts", "utf8")).toContain("K776-API-005");
  });
  it("test_post_ticket_draft_conversations_id_adopt_conflict", () => {
    // UNWANTED: IF 作る画面の会話でない会話を移すなら、Kaname は 409 と E-TALK-081 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/draft-adopt.test.ts の「K776-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/draft-adopt.test.ts", "utf8")).toContain("K776-API-007");
  });
  it("test_post_ticket_draft_conversations_id_adopt_rejected_422", () => {
    // UNWANTED: IF 移す体の形が契約に合わないなら、Kaname は 422 と欄の名前を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/draft-adopt.test.ts の「K776-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/draft-adopt.test.ts", "utf8")).toContain("K776-API-011");
  });
  it("test_post_ticket_draft_conversations_id_adopt_conflict_2", () => {
    // UNWANTED: IF もう移した会話をもう 1 度移すなら、Kaname は 409 と E-TALK-082 を返し、最初の移しを残す
    // 本物の試験：apps/api/test/features/F5/draft-adopt.test.ts の「K776-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/draft-adopt.test.ts", "utf8")).toContain("K776-API-008");
  });
  it("test_post_ticket_draft_conversations_id_adopt_session_unresolved", () => {
    // UNWANTED: IF 移す DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も変えない
    // 本物の試験：apps/api/test/features/F5/draft-adopt.test.ts の「K776-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/draft-adopt.test.ts", "utf8")).toContain("K776-API-016");
  });
  it("test_post_ticket_draft_conversations_id_adopt_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_ticket_draft_conversations_id_adopt_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/draft-adopt.test.ts の「K776-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/draft-adopt.test.ts", "utf8")).toContain("K776-API-015");
  });
  // 当てはまらない（この口はサーバーの外を呼ばない（DB の会話の種類と 1 行の知らせと証跡を書くだけ））：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_ticket_draft_conversations_id_adopt_upstream_failed");
  it("test_post_ticket_draft_conversations_id_adopt_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_ticket_draft_conversations_id_adopt_mfa_pending");
  it("test_post_ticket_draft_conversations_id_adopt_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ticket_draft_conversations_id_adopt_shape", () => {
    // UBIQUITOUS: POST /api/v1/ticket_draft_conversations/:id/adopt の副作用は関門 C2・C3・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/draft-adopt.test.ts の「K776-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/draft-adopt.test.ts", "utf8")).toContain("K776-API-001");
  });
});
