// K-810「メンバーの 1 人を読む口（getMember）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン。土台 admin.harness.ts）。
//   行 ID（K810-API-…／K810-DB-…）は 11_tickets/K-810.md の表と 1 対 1。答えの形は K-800 の契約（MemberDetail・鍵はちょうど 6）：
//     getMember GET /members/:id → 200 { data: { member, groups, assigned, clone, login, recent_events } }
//       member { id, name, email, role, suspended, suspended_at, since, self, is_owner, role_changed }
//       groups [{ id, name, code, primary, role }]（主の所属が先）  assigned { tickets, overdue, stuck, handing }
//       clone { pc, pc_days_away, device }  login { passkeys, has_password, two_factor, last_login_at }
//       recent_events [{ id, action, at, by }]（新しい順・5 件まで・payload は返さない）
//     「できること」（role_bundle・granted・revoked）は返さない（D-154.10）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupAdmin, type Person, type World } from "./admin.harness.js";

const h = setupAdmin();
type D = {
  member: Record<string, unknown>;
  groups: Record<string, unknown>[];
  assigned: Record<string, unknown>;
  clone: Record<string, unknown>;
  login: Record<string, unknown>;
  recent_events: Record<string, unknown>[];
};
const get = (p: Person, id: string) => h.call(p, "GET", `/members/${id}`);
const read = async (w: World, id: string, p: Person = w.admin) => {
  const r = await get(p, id);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await h.json(r)).data as unknown as D;
};
const TODAY = "(now() at time zone 'Asia/Tokyo')::date";

