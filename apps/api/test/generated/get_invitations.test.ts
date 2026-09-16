// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。GET /api/v1/invitations
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
import { args } from "../args.js";

const e = endpointOf("getInvitations");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("GET /api/v1/invitations", () => {
  it("test_get_invitations_ok", async () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/invitations が「招待リンクを押して名前を入れる」として呼ばれたとき THEN Kaname は「メンバーを作り、スコープを結ぶ」を行い 2xx を返す（自動側：自分のAIが見える範囲を説明する）
    const who = e.auth === "ops" ? "ops" : "boss";
    const r = await h.call(e, who, await args(h, e, who));
    expect([200, 201]).toContain(r.status);
    const b = (await r.json()) as { data: unknown };
    expect(b.data).toBeDefined();
    if (e.kind === "create") expect((b.data as { id: string }).id).toBeTruthy();
  });
  it("test_get_invitations_rate_limited", async () => {
    // UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
    const who = e.auth === "ops" ? "ops" : "boss";
    h.limits["getInvitations"] = 2;
    const a = await args(h, e, who);
    await h.call(e, who, a);
    await h.call(e, who, a);
    const before = await h.count(e.table);
    const r = await h.call(e, who, a);
    expect(r.status).toBe(429);
    const b = (await r.json()) as { code: string; retry_after_sec: number };
    expect(b.code).toBe("RATE_LIMITED");
    expect(b.retry_after_sec).toBeGreaterThan(0);
    expect(await h.count(e.table)).toBe(before);
    delete h.limits["getInvitations"];
  });
  it("test_get_invitations_upstream_failed", async () => {
    // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
    const who = e.auth === "ops" ? "ops" : "boss";
    const a = await args(h, e, who);
    h.hooks["getInvitations"] = {
      effect: async () => ({ status: "failed", reason: "外部が完了信号を出さなかった", handoff: "人が確認する" }),
    };
    const before = await h.count(e.table);
    const r = await h.call(e, who, a);
    expect(r.status).toBe(502);
    const b = (await r.json()) as { code: string; handoff: string };
    expect(b.code).toBe("EXTERNAL_FAILED");
    expect(b.handoff).toBeTruthy();
    expect(await h.count(e.table)).toBe(before);
    delete h.hooks["getInvitations"];
  });
  it("test_get_invitations_shape", async () => {
    // UBIQUITOUS: GET /api/v1/invitations の副作用は関門 C2・C3 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    const who = e.auth === "ops" ? "ops" : "boss";
    const r = await h.call(e, who, await args(h, e, who));
    const b = (await r.json()) as Record<string, unknown>;
    if (r.status < 300) {
      expect(b).toHaveProperty("data");
      if (e.kind === "list") {
        expect(Array.isArray(b["data"])).toBe(true);
        expect(b["meta"]).toHaveProperty("limit");
      }
    } else {
      expect(b).toHaveProperty("error");
      expect(b).toHaveProperty("code");
    }
  });
});
