// K-802「グループを足す口（createScope）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン。土台 admin.harness.ts）。
//   行 ID（K802-API-…／K802-DB-…）は 11_tickets/K-802.md の表と 1 対 1。
//   入力と答えの形は K-800 の契約（05_flow/screen_api.d/K-800.py）：
//     createScope POST /scopes ← { name, ticket_prefix, parent_id?, layer_id?, color?, manager_member_ids?, member_ids? }
//       → 201 { data: { id, name, ticket_prefix, color, parent_id, layer, position, managers, member_count, created_at } }（鍵はちょうど 10）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { msg, setupAdmin, type P, type World } from "./admin.harness.js";

const h = setupAdmin();
const KEYS = [
  "color",
  "created_at",
  "id",
  "layer",
  "managers",
  "member_count",
  "name",
  "parent_id",
  "position",
  "ticket_prefix",
];
const create = (w: World, p: P, body: Record<string, unknown>, o: { key?: string } = {}) =>
  h.call(p, "POST", "/scopes", { body, ...(o.key ? { key: o.key } : {}) });
const body = (o: Record<string, unknown> = {}) => ({ name: "カスタマーサポート", ticket_prefix: "CS", ...o });
const scopeCount = (w: World) =>
  h.num("select count(*) as n from scopes where tenant_id = $1 and deleted_at is null", [w.tenantId]);
const seats = (scopeId: string) =>
  h.rows<{ member_id: string; role: string; is_primary: boolean }>(
    "select member_id, role, is_primary from scope_memberships where scope_id = $1 and deleted_at is null order by member_id",
    [scopeId],
  );
const layerOf = async (w: World, label: string, order: number) =>
  (
    await h.one<{ id: string }>(
      "insert into layers (tenant_id, key, label, order_no) values ($1, $2, $3, $4) returning id",
      [w.tenantId, `l_${randomUUID().slice(0, 8)}`, label, order],
    )
  ).id;

