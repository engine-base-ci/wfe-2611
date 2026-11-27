// K-978 運営がお知らせを出す（publishOpsNotice・POST /api/v1/ops/notices/:id/publish）と、1 社にお知らせを送る（sendWorkspaceNotice・POST /api/v1/ops/workspaces/:id/notices）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   出す日時が先なら予定（scheduled）・無いか過ぎていれば今出す（published・publish_at は今）。障害は今の状態（status_incidents）を「調べている」で 1 行。
//   メールは使えなくなるメンテだけ、届く会社の管理者へ（D-156.11・D-128.109・関門 C6）。鈴（notifications）には出さない（D-156.28）。
//   顧客に見えるかは K-954 の口（hooks notices-read）で確かめる。メールは土台の偽の mailer が数える
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
let staffA: Person;

beforeAll(async () => {
  t = await startOpsNotices("k978", ["ops-notices-publish", "notices-read"]);
  me = await t.ops("高本");
  noNotice = await t.ops("お金だけ", ["money"]);
  a = await t.ws("ミナト企画");
  b = await t.ws("北村デザイン");
  staffA = await t.member(a, "メンバー");
});
afterAll(async () => {
  await t.close();
});

const publish = async (id: string, who: Person = me) => {
  const r = await t.call(who, "POST", `/ops/notices/${id}/publish`, {});
  return { r, b: await t.json(r) };
};
const send = async (wsId: string, body: unknown, who: Person = me) => {
  const r = await t.call(who, "POST", `/ops/workspaces/${wsId}/notices`, body);
  return { r, b: await t.json(r) };
};
const dbRow = (id: string) =>
  t.row<{ state: string; pub: string | null; by: string | null; mailed: string | null }>(
    "select state, publish_at as pub, published_by as by, emailed_admins_at as mailed from notices where id = $1",
    [id],
  );
const incidents = (id: string) =>
  t.f.admin.query<{ state: string; started: string | null }>(
    "select state, started_at as started from status_incidents where notice_id = $1 and deleted_at is null",
    [id],
  );
const seenBy = async (who: Person, id: string): Promise<boolean> => {
  const r = await t.call(who, "GET", "/notices");
  return t.mine((await t.json(r)).data).some((x) => x["id"] === id);
};
const adminEmails = async (...ws: Ws[]): Promise<string[]> =>
  (
    await t.f.admin.query<{ email: string }>(
      `select u.email from tenant_memberships m join kaname_auth."user" u on u.id = m.auth_user_id
        where m.tenant_id = any($1::uuid[]) and m.role = 'admin' and m.status = 'active' and m.deleted_at is null`,
      [ws.map((w) => w.tenantId)],
    )
  ).rows
    .map((x) => x.email)
    .sort();
const bells = () =>
  t.n("select count(*) as n from notifications where tenant_id = any($1::uuid[])", [[a.tenantId, b.tenantId]]);
const maint = (title: string) =>
  t.notice({
    title,
    kind: "maintenance",
    tenantIds: [a.tenantId, b.tenantId],
    maintenance: { fromIn: 86_400, toIn: 90_000 },
  });

