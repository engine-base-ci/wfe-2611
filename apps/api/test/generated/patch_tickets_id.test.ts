// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。PATCH /api/v1/tickets/:id
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
import { args } from "../args.js";

const e = endpointOf("updateTicket");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("PATCH /api/v1/tickets/:id", () => {
  it("not_implemented_501", async () => {
    // まだ作っていない口は、正しい役の人が呼んでも 501 で止まり、何も書かない（fail-closed・D-128.113）
    const who = e.auth === "ops" ? "ops" : "boss";
    if (e.auth === "public" || e.auth === "client" || e.auth === "device") return;
    const before = await h.count("audit_events");
    const r = await h.call(e, who, { ...(e.path.includes(":id") ? { id: "0193c5a0-0000-7000-8000-000000000000" } : {}), ...(e.method === "POST" || e.method === "PATCH" ? { body: {} } : {}) });
    expect(r.status).toBe(501);
    expect(await h.count("audit_events")).toBe(before);
  });
  // まだ作っていない口。作ったら本物の試験になる：EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「責任者・期限・分類・親を決める」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：振り分けの案を出す）
  it.todo("test_patch_tickets_id_ok");
  // まだ作っていない口。作ったら本物の試験になる：EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「印の付いたチケットを開いて手を打つ」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
  it.todo("test_patch_tickets_id_ok_2");
  // まだ作っていない口。作ったら本物の試験になる：EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「理由と再開条件を書いて保留にする」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
  it.todo("test_patch_tickets_id_ok_3");
  // まだ作っていない口。作ったら本物の試験になる：EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「作業の段を動かす」として呼ばれたとき THEN Kaname は「実績時間を記録」を行い 2xx を返す
  it.todo("test_patch_tickets_id_ok_4");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_patch_tickets_id_rejected_401");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_patch_tickets_id_rejected_403");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
  it.todo("test_patch_tickets_id_not_found");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_patch_tickets_id_rejected_422");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_patch_tickets_id_rate_limited");
  // まだ作っていない口。作ったら本物の試験になる：UBIQUITOUS: PATCH /api/v1/tickets/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_patch_tickets_id_shape");
});
