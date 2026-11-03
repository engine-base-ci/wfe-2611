// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。DELETE /api/v1/members/:id
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
import { args } from "../args.js";

const e = endpointOf("removeMember");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("DELETE /api/v1/members/:id", () => {
  it("test_delete_members_id_ok", async () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/members/:id が「担当中のチケットと承認を引き継いでから抜けさせる」として呼ばれたとき THEN Kaname は「セッションを失効」を行い 2xx を返す
    const who = e.auth === "ops" ? "ops" : "boss"; const r = await h.call(e, who, await args(h, e, who)); expect([200, 201]).toContain(r.status); const b = (await r.json()) as { data: unknown }; expect(b.data).toBeDefined(); if (e.kind === "create") expect((b.data as { id: string }).id).toBeTruthy();
  });
  it("test_delete_members_id_rejected_401", async () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    const a = await args(h, e, "boss"); const before = await h.count(e.table); const r = await h.call(e, "anon", a); expect(r.status).toBe(e.auth === "public" ? 200 : 401); if (e.auth !== "public") { expect(((await r.json()) as { code: string }).code).toBe("UNAUTHENTICATED"); expect(await h.count(e.table)).toBe(before); }
  });
  it("test_delete_members_id_rejected_403", async () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    const a = await args(h, e, e.auth === "ops" ? "ops" : "boss"); const before = await h.count(e.table); const who = e.auth === "ops" ? "boss" : e.kind === "list" || e.kind === "get" ? "opsB" : "staff"; const r = await h.call(e, who, a); expect([403, 404]).toContain(r.status); expect(await h.count(e.table)).toBe(before);
  });
  it("test_delete_members_id_not_found", async () => {
    // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
    if (e.kind === "list" || e.kind === "create") return; const who = e.auth === "ops" ? "ops" : "boss"; const r = await h.call(e, who, { ...(await args(h, e, who)), id: "0193c5a0-0000-7000-8000-000000000000" }); expect(r.status).toBe(404);
  });
  it("test_delete_members_id_rate_limited", async () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    const who = e.auth === "ops" ? "ops" : "boss"; h.limits["removeMember"] = 2; const a = await args(h, e, who); await h.call(e, who, a); await h.call(e, who, a); const before = await h.count(e.table); const r = await h.call(e, who, a); expect(r.status).toBe(429); const b = (await r.json()) as { code: string; retry_after_sec: number }; expect(b.code).toBe("RATE_LIMITED"); expect(b.retry_after_sec).toBeGreaterThan(0); expect(await h.count(e.table)).toBe(before); delete h.limits["removeMember"];
  });
  it("test_delete_members_id_rejected_422", async () => {
    // UNWANTED: IF 抜ける人の依存（タスク・承認待ち・AI社員・層の長）に自分のAIが引き継ぎ先の案を出せない、または引き継ぎ先が未決のまま「無効にする」を押した THEN Kaname は「引き継ぎ先が決まっていないものがあります。決めるまで無効にできません」を返し、自分のAIの案を全部採る／1 件ずつ決める（E-ACT-035）
    const who = e.auth === "ops" ? "ops" : "boss"; if (e.kind === "list") { const r = await h.call(e, who, { query: { limit: "0" } }); expect(r.status).toBe(422); return; } if (e.kind === "get" || e.kind === "delete") { const r = await h.call(e, who, { id: "not-a-uuid" }); expect(r.status).toBe(422); return; } const a = await args(h, e, who); const before = await h.count(e.table); const r = await h.call(e, who, { ...a, body: { __unknown_field: "x", id: 12345 } }); expect(r.status).toBe(422); const b = (await r.json()) as { code: string; details: unknown[] }; expect(b.code).toBe("VALIDATION_ERROR"); expect(b.details.length).toBeGreaterThan(0); expect(await h.count(e.table)).toBe(before); const r2 = await h.call(e, who, { ...a, body: "{not json" }); expect(r2.status).toBe(422);
  });
  it("test_delete_members_id_shape", async () => {
    // UBIQUITOUS: DELETE /api/v1/members/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    const who = e.auth === "ops" ? "ops" : "boss"; const r = await h.call(e, who, await args(h, e, who)); const b = (await r.json()) as Record<string, unknown>; if (r.status < 300) { expect(b).toHaveProperty("data"); if (e.kind === "list") { expect(Array.isArray(b["data"])).toBe(true); expect(b["meta"]).toHaveProperty("limit"); } } else { expect(b).toHaveProperty("error"); expect(b).toHaveProperty("code"); }
  });
});
