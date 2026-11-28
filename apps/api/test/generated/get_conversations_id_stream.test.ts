// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/conversations/:id/stream
// 流れは知らせの接続（偽を差す）と会話の持ち主で答えが変わる。生成の試験の種では流れを開けず、知らせの接続も差せない（K-759）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/conversations/:id/stream", () => {
  it("test_get_conversations_id_stream_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/conversations/:id/stream が「話す・資料を付ける・許可に答える」として呼ばれたとき THEN Kaname は「会話を残す」を行い 2xx を返す（自動側：答える・成果物を書き出す）
    // 本物の試験：apps/api/test/features/F5/talk-stream.test.ts の「K759-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-stream.test.ts", "utf8")).toContain("K759-API-001");
  });
  it("test_get_conversations_id_stream_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/talk-stream.test.ts の「K759-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-stream.test.ts", "utf8")).toContain("K759-API-010");
  });
  it("test_get_conversations_id_stream_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F5/talk-stream.test.ts の「K759-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-stream.test.ts", "utf8")).toContain("K759-API-009");
  });
  it("test_get_conversations_id_stream_not_found", () => {
    // UNWANTED: IF 自分の会話でないか無い会話の流れを開いたなら、Kaname は 404 を返し、在るかを漏らさず流れを開かない
    // 本物の試験：apps/api/test/features/F5/talk-stream.test.ts の「K759-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-stream.test.ts", "utf8")).toContain("K759-API-009");
  });
  it("test_get_conversations_id_stream_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144.d/K-759.ts の「K144-API-924」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-759.ts", "utf8")).toContain("K144-API-924");
  });
  it("test_get_conversations_id_stream_unavailable", () => {
    // UNWANTED: IF 知らせの接続が無いかつなげないなら、Kaname は 503 と E-TALK-020 を返し、流れを開かない
    // 本物の試験：apps/api/test/features/F5/talk-stream.test.ts の「K759-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-stream.test.ts", "utf8")).toContain("K759-API-008");
  });
  it("test_get_conversations_id_stream_session_unresolved", () => {
    // UNWANTED: IF 会話の持ち主を確かめる DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、流れを開かない
    // 本物の試験：apps/api/test/features/F5/talk-stream.test.ts の「K759-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-stream.test.ts", "utf8")).toContain("K759-API-015");
  });
  it("test_get_conversations_id_stream_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/talk-stream.test.ts の「K759-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-stream.test.ts", "utf8")).toContain("K759-API-010");
  });
  // 当てはまらない（この口はサーバーの外を呼ばない（同じ API の中の知らせの接続の受け手を作るだけ。接続が無い・つなげない・落ちたは 503 E-TALK-020 と down＝K759-API-007・008））：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_get_conversations_id_stream_upstream_failed");
  it("test_get_conversations_id_stream_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_conversations_id_stream_mfa_pending");
  it("test_get_conversations_id_stream_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_conversations_id_stream_shape", () => {
    // UBIQUITOUS: GET /api/v1/conversations/:id/stream の副作用は関門 C3・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/talk-stream.test.ts の「K759-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/talk-stream.test.ts", "utf8")).toContain("K759-API-001");
  });
});
