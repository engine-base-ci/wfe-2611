// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。GET /api/v1/members
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
import { args } from "../args.js";

const e = endpointOf("listMembers");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("GET /api/v1/members", () => {
  it("test_get_members_ok", async () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/members が「責任者・期限・分類・親を決める」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：振り分けの案を出す）
    const who = e.auth === "ops" ? "ops" : "boss"; const r = await h.call(e, who, await args(h, e, who)); expect([200, 201]).toContain(r.status); const b = (await r.json()) as { data: unknown }; expect(b.data).toBeDefined(); if (e.kind === "create") expect((b.data as { id: string }).id).toBeTruthy();
  });
  it("test_get_members_rejected_401", async () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    const a = await args(h, e, "boss"); const before = await h.count(e.table); const r = await h.call(e, "anon", a); expect(r.status).toBe(e.auth === "public" ? 200 : 401); if (e.auth !== "public") { expect(((await r.json()) as { code: string }).code).toBe("UNAUTHENTICATED"); expect(await h.count(e.table)).toBe(before); }
  });
  it("test_get_members_rejected_403", async () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    if (e.kind === "create" && e.perm.word === "self") { const a = await args(h, e, "staff"); const r = await h.call(e, "staff", a); expect([201, 403, 404]).toContain(r.status); if (r.status === 201) { const d = ((await r.json()) as { data: Record<string, unknown> }).data; for (const c of ["owner_member_id", "opened_by_member_id", "member_id", "requested_by", "uploaded_by"]) if (c in d) expect(d[c], "持ち主は呼んだ人").toBe(h.S.staffA); } return; } const a = await args(h, e, e.auth === "ops" ? "ops" : "boss"); const before = await h.count(e.table); const who = e.auth === "ops" ? "boss" : e.kind === "list" || e.kind === "get" ? "opsB" : "staff"; const r = await h.call(e, who, a); expect([403, 404]).toContain(r.status); expect(await h.count(e.table)).toBe(before);
  });
  it("test_get_members_rejected_422", async () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    const who = e.auth === "ops" ? "ops" : "boss"; if (e.kind === "list") { const r = await h.call(e, who, { query: { limit: "0" } }); expect(r.status).toBe(422); return; } if (e.kind === "get" || e.kind === "delete") { const r = await h.call(e, who, { id: "not-a-uuid" }); expect(r.status).toBe(422); return; } const a = await args(h, e, who); const before = await h.count(e.table); const r = await h.call(e, who, { ...a, body: { __unknown_field: "x", id: 12345 } }); expect(r.status).toBe(422); const b = (await r.json()) as { code: string; details: unknown[] }; expect(b.code).toBe("VALIDATION_ERROR"); expect(b.details.length).toBeGreaterThan(0); expect(await h.count(e.table)).toBe(before); const r2 = await h.call(e, who, { ...a, body: "{not json" }); expect(r2.status).toBe(422);
  });
  it("test_get_members_rate_limited", async () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    const who = e.auth === "ops" ? "ops" : "boss"; h.limits["listMembers"] = 2; const a = await args(h, e, who); await h.call(e, who, a); await h.call(e, who, a); const before = await h.count(e.table); const r = await h.call(e, who, a); expect(r.status).toBe(429); const b = (await r.json()) as { code: string; retry_after_sec: number }; expect(b.code).toBe("RATE_LIMITED"); expect(b.retry_after_sec).toBeGreaterThan(0); expect(await h.count(e.table)).toBe(before); delete h.limits["listMembers"];
  });
  it("test_get_members_shape", async () => {
    // UBIQUITOUS: GET /api/v1/members の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    const who = e.auth === "ops" ? "ops" : "boss"; const r = await h.call(e, who, await args(h, e, who)); const b = (await r.json()) as Record<string, unknown>; if (r.status < 300) { expect(b).toHaveProperty("data"); if (e.kind === "list") { expect(Array.isArray(b["data"])).toBe(true); expect(b["meta"]).toHaveProperty("limit"); } } else { expect(b).toHaveProperty("error"); expect(b).toHaveProperty("code"); }
  });
});
