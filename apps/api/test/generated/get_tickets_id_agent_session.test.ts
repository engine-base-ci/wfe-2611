// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/tickets/:id/agent-session
// チケットの会話は、会話の有無・人・チケットの権限で答えが変わる。生成の試験の種では会話と PC を作れない（K-763）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/tickets/:id/agent-session", () => {
  it("test_get_tickets_id_agent_session_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/tickets/:id/agent-session が「話す・資料を付ける・許可に答える」として呼ばれたとき THEN Kaname は「会話を残す」を行い 2xx を返す（自動側：答える・成果物を書き出す）
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-002");
  });
  it("test_get_tickets_id_agent_session_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-018");
  });
  // 当てはまらない（読む口はチケットが見えれば通り、見えなければ 404（行の守り・在るかを漏らさない）。見えるのに読めない 403 は無い（受けは K763-API-006・007））：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_tickets_id_agent_session_rejected_403");
  it("test_get_tickets_id_agent_session_not_found", () => {
    // UNWANTED: IF 見えないか無いチケットの会話を開く・言うなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-006");
  });
  it("test_get_tickets_id_agent_session_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144.d/K-763.ts の「K144-API-927」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-763.ts", "utf8")).toContain("K144-API-927");
  });
  it("test_get_tickets_id_agent_session_session_unresolved", () => {
    // UNWANTED: IF チケットの会話を読む・言う DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-019");
  });
  it("test_get_tickets_id_agent_session_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-018");
  });
  // 当てはまらない（この口はサーバーの外を呼ばない（DB に会話・人の言葉の行・待っている仕事を書く／読むだけ。AI を動かすのは仕事を取りに来る本人の PC・D-097））：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_get_tickets_id_agent_session_upstream_failed");
  it("test_get_tickets_id_agent_session_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_tickets_id_agent_session_mfa_pending");
  it("test_get_tickets_id_agent_session_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_tickets_id_agent_session_shape", () => {
    // UBIQUITOUS: GET /api/v1/tickets/:id/agent-session の副作用は関門 C3・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/talk-ticket.test.ts の「K763-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-ticket.test.ts", "utf8")).toContain("K763-API-002");
  });
});
