// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。GET /api/v1/knowledge_pages/:id
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
import { args } from "../args.js";

const e = endpointOf("getKnowledgePage");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("GET /api/v1/knowledge_pages/:id", () => {
  it("not_implemented_501", async () => {
    // まだ作っていない口は、正しい役の人が呼んでも 501 で止まり、何も書かない（fail-closed・D-128.113）
    const who = e.auth === "ops" ? "ops" : "boss";
    if (e.auth === "public" || e.auth === "client" || e.auth === "device") return;
    const before = await h.count("audit_events");
    const r = await h.call(e, who, { ...(e.path.includes(":id") ? { id: "0193c5a0-0000-7000-8000-000000000000" } : {}), ...(e.method === "POST" || e.method === "PATCH" ? { body: {} } : {}) });
    expect(r.status).toBe(501);
    expect(await h.count("audit_events")).toBe(before);
  });
  it.todo("test_get_knowledge_pages_id_ok（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_get_knowledge_pages_id_rejected_401（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_get_knowledge_pages_id_rejected_403（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_get_knowledge_pages_id_not_found（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_get_knowledge_pages_id_rate_limited（まだ作っていない口。作ったら本物の試験になる）");
  it.todo("test_get_knowledge_pages_id_shape（まだ作っていない口。作ったら本物の試験になる）");
});
