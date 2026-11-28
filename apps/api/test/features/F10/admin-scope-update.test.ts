// K-804「グループを直す・並びを替える口（updateScope）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン。土台 admin.harness.ts）。
//   行 ID（K804-API-…／K804-DB-…）は 11_tickets/K-804.md の表と 1 対 1。入力と答えの形は K-800 の契約：
//     updateScope PATCH /scopes/:id ← { name?, color?, position?, manager_member_ids? }（短い名前・上のグループ・層は変えられない＝欄が無い）
//       → 200 { data: { id, name, ticket_prefix, color, parent_id, layer, position, managers, member_count, created_at } }（鍵はちょうど 10）
//     listScopes GET /scopes（K-60 の口・足す）→ 1 件に上の 10 の鍵を足し（元の列は残す）、上のグループが先・兄弟は position の順で返す
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupAdmin, type P, type World } from "./admin.harness.js";

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
const edit = (p: P, id: string, body: Record<string, unknown>) => h.call(p, "PATCH", `/scopes/${id}`, { body });
const row = (id: string) =>
  h.one<{ name: string; color: string | null; position: number; ticket_prefix: string; parent_id: string | null }>(
    "select name, color, position, ticket_prefix, parent_id from scopes where id = $1",
    [id],
  );
const seat = (scopeId: string, memberId: string) =>
  h.rows<{ role: string; is_primary: boolean }>(
    "select role, is_primary from scope_memberships where scope_id = $1 and member_id = $2 and deleted_at is null",
    [scopeId, memberId],
  );
const positions = async (w: World) =>
  (
    await h.rows<{ name: string; position: number }>(
      "select name, position from scopes where tenant_id = $1 and parent_id = $2 and deleted_at is null order by position, created_at, id",
      [w.tenantId, w.eg],
    )
  ).map((x) => `${x.position}:${x.name}`);