describe("K-810 メンバーの 1 人を読む口（getMember）", () => {
  it("K810-API-001 全部入りの人を読む：200・no-store・鍵がちょうど 6・member の鍵 10（is_owner を含む）・「できること」の鍵（role_bundle・granted・revoked）は無い", async () => {
    await h.ready();
    const w = await h.world();
    const r = await get(w.admin, w.member.id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as unknown as D;
    expect(Object.keys(d).sort()).toEqual(["assigned", "clone", "groups", "login", "member", "recent_events"]);
    expect(Object.keys(d.member).sort()).toEqual(
      ["email", "id", "is_owner", "name", "role", "role_changed", "self", "since", "suspended", "suspended_at"].sort(),
    );
    expect(d.member).toMatchObject({
      id: w.member.id,
      name: "鈴木 一郎",
      email: w.member.email,
      role: "member",
      suspended: false,
      suspended_at: null,
      is_owner: false,
      self: false,
      role_changed: null,
    });
    expect(String(d.member["since"])).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(JSON.stringify(d)).not.toMatch(/role_bundle|granted|revoked/);
    expect((await read(w, w.admin.id)).member["is_owner"]).toBe(true);
    expect((await read(w, w.admin2.id)).member["is_owner"]).toBe(false);
  });

  it("K810-API-002 グループと役割（兼務・D-154.15）：主の所属が先・兼ねるグループは作った順にそれぞれの役割（違う層のマネージャーを兼ねる・別の部署に作業員として入る）・会社の役割は member.role", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager'), ($1, $4, $3, 'member')",
      [w.tenantId, w.jd, w.mgr.id, w.ac],
    );
    const d = await read(w, w.mgr.id);
    expect(d.member["role"]).toBe("manager");
    expect(d.groups).toEqual([
      { id: w.eg, name: "営業", code: "EG", primary: true, role: "manager" },
      { id: w.jd, name: "受託開発", code: "JD", primary: false, role: "manager" },
      { id: w.ac, name: "経理", code: "AC", primary: false, role: "member" },
    ]);
    const admin = await read(w, w.admin.id);
    expect(admin.member["role"]).toBe("admin");
    expect(admin.groups[0]).toMatchObject({ id: w.eg, primary: true, role: null });
  });

  it("K810-API-003 自分を開く：member.self が true（止める・外すを押せない形にするための印）。管理者が自分を読める", async () => {
    await h.ready();
    const w = await h.world();
    const d = await read(w, w.admin.id);
    expect(d.member).toMatchObject({ id: w.admin.id, self: true, role: "admin" });
    expect((await read(w, w.member.id)).member["self"]).toBe(false);
  });

  it("K810-API-004 止まっている人：200・suspended true・suspended_at が入る・グループと担当は読める", async () => {
    await h.ready();
    const w = await h.world();
    const d = await read(w, w.stopped.id);
    expect(d.member).toMatchObject({ suspended: true, name: "止めた人" });
    expect(String(d.member["suspended_at"])).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(d.groups.length).toBeGreaterThan(0);
  });

  it("K810-API-005 役割を変えた人と日：audit_events の member.role_change の新しい物から role_changed ＝ { at, by（変えた人の名前）, from（前の役割） }・無ければ null", async () => {
    await h.ready();
    const w = await h.world();
    expect((await read(w, w.member.id)).member["role_changed"]).toBeNull();
    await h.f.admin.query(
      `insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, payload, occurred_at)
       values ($1, $2, 'admin', 'member.role_change', 'members', $3, '{"scope_id": null, "from": "manager", "to": "member"}'::jsonb, now() - interval '9 days'),
              ($1, $4, 'admin', 'member.role_change', 'members', $3, '{"scope_id": null, "from": "member", "to": "manager"}'::jsonb, now() - interval '2 days')`,
      [w.tenantId, w.admin.id, w.member.id, w.admin2.id],
    );
    const rc = (await read(w, w.member.id)).member["role_changed"] as Record<string, unknown>;
    expect(Object.keys(rc).sort()).toEqual(["at", "by", "from"]);
    expect(rc).toMatchObject({ by: "二人目の管理者", from: "member" });
  });

  it("K810-API-006 担当しているもの：tickets（担当で完了前）・overdue（期限が日本時間の今日より前）・stuck（7 日触っていない）・handing（渡し中＝待っている渡しの渡す側）。完了したものは数えない・ほかの人の担当は混ざらない", async () => {
    await h.ready();
    const w = await h.world();
    const t1 = await h.ticket(w, { assignee: w.member, dueSql: `${TODAY} + 3` });
    await h.ticket(w, { assignee: w.member, dueSql: `${TODAY} - 1` });
    await h.ticket(w, { assignee: w.member, dueSql: `${TODAY}`, staleDays: 8 });
    await h.ticket(w, { assignee: w.member, dueSql: `${TODAY} - 5`, completed: true });
    await h.ticket(w, { assignee: w.mgr, dueSql: `${TODAY} - 5` });
    await h.f.admin.query(
      "insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id, state, reason) values ($1, $2, 'pass', $3, $4, 'waiting', 'あとを頼む')",
      [w.tenantId, t1, w.member.id, w.mgr.id],
    );
    const d = await read(w, w.member.id);
    expect(d.assigned).toEqual({ tickets: 3, overdue: 1, stuck: 1, handing: 1 });
    expect((await read(w, w.viewer.id)).assigned).toEqual({ tickets: 0, overdue: 0, stuck: 0, handing: 0 });
  });

  it("K810-API-007 分身（PC）：pc は K-419 と同じ決め（今日 ok・3 日前 away と pc_days_away・無い never・閲覧のみ none）・device は最後の bridge の行の端末の名前（無ければ null）", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query(
      "insert into sessions (tenant_id, member_id, kind_id, device_label, last_seen_at) values ($1, $2, 'bridge', 'MacBook Air', now()), ($1, $3, 'bridge', 'Windows PC', now() - interval '3 days 2 hours'), ($1, $3, 'bridge', '古い PC', now() - interval '20 days')",
      [w.tenantId, w.admin.id, w.member.id],
    );
    expect((await read(w, w.admin.id)).clone).toEqual({ pc: "ok", pc_days_away: null, device: "MacBook Air" });
    expect((await read(w, w.member.id)).clone).toEqual({ pc: "away", pc_days_away: 3, device: "Windows PC" });
    expect((await read(w, w.mgr.id)).clone).toEqual({ pc: "never", pc_days_away: null, device: null });
    expect((await read(w, w.viewer.id)).clone).toEqual({ pc: "none", pc_days_away: null, device: null });
  });

  it("K810-API-008 ログイン：passkeys（本数）・has_password・two_factor・last_login_at（画面のセッションの issued_at のいちばん新しい物・失効した行も数える・無ければ null）", async () => {
    await h.ready();
    const w = await h.world();
    const uid = (await h.one<{ a: string }>("select auth_user_id as a from members where id = $1", [w.member.id])).a;
    await h.f.admin.query(
      `insert into kaname_auth.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       values ($1, $2, 'credential', $2, 'x', now(), now())`,
      [randomUUID(), uid],
    );
    await h.f.admin.query('update kaname_auth."user" set "twoFactorEnabled" = true where id = $1', [uid]);
    await h.f.admin.query(
      "insert into sessions (tenant_id, member_id, kind_id, issued_at, revoked_at) values ($1, $2, 'web', now() - interval '6 days', now()), ($1, $2, 'web', now() - interval '2 days', null), ($1, $2, 'bridge', now(), null)",
      [w.tenantId, w.member.id],
    );
    const d = await read(w, w.member.id);
    expect(d.login).toMatchObject({ passkeys: 0, has_password: true, two_factor: true });
    expect(Math.abs(new Date(String(d.login["last_login_at"])).getTime() - (Date.now() - 2 * 86_400_000))).toBeLessThan(
      120_000,
    );
    expect((await read(w, w.mgr.id)).login).toEqual({
      passkeys: 0,
      has_password: false,
      two_factor: false,
      last_login_at: null,
    });
  });

  it("K810-API-009 最近の記録：その人が起こした・その人に起きた記録を新しい順に 5 件まで・鍵は id・action・at・by だけ（payload・メール・ほかの会社の記録は出さない）", async () => {
    await h.ready();
    const w = await h.world();
    for (let i = 1; i <= 7; i++)
      await h.f.admin.query(
        `insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, payload, occurred_at)
         values ($1, $2, 'member', $3, 'members', $4, '{"秘密": "出さない"}'::jsonb, now() - ($5::text)::interval)`,
        [w.tenantId, i % 2 ? w.member.id : w.admin.id, `member.test${i}`, i % 2 ? w.mgr.id : w.member.id, `${i} hours`],
      );
    await h.f.admin.query(
      `insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id) values ($1, $2, 'member', 'member.other', 'members', $3)`,
      [w.other.tenantId, w.member.id, w.member.id],
    );
    const d = await read(w, w.member.id);
    expect(d.recent_events.length).toBe(5);
    expect(d.recent_events.map((e) => e["action"])).toEqual([
      "member.test1",
      "member.test2",
      "member.test3",
      "member.test4",
      "member.test5",
    ]);
    for (const e of d.recent_events) expect(Object.keys(e).sort()).toEqual(["action", "at", "by", "id"]);
    expect(JSON.stringify(d)).not.toContain("出さない");
    expect(JSON.stringify(d)).not.toContain("member.other");
    expect(d.recent_events[1]).toMatchObject({ by: "高本 聖斗" });
  });

  it("K810-API-010 読めない・もう居ない人：無い id・別の会社の人・外した人・消した人・AI → 404・E-MEM-002（欄・details なし）。中身（名前）を返さない", async () => {
    await h.ready();
    const w = await h.world();
    const left = await h.make(w, "left", "外した人", { status: "left" });
    const gone = await h.make(w, "gone", "消した人");
    await h.f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    const ai = (
      await h.one<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'ai_employee', 'AI') returning id",
        [w.tenantId, w.eg],
      )
    ).id;
    for (const id of [randomUUID(), w.outsider.id, left.id, gone.id, ai]) {
      const r = await get(w.admin, id);
      expect(r.status, id).toBe(404);
      const j = await h.json(r);
      expect(j.code).toBe("E-MEM-002");
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
      expect(JSON.stringify(j)).not.toContain("外した人");
    }
  });

  it("K810-API-011 権限：管理者・members の view を付けた人は 200・マネージャー・メンバー・閲覧のみ・止めた人は 403（中身なし）・ログインしていない 401。別の会社の管理者はこの会社の人を読めない", async () => {
    await h.ready();
    const w = await h.world();
    const viewer = await h.make(w, "viewgrant", "見る権限の人");
    await h.f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'view')",
      [w.tenantId, viewer.id],
    );
    expect((await get(viewer, w.member.id)).status).toBe(200);
    for (const p of [w.mgr, w.member, w.viewer, w.stopped]) {
      const r = await get(p, w.member.id);
      expect(r.status, p.name).toBe(403);
      expect((await h.json(r)).data).toBeUndefined();
    }
    expect((await h.f.req("GET", `/members/${w.member.id}`)).status).toBe(401);
    expect((await get(w.outsider, w.member.id)).status).toBe(404);
  });

  it("K810-API-012 失敗：DB の関数が落ちる → 503・E-PAGE-003（画面は「読めません」・md-failed）・何も書かない", async () => {
    await h.ready();
    const w = await h.world();
    await h.breakPool(["getMember"], async () => {
      const r = await get(w.admin, w.member.id);
      expect(r.status).toBe(503);
      expect((await h.json(r)).code).toBe("E-PAGE-003");
    });
    expect((await get(w.admin, w.member.id)).status).toBe(200);
  });

  it("K810-DB-013 守り：app.member_detail は kaname_app に渡してある・見る権限の無い人が直に呼ぶと forbidden・別の会社の人は member_gone・書かない（証跡を増やさない）", async () => {
    await h.ready();
    const w = await h.world();
    const call = (p: Person, id: string) =>
      h.asOwner<{ v: { error?: string; ok?: boolean } }>(p, "select app.member_detail($1::uuid) as v", [id]);
    expect((await call(w.member, w.admin.id))[0]!.v).toMatchObject({ error: "forbidden" });
    expect((await call(w.admin, w.outsider.id))[0]!.v).toMatchObject({ error: "member_gone" });
    expect((await call(w.admin, w.member.id))[0]!.v.ok).toBe(true);
    expect(await h.num("select count(*) as n from audit_events where tenant_id = $1", [w.tenantId])).toBe(0);
  });
});
