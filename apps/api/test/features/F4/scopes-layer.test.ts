// K-249「グループの一覧の口に層の絞り込み（layer_id）を足す」の単体の試験（口・本物の DB）。行 ID（K249-API-…）は 11_tickets/K-249.md の表と 1 対 1。
// 口：GET /api/v1/scopes（listScopes・K-60 が作った）。契約には問い合わせ layer_id（その層のグループだけ）が在るのに、今の口は読まずに全部を返す。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
let me: Person;
let tenantId: string;
let deptLayer: string;
let teamLayer: string;
let sales: string;
let acct: string;
let team: string;
let otherLayer: string;
let editor: Person;
let gone: string;

const ids = async (q = "") => {
  const r = await f.req("GET", `/scopes${q ? `?${q}` : ""}`, { headers: me.auth });
  expect(r.status, await r.clone().text()).toBe(200);
  return (((await r.json()) as { data: { id: string }[] }).data ?? []).map((s) => s.id).sort();
};
const one = async (sql: string, p: unknown[]) => (await f.admin.query<{ id: string }>(sql, p)).rows[0]!.id;

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  const c = await f.company(`K249 の会社 ${randomUUID().slice(0, 6)}`, "EG");
  tenantId = c.tenantId;
  deptLayer = await one(
    "insert into layers (tenant_id, key, label, order_no) values ($1, 'dept', '部門', 1) returning id",
    [tenantId],
  );
  teamLayer = await one(
    "insert into layers (tenant_id, key, label, order_no) values ($1, 'team', 'チーム', 2) returning id",
    [tenantId],
  );
  sales = await one(
    "insert into scopes (tenant_id, parent_id, layer_id, name, ticket_prefix) values ($1, $2, $3, '営業', 'SL') returning id",
    [tenantId, c.rootScope, deptLayer],
  );
  acct = await one(
    "insert into scopes (tenant_id, parent_id, layer_id, name, ticket_prefix) values ($1, $2, $3, '経理', 'KR') returning id",
    [tenantId, c.rootScope, deptLayer],
  );
  team = await one(
    "insert into scopes (tenant_id, parent_id, layer_id, name, ticket_prefix) values ($1, $2, $3, '営業 1 課', 'S1') returning id",
    [tenantId, sales, teamLayer],
  );
  me = await f.person(tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
  for (const s of [sales, acct, team])
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'view')",
      [tenantId, me.id, s],
    );
  // 書けるグループは営業だけの人（全体は見るだけ）
  editor = await f.person(tenantId, c.rootScope, { name: "営業の人", ticketAbility: "view" });
  await f.admin.query(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'edit')",
    [tenantId, editor.id, sales],
  );
  gone = await one(
    "insert into scopes (tenant_id, parent_id, layer_id, name, ticket_prefix, deleted_at) values ($1, $2, $3, '消した部門', 'GN', now()) returning id",
    [tenantId, c.rootScope, deptLayer],
  );
  const o = await f.company(`K249 の別の会社 ${randomUUID().slice(0, 6)}`, "OT");
  otherLayer = await one(
    "insert into layers (tenant_id, key, label, order_no) values ($1, 'dept', '部門', 1) returning id",
    [o.tenantId],
  );
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-249 グループの一覧の層の絞り込み", () => {
  it("K249-API-001 layer_id を付けると、その層のグループだけ（部門の層：営業・経理／チームの層：営業 1 課）。書けるグループ（meta.writable）は絞った中だけ", async () => {
    expect(await ids(`layer_id=${deptLayer}`)).toEqual([sales, acct].sort());
    expect(await ids(`layer_id=${teamLayer}`)).toEqual([team]);
    const r = await f.req("GET", `/scopes?layer_id=${deptLayer}`, { headers: editor.auth });
    expect(r.status, await r.clone().text()).toBe(200);
    const body = (await r.json()) as { data: { id: string }[]; meta: { writable?: string[] } };
    const got = body.data.map((s) => s.id);
    expect(got.sort()).toEqual([sales, acct].sort());
    expect([...(body.meta.writable ?? [])].sort()).toEqual([sales]);
    for (const w of body.meta.writable ?? []) expect(got).toContain(w);
  });

  it("K249-API-002 layer_id が無い・空の値（?layer_id=）なら今までどおり見えるグループ全部（どちらも同じ id）", async () => {
    const all = await ids();
    for (const s of [sales, acct, team]) expect(all).toContain(s);
    expect(await ids("layer_id=")).toEqual(all);
  });

  it("K249-API-003 layer_id が uuid でないと 422・欄の名前 layer_id", async () => {
    const r = await f.req("GET", "/scopes?layer_id=abc", { headers: me.auth });
    expect(r.status).toBe(422);
    const fields = (((await r.json()) as { details?: { field: string }[] }).details ?? []).map((d) => d.field);
    expect(fields).toContain("layer_id");
  });

  it("K249-API-004 別の会社の層・無い層の id は 0 件（200・中身を漏らさない）", async () => {
    expect(await ids(`layer_id=${otherLayer}`)).toEqual([]);
    expect(await ids(`layer_id=${randomUUID()}`)).toEqual([]);
  });

  it("K249-API-005 部門の層に消したグループがあっても、layer_id で絞った一覧に出ない", async () => {
    const got = await ids(`layer_id=${deptLayer}`);
    expect(got).not.toContain(gone);
    expect(got).toEqual([sales, acct].sort());
  });
});
