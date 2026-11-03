// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。GET /api/v1/auth/invitations/:token
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";

const e = endpointOf("getInvitation");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("GET /api/v1/auth/invitations/:token", () => {
  it("not_implemented_501", async () => {
    // まだ作っていない口は、正しい役の人が呼んでも 501 で止まり、何も書かない（fail-closed・D-128.113）
    const who = e.auth === "ops" ? "ops" : "boss";
    if (e.auth === "public" || e.auth === "client" || e.auth === "device") return;
    const before = await h.count("audit_events");
    const r = await h.call(e, who, { ...(e.path.includes(":id") ? { id: "0193c5a0-0000-7000-8000-000000000000" } : {}), ...(e.method === "POST" || e.method === "PATCH" ? { body: {} } : {}) });
    expect(r.status).toBe(501);
    expect(await h.count("audit_events")).toBe(before);
  });
  // まだ作っていない口。作ったら本物の試験になる：EVENT-DRIVEN: WHEN GET /api/v1/auth/invitations/:token が「招待の中身（会社・層・役割）を見て参加する」として呼ばれたとき THEN Kaname は「テナントへの所属を作り、層と権限の束を結ぶ」を行い 2xx を返す
  it.todo("test_get_auth_invitations_token_ok");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_auth_invitations_token_rate_limited");
  // まだ作っていない口。作ったら本物の試験になる：UBIQUITOUS: GET /api/v1/auth/invitations/:token の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_get_auth_invitations_token_shape");
});
