// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/tickets/:id/agent-session/messages
// チケットの会話に言うのは、チケットの権限・PC・会話の有無で答えが変わる。生成の試験の種では作れない（K-763）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/tickets/:id/agent-session/messages", () => {
  it("test_post_tickets_id_agent_session_messages_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/agent-session/messages が「話す・資料を付ける・許可に答える」として呼ばれたとき THEN Kaname は「会話を残す」を行い 2xx を返す（自動側：答える・成果物を書き出す）
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-008");
  });
  // 当てはまらない（許可に答える・許可のモードを選ぶ道はこの口に作らない（体は text だけ・D-153.16）。許可の答えは承認の口（K-162）が持つ）：EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/agent-session/messages が「許可に答える・許可のモードを選ぶ」として呼ばれたとき THEN Kaname は「答えは bridge_job_events と証跡に。「いつも」は permission_rules に。全部許可は本人が選んだときだけ・既定にしない」を行い 2xx を返す（自動側：Claude Code の許可の問いを会話に出す（今回だけ／いつも／しない＋一言）。モードは Claude Code の公式の選択肢をそのまま渡す）
  it.todo("test_post_tickets_id_agent_session_messages_ok_2");
  it("test_post_tickets_id_agent_session_messages_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-018");
  });
  it("test_post_tickets_id_agent_session_messages_rejected_403", () => {
    // UNWANTED: IF チケットが見えるが書けない人が言うなら、Kaname は 403 を返し、会話も仕事も作らない
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-014");
  });
  it("test_post_tickets_id_agent_session_messages_not_found", () => {
    // UNWANTED: IF 見えないか無いチケットの会話を開く・言うなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-014");
  });
  it("test_post_tickets_id_agent_session_messages_conflict", () => {
    // UNWANTED: IF つながっている自分の PC が無いなら、Kaname は 409 と E-TALK-050 を返し、作りかけの会話ごと戻して何も残さない
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-013");
  });
  it("test_post_tickets_id_agent_session_messages_rejected_422", () => {
    // UNWANTED: IF 言う体の形が契約に合わないなら、Kaname は 422 と欄の名前を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-012");
  });
  it("test_post_tickets_id_agent_session_messages_conflict_2", () => {
    // UNWANTED: IF 1 つの会話で待っている仕事が 20 あるなら、Kaname は 409 と E-TALK-012 を返し、21 個目を積まない
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-027」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-027");
  });
  it("test_post_tickets_id_agent_session_messages_session_unresolved", () => {
    // UNWANTED: IF チケットの会話を読む・言う DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-019");
  });
  it("test_post_tickets_id_agent_session_messages_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_tickets_id_agent_session_messages_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-018");
  });
  // 当てはまらない（この口はサーバーの外を呼ばない（DB に会話・人の言葉の行・待っている仕事を書く／読むだけ。AI を動かすのは仕事を取りに来る本人の PC・D-097））：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_tickets_id_agent_session_messages_upstream_failed");
  it("test_post_tickets_id_agent_session_messages_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_tickets_id_agent_session_messages_mfa_pending");
  it("test_post_tickets_id_agent_session_messages_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_tickets_id_agent_session_messages_shape", () => {
    // UBIQUITOUS: POST /api/v1/tickets/:id/agent-session/messages の副作用は関門 C2・C3・C4・C5 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-008");
  });
});