describe("K-978 出す", () => {
  it("K978-API-001 すぐ出す：201・16 欄・state published・publish_at は今（前後 1 分）。DB は published で出した人が自分", async () => {
    const id = await t.notice({ title: "すぐ", tenantIds: [a.tenantId] });
    const { r, b: body } = await publish(id);
    expect(r.status, JSON.stringify(body)).toBe(201);
    const d = body.data as Json;
    expect(Object.keys(d).sort()).toEqual(OPS_NOTICE_KEYS);
    expect(d["state"]).toBe("published");
    expect(Math.abs(new Date(String(d["publish_at"])).getTime() - Date.now())).toBeLessThan(60_000);
    const row = (await dbRow(id))!;
    expect([row.state, row.by]).toEqual(["published", me.id]);
  });

  it("K978-API-002 予定：出す日時が先なら scheduled（publish_at はそのまま）・過ぎた出す日時は今出す（published・publish_at は今）", async () => {
    const later = await t.notice({ title: "予定", publishIn: 3600 });
    const past = await t.notice({ title: "過ぎた予定", publishIn: -3600 });
    expect(((await publish(later)).b.data as Json)["state"]).toBe("scheduled");
    expect((await dbRow(later))!.state).toBe("scheduled");
    const d = (await publish(past)).b.data as Json;
    expect(d["state"]).toBe("published");
    expect(Math.abs(new Date(String(d["publish_at"])).getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("K978-API-003 顧客に見える：出したワークスペース向けは相手の会社の人の一覧に出て、ほかの会社には出ない。予定の前は誰にも出ない", async () => {
    const now = await t.notice({ title: "見える", tenantIds: [a.tenantId] });
    const later = await t.notice({ title: "まだ見えない", tenantIds: [a.tenantId], publishIn: 3600 });
    await publish(now);
    await publish(later);
    expect([await seenBy(staffA, now), await seenBy(b.admin, now), await seenBy(staffA, later)]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("K978-API-004 障害：出すと今の状態が「調べている」で 1 行（始まりは出した時刻）・答えの incident_state は investigating", async () => {
    const id = await t.notice({ title: "障害", kind: "incident", tenantIds: [a.tenantId] });
    const { b: body } = await publish(id);
    expect((body.data as Json)["incident_state"]).toBe("investigating");
    const rows = (await incidents(id)).rows;
    expect(rows.map((x) => x.state)).toEqual(["investigating"]);
    expect(rows[0]!.started).not.toBeNull();
  });

  it("K978-API-005 二重：出した・予定のお知らせをもう一度出すと 409 E-OPS-011・欄なし・状態の行は増えない", async () => {
    const id = await t.notice({ title: "二重", kind: "incident", tenantIds: [a.tenantId] });
    await publish(id);
    const later = await t.notice({ title: "予定の二重", publishIn: 3600 });
    await publish(later);
    for (const x of [id, later]) {
      const { r, b: body } = await publish(x);
      expect([r.status, body["code"], isFlat(body)]).toEqual([409, "E-OPS-011", true]);
    }
    expect((await incidents(id)).rows.length).toBe(1);
  });

  it("K978-API-006 メンテの時間が無いメンテは出せない：409 E-OPS-010・欄なし・下書きのまま・メールは送らない", async () => {
    const id = await t.notice({ title: "時間なし", kind: "maintenance", tenantIds: [a.tenantId] });
    const before = t.mails.calls.length;
    const { r, b: body } = await publish(id);
    expect([r.status, body["code"], isFlat(body)]).toEqual([409, "E-OPS-010", true]);
    expect((await dbRow(id))!.state).toBe("draft");
    expect(t.mails.calls.length).toBe(before);
  });

  it("K978-API-007 メンテのメール：届く 2 社の管理者にだけ 1 通ずつ（管理者でない人には送らない）・題がメールの件名に入る・emailed_admins_at が入る", async () => {
    const id = await maint("メンテのメール");
    t.mails.calls.length = 0;
    expect((await publish(id)).r.status).toBe(201);
    expect(t.mails.calls.map((m) => m.to).sort()).toEqual(await adminEmails(a, b));
    for (const m of t.mails.calls) expect(m.subject).toContain("メンテのメール");
    expect((await dbRow(id))!.mailed).not.toBeNull();
  });

  it("K978-API-023 止めている会社には届けない（D-156.82）：止めた会社も選んだメンテを出すと、メールは止めていない会社の管理者にだけ・止めた会社の管理者には 0 通・止めた会社の人の一覧に出ない", async () => {
    const stopped = await t.ws("止めた会社");
    await t.f.admin.query(
      "update tenants set stopped_at = now(), stop_on = (now() at time zone 'Asia/Tokyo')::date, stop_reason_key = 'unpaid' where id = $1",
      [stopped.tenantId],
    );
    const id = await t.notice({
      title: "止めた会社にはメンテのメールなし",
      kind: "maintenance",
      tenantIds: [a.tenantId, stopped.tenantId],
      maintenance: { fromIn: 86_400, toIn: 90_000 },
    });
    t.mails.calls.length = 0;
    expect((await publish(id)).r.status).toBe(201);
    expect(t.mails.calls.map((m) => m.to).sort()).toEqual(await adminEmails(a));
    const stoppedAdmins = await adminEmails(stopped);
    expect(stoppedAdmins).toHaveLength(1);
    expect(t.mails.calls.map((m) => m.to)).not.toContain(stoppedAdmins[0]);
    expect([await seenBy(a.admin, id), await seenBy(stopped.admin, id)]).toEqual([true, false]);
  });

  it("K978-API-008 メールはメンテだけ：リリースと障害を出してもメールは 0 通・emailed_admins_at は null", async () => {
    t.mails.calls.length = 0;
    for (const kind of ["release", "incident"] as const) {
      const id = await t.notice({ title: `${kind} はメールなし`, kind, tenantIds: [a.tenantId] });
      await publish(id);
      expect((await dbRow(id))!.mailed).toBeNull();
    }
    expect(t.mails.calls.length).toBe(0);
  });

  it("K978-API-009 メールが送れない：お知らせは出した（201・published）・ログに「[notices] メンテのメールを送れなかった（2 件）」が 1 行・宛先の字はログに無い", async () => {
    const id = await maint("送れないメール");
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    t.mails.fail = true;
    try {
      const { r, b: body } = await publish(id);
      expect([r.status, (body.data as Json)["state"]]).toEqual([201, "published"]);
      const lines = err.mock.calls.map((c) => c.join(" ")).filter((l) => l.includes("[notices]"));
      expect(lines).toEqual(["[notices] メンテのメールを送れなかった（2 件）"]);
      expect(lines.join("")).not.toContain("@");
    } finally {
      t.mails.fail = false;
      err.mockRestore();
    }
  });

  it("K978-API-010 鈴に出さない：出しても会社の人の notifications の行は増えない（メンテ・リリースとも）", async () => {
    const before = await bells();
    await publish(await maint("鈴なしメンテ"));
    await publish(await t.notice({ title: "鈴なしリリース", tenantIds: [a.tenantId, b.tenantId] }));
    expect(await bells()).toBe(before);
  });

  it("K978-API-011 記録：出すと運営の会社の記録に notice.publish が 1 行（対象 notices とその id）・payload に題の字が無い", async () => {
    const id = await t.notice({ title: "記録の題" });
    await publish(id);
    const rows = await t.f.admin.query<{ tt: string; p: Json }>(
      "select target_tenant_id::text as tt, payload as p from ops_audit_events where action = 'notice.publish' and target_id = $1",
      [id],
    );
    expect(rows.rows.map((x) => x.tt)).toEqual([OPS_TENANT]);
    expect(JSON.stringify(rows.rows[0]!.p)).not.toContain("記録の題");
  });

  it("K978-API-012 見えない：消したお知らせ・無い id は 404・欄なし", async () => {
    for (const id of [await t.notice({ title: "消した", deleted: true }), randomUUID()]) {
      const { r, b: body } = await publish(id);
      expect([r.status, isFlat(body)]).toEqual([404, true]);
    }
  });

  it("K978-API-013 守り：ログインなし 401・notice を持たない運営の人は 403 で下書きのまま", async () => {
    const id = await t.notice({ title: "守り" });
    expect((await t.call(null, "POST", `/ops/notices/${id}/publish`, {})).status).toBe(401);
    expect((await publish(id, noNotice)).r.status).toBe(403);
    expect((await dbRow(id))!.state).toBe("draft");
  });

  it("K978-API-014 DB が落ちた：出す関数を呼べないと 503 E-PAGE-003・下書きのまま・メールも送らない。戻すと 201", async () => {
    const id = await maint("落ちる");
    t.mails.calls.length = 0;
    const back = await t.breakFn("app.ops_notice_publish(uuid)");
    try {
      const { r, b: body } = await publish(id);
      expect([r.status, body["code"]]).toEqual([503, "E-PAGE-003"]);
    } finally {
      await back();
    }
    expect([(await dbRow(id))!.state, t.mails.calls.length]).toEqual(["draft", 0]);
    expect((await publish(id)).r.status).toBe(201);
  });

  it("K978-API-015 同時に 2 回出す：1 つが 201・もう 1 つが 409 E-OPS-011。障害の状態の行は 1 つ・記録も 1 行", async () => {
    const id = await t.notice({ title: "同時", kind: "incident", tenantIds: [a.tenantId] });
    const got = await Promise.all([publish(id), publish(id)]);
    expect(got.map((x) => x.r.status).sort()).toEqual([201, 409]);
    expect((await incidents(id)).rows.length).toBe(1);
    expect(
      await t.n("select count(*) as n from ops_audit_events where action = 'notice.publish' and target_id = $1", [id]),
    ).toBe(1);
  });
});

describe("K-978 1 社に送る", () => {
  const body = (o: Json = {}): Json => ({
    title: `${t.run} 1 社へ`,
    body: "請求書の宛名を直しました",
    placements: ["band", "list"],
    ...o,
  });
  const sent = (wsId: string) =>
    t.n("select count(*) as n from notices where tenant_id = $1 and title like $2 and $3 = any(target_tenant_ids)", [
      OPS_TENANT,
      `${t.run}%`,
      wsId,
    ]);

  it("K978-API-016 送る：201・16 欄・誰にはその 1 社だけ・state published・出す場所 band と list。その会社の人の一覧に出て、ほかの会社には出ない", async () => {
    const { r, b: res } = await send(a.tenantId, body());
    expect(r.status, JSON.stringify(res)).toBe(201);
    const d = res.data as Json;
    expect(Object.keys(d).sort()).toEqual(OPS_NOTICE_KEYS);
    expect([d["state"], d["audience"], [...(d["placements"] as string[])].sort()]).toEqual([
      "published",
      { mode: "workspaces", plans: [], workspaces: [{ id: a.tenantId, name: a.name }] },
      ["band", "list"],
    ]);
    expect([await seenBy(staffA, String(d["id"])), await seenBy(b.admin, String(d["id"]))]).toEqual([true, false]);
  });

  it("K978-API-022 管理者だけ：admins_only を付けて list だけで送ると 201・答えと DB の admins_only は true・その会社の管理者の一覧に出て、管理者でない人には出ない。上の帯と一緒は 422・行は増えない（D-156.57）", async () => {
    const { r, b: res } = await send(
      a.tenantId,
      body({ title: `${t.run} 管理者だけ`, placements: ["list"], admins_only: true }),
    );
    expect(r.status, JSON.stringify(res)).toBe(201);
    const d = res.data as Json;
    expect(d["admins_only"]).toBe(true);
    const id = String(d["id"]);
    expect((await t.row<{ x: boolean }>("select admins_only as x from notices where id = $1", [id]))?.x).toBe(true);
    expect([await seenBy(a.admin, id), await seenBy(staffA, id)]).toEqual([true, false]);
    const before = await t.n("select count(*)::int as n from notices where title = $1", [`${t.run} 管理者だけの帯`]);
    const bad = await send(
      a.tenantId,
      body({ title: `${t.run} 管理者だけの帯`, placements: ["band", "list"], admins_only: true }),
    );
    expect(bad.r.status).toBe(422);
    expect(await t.n("select count(*)::int as n from notices where title = $1", [`${t.run} 管理者だけの帯`])).toBe(
      before,
    );
  });

  it("K978-API-017 記録：その会社の運営の記録と会社の記録に notice.send が 1 行ずつ・target_label は会社名・payload に題と本文の字が無い", async () => {
    const { b: res } = await send(a.tenantId, body({ title: `${t.run} 記録の 1 社` }));
    const id = String((res.data as Json)["id"]);
    const e = await t.f.admin.query<{ p: Json }>(
      "select payload as p from ops_audit_events where target_tenant_id = $1 and action = 'notice.send' and target_id = $2",
      [a.tenantId, id],
    );
    expect(e.rows.length).toBe(1);
    expect(e.rows[0]!.p["target_label"]).toBe(a.name);
    expect(JSON.stringify(e.rows[0]!.p)).not.toMatch(/記録の 1 社|宛名を直しました/);
    expect(
      await t.n(
        "select count(*) as n from audit_events where tenant_id = $1 and action = 'notice.send' and target_id = $2",
        [a.tenantId, id],
      ),
    ).toBe(1);
  });

  it("K978-API-018 送れない会社：運営の会社・無い uuid・消した会社は 404・欄なし・行を作らない", async () => {
    const gone = await t.ws("消した会社");
    await t.f.admin.query("update tenants set deleted_at = now() where id = $1", [gone.tenantId]);
    for (const id of [OPS_TENANT, randomUUID(), gone.tenantId]) {
      const { r, b: res } = await send(id, body());
      expect([r.status, isFlat(res)]).toEqual([404, true]);
      expect(await sent(id)).toBe(0);
    }
    await t.f.admin.query("update tenants set deleted_at = null where id = $1", [gone.tenantId]);
  });

  it("K978-API-019 形の誤り：題が無い・出す場所が空・知らない鍵（kind）は 422 で行を作らない", async () => {
    const before = await sent(b.tenantId);
    const { title: _t, ...noTitle } = body();
    for (const x of [noTitle, body({ placements: [] }), body({ kind: "incident" })]) {
      expect((await send(b.tenantId, x)).r.status, JSON.stringify(x)).toBe(422);
    }
    expect(await sent(b.tenantId)).toBe(before);
  });

  it("K978-API-020 1 社に送るは届けるだけ：メールも鈴（notifications）も増えない", async () => {
    const before = await bells();
    t.mails.calls.length = 0;
    expect((await send(b.tenantId, body())).r.status).toBe(201);
    expect([await bells(), t.mails.calls.length]).toEqual([before, 0]);
  });

  it("K978-API-021 守り：notice を持たない運営の人は 403 で行を作らない", async () => {
    const before = await sent(b.tenantId);
    expect((await send(b.tenantId, body(), noNotice)).r.status).toBe(403);
    expect(await sent(b.tenantId)).toBe(before);
  });
});

describe("K-978 DB", () => {
  it("K978-DB-001 関数 2 つ（ops_notice_publish・ops_workspace_notice_send）は security definer・kaname_app は呼べ、PUBLIC は呼べない", async () => {
    const r = await t.f.admin.query<{ name: string; definer: boolean; app: boolean; pub: boolean }>(
      `select p.proname as name, p.prosecdef as definer,
              has_function_privilege('kaname_app', p.oid, 'execute') as app,
              exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       where a.grantee = 0 and a.privilege_type = 'EXECUTE') as pub
         from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'app' and p.proname in ('ops_notice_publish', 'ops_workspace_notice_send')
        order by p.proname`,
    );
    expect(r.rows.map((x) => x.name)).toEqual(["ops_notice_publish", "ops_workspace_notice_send"]);
    for (const x of r.rows) expect([x.definer, x.app, x.pub]).toEqual([true, true, false]);
  });

  it("K978-DB-002 2 層目：会社の人の文脈で出す・送る関数を呼ぶと 42501", async () => {
    const ctx = { tenantId: a.tenantId, userId: a.admin.id, role: "member" as const, stepUpAt: null };
    const id = await t.notice({ title: "会社の人から" });
    for (const sql of [
      `select app.ops_notice_publish('${id}')`,
      `select app.ops_workspace_notice_send('${a.tenantId}', '{"title":"x","body":"y","placements":["list"]}'::jsonb)`,
    ]) {
      await expect(withTenant(t.f.pool, ctx as never, (cl) => cl.query(sql))).rejects.toMatchObject({ code: "42501" });
    }
    expect((await dbRow(id))!.state).toBe("draft");
  });
});
