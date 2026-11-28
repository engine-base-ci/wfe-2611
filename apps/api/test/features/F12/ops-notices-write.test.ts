// K-1014 運営がお知らせを作る・直す（createOpsNotice・POST /api/v1/ops/notices／updateOpsNotice・PATCH /api/v1/ops/notices/:id）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えは K-1004 の OpsNoticeDetail の 16 欄（K-977 の app.ops_notice_detail が作る）。作るは下書き（出すのは K-978）。
//   誰に（D-156.33）：全部／プラン（鍵 → 運営の会社の plans.id）／ワークスペース（uuid → target_tenant_ids）。出す場所の band は DB の 'banner'。
//   出した後に直せるのは 題・本文・影響・メンテの時間だけ（種類・誰に・出す場所・予定の時刻は 409 E-OPS-009）
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
let b: Ws;

beforeAll(async () => {
  t = await startOpsNotices("k1014", ["ops-notices-write", "ops-notices-read"]);
  me = await t.ops("高本");
  noNotice = await t.ops("お金だけ", ["money"]);
  a = await t.ws("ミナト企画", { members: 2 });
  b = await t.ws("北村デザイン");
});
afterAll(async () => {
  await t.close();
});

const at = (sec: number) => new Date(Date.now() + sec * 1000).toISOString();
const base = (o: Json = {}): Json => ({
  kind: "release",
  title: `${t.run} 作った`,
  body: "チケットにスレッドができました",
  audience_mode: "all",
  placements: ["list"],
  ...o,
});
const create = async (body: unknown, who: Person = me) => {
  const r = await t.call(who, "POST", "/ops/notices", body);
  return { r, b: await t.json(r) };
};
const patch = async (id: string, body: unknown, who: Person = me) => {
  const r = await t.call(who, "PATCH", `/ops/notices/${id}`, body);
  return { r, b: await t.json(r) };
};
const dbRow = (id: string) =>
  t.row<{
    state: string;
    kind: string;
    title: string;
    placements: string[];
    plans: string[] | null;
    tenants: string[] | null;
    pub: string | null;
    mf: string | null;
    created_by: string | null;
  }>(
    `select state, kind_id as kind, title, placements, target_plan_ids as plans, target_tenant_ids as tenants,
            publish_at as pub, maintenance_from as mf, created_by from notices where id = $1`,
    [id],
  );
const mineCount = () =>
  t.n("select count(*) as n from notices where tenant_id = $1 and title like $2", [OPS_TENANT, `${t.run}%`]);

