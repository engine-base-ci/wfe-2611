// K-803「層を足す・直す口（createLayer・updateLayer）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン。土台 admin.harness.ts）。
//   行 ID（K803-API-…／K803-DB-…）は 11_tickets/K-803.md の表と 1 対 1。入力と答えの形は K-800 の契約：
//     createLayer POST  /layers     ← { label, order_no? } → 201 { data: { id, key, label, order_no, group_count, created_at } }（鍵はちょうど 6）
//     updateLayer PATCH /layers/:id ← { label?, order_no? } → 200 { data: 同じ 6 つの鍵 }
//     listLayers  GET   /layers     → 200 { data: [{ id, key, label, order_no, group_count, created_at }]（order_no の順・消した層を含まない）, meta: { limit } }（会社の人なら誰でも読める）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupAdmin, type P, type World } from "./admin.harness.js";

const h = setupAdmin();
const KEYS = ["created_at", "group_count", "id", "key", "label", "order_no"];
const add = (p: P, body: Record<string, unknown>, o: { key?: string } = {}) =>
  h.call(p, "POST", "/layers", { body, ...(o.key ? { key: o.key } : {}) });
const patch = (p: P, id: string, body: Record<string, unknown>) => h.call(p, "PATCH", `/layers/${id}`, { body });
const orders = async (w: World) =>
  (
    await h.rows<{ label: string; order_no: number }>(
      "select label, order_no from layers where tenant_id = $1 and deleted_at is null order by order_no",
      [w.tenantId],
    )
  ).map((x) => `${x.order_no}:${x.label}`);
const insert = async (w: World, label: string, order: number, deleted = false) =>
  (
    await h.one<{ id: string }>(
      "insert into layers (tenant_id, key, label, order_no, deleted_at) values ($1, $2, $3, $4, $5) returning id",
      [w.tenantId, `l_${randomUUID().slice(0, 8)}`, label, order, deleted ? new Date() : null],
    )
  ).id;
const count = (w: World) =>
  h.num("select count(*) as n from layers where tenant_id = $1 and deleted_at is null", [w.tenantId]);

