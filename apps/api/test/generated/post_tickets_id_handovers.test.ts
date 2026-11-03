// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。POST /api/v1/tickets/:id/handovers
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
import { args } from "../args.js";

const e = endpointOf("createTicketHandover");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("POST /api/v1/tickets/:id/handovers", () => {
  it("not_implemented_501", async () => {
    // まだ作っていない口は、正しい役の人が呼んでも 501 で止まり、何も書かない（fail-closed・D-128.113）
    const who = e.auth === "ops" ? "ops" : "boss";
    if (e.auth === "public" || e.auth === "client" || e.auth === "device") return;
    const before = await h.count("audit_events");
    const r = await h.call(e, who, { ...(e.path.includes(":id") ? { id: "0193c5a0-0000-7000-8000-000000000000" } : {}), ...(e.method === "POST" || e.method === "PATCH" ? { body: {} } : {}) });
    expect(r.status).toBe(501);
    expect(await h.count("audit_events")).toBe(before);
  });
  it.todo("test_post_tickets_id_handovers_ok（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_post_tickets_id_handovers_ok_2（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_post_tickets_id_handovers_ok_3（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_post_tickets_id_handovers_ok_4（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_post_tickets_id_handovers_rejected_401（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_post_tickets_id_handovers_rejected_403（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_post_tickets_id_handovers_not_found（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_post_tickets_id_handovers_rejected_422（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_post_tickets_id_handovers_rejected_422_2（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_post_tickets_id_handovers_rate_limited（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_post_tickets_id_handovers_shape（まだ作っていない口。作ったら本物の試験になる）");
});