describe("K-804 グループを直す・並びを替える口（updateScope）", () => {
  it("K804-API-001 名前を直す（「　ＣＳ　窓口　」）：200・鍵がちょうど 10・name「CS 窓口」・短い名前・上のグループ・層は変わらない・証跡 scope.update 1 行（payload は変えた欄の名前だけ）", async () => {
    await h.ready();
    const w = await h.world();
    const before = await row(w.jd);
    const r = await edit(w.admin, w.jd, { name: "　ＣＳ　窓口　" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d).toMatchObject({ id: w.jd, name: "CS 窓口", ticket_prefix: "JD", parent_id: w.eg });
    expect(await row(w.jd)).toMatchObject({ name: "CS 窓口", ticket_prefix: before.ticket_prefix, parent_id: w.eg });
    expect(await h.audits(w.tenantId, "scope.update")).toBe(1);
    const a = await h.one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'scope.update'",
      [w.tenantId],
    );
    expect(a.payload).toEqual({ fields: ["name"] });
  });

  it("K804-API-002 色を直す：6 つのどれかなら 200・6 つ以外・空は 422・色だけ直しても名前と並びは変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const r = await edit(w.admin, w.jd, { color: "coral" });
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toMatchObject({ color: "coral", name: "受託開発" });
    for (const c of ["#FFFFFF", "blue", ""]) expect((await edit(w.admin, w.jd, { color: c })).status, c).toBe(422);
    expect((await row(w.jd)).color).toBe("coral");
  });

  it("K804-API-003 並びを替える：同じ上のグループの兄弟の中で位置を指す・範囲を超えた値は最後・前からの 0 の行も 1 から振り直す・上のグループが別の兄弟は動かない", async () => {
    await h.ready();
    const w = await h.world();
    const x = await h.addScope(w.tenantId, "広報", "PR", w.eg);
    const child = await h.addScope(w.tenantId, "広報の子", "PC", x);
    const r = await edit(w.admin, x, { position: 1 });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(((await h.json(r)).data as { position: number }).position).toBe(1);
    expect(await positions(w)).toEqual(["1:広報", "2:受託開発", "3:経理"]);
    const last = await edit(w.admin, x, { position: 99 });
    expect(((await h.json(last)).data as { position: number }).position).toBe(3);
    expect(await positions(w)).toEqual(["1:受託開発", "2:経理", "3:広報"]);
    expect((await row(child)).position).toBe(0);
    expect((await edit(w.admin, x, { position: 0 })).status).toBe(422);
  });

  it("K804-API-004 マネージャーを替える：指した人が manager・外れた人は member に下がる（所属は残る）・主の所属の人も行ができる・同じ人を 2 つのグループのマネージャーにできる（兼務・D-154.15）", async () => {
    await h.ready();
    const w = await h.world();
    const g = await h.addScope(w.tenantId, "広報", "PR", w.eg);
    await h.f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $2, $3, false, 'manager')",
      [w.tenantId, g, w.mgr.id],
    );
    const r = await edit(w.admin, g, { manager_member_ids: [w.member.id] });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data as { managers: { id: string; name: string }[]; member_count: number };
    expect(d.managers).toEqual([{ id: w.member.id, name: "鈴木 一郎" }]);
    expect(d.member_count).toBe(2);
    expect(await seat(g, w.mgr.id)).toEqual([{ role: "member", is_primary: false }]);
    expect(await seat(g, w.member.id)).toEqual([{ role: "manager", is_primary: false }]);
    // 佐藤は営業のマネージャーのまま、鈴木は営業のメンバーのまま広報のマネージャー（主の所属は営業）
    expect((await seat(w.eg, w.mgr.id))[0]!.role).toBe("manager");
    expect((await seat(w.eg, w.member.id))[0]!.role).toBe("member");
    const g2 = await h.addScope(w.tenantId, "経営企画", "KK", w.eg);
    const r2 = await edit(w.admin, g2, { manager_member_ids: [w.member.id, w.mgr.id] });
    expect(r2.status).toBe(200);
    expect(
      await h.num(
        "select count(*) as n from scope_memberships where member_id = $1 and role = 'manager' and deleted_at is null",
        [w.member.id],
      ),
    ).toBe(2);
    const cleared = await edit(w.admin, g2, { manager_member_ids: [] });
    expect(((await h.json(cleared)).data as { managers: unknown[] }).managers).toEqual([]);
    expect(await h.audits(w.tenantId, "scope.update")).toBe(3);
  });

  it("K804-API-005 マネージャーに選べない人：無い id・別の会社・抜けた人・AI → 404・止めた人 → 409（名前と訳）・閲覧のみ → 409・1 人でもだめなら何も変えない（名前も所属も証跡も）", async () => {
    await h.ready();
    const w = await h.world();
    const left = await h.make(w, "left", "抜けた人", { status: "left" });
    const before = await row(w.jd);
    const cases: [string[], number, string][] = [
      [[randomUUID()], 404, "E-GRP-015"],
      [[w.outsider.id], 404, "E-GRP-015"],
      [[left.id], 404, "E-GRP-015"],
      [[w.member.id, w.stopped.id], 409, "E-GRP-016"],
      [[w.viewer.id], 409, "E-GRP-017"],
    ];
    for (const [ids, status, code] of cases) {
      const r = await edit(w.admin, w.jd, { name: "変わらない", manager_member_ids: ids });
      expect(r.status, code).toBe(status);
      const j = await h.json(r);
      expect(j.code).toBe(code);
      expect(j.details).toBeUndefined();
      if (status === 404) expect(j.field).toBeUndefined();
    }
    expect(await row(w.jd)).toEqual(before);
    expect(await seat(w.jd, w.member.id)).toEqual([]);
    expect(await h.audits(w.tenantId, "scope.update")).toBe(0);
  });

  it("K804-API-006 同じ上のグループの下に同じ名前（大文字小文字・全角半角は同じ）→ 409・E-GRP-011（欄・details なし）。自分の名前を直す・消した兄弟と同じ名前は 200", async () => {
    await h.ready();
    const w = await h.world();
    const gone = await h.addScope(w.tenantId, "消した兄弟", "GG", w.eg);
    await h.f.admin.query("update scopes set deleted_at = now() where id = $1", [gone]);
    for (const n of ["経理", "ＡＢ"]) {
      if (n === "ＡＢ") await edit(w.admin, w.ac, { name: "AB" });
      const r = await edit(w.admin, w.jd, { name: n === "経理" ? "経理" : "ab" });
      expect(r.status, n).toBe(409);
      const j = await h.json(r);
      expect(j.code).toBe("E-GRP-011");
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
    }
    expect((await edit(w.admin, w.jd, { name: "受託開発" })).status).toBe(200);
    expect((await edit(w.admin, w.jd, { name: "消した兄弟" })).status).toBe(200);
  });

  it("K804-API-007 直す先が無い：無い id・別の会社のグループ・消したグループ → 404・E-GRP-002（欄・details なし）・別の会社のグループは変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const gone = await h.addScope(w.tenantId, "消した", "DD", w.eg);
    await h.f.admin.query("update scopes set deleted_at = now() where id = $1", [gone]);
    const theirs = w.other.rootScope;
    const before = await row(theirs);
    for (const id of [randomUUID(), theirs, gone]) {
      const r = await edit(w.admin, id, { name: "直す" });
      expect(r.status, id).toBe(404);
      const j = await h.json(r);
      expect(j.code).toBe("E-GRP-002");
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
    }
    expect(await row(theirs)).toEqual(before);
  });

  it("K804-API-008 入力の形：体が空・名前が空・101 文字・短い名前／上のグループ／層／番号の頭の次の番号を送る・manager_member_ids が 11 人 → 422・グループは変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const before = await row(w.jd);
    const bad: Record<string, unknown>[] = [
      {},
      { name: "" },
      { name: "あ".repeat(101) },
      { name: "x", ticket_prefix: "ZZ" },
      { name: "x", parent_id: w.eg },
      { name: "x", layer_id: randomUUID() },
      { name: "x", next_ticket_no: 99 },
      { manager_member_ids: Array.from({ length: 11 }, () => randomUUID()) },
    ];
    for (const b of bad) expect((await edit(w.admin, w.jd, b)).status, JSON.stringify(b).slice(0, 60)).toBe(422);
    expect(await row(w.jd)).toEqual(before);
    expect(await h.audits(w.tenantId, "scope.update")).toBe(0);
  });

  it("K804-API-009 権限：scopes の edit を付けた人は 200・マネージャー・メンバー・閲覧のみ・layers だけの人・止めた人は 403（変わらない）・ログインしていない 401・上限 1 回で 2 回目 429", async () => {
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
    const scopesP = await grant("scopes", "scopes");
    const layersP = await grant("layers", "layers");
    expect((await edit(scopesP, w.jd, { name: "権限で直した" })).status).toBe(200);
    for (const p of [w.mgr, w.member, w.viewer, layersP, w.stopped])
      expect((await edit(p, w.jd, { name: `だめ ${p.name}` })).status, p.name).toBe(403);
    expect((await row(w.jd)).name).toBe("権限で直した");
    expect((await h.f.req("PATCH", `/scopes/${w.jd}`, { body: { name: "x" } })).status).toBe(401);
    h.limits["updateScope"] = 1;
    try {
      expect((await edit(w.admin, w.jd, { name: "上限 1" })).status).toBe(200);
      expect((await edit(w.admin, w.jd, { name: "上限 2" })).status).toBe(429);
    } finally {
      h.limits["updateScope"] = 10_000;
    }
  });

  it("K804-API-010 操作の揺れ（G-16）：同じ名前への変更を同時に 2 本 → 200 と 409・3 つのグループの並びを同時に替えても 1 から重ならない連番", async () => {
    await h.ready();
    const w = await h.world();
    const rs = await Promise.all([edit(w.admin, w.jd, { name: "同時" }), edit(w.admin2, w.ac, { name: "同時" })]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const x = await h.addScope(w.tenantId, "広報", "PR", w.eg);
    const moves = await Promise.all([
      edit(w.admin, x, { position: 1 }),
      edit(w.admin2, w.jd, { position: 3 }),
      edit(w.admin, w.ac, { position: 2 }),
    ]);
    expect(moves.map((r) => r.status)).toEqual([200, 200, 200]);
    const o = await h.rows<{ position: number }>(
      "select position from scopes where tenant_id = $1 and parent_id = $2 and deleted_at is null order by position",
      [w.tenantId, w.eg],
    );
    expect(o.map((v) => v.position)).toEqual([1, 2, 3]);
  });

  it("K804-API-011 失敗（手順 S1）：scopes の update・所属の行・証跡で DB が落ちる → 503・E-PAGE-003・名前も並びも所属も証跡も前のまま。やり直すと 200", async () => {
    await h.ready();
    const w = await h.world();
    const before = await row(w.jd);
    for (const [table, op] of [
      ["scopes", "update"],
      ["scope_memberships", "insert"],
      ["audit_events", "insert"],
    ] as const)
      await h.breakOn(table, w.tenantId, op, async () => {
        const r = await edit(w.admin, w.jd, { name: "落ちる", position: 1, manager_member_ids: [w.member.id] });
        expect(r.status, table).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    expect(await row(w.jd)).toEqual(before);
    expect(await seat(w.jd, w.member.id)).toEqual([]);
    expect(await h.audits(w.tenantId, "scope.update")).toBe(0);
    expect((await edit(w.admin, w.jd, { name: "落ちない" })).status).toBe(200);
  });

  it("K804-API-012 反映：直した後、別の GET でメンバーの並び（K-419）を読むと新しい名前が出て、短い名前（code）は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    await edit(w.admin, w.jd, { name: "受託開発部" });
    const list = (await h.json(await h.call(w.admin, "GET", "/workspace/members"))).data as {
      groups: { id: string; code: string; name: string }[];
    };
    expect(list.groups.find((g) => g.id === w.jd)).toMatchObject({ name: "受託開発部", code: "JD" });
  });

  it("K804-DB-013 守り：kaname_app から直に呼べるのは app.scope_update だけ（scope_renumber は permission denied）。書けない人が直に呼ぶと forbidden・行は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    await expect(h.f.pool.query(`select app.scope_renumber('${w.eg}')`)).rejects.toThrow(/permission denied/);
    const before = await row(w.jd);
    const v = (
      await h.asOwner<{ v: { error?: string } }>(w.member, "select app.scope_update($1::uuid, $2::jsonb) as v", [
        w.jd,
        JSON.stringify({ name: "直に" }),
      ])
    )[0]!.v;
    expect(v).toMatchObject({ error: "forbidden" });
    expect(await row(w.jd)).toEqual(before);
    const ok = (
      await h.asOwner<{ v: { ok?: boolean } }>(w.admin, "select app.scope_update($1::uuid, $2::jsonb) as v", [
        w.jd,
        JSON.stringify({ name: "直に 2" }),
      ])
    )[0]!.v;
    expect(ok.ok).toBe(true);
  });

  it("K804-API-014 グループの一覧（listScopes・K-60 の口）：1 件に ScopeUpdated と同じ 10 の鍵がある（元の列 layer_id なども残る）・上のグループが先・兄弟は position の順・消したグループと別の会社のグループは出ない・meta.writable は今までどおり", async () => {
    await h.ready();
    const w = await h.world();
    await edit(w.admin, w.ac, { position: 1, color: "coral" });
    const gone = await h.addScope(w.tenantId, "消した", "DD", w.eg);
    await h.f.admin.query("update scopes set deleted_at = now() where id = $1", [gone]);
    const r = await h.call(w.admin, "GET", "/scopes");
    expect(r.status, await r.clone().text()).toBe(200);
    const j = (await h.json(r)) as unknown as { data: Record<string, unknown>[]; meta: { writable?: unknown } };
    expect(j.data.map((x) => x["name"])).toEqual(["営業", "経理", "受託開発"]);
    for (const x of j.data) {
      for (const k of KEYS) expect(Object.keys(x), `${x["name"]} の ${k}`).toContain(k);
      expect(Object.keys(x)).toContain("layer_id");
    }
    expect(j.data.find((x) => x["id"] === w.ac)).toMatchObject({
      color: "coral",
      position: 1,
      ticket_prefix: "AC",
      member_count: 0,
    });
    expect(Array.isArray(j.meta.writable)).toBe(true);
    expect(j.data.map((x) => x["id"])).not.toContain(w.other.rootScope);
  });

  it("K804-API-015 グループの一覧の権限と絞り込み：メンバー・閲覧のみも読める（今までどおり）・マネージャーの名前（managers）は会社の人に見える・layer_id の絞り込みは今までどおり・ログインしていない 401", async () => {
    await h.ready();
    const w = await h.world();
    await edit(w.admin, w.jd, { manager_member_ids: [w.mgr.id] });
    for (const p of [w.member, w.viewer]) {
      const r = await h.call(p, "GET", "/scopes");
      expect(r.status, p.name).toBe(200);
      const d = ((await h.json(r)) as unknown as { data: Record<string, unknown>[] }).data;
      expect(d.find((x) => x["id"] === w.jd)?.["managers"]).toEqual([{ id: w.mgr.id, name: "佐藤 花子" }]);
    }
    const layer = (
      await h.one<{ id: string }>(
        "insert into layers (tenant_id, key, label, order_no) values ($1, 'l_k804', '部門', 1) returning id",
        [w.tenantId],
      )
    ).id;
    await h.f.admin.query("update scopes set layer_id = $2 where id = $1", [w.jd, layer]);
    const byLayer = await h.call(w.admin, "GET", `/scopes?layer_id=${layer}`);
    expect(
      ((await h.json(byLayer)) as unknown as { data: Record<string, unknown>[] }).data.map((x) => x["id"]),
    ).toEqual([w.jd]);
    expect((await h.f.req("GET", "/scopes")).status).toBe(401);
  });
});