describe("K-803 層を足す口（createLayer）", () => {
  it("K803-API-001 層を足す（名前「　部門　」・もう 1 つ）：201・鍵がちょうど 6・label「部門」・order_no 1／2・key が l_ ＋ 8 文字・group_count 0・証跡 layer.create が 2 行（payload に order_no）", async () => {
    await h.ready();
    const w = await h.world();
    const a = await add(w.admin, { label: "　部門　" });
    expect(a.status, await a.clone().text()).toBe(201);
    expect(a.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(a)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d).toMatchObject({ label: "部門", order_no: 1, group_count: 0 });
    expect(String(d["key"])).toMatch(/^l_[0-9a-f]{8}$/);
    const b = (await h.json(await add(w.admin, { label: "チーム" }))).data as Record<string, unknown>;
    expect(b["order_no"]).toBe(2);
    expect(await h.audits(w.tenantId, "layer.create")).toBe(2);
    const au = await h.one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'layer.create' order by occurred_at limit 1",
      [w.tenantId],
    );
    expect(au.payload).toEqual({ order_no: 1 });
  });

  it("K803-API-002 並びを指して足す：A・B・C の後に order_no 1・99・3 → 指した位置に入り、以降が 1 つずつ下がる・99 は最後・並びはいつも 1 から重ならない連番", async () => {
    await h.ready();
    const w = await h.world();
    for (const l of ["A", "B", "C"]) await add(w.admin, { label: l });
    await add(w.admin, { label: "D", order_no: 1 });
    expect(await orders(w)).toEqual(["1:D", "2:A", "3:B", "4:C"]);
    await add(w.admin, { label: "E", order_no: 99 });
    await add(w.admin, { label: "F", order_no: 3 });
    expect(await orders(w)).toEqual(["1:D", "2:A", "3:F", "4:B", "5:C", "6:E"]);
  });

  it("K803-API-003 入力の形：名前が無い・空・空白だけ・41 文字／order_no 0・負・小数・文字／知らない欄（key・tenant_id）→ 422・層は増えない。名前 40 文字は 201", async () => {
    await h.ready();
    const w = await h.world();
    const bad: Record<string, unknown>[] = [
      {},
      { label: "" },
      { label: "　 " },
      { label: "あ".repeat(41) },
      { label: "層", order_no: 0 },
      { label: "層", order_no: -1 },
      { label: "層", order_no: 1.5 },
      { label: "層", order_no: "1" },
      { label: "層", key: "l_aaaaaaaa" },
      { label: "層", tenant_id: w.other.tenantId },
    ];
    for (const b of bad) expect((await add(w.admin, b)).status, JSON.stringify(b)).toBe(422);
    expect(await count(w)).toBe(0);
    expect((await add(w.admin, { label: "あ".repeat(40) })).status).toBe(201);
  });

  it("K803-API-004 上限（G-16）：消した層 2 つを除いて 7 段で足す → 8 段・8 段で足す → 409・E-GRP-013（欄・details なし）・層は増えない", async () => {
    await h.ready();
    const w = await h.world();
    for (let i = 1; i <= 7; i++) await insert(w, `層${i}`, i);
    await insert(w, "消した 1", 8, true);
    await insert(w, "消した 2", 9, true);
    expect((await add(w.admin, { label: "八つ目" })).status).toBe(201);
    expect(await count(w)).toBe(8);
    const r = await add(w.admin, { label: "九つ目" });
    expect(r.status).toBe(409);
    const j = await h.json(r);
    expect(j.code).toBe("E-GRP-013");
    expect(j.field).toBeUndefined();
    expect(j.details).toBeUndefined();
    expect(await count(w)).toBe(8);
    expect(await h.audits(w.tenantId, "layer.create")).toBe(1);
  });

  it("K803-API-005 同じ名前の層（dept・DEPT・全角・前後の空白）→ 409・E-GRP-019。消した層と同じ名前は 201", async () => {
    await h.ready();
    const w = await h.world();
    await add(w.admin, { label: "Dept" });
    for (const n of ["dept", "DEPT", "Ｄｅｐｔ", " Dept "]) {
      const r = await add(w.admin, { label: n });
      expect(r.status, n).toBe(409);
      expect((await h.json(r)).code).toBe("E-GRP-019");
    }
    await insert(w, "消した名前", 5, true);
    expect((await add(w.admin, { label: "消した名前" })).status).toBe(201);
  });

  it("K803-API-006 権限：layers の edit を付けた人は 201・scopes の edit だけの人・マネージャー・メンバー・閲覧のみ・止めた人は 403（層は増えない）・ログインしていない 401・上限 1 回で 2 回目 429", async () => {
    await h.ready();
    const w = await h.world();
    const grant = async (key: string, target: string) => {
      const p = await h.make(w, key, `${key} の人`);
      await h.f.admin.query(
        "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, $3, null, 'edit')",
        [w.tenantId, p.id, target],
      );
      return p;
    };
    const layersP = await grant("layers", "layers");
    const scopesP = await grant("scopes", "scopes");
    expect((await add(layersP, { label: "権限の層" })).status).toBe(201);
    for (const p of [scopesP, w.mgr, w.member, w.viewer, w.stopped])
      expect((await add(p, { label: `だめ ${p.name}` })).status, p.name).toBe(403);
    expect(await count(w)).toBe(1);
    expect((await h.f.req("POST", "/layers", { body: { label: "x" } })).status).toBe(401);
    h.limits["createLayer"] = 1;
    try {
      expect((await add(w.admin, { label: "上限 1" })).status).toBe(201);
      const second = await add(w.admin, { label: "上限 2" });
      expect(second.status).toBe(429);
    } finally {
      h.limits["createLayer"] = 10_000;
    }
  });

  it("K803-API-007 操作の揺れ（G-16）：最後の 1 枠・同じ名前を別の冪等キーで同時に 2 本 → 201 と 409 が 1 つずつ。二度押し（同じキー）は同じ 201・層 1", async () => {
    await h.ready();
    const w = await h.world();
    for (let i = 1; i <= 7; i++) await insert(w, `層${i}`, i);
    const run = async (a: string, b: string) =>
      (
        await Promise.all([
          add(w.admin, { label: a }, { key: randomUUID() }),
          add(w.admin, { label: b }, { key: randomUUID() }),
        ])
      )
        .map((r) => r.status)
        .sort();
    expect(await run("最後 A", "最後 B")).toEqual([201, 409]);
    expect(await count(w)).toBe(8);
    const w2 = await h.world();
    expect(await run2(w2)).toEqual([201, 409]);
    const key = randomUUID();
    const w3 = await h.world();
    const [x, y] = [await add(w3.admin, { label: "二度" }, { key }), await add(w3.admin, { label: "二度" }, { key })];
    expect([x.status, y.status]).toEqual([201, 201]);
    expect(await count(w3)).toBe(1);
    async function run2(world: World) {
      return (
        await Promise.all([
          add(world.admin, { label: "同名" }, { key: randomUUID() }),
          add(world.admin, { label: "同名" }, { key: randomUUID() }),
        ])
      )
        .map((r) => r.status)
        .sort();
    }
  });

  it("K803-API-008 失敗（手順 S1）：層の行・並びの押し出し・証跡を書く所で DB が落ちる → 503・E-PAGE-003・層も並びも前のまま・証跡 0。やり直すと 201", async () => {
    await h.ready();
    const w = await h.world();
    await add(w.admin, { label: "A" });
    await add(w.admin, { label: "B" });
    const before = await orders(w);
    const audits = await h.audits(w.tenantId, "layer.create");
    for (const [table, op] of [
      ["layers", "insert"],
      ["layers", "update"],
      ["audit_events", "insert"],
    ] as const)
      await h.breakOn(table, w.tenantId, op, async () => {
        const r = await add(w.admin, { label: "落ちる", order_no: 1 });
        expect(r.status, `${table} ${op}`).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    expect(await orders(w)).toEqual(before);
    expect(await h.audits(w.tenantId, "layer.create")).toBe(audits);
    expect((await add(w.admin, { label: "落ちない", order_no: 1 })).status).toBe(201);
  });
});

describe("K-803 層を直す口（updateLayer）", () => {
  it("K803-API-009 名前を直す：200・鍵がちょうど 6・label が変わる・key と order_no は変わらない・group_count はその層のグループの数・証跡 layer.update 1 行（payload に変えた欄の名前だけ）", async () => {
    await h.ready();
    const w = await h.world();
    const id = ((await h.json(await add(w.admin, { label: "部門" }))).data as { id: string }).id;
    await h.f.admin.query("update scopes set layer_id = $2 where id = any($1::uuid[])", [[w.jd, w.ac], id]);
    const before = await h.one<{ key: string }>("select key from layers where id = $1", [id]);
    const r = await patch(w.admin, id, { label: "　部署　" });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d).toMatchObject({ id, label: "部署", order_no: 1, group_count: 2, key: before.key });
    expect(await h.audits(w.tenantId, "layer.update")).toBe(1);
    const au = await h.one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'layer.update'",
      [w.tenantId],
    );
    expect(au.payload).toEqual({ fields: ["label"] });
  });

  it("K803-API-010 並びを替える：先頭を最後へ・最後を先頭へ・範囲を超えた値は最後・並びは 1 から重ならない連番のまま", async () => {
    await h.ready();
    const w = await h.world();
    const ids: string[] = [];
    for (const l of ["A", "B", "C", "D"])
      ids.push(((await h.json(await add(w.admin, { label: l }))).data as { id: string }).id);
    expect((await patch(w.admin, ids[0]!, { order_no: 4 })).status).toBe(200);
    expect(await orders(w)).toEqual(["1:B", "2:C", "3:D", "4:A"]);
    expect((await patch(w.admin, ids[3]!, { order_no: 1 })).status).toBe(200);
    expect(await orders(w)).toEqual(["1:D", "2:B", "3:C", "4:A"]);
    const r = await patch(w.admin, ids[2]!, { order_no: 99 });
    expect(((await h.json(r)).data as { order_no: number }).order_no).toBe(4);
    expect(await orders(w)).toEqual(["1:D", "2:B", "3:A", "4:C"]);
    const both = await patch(w.admin, ids[1]!, { label: "B 改", order_no: 1 });
    expect(both.status).toBe(200);
    expect(await orders(w)).toEqual(["1:B 改", "2:D", "3:A", "4:C"]);
  });

  it("K803-API-011 同じ名前の層への変更は 409・E-GRP-019（ほかの層と同じ。大文字小文字・全角半角は同じ）。自分の名前を大文字にし直すのは 200", async () => {
    await h.ready();
    const w = await h.world();
    const a = ((await h.json(await add(w.admin, { label: "Dept" }))).data as { id: string }).id;
    const b = ((await h.json(await add(w.admin, { label: "Team" }))).data as { id: string }).id;
    const r = await patch(w.admin, b, { label: "ＤＥＰＴ" });
    expect(r.status).toBe(409);
    expect((await h.json(r)).code).toBe("E-GRP-019");
    expect(await orders(w)).toEqual(["1:Dept", "2:Team"]);
    expect((await patch(w.admin, a, { label: "DEPT" })).status).toBe(200);
  });

  it("K803-API-012 直す先が無い：無い id・別の会社の層・消した層 → 404・E-GRP-007（欄・details なし）。体が空 → 422・知らない欄（key・order_no が文字）→ 422・名前 41 文字 → 422。層は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const mine = ((await h.json(await add(w.admin, { label: "部門" }))).data as { id: string }).id;
    const theirs = ((await h.json(await add(w.outsider, { label: "別の会社の層" }))).data as { id: string }).id;
    const gone = await insert(w, "消した", 5, true);
    for (const id of [randomUUID(), theirs, gone]) {
      const r = await patch(w.admin, id, { label: "直す" });
      expect(r.status, id).toBe(404);
      const j = await h.json(r);
      expect(j.code).toBe("E-GRP-007");
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
    }
    for (const b of [{}, { key: "l_aaaaaaaa" }, { order_no: "1" }, { label: "あ".repeat(41) }, { order_no: 0 }])
      expect((await patch(w.admin, mine, b)).status, JSON.stringify(b)).toBe(422);
    expect(await orders(w)).toEqual(["1:部門"]);
    expect((await h.one<{ label: string }>("select label from layers where id = $1", [theirs])).label).toBe(
      "別の会社の層",
    );
  });

  it("K803-API-013 権限：layers の edit を付けた人は 200・scopes だけの人・マネージャー・メンバー・閲覧のみ・止めた人は 403（変わらない）・ログインしていない 401", async () => {
    await h.ready();
    const w = await h.world();
    const id = ((await h.json(await add(w.admin, { label: "部門" }))).data as { id: string }).id;
    const p = await h.make(w, "layersp", "層の人");
    await h.f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'layers', null, 'edit')",
      [w.tenantId, p.id],
    );
    expect((await patch(p, id, { label: "権限で直した" })).status).toBe(200);
    for (const q of [w.mgr, w.member, w.viewer, w.stopped])
      expect((await patch(q, id, { label: "だめ" })).status, q.name).toBe(403);
    expect((await h.f.req("PATCH", `/layers/${id}`, { body: { label: "x" } })).status).toBe(401);
    expect((await h.one<{ label: string }>("select label from layers where id = $1", [id])).label).toBe("権限で直した");
  });

  it("K803-API-014 操作の揺れ（G-16）：2 人の管理者が同時に並びを替える → どちらも 200・並びは 1 から重ならない連番のまま（同じ order_no が 2 つできない）", async () => {
    await h.ready();
    const w = await h.world();
    const ids: string[] = [];
    for (const l of ["A", "B", "C", "D", "E"])
      ids.push(((await h.json(await add(w.admin, { label: l }))).data as { id: string }).id);
    const rs = await Promise.all([
      patch(w.admin, ids[0]!, { order_no: 5 }),
      patch(w.admin2, ids[4]!, { order_no: 1 }),
      patch(w.admin, ids[2]!, { order_no: 2 }),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
    const o = await h.rows<{ order_no: number }>(
      "select order_no from layers where tenant_id = $1 and deleted_at is null order by order_no",
      [w.tenantId],
    );
    expect(o.map((x) => x.order_no)).toEqual([1, 2, 3, 4, 5]);
  });

  it("K803-API-015 失敗（手順 S1）：直す update・並びの update・証跡で DB が落ちる → 503・E-PAGE-003・名前も並びも前のまま・証跡は増えない", async () => {
    await h.ready();
    const w = await h.world();
    const a = ((await h.json(await add(w.admin, { label: "A" }))).data as { id: string }).id;
    await add(w.admin, { label: "B" });
    const before = await orders(w);
    const audits = await h.audits(w.tenantId, "layer.update");
    for (const [table, op] of [
      ["layers", "update"],
      ["audit_events", "insert"],
    ] as const)
      await h.breakOn(table, w.tenantId, op, async () => {
        const r = await patch(w.admin, a, { label: "A 改", order_no: 2 });
        expect(r.status, `${table}`).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    expect(await orders(w)).toEqual(before);
    expect(await h.audits(w.tenantId, "layer.update")).toBe(audits);
  });

  it("K803-DB-016 守り：kaname_app から直に呼べるのは app.layer_create・app.layer_update だけ（layer_json・layer_renumber は permission denied）。書けない人が直に呼ぶと forbidden・行は増えない", async () => {
    await h.ready();
    const w = await h.world();
    for (const call of [`select app.layer_json('${randomUUID()}')`, `select app.layer_renumber('${w.tenantId}')`])
      await expect(h.f.pool.query(call), call).rejects.toThrow(/permission denied/);
    const v = (
      await h.asOwner<{ v: { error?: string } }>(w.member, "select app.layer_create($1::jsonb) as v", [
        JSON.stringify({ label: "直に" }),
      ])
    )[0]!.v;
    expect(v).toMatchObject({ error: "forbidden" });
    expect(await count(w)).toBe(0);
    const ok = (
      await h.asOwner<{ v: { ok?: boolean } }>(w.admin, "select app.layer_create($1::jsonb) as v", [
        JSON.stringify({ label: "直に 2" }),
      ])
    )[0]!.v;
    expect(ok.ok).toBe(true);
  });

  it("K803-API-017 層の一覧（listLayers）：200・no-store・order_no の順・1 件は 6 つの鍵ちょうど・group_count はその層のグループの数・消した層と別の会社の層は出ない・層が無ければ空の並び", async () => {
    await h.ready();
    const w = await h.world();
    const r0 = await h.call(w.admin, "GET", "/layers");
    expect(r0.status, await r0.clone().text()).toBe(200);
    expect(((await h.json(r0)) as { data: unknown[] }).data).toEqual([]);
    const a = ((await h.json(await add(w.admin, { label: "部門" }))).data as { id: string }).id;
    await add(w.admin, { label: "チーム" });
    await insert(w, "消した", 9, true);
    await add(w.outsider, { label: "別の会社の層" });
    await h.f.admin.query("update scopes set layer_id = $2 where id = any($1::uuid[])", [[w.jd, w.ac], a]);
    const r = await h.call(w.admin, "GET", "/layers");
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = ((await h.json(r)) as unknown as { data: Record<string, unknown>[] }).data;
    expect(d.map((x) => x["label"])).toEqual(["部門", "チーム"]);
    expect(d.map((x) => x["order_no"])).toEqual([1, 2]);
    for (const x of d) expect(Object.keys(x).sort()).toEqual(KEYS);
    expect(d.map((x) => x["group_count"])).toEqual([2, 0]);
  });

  it("K803-API-018 層の一覧の権限：会社の人（メンバー・閲覧のみ・マネージャー・止めた人でない人）は誰でも 200・ログインしていない 401・別の会社の管理者はこの会社の層を読めない（自分の会社の分だけ）", async () => {
    await h.ready();
    const w = await h.world();
    await add(w.admin, { label: "部門" });
    for (const p of [w.mgr, w.member, w.viewer]) {
      const r = await h.call(p, "GET", "/layers");
      expect(r.status, p.name).toBe(200);
      expect(((await h.json(r)) as unknown as { data: unknown[] }).data.length).toBe(1);
    }
    expect((await h.f.req("GET", "/layers")).status).toBe(401);
    const theirs = await h.call(w.outsider, "GET", "/layers");
    expect(((await h.json(theirs)) as unknown as { data: unknown[] }).data).toEqual([]);
  });
});
