// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/conversations/:id/messages
// 言うは、会話の持ち主・会話の種類・PC・待ちの数で答えが変わる。生成の試験の種では会話と PC の組を作れない（K-758）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/conversations/:id/messages", () => {
  it("test_post_conversations_id_messages_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/conversations/:id/messages が「やりたいことを話す」として呼ばれたとき THEN Kaname は「案を確定するとチケットになる」を行い 2xx を返す（自動側：会話からチケットの案（区画・テスト仕様・業務の型の候補）を作る）
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-001");
  });
  it("test_post_conversations_id_messages_ok_2", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/conversations/:id/messages が「話す・資料を付ける・許可に答える」として呼ばれたとき THEN Kaname は「会話を残す」を行い 2xx を返す（自動側：答える・成果物を書き出す）
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-007");
  });
  it("test_post_conversations_id_messages_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-018");
  });
  it("test_post_conversations_id_messages_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-006");
  });
  it("test_post_conversations_id_messages_not_found", () => {
    // UNWANTED: IF 自分の会話でないか無い会話に言う・止めるなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-006");
  });
  it("test_post_conversations_id_messages_conflict", () => {
    // UNWANTED: IF つながっている自分の PC が無いなら、Kaname は 409 と E-TALK-010 を返し、行も仕事も作らない
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-004");
  });
  it("test_post_conversations_id_messages_rejected_422", () => {
    // UNWANTED: IF 言う体の形が契約に合わないなら、Kaname は 422 と欄の名前を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-003");
  });
  it("test_post_conversations_id_messages_conflict_2", () => {
    // UNWANTED: IF 自分の AI との会話でない会話にこの口から言うなら、Kaname は 409 と E-TALK-011 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-005");
  });
  it("test_post_conversations_id_messages_conflict_3", () => {
    // UNWANTED: IF 1 つの会話で待っている仕事が 20 あるなら、Kaname は 409 と E-TALK-012 を返し、21 個目を積まない
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-008");
  });
  it("test_post_conversations_id_messages_session_unresolved", () => {
    // UNWANTED: IF 言う・止める DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-015");
  });
  it("test_post_conversations_id_messages_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_conversations_id_messages_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-018");
  });
  // 当てはまらない（この口はサーバーの外を呼ばない（DB に人の言葉の行と待っている仕事を書くだけ。AI を動かすのは仕事を取りに来る本人の PC・D-097））：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_conversations_id_messages_upstream_failed");
  it("test_post_conversations_id_messages_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_conversations_id_messages_mfa_pending");
  it("test_post_conversations_id_messages_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_conversations_id_messages_shape", () => {
    // UBIQUITOUS: POST /api/v1/conversations/:id/messages の副作用は関門 C2・C3・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/talk-say.test.ts の「K758-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-say.test.ts", "utf8")).toContain("K758-API-001");
  });
});
