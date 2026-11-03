// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。GET /api/v1/notices
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
import { args } from "../args.js";

const e = endpointOf("listNotices");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("GET /api/v1/notices", () => {
  it("test_get_notices_ok", async () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/notices が「お知らせと稼働状況を見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    const who = e.auth === "ops" ? "ops" : "boss"; const r = await h.call(e, who, await args(h, e, who)); expect([200, 201]).toContain(r.status); const b = (await r.json()) as { data: unknown }; expect(b.data).toBeDefined(); if (e.kind === "create") expect((b.data as { id: string }).id).toBeTruthy();
  });
  it("test_get_notices_rejected_401", async () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    const a = await args(h, e, "boss"); const before = await h.count(e.table); const r = await h.call(e, "anon", a); expect(r.status).toBe(e.auth === "public" ? 200 : 401); if (e.auth !== "public") { expect(((await r.json()) as { code: string }).code).toBe("UNAUTHENTICATED"); expect(await h.count(e.table)).toBe(before); }
  });
  it("test_get_notices_rejected_403", async () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    const a = await args(h, e, e.auth === "ops" ? "ops" : "boss"); const before = await h.count(e.table); const who = e.auth === "ops" ? "boss" : e.kind === "list" || e.kind === "get" ? "opsB" : "staff"; const r = await h.call(e, who, a); expect([403, 404]).toContain(r.status); expect(await h.count(e.table)).toBe(before);
  });
  it("test_get_notices_rate_limited", async () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    const who = e.auth === "ops" ? "ops" : "boss"; h.limits["listNotices"] = 2; const a = await args(h, e, who); await h.call(e, who, a); await h.call(e, who, a); const before = await h.count(e.table); const r = await h.call(e, who, a); expect(r.status).toBe(429); const b = (await r.json()) as { code: string; retry_after_sec: number }; expect(b.code).toBe("RATE_LIMITED"); expect(b.retry_after_sec).toBeGreaterThan(0); expect(await h.count(e.table)).toBe(before); delete h.limits["listNotices"];
  });
});
