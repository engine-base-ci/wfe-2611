// K-1158 席（人数）の数え方 app.tenant_seat_count を「同じ会社の所属が消されておらず、状態が left でない人」に直す（K-961 の 1 か所の置き換え）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   所属の行が無い人（前からの試験の作り物）は今のまま数える。invited・suspended は代表の答え待ちで今のまま数える（保留）。
//   外す口（K-848 → K-849 の app.member_erase）は members.deleted_at・所属の status left・所属の deleted_at を同じ時刻で入れる。その形は DB に直に置く
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { startOpsWs, type OpsWs, type Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

let t: OpsWs;
let opsAll: Person;

beforeAll(async () => {
  t = await startOpsWs("k1158", ["ops-workspaces", "ops-workspace", "ops-workspace-billing", "plans"]);
  opsAll = await t.ops("全部");
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const seats = async (w: Ws) => (await t.row<{ n: number }>("select app.tenant_seat_count($1) as n", [w.tenantId]))!.n;
/** role member の所属を 1 人（作った順） */
const aMember = async (w: Ws) =>
  (await t.row<{ id: string }>(
    `select member_id as id from tenant_memberships
      where tenant_id = $1 and role = 'member' and deleted_at is null and status <> 'left'
      order by created_at, member_id limit 1`,
    [w.tenantId],
  ))!.id;
const setMembership = (w: Ws, member: string, sql: string) =>
  t.f.admin.query(`update tenant_memberships set ${sql} where tenant_id = $1 and member_id = $2`, [w.tenantId, member]);

describe("K-1158 席の数え方（app.tenant_seat_count）", () => {
  it("K1158-DB-001 所属を left にしただけ（members.deleted_at は空のまま）の人は数えない", async () => {
    const x = await t.ws("left だけ", { members: 4 });
    const n0 = await seats(x);
    await setMembership(x, await aMember(x), "status = 'left'");
    expect(await seats(x)).toBe(n0 - 1);
  });

  it("K1158-DB-002 所属の行に消した印（deleted_at）だけを入れた人は数えない", async () => {
    const x = await t.ws("所属を消しただけ", { members: 4 });
    const n0 = await seats(x);
    await setMembership(x, await aMember(x), "deleted_at = now()");
    expect(await seats(x)).toBe(n0 - 1);
  });

  it("K1158-DB-003 外す口（K-848 → K-849）の形：members.deleted_at・所属の status left・所属の deleted_at を同じ時刻で入れた人は数えない", async () => {
    const x = await t.ws("外す口の形", { members: 4 });
    const n0 = await seats(x);
    const one = await aMember(x);
    const at = (await t.row<{ at: string }>("select now()::text as at"))!.at;
    await t.f.admin.query("update members set deleted_at = $2::timestamptz where id = $1", [one, at]);
    await setMembership(x, one, `status = 'left', deleted_at = '${at}'::timestamptz`);
    expect(await seats(x)).toBe(n0 - 1);
  });

  it("K1158-DB-004 今のまま数える・数えない人：所属の行が無い人は数える・ゲスト（requester）は数えない（所属の行は会社と人で 1 つ＝0075 の unique）", async () => {
    const x = await t.ws("今のまま", { members: 2 });
    const n0 = await seats(x);
    await t.f.admin.query(
      `insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', 'k1158-所属なし')`,
      [x.tenantId, x.rootScope],
    );
    expect(await seats(x)).toBe(n0 + 1);
    await t.member(x, "ゲスト", { role: "requester" });
    expect(await seats(x)).toBe(n0 + 1);
  });

  it("K1158-DB-005 保留（代表の答え待ち）：所属の status が invited・suspended の人は今のまま数える", async () => {
    const x = await t.ws("保留", { members: 4 });
    const n0 = await seats(x);
    const a = await aMember(x);
    await setMembership(x, a, "status = 'suspended'");
    expect(await seats(x)).toBe(n0);
    const b = await aMember(x);
    await setMembership(x, b, "status = 'invited'");
    expect(await seats(x)).toBe(n0);
  });

  it("K1158-DB-006 関数の権限は今のまま：会社の人の文脈（kaname_app）では app.tenant_seat_count を直に呼べない（42501）", async () => {
    const x = await t.ws("権限", { members: 2 });
    const ctx: TenantContext = { tenantId: x.tenantId, userId: x.admin.id, role: "member" };
    const e = await withTenant(t.f.pool, ctx, (c) => c.query("select app.tenant_seat_count($1)", [x.tenantId])).then(
      () => null,
      (err: { code?: string }) => err,
    );
    expect(e?.code).toBe("42501");
  });
});

describe("K-1158 同じ数がどこでも出る", () => {
  it("K1158-API-001 所属を left にした会社で、運営の一覧の members.count・1 社の members.count・1 社の請求の members.count・顧客の選べるプランの meta.members が全部同じで、前より 1 少ない", async () => {
    const x = await t.ws("同じ数", { members: 4 });
    const all = async () => {
      const list = (await t.json(await t.call(opsAll, "GET", `/ops/workspaces?q=${encodeURIComponent(x.name)}`)))
        .data as Row[];
      const row = (list.find((i) => i["id"] === x.tenantId)!["members"] as Row)["count"];
      const one = (
        ((await t.json(await t.call(opsAll, "GET", `/ops/workspaces/${x.tenantId}`))).data as Row)["members"] as Row
      )["count"];
      const bill = (
        ((await t.json(await t.call(opsAll, "GET", `/ops/workspaces/${x.tenantId}/billing`))).data as Row)[
          "members"
        ] as Row
      )["count"];
      const plans = ((await t.json(await t.call(x.admin, "GET", "/workspace/plans"))).meta as Row)["members"];
      return [row, one, bill, plans];
    };
    const n0 = await seats(x);
    expect(await all()).toEqual([n0, n0, n0, n0]);
    await setMembership(x, await aMember(x), "status = 'left'");
    expect(await all()).toEqual([n0 - 1, n0 - 1, n0 - 1, n0 - 1]);
  });

  it("K1158-API-002 招く上限（K-1103 の app.seat_check）も同じ数：無料の満員（社内 3 人）は 1 人を招けない → 1 人の所属を left にすると 1 人を招ける", async () => {
    const x = await t.ws("招く上限", { plan: "free", members: 3 });
    const ctx: TenantContext = { tenantId: x.tenantId, userId: x.admin.id, role: "member" };
    const check = () =>
      withTenant(t.f.pool, ctx, (c) => c.query("select app.seat_check(1, '{}'::text[])")).then(
        () => "ok",
        (err: { message?: string }) => String(err.message ?? "ng"),
      );
    expect(await check()).not.toBe("ok");
    await setMembership(x, await aMember(x), "status = 'left'");
    expect(await check()).toBe("ok");
  });
});
