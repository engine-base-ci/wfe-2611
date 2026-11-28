// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/bridge/jobs/:id/conversation-entries
// 写しは仕事を受け取った PC・仕事の会話・同じ id の有無で答えが変わる。生成の試験の種では会話つきの動いている仕事を作れない（K-760）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/bridge/jobs/:id/conversation-entries", () => {
  it("test_post_bridge_jobs_id_conversation_entries_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/bridge/jobs/:id/conversation-entries が「話す・資料を付ける・許可に答える」として呼ばれたとき THEN Kaname は「会話を残す」を行い 2xx を返す（自動側：答える・成果物を書き出す）
    // 本物の試験：apps/api/test/features/F5/talk-mirror.test.ts の「K760-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-mirror.test.ts", "utf8")).toContain("K760-API-001");
  });
  it("test_post_bridge_jobs_id_conversation_entries_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/talk-mirror.test.ts の「K760-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-mirror.test.ts", "utf8")).toContain("K760-API-018");
  });
  it("test_post_bridge_jobs_id_conversation_entries_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F5/talk-mirror.test.ts の「K760-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-mirror.test.ts", "utf8")).toContain("K760-API-008");
  });
  it("test_post_bridge_jobs_id_conversation_entries_not_found", () => {
    // UNWANTED: IF 受け取っていない仕事か消した会話に写そうとしたなら、Kaname は 404 を返し、在るかを漏らさず何も写さない
    // 本物の試験：apps/api/test/features/F5/talk-mirror.test.ts の「K760-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-mirror.test.ts", "utf8")).toContain("K760-API-008");
  });
  it("test_post_bridge_jobs_id_conversation_entries_conflict", () => {
    // UNWANTED: IF 写す仕事に会話が無いなら、Kaname は 409 と E-TALK-030 を返し、何も写さない
    // 本物の試験：apps/api/test/features/F5/talk-mirror.test.ts の「K760-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-mirror.test.ts", "utf8")).toContain("K760-API-009");
  });
  it("test_post_bridge_jobs_id_conversation_entries_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F5/talk-mirror.test.ts の「K760-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-mirror.test.ts", "utf8")).toContain("K760-API-007");
  });
  it("test_post_bridge_jobs_id_conversation_entries_session_unresolved", () => {
    // UNWANTED: IF 写しを書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も写さない
    // 本物の試験：apps/api/test/features/F5/talk-mirror.test.ts の「K760-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-mirror.test.ts", "utf8")).toContain("K760-API-012");
  });
  it("test_post_bridge_jobs_id_conversation_entries_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_bridge_jobs_id_conversation_entries_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/talk-mirror.test.ts の「K760-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-mirror.test.ts", "utf8")).toContain("K760-API-019");
  });
  // 当てはまらない（写しはサーバーの外を呼ばない（PC から届いた文を DB に写すだけ・D-112）。PC が完了信号を出さない・写しが遅れることは取り戻し（listMirrorTargets・K760-BR-003）が拾う）：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_bridge_jobs_id_conversation_entries_upstream_failed");
  it("test_post_bridge_jobs_id_conversation_entries_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_bridge_jobs_id_conversation_entries_shape", () => {
    // UBIQUITOUS: POST /api/v1/bridge/jobs/:id/conversation-entries の副作用は関門 C2・C3・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/talk-mirror.test.ts の「K760-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-mirror.test.ts", "utf8")).toContain("K760-API-001");
  });
});