describe("K-1014 作る", () => {
  it("K1014-API-001 作る：201・答えは 16 欄・state draft・誰には全部・出す場所 list・出した人は自分・届く数あり。DB は下書きで作った人が自分", async () => {
    const { r, b: body } = await create(base());
    expect(r.status, JSON.stringify(body)).toBe(201);
    const d = body.data as Json;
    expect(Object.keys(d).sort()).toEqual(OPS_NOTICE_KEYS);
    expect([d["state"], d["audience"], d["placements"], d["author_name"]]).toEqual([
      "draft",
      { mode: "all", plans: [], workspaces: [] },
      ["list"],
      "運営 高本",
    ]);
    expect(Object.keys(d["reach"] as Json).sort()).toEqual(["members", "workspaces"]);
    const row = (await dbRow(String(d["id"])))!;
    expect([row.state, row.created_by]).toEqual(["draft", me.id]);
  });

  it("K1014-API-002 メンテ：時間と影響が入り、出す場所 band と list は DB で banner と list。答えの maintenance は { from, to }", async () => {
    const { r, b: body } = await create(
      base({
        kind: "maintenance",
        title: `${t.run} メンテ`,
        placements: ["band", "list"],
        maintenance_from: at(86_400),
        maintenance_to: at(90_000),
        impact: "画面・分身の実行・PC とのつながり",
      }),
    );
    expect(r.status, JSON.stringify(body)).toBe(201);
    const d = body.data as Json;
    expect([d["impact"], Object.keys(d["maintenance"] as Json).sort()]).toEqual([
      "画面・分身の実行・PC とのつながり",
      ["from", "to"],
    ]);
    expect([...(await dbRow(String(d["id"])))!.placements].sort()).toEqual(["banner", "list"]);
  });

  it("K1014-API-003 誰に：プランは鍵が運営の会社の plans.id になる・ワークスペースは target_tenant_ids に入る（答えは名前つき）", async () => {
    const p = await create(base({ audience_mode: "plans", audience_plans: ["team", "business"] }));
    expect(p.r.status).toBe(201);
    const pr = (await dbRow(String((p.b.data as Json)["id"])))!;
    expect([...(pr.plans ?? [])].sort()).toEqual([await t.planId("business"), await t.planId("team")].sort());
    const w = await create(base({ audience_mode: "workspaces", audience_workspace_ids: [a.tenantId, b.tenantId] }));
    expect(w.r.status).toBe(201);
    const d = w.b.data as Json;
    expect([...((await dbRow(String(d["id"])))!.tenants ?? [])].sort()).toEqual([a.tenantId, b.tenantId].sort());
    expect(((d["audience"] as Json)["workspaces"] as Json[]).map((x) => x["name"]).sort()).toEqual(
      [a.name, b.name].sort(),
    );
    expect(d["reach"]).toEqual({ workspaces: 2, members: 3 });
  });

  it("K1014-API-004 出す日時を付けても作るは下書きのまま（出すのは別の口）。publish_at は付けた時刻", async () => {
    const when = at(7200);
    const { b: body } = await create(base({ publish_at: when }));
    const d = body.data as Json;
    expect([d["state"], new Date(String(d["publish_at"])).toISOString()]).toEqual(["draft", when]);
  });

  it("K1014-API-005 形の誤り：必須の欄が無い・題 101 字・題か本文が空白だけ（D-156.38）・種類が違う・出す場所が空・知らない鍵・知らないプランの鍵・uuid でないワークスペース・NUL は 422 で行を作らない", async () => {
    const before = await mineCount();
    const { title: _t, ...noTitle } = base();
    void _t;
    for (const body of [
      noTitle,
      base({ title: `${t.run} ${"字".repeat(101)}` }),
      base({ title: "　 \t" }),
      base({ body: " \n　" }),
      base({ kind: "urgent" }),
      base({ placements: [] }),
      base({ color: "red" }),
      base({ audience_mode: "plans", audience_plans: ["gold"] }),
      base({ audience_mode: "workspaces", audience_workspace_ids: ["abc"] }),
      base({ title: `${t.run} 題\u0000` }),
    ]) {
      const { r } = await create(body);
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
    expect(await mineCount()).toBe(before);
  });

  it("K1014-API-006 組み合わせの決まり（契約の INPUT_RULES）：ワークスペースを選ぶのに並びが無い・プランで選ぶのに並びが無い・全部なのに並びがある・メンテの始まりだけ は 422", async () => {
    for (const body of [
      base({ audience_mode: "workspaces" }),
      base({ audience_mode: "plans" }),
      base({ audience_mode: "all", audience_workspace_ids: [a.tenantId] }),
      base({ kind: "maintenance", maintenance_from: at(3600) }),
    ]) {
      const { r } = await create(body);
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
  });

  it("K1014-API-007 メンテの終わりが始まりより前・同じ：409 E-OPS-014・欄なし・行を作らない", async () => {
    const before = await mineCount();
    for (const [f, to] of [
      [7200, 3600],
      [3600, 3600],
    ] as const) {
      const { r, b: body } = await create(
        base({ kind: "maintenance", maintenance_from: at(f), maintenance_to: at(to) }),
      );
      expect([r.status, body["code"], isFlat(body)]).toEqual([409, "E-OPS-014", true]);
    }
    expect(await mineCount()).toBe(before);
  });

  it("K1014-API-008 選べないワークスペース：運営の会社・無い uuid・消した会社を選ぶと 404・欄なし・行を作らない", async () => {
    const gone = await t.ws("消した会社");
    await t.f.admin.query("update tenants set deleted_at = now() where id = $1", [gone.tenantId]);
    const before = await mineCount();
    for (const id of [OPS_TENANT, randomUUID(), gone.tenantId]) {
      const { r, b: body } = await create(
        base({ audience_mode: "workspaces", audience_workspace_ids: [a.tenantId, id] }),
      );
      expect([r.status, isFlat(body)]).toEqual([404, true]);
    }
    expect(await mineCount()).toBe(before);
    await t.f.admin.query("update tenants set deleted_at = null where id = $1", [gone.tenantId]);
  });
});

describe("K-1014 直す", () => {
  it("K1014-API-009 一部だけ直す：題だけ送ると題だけ変わり、ほかはそのまま。200・16 欄", async () => {
    const id = await t.notice({ title: "直す前", body: "前の本文", placements: ["banner", "list"] });
    const { r, b: body } = await patch(id, { title: `${t.run} 直した後` });
    expect(r.status, JSON.stringify(body)).toBe(200);
    const d = body.data as Json;
    expect(Object.keys(d).sort()).toEqual(OPS_NOTICE_KEYS);
    expect([d["title"], d["body"], [...(d["placements"] as string[])].sort()]).toEqual([
      `${t.run} 直した後`,
      "前の本文",
      ["band", "list"],
    ]);
  });

  it("K1014-API-010 下書きは誰にも出す場所も変えられる：全部 → ワークスペース 1 社・list → band", async () => {
    const id = await t.notice({ title: "下書きを直す" });
    const { r } = await patch(id, {
      audience_mode: "workspaces",
      audience_workspace_ids: [a.tenantId],
      placements: ["band"],
    });
    expect(r.status).toBe(200);
    const row = (await dbRow(id))!;
    expect([row.tenants, row.placements]).toEqual([[a.tenantId], ["banner"]]);
  });

  it("K1014-API-011 出した後：題・本文・影響・メンテの時間は直せる。種類・誰に・出す場所・予定の時刻を変えると 409 E-OPS-009 で何も変わらない", async () => {
    const id = await t.notice({
      title: "出した後",
      kind: "maintenance",
      state: "published",
      publishIn: -60,
      maintenance: { fromIn: 3600, toIn: 7200 },
    });
    expect((await patch(id, { body: "時間が変わりました", impact: "画面", maintenance_to: at(9000) })).r.status).toBe(
      200,
    );
    for (const body of [
      { kind: "release" },
      { audience_mode: "workspaces", audience_workspace_ids: [a.tenantId] },
      { placements: ["band"] },
      { publish_at: at(3600) },
    ]) {
      const { r, b: res } = await patch(id, { ...body, title: `${t.run} 変わらない題` });
      expect([r.status, res["code"], isFlat(res)], JSON.stringify(body)).toEqual([409, "E-OPS-009", true]);
    }
    const row = (await dbRow(id))!;
    expect([row.kind, row.title, row.placements]).toEqual(["maintenance", `${t.run} 出した後`, ["list"]]);
  });

  it("K1014-API-012 見えない・無い：消したお知らせ・無い id は 404・欄なし。保存のメンテの時間と合わせて終わりが前になると 409 E-OPS-014", async () => {
    const del = await t.notice({ title: "消した", deleted: true });
    for (const id of [del, randomUUID()]) {
      const { r, b: body } = await patch(id, { title: `${t.run} x` });
      expect([r.status, isFlat(body)]).toEqual([404, true]);
    }
    const m = await t.notice({ title: "メンテ", kind: "maintenance", maintenance: { fromIn: 3600, toIn: 7200 } });
    const { r, b: body } = await patch(m, { maintenance_to: at(1800) });
    expect([r.status, body["code"]]).toEqual([409, "E-OPS-014"]);
  });
});

describe("K-1014 記録・守り・失敗", () => {
  it("K1014-API-013 記録：作ると notice.create・直すと notice.update が運営の会社の記録に 1 行ずつ（対象 notices とその id）。payload に題と本文の字を入れない", async () => {
    const { b: body } = await create(base({ title: `${t.run} 記録の題`, body: "記録の本文" }));
    const id = String((body.data as Json)["id"]);
    await patch(id, { body: "直した本文" });
    const rows = await t.f.admin.query<{ action: string; tt: string; p: Json }>(
      "select action, target_tenant_id::text as tt, payload as p from ops_audit_events where target_type = 'notices' and target_id = $1 order by occurred_at, id",
      [id],
    );
    expect(rows.rows.map((x) => [x.action, x.tt])).toEqual([
      ["notice.create", OPS_TENANT],
      ["notice.update", OPS_TENANT],
    ]);
    const text = JSON.stringify(rows.rows.map((x) => x.p));
    for (const s of ["記録の題", "記録の本文", "直した本文"]) expect(text).not.toContain(s);
  });

  it("K1014-API-014 守り：ログインなし 401・お知らせ（notice）を持たない運営の人は作るも直すも 403 で行を作らない・変えない", async () => {
    const id = await t.notice({ title: "守り" });
    expect((await t.call(null, "POST", "/ops/notices", base())).status).toBe(401);
    expect((await create(base(), noNotice)).r.status).toBe(403);
    expect((await patch(id, { title: `${t.run} 変えた` }, noNotice)).r.status).toBe(403);
    expect((await dbRow(id))!.title).toBe(`${t.run} 守り`);
  });

  it("K1014-API-015 DB が落ちた：作る関数を呼べないと 503 E-PAGE-003・行は残らない・記録も無い。戻すと 201", async () => {
    const before = await mineCount();
    const back = await t.breakFn("app.ops_notice_create(jsonb)");
    try {
      const { r, b: body } = await create(base({ title: `${t.run} 落ちる` }));
      expect([r.status, body["code"]]).toEqual([503, "E-PAGE-003"]);
    } finally {
      await back();
    }
    expect(await mineCount()).toBe(before);
    expect((await create(base({ title: `${t.run} 戻った` }))).r.status).toBe(201);
  });

  it("K1014-API-016 作る・直すは届けない：鈴（notifications）の行もメールも増えない", async () => {
    const before = await t.n("select count(*) as n from notifications where tenant_id = any($1::uuid[])", [
      [a.tenantId, b.tenantId],
    ]);
    const { b: body } = await create(base({ audience_mode: "workspaces", audience_workspace_ids: [a.tenantId] }));
    await patch(String((body.data as Json)["id"]), { body: "直した" });
    expect(
      await t.n("select count(*) as n from notifications where tenant_id = any($1::uuid[])", [
        [a.tenantId, b.tenantId],
      ]),
    ).toBe(before);
    expect(t.mails.calls.length).toBe(0);
  });
});

describe("K-1014 DB", () => {
  it("K1014-DB-001 関数 2 つ（ops_notice_create・ops_notice_update）は security definer・kaname_app は呼べ、PUBLIC は呼べない", async () => {
    const r = await t.f.admin.query<{ name: string; definer: boolean; app: boolean; pub: boolean }>(
      `select p.proname as name, p.prosecdef as definer,
              has_function_privilege('kaname_app', p.oid, 'execute') as app,
              exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       where a.grantee = 0 and a.privilege_type = 'EXECUTE') as pub
         from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'app' and p.proname in ('ops_notice_create', 'ops_notice_update')
        order by p.proname`,
    );
    expect(r.rows.map((x) => x.name)).toEqual(["ops_notice_create", "ops_notice_update"]);
    for (const x of r.rows) expect([x.definer, x.app, x.pub]).toEqual([true, true, false]);
  });

  it("K1014-DB-002 2 層目：会社の人の文脈で作る・直す関数を呼ぶと 42501 で行を作らない", async () => {
    const ctx = { tenantId: a.tenantId, userId: a.admin.id, role: "member" as const, stepUpAt: null };
    const before = await mineCount();
    const input = JSON.stringify(base({ title: `${t.run} 会社の人` }));
    for (const sql of [
      `select app.ops_notice_create('${input}'::jsonb)`,
      `select app.ops_notice_update('${randomUUID()}', '{}'::jsonb)`,
    ]) {
      await expect(withTenant(t.f.pool, ctx as never, (cl) => cl.query(sql))).rejects.toMatchObject({ code: "42501" });
    }
    expect(await mineCount()).toBe(before);
  });
});
