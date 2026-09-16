// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。PATCH /api/v1/tasks/:id
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
import { args } from "../args.js";

const e = endpointOf("patchTasksById");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("PATCH /api/v1/tasks/:id", () => {
  it("test_patch_tasks_id_ok", async () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/tasks/:id が「自分のタスクを終える」として呼ばれたとき THEN Kaname は「タスクの状態を更新し、目標の実績に積む」を行い 2xx を返す
    const who = e.auth === "ops" ? "ops" : "boss";
    const r = await h.call(e, who, await args(h, e, who));
    expect([200, 201]).toContain(r.status);
    const b = (await r.json()) as { data: unknown };
    expect(b.data).toBeDefined();
    if (e.kind === "create") expect((b.data as { id: string }).id).toBeTruthy();
  });
  it("test_patch_tasks_id_ok_2", async () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/tasks/:id が「誰に引き継いでもらうか選ぶ（負荷を見て）」として呼ばれたとき THEN Kaname は「担当を移す（合意 or 指示）。goal_id は変えない。task_handovers に記録」を行い 2xx を返す（自動側：自分のAIが相手の負荷と合意の要否を出す）
    const who = e.auth === "ops" ? "ops" : "boss";
    const r = await h.call(e, who, await args(h, e, who));
    expect([200, 201]).toContain(r.status);
    const b = (await r.json()) as { data: unknown };
    expect(b.data).toBeDefined();
    if (e.kind === "create") expect((b.data as { id: string }).id).toBeTruthy();
  });
  it("test_patch_tasks_id_rejected_401", async () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    const a = await args(h, e, "boss");
    const before = await h.count(e.table);
    const r = await h.call(e, "anon", a);
    expect(r.status).toBe(e.auth === "public" ? 200 : 401);
    if (e.auth !== "public") {
      expect(((await r.json()) as { code: string }).code).toBe("UNAUTHENTICATED");
      expect(await h.count(e.table)).toBe(before);
    }
  });
  it("test_patch_tasks_id_rejected_403", async () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    const a = await args(h, e, e.auth === "ops" ? "ops" : "boss");
    const before = await h.count(e.table);
    const who = e.auth === "ops" ? "boss" : e.kind === "list" || e.kind === "get" ? "opsB" : "staff";
    const r = await h.call(e, who, a);
    expect([403, 404]).toContain(r.status);
    expect(await h.count(e.table)).toBe(before);
  });
  it("test_patch_tasks_id_not_found", async () => {
    // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
    if (e.kind === "list" || e.kind === "create") return;
    const who = e.auth === "ops" ? "ops" : "boss";
    const r = await h.call(e, who, { ...(await args(h, e, who)), id: "0193c5a0-0000-7000-8000-000000000000" });
    expect(r.status).toBe(404);
  });
  it("test_patch_tasks_id_rejected_422", async () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    const who = e.auth === "ops" ? "ops" : "boss";
    if (e.kind === "list") {
      const r = await h.call(e, who, { query: { limit: "0" } });
      expect(r.status).toBe(422);
      return;
    }
    if (e.kind === "get" || e.kind === "delete") {
      const r = await h.call(e, who, { id: "not-a-uuid" });
      expect(r.status).toBe(422);
      return;
    }
    const a = await args(h, e, who);
    const before = await h.count(e.table);
    const r = await h.call(e, who, { ...a, body: { __unknown_field: "x", id: 12345 } });
    expect(r.status).toBe(422);
    const b = (await r.json()) as { code: string; details: unknown[] };
    expect(b.code).toBe("VALIDATION_ERROR");
    expect(b.details.length).toBeGreaterThan(0);
    expect(await h.count(e.table)).toBe(before);
    const r2 = await h.call(e, who, { ...a, body: "{not json" });
    expect(r2.status).toBe(422);
  });
  it("test_patch_tasks_id_rate_limited", async () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    const who = e.auth === "ops" ? "ops" : "boss";
    h.limits["patchTasksById"] = 2;
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
    delete h.limits["patchTasksById"];
  });
  it("test_patch_tasks_id_shape", async () => {
    // UBIQUITOUS: PATCH /api/v1/tasks/:id の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
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
