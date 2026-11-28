// K-979 運営が障害の続報を足す（addIncidentUpdate・POST /api/v1/ops/notices/:id/updates）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   障害の状態は 4 つ（調べている → 原因が分かった → 様子を見ている → 直った・D-125.127）。続報は notice_updates に 1 行と、
//   今の状態（status_incidents.state）を同じ取引で直す。直ったら resolved_at。足せるのは出した障害だけ・直った後は足せない。
//   顧客の側の見え方は K-954 の口（hooks notices-read の updates と state）で確かめる
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenant } from "@kaname/db/context";
import { startOpsNotices, OPS_NOTICE_KEYS, type OpsNotices } from "./ops-notice.harness.js";
import { isFlat, OPS_TENANT, type Json, type Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

let t: OpsNotices;
let me: Person;
let noNotice: Person;
let a: Ws;

beforeAll(async () => {
  t = await startOpsNotices("k979", ["ops-notices-incident", "notices-read"]);
  me = await t.ops("高本");
  noNotice = await t.ops("お金だけ", ["money"]);
  a = await t.ws("ミナト企画");
});
afterAll(async () => {
  await t.close();
});

/** 出した障害（今の状態の行つき） */
const live = async (title: string, state = "investigating"): Promise<string> => {
  const id = await t.notice({ title, kind: "incident", state: "published", publishIn: -600, tenantIds: [a.tenantId] });
  await t.incident(id, state);
  return id;
};
const add = async (id: string, body: unknown, who: Person = me) => {
  const r = await t.call(who, "POST", `/ops/notices/${id}/updates`, body);
  return { r, b: await t.json(r) };
};
const now = (id: string) =>
  t.row<{ state: string; resolved: string | null; n: string }>(
    `select state, resolved_at as resolved, (select count(*) from status_incidents where notice_id = $1 and deleted_at is null) as n
       from status_incidents where notice_id = $1 and deleted_at is null order by created_at desc limit 1`,
    [id],
  );
const ups = (id: string) =>
  t.f.admin.query<{ state: string; body: string }>(
    "select state, body from notice_updates where notice_id = $1 and deleted_at is null order by created_at, id",
    [id],
  );

describe("K-979 続報", () => {
  it("K979-API-001 足す：201・16 欄・incident_state は足した状態・updates の最後が足した続報", async () => {
    const id = await live("遅れています");
    const { r, b: body } = await add(id, { state: "identified", body: "送る順番の仕組みが詰まっていました" });
    expect(r.status, JSON.stringify(body)).toBe(201);
    const d = body.data as Json;
    expect(Object.keys(d).sort()).toEqual(OPS_NOTICE_KEYS);
    expect(d["incident_state"]).toBe("identified");
    const last = (d["updates"] as Json[]).at(-1)!;
    expect([last["state"], last["body"]]).toEqual(["identified", "送る順番の仕組みが詰まっていました"]);
  });

  it("K979-API-002 同じ取引で 2 つ：notice_updates に 1 行増え、今の状態の行の state も同じ値（行は 1 つのまま）", async () => {
    const id = await live("2 つ");
    await add(id, { state: "monitoring", body: "様子を見ています" });
    expect((await ups(id)).rows).toEqual([{ state: "monitoring", body: "様子を見ています" }]);
    const s = (await now(id))!;
    expect([s.state, Number(s.n)]).toEqual(["monitoring", 1]);
  });

  it("K979-API-003 直った：resolved_at が入り、答えの state は resolved・incident_state は resolved", async () => {
    const id = await live("直る", "monitoring");
    const { b: body } = await add(id, { state: "resolved", body: "直りました" });
    const d = body.data as Json;
    expect([d["state"], d["incident_state"]]).toEqual(["resolved", "resolved"]);
    expect((await now(id))!.resolved).not.toBeNull();
  });

  it("K979-API-004 直った後は足せない：409 E-OPS-013・欄なし・続報の行は増えない", async () => {
    const id = await live("直った後");
    await add(id, { state: "resolved", body: "直りました" });
    const { r, b: body } = await add(id, { state: "monitoring", body: "やはり遅い" });
    expect([r.status, body["code"], isFlat(body)]).toEqual([409, "E-OPS-013", true]);
    expect((await ups(id)).rows.length).toBe(1);
  });

  it("K979-API-005 障害で出した物だけ：リリース・メンテ・下書きの障害・予定の前の障害は 409 E-OPS-012・欄なし・行を作らない", async () => {
    const ids = [
      await t.notice({ title: "リリース", state: "published", publishIn: -60 }),
      await t.notice({ title: "メンテ", kind: "maintenance", state: "published", publishIn: -60 }),
      await t.notice({ title: "下書きの障害", kind: "incident" }),
      await t.notice({ title: "予定の障害", kind: "incident", state: "scheduled", publishIn: 3600 }),
    ];
    for (const id of ids) {
      const { r, b: body } = await add(id, { state: "identified", body: "x" });
      expect([r.status, body["code"], isFlat(body)]).toEqual([409, "E-OPS-012", true]);
      expect((await ups(id)).rows.length).toBe(0);
    }
  });

  it("K979-API-006 今の状態の行が無い出した障害（前のデータ）：足すと 201 で今の状態の行を 1 つ作る", async () => {
    const id = await t.notice({ title: "行なし", kind: "incident", state: "published", publishIn: -60 });
    expect((await add(id, { state: "identified", body: "原因が分かりました" })).r.status).toBe(201);
    const s = (await now(id))!;
    expect([s.state, Number(s.n)]).toEqual(["identified", 1]);
  });

  it("K979-API-007 顧客に見える：届く会社の人の一覧で、そのお知らせの state が足した状態・updates の最後が続報", async () => {
    const id = await live("顧客の見え方");
    await add(id, { state: "monitoring", body: "様子を見ています" });
    const r = await t.call(a.admin, "GET", "/notices");
    const row = t.mine((await t.json(r)).data).find((x) => x["id"] === id)!;
    expect(row["state"]).toBe("monitoring");
    expect(((row["updates"] as Json[]).at(-1) as Json)["body"]).toBe("様子を見ています");
  });

  it("K979-API-008 形の誤り：状態が違う・本文が無い・空・4001 字・NUL・知らない鍵は 422 で行を作らない", async () => {
    const id = await live("形");
    for (const body of [
      { state: "fixed", body: "x" },
      { state: "identified" },
      { state: "identified", body: "" },
      { state: "identified", body: "字".repeat(4001) },
      { state: "identified", body: "途中\u0000" },
      { state: "identified", body: "x", notify: true },
    ]) {
      expect((await add(id, body)).r.status, JSON.stringify(body).slice(0, 80)).toBe(422);
    }
    expect((await ups(id)).rows.length).toBe(0);
  });

  it("K979-API-009 見えない：消したお知らせ・無い id・顧客の会社の行は 404・欄なし", async () => {
    const del = await t.notice({
      title: "消した",
      kind: "incident",
      state: "published",
      publishIn: -60,
      deleted: true,
    });
    const foreign = randomUUID();
    await t.f.admin.query(
      "insert into notices (id, tenant_id, kind_id, title, body, state) values ($1, $2, 'incident', $3, '本文', 'published')",
      [foreign, a.tenantId, `${t.run} 顧客の会社の障害`],
    );
    for (const id of [del, randomUUID(), foreign]) {
      const { r, b: body } = await add(id, { state: "identified", body: "x" });
      expect([r.status, isFlat(body)]).toEqual([404, true]);
    }
    await t.f.admin.query("delete from notices where id = $1", [foreign]);
  });

  it("K979-API-010 守り：ログインなし 401・notice を持たない運営の人は 403 で行を作らない", async () => {
    const id = await live("守り");
    expect((await t.call(null, "POST", `/ops/notices/${id}/updates`, { state: "identified", body: "x" })).status).toBe(
      401,
    );
    expect((await add(id, { state: "identified", body: "x" }, noNotice)).r.status).toBe(403);
    expect((await ups(id)).rows.length).toBe(0);
  });

  it("K979-API-011 記録：運営の会社の記録に notice.incident_update が 1 行・payload は状態だけで本文の字が無い", async () => {
    const id = await live("記録");
    await add(id, { state: "identified", body: "記録の本文" });
    const rows = await t.f.admin.query<{ tt: string; p: Json }>(
      "select target_tenant_id::text as tt, payload as p from ops_audit_events where action = 'notice.incident_update' and target_id = $1",
      [id],
    );
    expect(rows.rows.map((x) => [x.tt, x.p["state"]])).toEqual([[OPS_TENANT, "identified"]]);
    expect(JSON.stringify(rows.rows[0]!.p)).not.toContain("記録の本文");
  });

  it("K979-API-012 DB が落ちた：今の状態の行に書けないと 503 E-PAGE-003・続報の行も増えず、今の状態も前のまま", async () => {
    const id = await live("落ちる");
    const back = await t.breakWrites("status_incidents", { notice_id: id });
    try {
      const { r, b: body } = await add(id, { state: "identified", body: "x" });
      expect([r.status, body["code"]]).toEqual([503, "E-PAGE-003"]);
    } finally {
      await back();
    }
    expect([(await ups(id)).rows.length, (await now(id))!.state]).toEqual([0, "investigating"]);
  });

  it("K979-API-013 同時に 2 つ足す：どちらも 201・続報は 2 行・今の状態は最後に足した続報の状態と同じ", async () => {
    const id = await live("同時");
    const got = await Promise.all([
      add(id, { state: "identified", body: "1 つ目" }),
      add(id, { state: "monitoring", body: "2 つ目" }),
    ]);
    expect(got.map((x) => x.r.status)).toEqual([201, 201]);
    const rows = (await ups(id)).rows;
    expect(rows.length).toBe(2);
    expect((await now(id))!.state).toBe(rows.at(-1)!.state);
  });

  it("K979-API-014 続報は届けるだけ：鈴（notifications）の行もメールも増えない", async () => {
    const id = await live("鈴なし");
    const before = await t.n("select count(*) as n from notifications where tenant_id = $1", [a.tenantId]);
    t.mails.calls.length = 0;
    await add(id, { state: "identified", body: "x" });
    expect([
      await t.n("select count(*) as n from notifications where tenant_id = $1", [a.tenantId]),
      t.mails.calls.length,
    ]).toEqual([before, 0]);
  });
});

describe("K-979 DB", () => {
  it("K979-DB-001 関数 ops_notice_incident_update は security definer・kaname_app は呼べ、PUBLIC は呼べない", async () => {
    const r = await t.f.admin.query<{ definer: boolean; app: boolean; pub: boolean }>(
      `select p.prosecdef as definer, has_function_privilege('kaname_app', p.oid, 'execute') as app,
              exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       where a.grantee = 0 and a.privilege_type = 'EXECUTE') as pub
         from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'app' and p.proname = 'ops_notice_incident_update'`,
    );
    expect(r.rows).toEqual([{ definer: true, app: true, pub: false }]);
  });

  it("K979-DB-002 2 層目：会社の人の文脈で呼ぶと 42501 で行を作らない", async () => {
    const id = await live("会社の人から");
    const ctx = { tenantId: a.tenantId, userId: a.admin.id, role: "member" as const, stepUpAt: null };
    await expect(
      withTenant(t.f.pool, ctx as never, (cl) =>
        cl.query("select app.ops_notice_incident_update($1, 'identified', 'x')", [id]),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect((await ups(id)).rows.length).toBe(0);
  });
});
