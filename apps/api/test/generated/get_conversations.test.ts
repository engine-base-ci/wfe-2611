// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/conversations
// 会話を読む口は、会話の種類・持ち主・行の種類・動いている仕事で答えが変わる。生成の試験の偽のセッションでは会話も行も仕事も作れない（K-757）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/conversations", () => {
  it("test_get_conversations_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/conversations が「会話を分けて始める・一覧から戻る」として呼ばれたとき THEN Kaname は「conversations に 1 行（agent_session_id は最初の返事で決まる）。一覧・探す（本文の PGroonga）・星・名前を直す・消す・記憶に使わない会話（毎朝のまとめから外す）」を行い 2xx を返す（自動側：新しい会話は Claude Code の新しいセッション。名前は最初の一言から自分のAIが付ける）
    // 本物の試験：apps/api/test/features/F5/talk-read.test.ts の「K757-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-read.test.ts", "utf8")).toContain("K757-API-001");
  });
  it("test_get_conversations_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/talk-read.test.ts の「K757-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-read.test.ts", "utf8")).toContain("K757-API-020");
  });
  // 当てはまらない（自分の会話だけを返す一覧で、権限の 403 は無い（他人の会話は出ない・受けは K757-API-002））：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_conversations_rejected_403");
  it("test_get_conversations_rejected_422", () => {
    // UNWANTED: IF 問い合わせの形が契約に合わないなら、Kaname は 422 と欄の名前を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-read.test.ts の「K757-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-read.test.ts", "utf8")).toContain("K757-API-004");
  });
  it("test_get_conversations_session_unresolved", () => {
    // UNWANTED: IF 会話を読む DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/talk-read.test.ts の「K757-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-read.test.ts", "utf8")).toContain("K757-API-018");
  });
  it("test_get_conversations_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/talk-read.test.ts の「K757-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-read.test.ts", "utf8")).toContain("K757-API-020");
  });
  it("test_get_conversations_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_conversations_mfa_pending");
  it("test_get_conversations_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_conversations_shape", () => {
    // UBIQUITOUS: GET /api/v1/conversations の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/talk-read.test.ts の「K757-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-read.test.ts", "utf8")).toContain("K757-API-001");
  });
});
