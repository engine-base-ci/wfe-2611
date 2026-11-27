// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/ticket_draft_conversations/:id/messages
// 作る画面の会話に言うのは、会話の持ち主・種類・PC・欄の中身で答えが変わる。生成の試験の種では作れない（K-774）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/ticket_draft_conversations/:id/messages", () => {
  it("test_post_ticket_draft_conversations_id_messages_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/ticket_draft_conversations/:id/messages が「話す・資料を付ける・許可に答える」として呼ばれたとき THEN Kaname は「会話を残す」を行い 2xx を返す（自動側：答える・成果物を書き出す）
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-006");
  });
  // 当てはまらない（チケットを作るのは作る口 createTicket（K-437）。この口は作る画面の右の会話を始める・言うだけで、チケットも番号も作らない）：EVENT-DRIVEN: WHEN POST /api/v1/ticket_draft_conversations/:id/messages が「種別を選び、題名・責任者・期限・目的・完了の条件を書く」として呼ばれたとき THEN Kaname は「番号（グループの頭文字＋連番）を振る・版を残す」を行い 2xx を返す（自動側：ルールを当てて既定値を入れる）
  it.todo("test_post_ticket_draft_conversations_id_messages_ok_2");
  it("test_post_ticket_draft_conversations_id_messages_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-020");
  });
  it("test_post_ticket_draft_conversations_id_messages_rejected_403", () => {
    // UNWANTED: IF 停止された人が作る画面の会話を始める・言うなら、Kaname は 403 を返し、何も作らない
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-021");
  });
  it("test_post_ticket_draft_conversations_id_messages_not_found", () => {
    // UNWANTED: IF 自分の会話でないか無い会話に言うなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-013");
  });
  it("test_post_ticket_draft_conversations_id_messages_conflict", () => {
    // UNWANTED: IF つながっている自分の PC が無いなら、Kaname は 409 と E-TALK-060 を返し、行も仕事も作らない
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-012");
  });
  it("test_post_ticket_draft_conversations_id_messages_rejected_422", () => {
    // UNWANTED: IF 言う体の形が契約に合わないなら、Kaname は 422 と欄の名前を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-010");
  });
  it("test_post_ticket_draft_conversations_id_messages_rejected_403_2", () => {
    // UNWANTED: IF チケットを作る権限が無い人が作る画面の会話を始める・言うなら、Kaname は 403 と E-TALK-062 を返し、何も作らない
    // 本物の試験：apps/api/test/features/F5/talk-draft-perm.test.ts の「K782-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft-perm.test.ts", "utf8")).toContain("K782-API-002");
  });
  it("test_post_ticket_draft_conversations_id_messages_conflict_2", () => {
    // UNWANTED: IF 作る画面の会話でない会話に言うなら、Kaname は 409 と E-TALK-061 を返し、何も積まない
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-014");
  });
  it("test_post_ticket_draft_conversations_id_messages_conflict_3", () => {
    // UNWANTED: IF 1 つの会話で待っている仕事が 20 あるなら、Kaname は 409 と E-TALK-012 を返し、21 個目を積まない
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-023」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-023");
  });
  it("test_post_ticket_draft_conversations_id_messages_session_unresolved", () => {
    // UNWANTED: IF 作る画面の会話を始める・言う DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-017");
  });
  it("test_post_ticket_draft_conversations_id_messages_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_ticket_draft_conversations_id_messages_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-020");
  });
  // 当てはまらない（この口はサーバーの外を呼ばない（DB に会話・人の言葉の行・待っている仕事を書くだけ。AI を動かすのは仕事を取りに来る本人の PC・D-097））：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_ticket_draft_conversations_id_messages_upstream_failed");
  it("test_post_ticket_draft_conversations_id_messages_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_ticket_draft_conversations_id_messages_mfa_pending");
  it("test_post_ticket_draft_conversations_id_messages_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ticket_draft_conversations_id_messages_shape", () => {
    // UBIQUITOUS: POST /api/v1/ticket_draft_conversations/:id/messages の副作用は関門 C2・C3・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/talk-draft.test.ts の「K774-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-draft.test.ts", "utf8")).toContain("K774-API-006");
  });
});