describe("K-802 グループを足す口（createScope）", () => {
  it("K802-API-001 全部の欄で足す：201・鍵がちょうど 10・所属の行（マネージャー manager・メンバー member・どれも兼務）・主の所属は変わらない・証跡 scope.create 1 行（名前は入れない）", async () => {
    await h.ready();
    const w = await h.world();
    const r = await create(
      w,
      w.admin,
      body({
        parent_id: w.eg,
        color: "plum",
        manager_member_ids: [w.mgr.id],
        member_ids: [w.member.id, w.viewer.id],
      }),
    );
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d).toMatchObject({
      name: "カスタマーサポート",
      ticket_prefix: "CS",
      color: "plum",
      parent_id: w.eg,
      position: 1,
      member_count: 3,
    });
    expect(d["managers"]).toEqual([{ id: w.mgr.id, name: "佐藤 花子" }]);
    const id = d["id"] as string;
    expect(await seats(id)).toEqual(
      expect.arrayContaining([
        { member_id: w.mgr.id, role: "manager", is_primary: false },
        { member_id: w.member.id, role: "member", is_primary: false },
        { member_id: w.viewer.id, role: "viewer", is_primary: false },
      ]),
    );
    expect((await seats(id)).length).toBe(3);
    const primaries = await h.rows<{ scope_id: string }>("select scope_id from members where id = any($1::uuid[])", [
      [w.mgr.id, w.member.id, w.viewer.id],
    ]);
    expect(primaries.map((x) => x.scope_id)).not.toContain(id);
    expect(await h.audits(w.tenantId, "scope.create")).toBe(1);
    const a = await h.one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'scope.create'",
      [w.tenantId],
    );
    expect(a.payload).toEqual({ parent_id: w.eg, ticket_prefix: "CS", manager_count: 1, member_count: 3 });
  });

  it("K802-API-002 名前と短い名前だけ：201・上のグループは会社のいちばん上（営業）・色は既定の青緑 teal・managers []・member_count 0・位置は兄弟の最後・層は上のグループから決まる", async () => {
    await h.ready();
    const w = await h.world();
    const r = await create(w, w.admin, body());
    expect(r.status).toBe(201);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(d).toMatchObject({
      parent_id: w.eg,
      color: "teal",
      managers: [],
      member_count: 0,
      position: 1,
      layer: null,
    });
    expect(await seats(d["id"] as string)).toEqual([]);
  });

  it("K802-API-003 表記ゆらぎ：名前「　ＣＳ　窓口　」→「CS 窓口」・短い名前「ｃｓ２」→「CS2」・「 ab 」→「AB」で保存", async () => {
    await h.ready();
    const w = await h.world();
    const a = await create(w, w.admin, { name: "　ＣＳ　窓口　", ticket_prefix: "ｃｓ２" });
    expect(a.status).toBe(201);
    expect((await h.json(a)).data).toMatchObject({ name: "CS 窓口", ticket_prefix: "CS2" });
    const row = await h.one<{ name: string; ticket_prefix: string }>(
      "select name, ticket_prefix from scopes where id = $1",
      [((await h.json(a)).data as { id: string }).id],
    );
    expect(row).toEqual({ name: "CS 窓口", ticket_prefix: "CS2" });
    const b = await create(w, w.admin, { name: "別の名前", ticket_prefix: " ab " });
    expect((await h.json(b)).data).toMatchObject({ ticket_prefix: "AB" });
  });

  it("K802-API-004 入力の形：名前が無い・空・101 文字／短い名前が空・1A・A-B・9 文字・T・あ／色が白／人の数 11・51 → 422（グループは増えない）。名前 100 文字・短い名前 8 文字は 201", async () => {
    await h.ready();
    const w = await h.world();
    const before = await scopeCount(w);
    const cases: [Record<string, unknown>, string][] = [
      [{ ticket_prefix: "AA" }, "E-GRP-001"],
      [{ name: "", ticket_prefix: "AA" }, "E-GRP-001"],
      [{ name: "あ".repeat(101), ticket_prefix: "AA" }, "E-GRP-001"],
      [{ name: "名前" }, "E-GRP-003"],
      [{ name: "名前", ticket_prefix: "1A" }, "E-GRP-003"],
      [{ name: "名前", ticket_prefix: "A-B" }, "E-GRP-003"],
      [{ name: "名前", ticket_prefix: "ABCDEFGHI" }, "E-GRP-003"],
      [{ name: "名前", ticket_prefix: "T" }, "E-GRP-003"],
      [{ name: "名前", ticket_prefix: "あ" }, "E-GRP-003"],
      [{ name: "名前", ticket_prefix: "AA", color: "#FFFFFF" }, "E-GRP-005"],
      [
        { name: "名前", ticket_prefix: "AA", manager_member_ids: Array.from({ length: 11 }, () => randomUUID()) },
        "E-GRP-009",
      ],
      [{ name: "名前", ticket_prefix: "AA", member_ids: Array.from({ length: 51 }, () => randomUUID()) }, "E-GRP-009"],
    ];
    for (const [b, code] of cases) {
      const r = await create(w, w.admin, b);
      expect(r.status, JSON.stringify(b).slice(0, 80)).toBe(422);
      const j = await h.json(r);
      expect(JSON.stringify(j), code).toContain(
        code === "E-GRP-001" ? "name" : code === "E-GRP-003" ? "ticket_prefix" : "",
      );
    }
    expect(await scopeCount(w)).toBe(before);
    expect((await create(w, w.admin, { name: "あ".repeat(100), ticket_prefix: "ABCDEFGH" })).status).toBe(201);
    expect(msg("E-GRP-001")).toContain("名前");
  });

  it("K802-API-005 指した物が無い：上のグループ・層・人（無い id・別の会社・消した・抜けた・AI）→ 404（欄・details を付けない）・何も作らない", async () => {
    await h.ready();
    const w = await h.world();
    const before = await scopeCount(w);
    const left = await h.make(w, "left", "抜けた人", { status: "left" });
    const ai = (
      await h.one<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'ai_employee', 'AI') returning id",
        [w.tenantId, w.eg],
      )
    ).id;
    const cases: [Record<string, unknown>, string][] = [
      [{ parent_id: randomUUID() }, "E-GRP-014"],
      [{ parent_id: w.other.rootScope }, "E-GRP-014"],
      [{ layer_id: randomUUID() }, "E-GRP-020"],
      [{ manager_member_ids: [randomUUID()] }, "E-GRP-015"],
      [{ member_ids: [w.outsider.id] }, "E-GRP-015"],
      [{ member_ids: [left.id] }, "E-GRP-015"],
      [{ member_ids: [ai] }, "E-GRP-015"],
    ];
    for (const [b, code] of cases) {
      const r = await create(w, w.admin, body(b));
      expect(r.status, JSON.stringify(b)).toBe(404);
      const j = await h.json(r);
      expect(j.code).toBe(code);
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
    }
    expect(await scopeCount(w)).toBe(before);
  });

  it("K802-API-006 短い名前の重なり：営業 EG・小文字 eg・全角 ｅｇ・消したグループの頭・ほかのグループの頭 → 409（欄・details なし）。別の会社が同じ EG は 201", async () => {
    await h.ready();
    const w = await h.world();
    const gone = await h.addScope(w.tenantId, "消したグループ", "GN", w.eg);
    await h.f.admin.query("update scopes set deleted_at = now() where id = $1", [gone]);
    for (const p of ["EG", "eg", "ｅｇ", "GN", "JD"]) {
      const r = await create(w, w.admin, { name: `重なり ${p}`, ticket_prefix: p });
      expect(r.status, p).toBe(409);
      const j = await h.json(r);
      expect(j.code).toBe("E-GRP-010");
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
    }
    const other = await create(w, w.outsider, { name: "別の会社の営業", ticket_prefix: "EG" });
    expect(other.status).toBe(201);
  });

  it("K802-API-007 同じ上のグループに同じ名前（大文字小文字・全角半角は同じ）→ 409。別の上のグループの下・消した兄弟と同じ名前は 201", async () => {
    await h.ready();
    const w = await h.world();
    expect((await create(w, w.admin, { name: "Sales Dept", ticket_prefix: "SD" })).status).toBe(201);
    for (const n of ["sales dept", "ＳＡＬＥＳ　ＤＥＰＴ"]) {
      const r = await create(w, w.admin, { name: n, ticket_prefix: `X${n.length}` });
      expect(r.status, n).toBe(409);
      expect((await h.json(r)).code).toBe("E-GRP-011");
    }
    expect((await create(w, w.admin, { name: "Sales Dept", ticket_prefix: "SD2", parent_id: w.jd })).status).toBe(201);
    const gone = await h.addScope(w.tenantId, "消した兄弟", "GG", w.eg);
    await h.f.admin.query("update scopes set deleted_at = now() where id = $1", [gone]);
    expect((await create(w, w.admin, { name: "消した兄弟", ticket_prefix: "GG2" })).status).toBe(201);
  });

  it("K802-API-008 上限（G-16）：消していないグループが 199 のとき足すと 200・200 のとき足すと 409（消したグループは数えない）", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query(
      `insert into scopes (tenant_id, parent_id, name, ticket_prefix)
       select $1, $2, 'G' || g, 'Z' || g from generate_series(1, 196) g`,
      [w.tenantId, w.eg],
    );
    const dead = await h.addScope(w.tenantId, "消した", "DD", w.eg);
    await h.f.admin.query("update scopes set deleted_at = now() where id = $1", [dead]);
    expect(await scopeCount(w)).toBe(199);
    expect((await create(w, w.admin, body())).status).toBe(201);
    expect(await scopeCount(w)).toBe(200);
    const r = await create(w, w.admin, { name: "201 個目", ticket_prefix: "OV" });
    expect(r.status).toBe(409);
    expect((await h.json(r)).code).toBe("E-GRP-012");
    expect(await scopeCount(w)).toBe(200);
    expect(await h.audits(w.tenantId, "scope.create")).toBe(1);
  });

  it("K802-API-009 人の状態：止めた人・招待中の人は 409（名前と訳）・閲覧のみをマネージャーに 409。1 人でもだめなら何も作らない（グループも所属も証跡も 0）", async () => {
    await h.ready();
    const w = await h.world();
    const invited = await h.make(w, "inv", "招待中の人", { status: "invited" });
    const before = await scopeCount(w);
    const cases: [Record<string, unknown>, string, Record<string, unknown>][] = [
      [{ member_ids: [w.member.id, w.stopped.id] }, "E-GRP-016", { 名前: "止めた人", 訳: "止まっています" }],
      [{ member_ids: [invited.id] }, "E-GRP-016", { 名前: "招待中の人", 訳: "招待中です" }],
      [{ manager_member_ids: [w.viewer.id] }, "E-GRP-017", { 名前: "山口 健" }],
    ];
    for (const [b, code, detail] of cases) {
      const r = await create(w, w.admin, body(b));
      expect(r.status, code).toBe(409);
      const j = await h.json(r);
      expect(j.code).toBe(code);
      expect(j.detail).toMatchObject(detail);
      expect(j.details).toBeUndefined();
    }
    expect(await scopeCount(w)).toBe(before);
    expect(await h.audits(w.tenantId, "scope.create")).toBe(0);
  });

  it("K802-API-010 兼務を通す（D-154.15）：同じ人を 2 つのグループのマネージャーにする・マネージャーとメンバーの両方に入れた人は manager の 1 行・同じ人を 2 回送っても 1 行", async () => {
    await h.ready();
    const w = await h.world();
    const a = (await h.json(await create(w, w.admin, body({ manager_member_ids: [w.mgr.id] })))).data as { id: string };
    const b = (
      await h.json(
        await create(w, w.admin, {
          name: "広報",
          ticket_prefix: "PR",
          manager_member_ids: [w.mgr.id],
          member_ids: [w.mgr.id, w.member.id, w.member.id],
        }),
      )
    ).data as { id: string; member_count: number };
    expect(b.member_count).toBe(2);
    expect(await seats(a.id)).toEqual([{ member_id: w.mgr.id, role: "manager", is_primary: false }]);
    expect(await seats(b.id)).toEqual(
      expect.arrayContaining([
        { member_id: w.mgr.id, role: "manager", is_primary: false },
        { member_id: w.member.id, role: "member", is_primary: false },
      ]),
    );
    expect((await seats(b.id)).length).toBe(2);
    // 主の所属（営業）は変わらない。佐藤は主の所属のほかに 2 つのグループで manager
    expect((await h.one<{ scope_id: string }>("select scope_id from members where id = $1", [w.mgr.id])).scope_id).toBe(
      w.eg,
    );
    expect(
      await h.num(
        "select count(*) as n from scope_memberships where member_id = $1 and role = 'manager' and deleted_at is null",
        [w.mgr.id],
      ),
    ).toBe(3);
  });

  it("K802-API-011 層：layer_id を指すとその層で保存・無ければ上のグループの層から決まる（層なしの会社は null・上が部門ならその次の層・いちばん深ければそのまま）", async () => {
    await h.ready();
    const w = await h.world();
    const dept = await layerOf(w, "部門", 1);
    const team = await layerOf(w, "チーム", 2);
    const picked = (await h.json(await create(w, w.admin, { name: "指した層", ticket_prefix: "PL", layer_id: team })))
      .data as {
      layer: { id: string; label: string } | null;
    };
    expect(picked.layer).toEqual({ id: team, label: "チーム" });
    await h.f.admin.query("update scopes set layer_id = $2 where id = $1", [w.jd, dept]);
    const auto = (await h.json(await create(w, w.admin, { name: "自動の層", ticket_prefix: "AL", parent_id: w.jd })))
      .data as {
      layer: { id: string } | null;
    };
    expect(auto.layer?.id).toBe(team);
    await h.f.admin.query("update scopes set layer_id = $2 where id = $1", [w.ac, team]);
    const deepest = (
      await h.json(await create(w, w.admin, { name: "いちばん深い", ticket_prefix: "DP", parent_id: w.ac }))
    ).data as {
      layer: { id: string } | null;
    };
    expect(deepest.layer?.id).toBe(team);
  });

  it("K802-API-012 権限：scopes の edit を付けた人は 201・マネージャー・メンバー・閲覧のみ・layers の edit だけの人・外した人は 403（グループは増えない）・ログインしていない 401・上限 1 回で 2 回目 429", async () => {
    await h.ready();
    const w = await h.world();
    const granted = await h.make(w, "granted", "権限を付けた人");
    await h.f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'scopes', null, 'edit')",
      [w.tenantId, granted.id],
    );
    const layersOnly = await h.make(w, "layers", "層だけの人");
    await h.f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'layers', null, 'edit')",
      [w.tenantId, layersOnly.id],
    );
    const before = await scopeCount(w);
    expect((await create(w, granted, body())).status).toBe(201);
    for (const p of [w.mgr, w.member, w.viewer, layersOnly, w.stopped]) {
      const r = await create(w, p, { name: `だめ ${p.name}`, ticket_prefix: "NO" });
      expect(r.status, p.name).toBe(403);
    }
    expect(await scopeCount(w)).toBe(before + 1);
    expect((await h.f.req("POST", "/scopes", { body: body() })).status).toBe(401);
    h.limits["createScope"] = 1;
    try {
      const first = await create(w, w.admin, { name: "上限の 1 回目", ticket_prefix: "LM" });
      expect(first.status).toBe(201);
      const second = await create(w, w.admin, { name: "上限の 2 回目", ticket_prefix: "LN" });
      expect(second.status).toBe(429);
      expect(((await h.json(second)) as { retry_after_sec?: number }).retry_after_sec).toBeGreaterThan(0);
    } finally {
      h.limits["createScope"] = 10_000;
    }
  });

  it("K802-API-013 二度押し（同じ冪等キー）：2 回とも 201・同じ id・グループ 1・所属の行は 1 つずつ・証跡 1。別の会社の管理者は自分の会社に足せて、こちらは増えない", async () => {
    await h.ready();
    const w = await h.world();
    const key = randomUUID();
    const b = body({ member_ids: [w.member.id] });
    const [r1, r2] = [await create(w, w.admin, b, { key }), await create(w, w.admin, b, { key })];
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(((await h.json(r1)).data as { id: string }).id).toBe(((await h.json(r2)).data as { id: string }).id);
    expect(
      await h.num("select count(*) as n from scopes where tenant_id = $1 and ticket_prefix = 'CS'", [w.tenantId]),
    ).toBe(1);
    expect(await h.audits(w.tenantId, "scope.create")).toBe(1);
    const mine = await scopeCount(w);
    expect((await create(w, w.outsider, { name: "別の会社のグループ", ticket_prefix: "XX" })).status).toBe(201);
    expect(await scopeCount(w)).toBe(mine);
  });

  it("K802-API-014 操作の揺れ（G-16）：同じ短い名前・同じ名前・最後の 1 枠を、別の冪等キーで同時に 2 本 → 201 と 409 が 1 つずつ（行は 1 つ）", async () => {
    await h.ready();
    const w = await h.world();
    const run = async (a: Record<string, unknown>, b: Record<string, unknown>) =>
      (await Promise.all([create(w, w.admin, a, { key: randomUUID() }), create(w, w.admin, b, { key: randomUUID() })]))
        .map((r) => r.status)
        .sort();
    expect(await run({ name: "同時 A", ticket_prefix: "CC" }, { name: "同時 B", ticket_prefix: "cc" })).toEqual([
      201, 409,
    ]);
    expect(await run({ name: "同じ名前", ticket_prefix: "CD" }, { name: "同じ名前", ticket_prefix: "CE" })).toEqual([
      201, 409,
    ]);
    expect(
      await h.num("select count(*) as n from scopes where tenant_id = $1 and ticket_prefix in ('CC','CD','CE')", [
        w.tenantId,
      ]),
    ).toBe(2);
    await h.f.admin.query(
      `insert into scopes (tenant_id, parent_id, name, ticket_prefix)
       select $1, $2, 'H' || g, 'Y' || g from generate_series(1, 194) g`,
      [w.tenantId, w.eg],
    );
    expect(await scopeCount(w)).toBe(199);
    expect(await run({ name: "最後の枠 A", ticket_prefix: "LA" }, { name: "最後の枠 B", ticket_prefix: "LB" })).toEqual(
      [201, 409],
    );
    expect(await scopeCount(w)).toBe(200);
  });

  it("K802-API-015 失敗（手順 S1）：所属の行を書く所・証跡を書く所で DB が落ちる → 503・E-PAGE-003・グループも所属も証跡も増えない。同じ体でやり直すと 201", async () => {
    await h.ready();
    const w = await h.world();
    const before = await scopeCount(w);
    const b = body({ member_ids: [w.member.id], manager_member_ids: [w.mgr.id] });
    for (const table of ["scope_memberships", "audit_events"]) {
      await h.breakOn(table, w.tenantId, "insert", async () => {
        const r = await create(w, w.admin, b);
        expect(r.status, table).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
      expect(await scopeCount(w)).toBe(before);
      expect(await h.audits(w.tenantId, "scope.create")).toBe(0);
    }
    expect((await create(w, w.admin, b)).status).toBe(201);
  });

  it("K802-API-016 反映：足した後、別の GET でメンバーの並び（K-419）を読むと新しいグループにマネージャー（group_role manager）とメンバー（member）が出る・営業の行の佐藤の other_groups に新しいグループの名前", async () => {
    await h.ready();
    const w = await h.world();
    const d = (
      await h.json(await create(w, w.admin, body({ manager_member_ids: [w.mgr.id], member_ids: [w.member.id] })))
    ).data as { id: string };
    const list = (await h.json(await h.call(w.admin, "GET", "/workspace/members"))).data as {
      groups: { id: string; code: string; name: string; members: Record<string, unknown>[] }[];
    };
    const g = list.groups.find((x) => x.id === d.id)!;
    expect(g).toMatchObject({ code: "CS", name: "カスタマーサポート" });
    expect(g.members.find((m) => m["id"] === w.mgr.id)).toMatchObject({ group_role: "manager", primary: false });
    expect(g.members.find((m) => m["id"] === w.member.id)).toMatchObject({ group_role: "member", primary: false });
    const sales = list.groups.find((x) => x.id === w.eg)!;
    expect(sales.members.find((m) => m["id"] === w.mgr.id)?.["other_groups"]).toEqual(["カスタマーサポート"]);
  });

  it("K802-DB-017 守り：kaname_app から直に呼べるのは app.scope_create だけ（scope_json・scope_member_count・scope_layer_for は permission denied）。書けない人が直に呼ぶと forbidden・行は増えない", async () => {
    await h.ready();
    const w = await h.world();
    for (const call of [
      `select app.scope_json('${w.eg}')`,
      `select app.scope_member_count('${w.eg}')`,
      `select app.scope_layer_for('${w.eg}')`,
    ])
      await expect(h.f.pool.query(call), call).rejects.toThrow(/permission denied/);
    const before = await scopeCount(w);
    const v = (
      await h.asOwner<{ v: { error?: string; ok?: boolean } }>(w.member, "select app.scope_create($1::jsonb) as v", [
        JSON.stringify({
          name: "直に",
          ticket_prefix: "DR",
          parent_id: w.eg,
          color: "indigo",
          manager_member_ids: [],
          member_ids: [],
        }),
      ])
    )[0]!.v;
    expect(v).toMatchObject({ error: "forbidden" });
    expect(await scopeCount(w)).toBe(before);
    const ok = (
      await h.asOwner<{ v: { ok?: boolean } }>(w.admin, "select app.scope_create($1::jsonb) as v", [
        JSON.stringify({
          name: "直に 2",
          ticket_prefix: "DS",
          parent_id: w.eg,
          color: "indigo",
          manager_member_ids: [],
          member_ids: [],
        }),
      ])
    )[0]!.v;
    expect(ok.ok).toBe(true);
  });

  it("K802-DB-018 新しい列：直に置いたグループは色 null・位置 0／色を白に直す・6 つ以外は check が断る（coral には直せる）", async () => {
    await h.ready();
    const w = await h.world();
    const id = await h.addScope(w.tenantId, "直に置いた", "RW", w.eg);
    expect(await h.one("select color, position from scopes where id = $1", [id])).toEqual({ color: null, position: 0 });
    await expect(h.f.admin.query("update scopes set color = '#FFFFFF' where id = $1", [id])).rejects.toThrow();
    await h.f.admin.query("update scopes set color = 'coral' where id = $1", [id]);
    expect((await h.one<{ color: string }>("select color from scopes where id = $1", [id])).color).toBe("coral");
  });
});
