// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。POST /api/v1/bridge/jobs/:id/conversation-entries
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";

const e = endpointOf("mirrorConversationEntries");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("POST /api/v1/bridge/jobs/:id/conversation-entries", () => {
  it("not_implemented_501", async () => {
    // まだ作っていない口は、正しい役の人が呼んでも 501 で止まり、何も書かない（fail-closed・D-128.113）
    const who = e.auth === "ops" ? "ops" : "boss";
    if (e.auth === "public" || e.auth === "client" || e.auth === "device") return;
    const before = await h.count("audit_events");
    const r = await h.call(e, who, { ...(e.path.includes(":id") ? { id: "0193c5a0-0000-7000-8000-000000000000" } : {}), ...(e.method === "POST" || e.method === "PATCH" ? { body: {} } : {}) });
    expect(r.status).toBe(501);
    expect(await h.count("audit_events")).toBe(before);
  });
  // まだ作っていない口。作ったら本物の試験になる：EVENT-DRIVEN: WHEN POST /api/v1/bridge/jobs/:id/conversation-entries が「話す・資料を付ける・許可に答える」として呼ばれたとき THEN Kaname は「会話を残す」を行い 2xx を返す（自動側：答える・成果物を書き出す）
  it.todo("test_post_bridge_jobs_id_conversation_entries_ok");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_post_bridge_jobs_id_conversation_entries_rejected_401");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_post_bridge_jobs_id_conversation_entries_rejected_403");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
  it.todo("test_post_bridge_jobs_id_conversation_entries_not_found");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
  it.todo("test_post_bridge_jobs_id_conversation_entries_rejected_422");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_bridge_jobs_id_conversation_entries_rejected_422_2");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_bridge_jobs_id_conversation_entries_rate_limited");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_bridge_jobs_id_conversation_entries_upstream_failed");
  // まだ作っていない口。作ったら本物の試験になる：UBIQUITOUS: POST /api/v1/bridge/jobs/:id/conversation-entries の副作用は関門 C2・C3・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_post_bridge_jobs_id_conversation_entries_shape");
});
