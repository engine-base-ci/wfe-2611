// K-838「ワークスペースから抜ける」の口の試験（本物の DB・偽の画面のログイン。土台 me.harness.ts）。行 ID（K838-API-…）は 11_tickets/K-838.md の表と 1 対 1。
//   leaveWorkspace DELETE /me/workspaces/:id（:id は抜ける会社の id・本人確認の取り直しが要る）→ 200 { data: { tenant_id, left: true, restorable_until } }
//   抜けられるのは、その会社に担当が残っていなくて最後の管理者でないとき（D-154.19・D-128.65）。抜けると、その会社の個人の物をすぐ消し（外すのと同じ app.member_erase・K-849）、
//   その会社の画面・PC のセッションを切る（G-14）。同じログインのほかの会社には触らない。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupMe, type MeWorld, type P } from "./me.harness.js";

const h = setupMe("me-leave.ts", { extraHooks: ["me-profile.ts"] });
const leave = (p: P, tenantId: string, o: { su?: number; key?: string } = {}) =>
  h.call(p, "DELETE", `/me/workspaces/${tenantId}`, { su: o.su ?? h.suNow(), ...(o.key ? { key: o.key } : {}) });
const alive = async (auth: string) =>
  (await h.f.admin.query("select * from app.session_alive($1)", [auth])).rows.length;
const tm = (p: P) => h.one<{ status: string }>("select status from tenant_memberships where member_id = $1", [p.id]);
const gone = async (p: P) =>
  (await h.one<{ d: Date | null }>("select deleted_at as d from members where id = $1", [p.id])).d;
const tasks = (tenant: string, scope: string, who: P, done = false) =>
  h.f.admin.query(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, completed_at, completed_by)
     values ($1, $2, '', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null), (select id from ticket_stages where tenant_id = $1 and key = 'doing'), '担当の試験', $3, $3, case when $4 then now() end, case when $4 then $3::uuid end)`,
    [tenant, scope, who.id, done],
  );
/** 同じログインの人を別の会社にも入れる（その会社の管理者は 1 人・その人が自分以外の管理者） */
async function company(w: MeWorld, me: P, role: "member" | "admin" = "member") {
  const co = await h.f.company(`抜ける会社-${randomUUID().slice(0, 4)}`, "ZZ");
  const mine = await h.f.alsoIn(me, co.tenantId, co.rootScope);
  await h.f.admin.query("update tenant_memberships set role = $2 where member_id = $1", [mine.id, role]);
  const boss = await h.make({ tenantId: co.tenantId, eg: co.rootScope }, "boss", "その会社の管理者", {
    role: "admin",
    owner: true,
  });
  void w;
  return { co, mine, boss };
}

describe("K-838 ワークスペースから抜ける（leaveWorkspace）", () => {
  it("K838-API-001 抜ける：200・left true・restorable_until は 30 日後・その会社の所属が left・人の行に抜けた印・その会社の会社の記録に member.left・同じログインの今の会社は変わらず入れる・読み直すと抜けた会社は出ない・その会社のほかの人は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine, boss } = await company(w, w.member);
    const r = await leave(w.member, co.tenantId);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["left", "restorable_until", "tenant_id"]);
    expect(d).toMatchObject({ tenant_id: co.tenantId, left: true });
    const days = (Date.parse(String(d["restorable_until"])) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    expect((await tm(mine)).status).toBe("left");
    expect(await gone(mine)).not.toBeNull();
    expect(await h.audits(co.tenantId, "member.left")).toBe(1);
    expect((await tm(w.member)).status).toBe("active");
    expect(await gone(w.member)).toBeNull();
    expect((await tm(boss)).status).toBe("active");
    const ws = (
      (await h.json(await h.call(w.member, "GET", "/me"))).data!["workspaces"] as { tenant_id: string }[]
    ).map((x) => x.tenant_id);
    expect(ws).toEqual([w.tenantId]);
  });

  it("K838-API-002 本人確認：取り直しが無い・15 分より前は 403・STEP_UP_REQUIRED・何も変わらない。14 分前は通る", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine } = await company(w, w.member);
    for (const su of [undefined, h.suAgo(16)]) {
      const r = await h.call(w.member, "DELETE", `/me/workspaces/${co.tenantId}`, su ? { su } : {});
      expect(r.status).toBe(403);
      expect((await h.json(r)).code).toBe("STEP_UP_REQUIRED");
    }
    expect((await tm(mine)).status).toBe("active");
    expect((await leave(w.member, co.tenantId, { su: h.suAgo(14) })).status).toBe(200);
  });

  it("K838-API-003 担当が残っている：その会社で担当の終わっていないチケットがあれば 409・E-ME-050（欄・details なし）・何も変わらない・渡す（担当が替わる）か終わらせれば抜けられる・ほかの会社の担当は数えない", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine } = await company(w, w.member);
    await tasks(co.tenantId, co.rootScope, mine);
    await tasks(w.tenantId, w.eg, w.member);
    const r = await leave(w.member, co.tenantId);
    expect(r.status).toBe(409);
    const b = await h.json(r);
    expect(b.code).toBe("E-ME-050");
    expect(b.field).toBeUndefined();
    expect(b.details).toBeUndefined();
    expect((await tm(mine)).status).toBe("active");
    expect(await alive((await h.session(mine)).auth)).toBe(1);
    await h.f.admin.query("update tickets set completed_at = now(), completed_by = $1 where assignee_member_id = $1", [
      mine.id,
    ]);
    expect((await leave(w.member, co.tenantId)).status).toBe(200);
  });

  it("K838-API-004 最後の管理者：その会社の有効な管理者が自分だけなら 409・E-ME-051（止めた管理者は数えない・自分だけの会社も同じ）・ほかに有効な管理者が居れば抜けられる。担当も残っていれば E-ME-051 が先", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine, boss } = await company(w, w.member, "admin");
    await h.f.admin.query("update tenant_memberships set status = 'suspended' where member_id = $1", [boss.id]);
    await h.f.admin.query("update members set suspended_at = now(), suspended_by = $1 where id = $1", [boss.id]);
    await tasks(co.tenantId, co.rootScope, mine);
    const r = await leave(w.member, co.tenantId);
    expect(r.status).toBe(409);
    expect((await h.json(r)).code).toBe("E-ME-051");
    expect((await tm(mine)).status).toBe("active");
    await h.f.admin.query("update tenant_memberships set status = 'active' where member_id = $1", [boss.id]);
    await h.f.admin.query("update members set suspended_at = null, suspended_by = null where id = $1", [boss.id]);
    await h.f.admin.query("update tickets set completed_at = now(), completed_by = $1 where assignee_member_id = $1", [
      mine.id,
    ]);
    expect((await leave(w.member, co.tenantId)).status).toBe(200);
  });

  it("K838-API-005 その会社のセッションを切る（G-14）：その会社の画面・PC のセッションが失効し、PC の動いている仕事は止まる・待っている仕事は取り消される・同じログインのほかの会社のセッションは生きたまま", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine } = await company(w, w.member);
    const web = await h.session(mine);
    const pc = await h.session(mine, { kind: "bridge" });
    const keep = await h.session(w.member);
    const job = (state: string, taken?: string) =>
      h.one<{ id: string }>(
        "insert into bridge_jobs (tenant_id, member_id, state_id, prompt, taken_session_id) values ($1, $2, $3, 'テスト', $4) returning id",
        [co.tenantId, mine.id, state, taken ?? null],
      );
    const running = await job("running", pc.id);
    const queued = await job("queued");
    expect((await leave(w.member, co.tenantId)).status).toBe(200);
    for (const a of [web.auth, pc.auth]) expect(await alive(a), a).toBe(0);
    expect(await alive(keep.auth)).toBe(1);
    const st = async (id: string) =>
      (await h.one<{ s: string }>("select state_id as s from bridge_jobs where id = $1", [id])).s;
    expect(["stopped", "cancelled"]).toContain(await st(running.id));
    expect(await st(queued.id)).toBe("cancelled");
  });

  it("K838-API-006 個人の物をすぐ消す（外すのと同じ・D-128.96）：個人の記憶は消え・勧めた記憶と会社の記憶・書いたチケットは残る・名前はそのまま出る・同じログインのほかの会社の物は消えない", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine } = await company(w, w.member);
    const mem = (tenant: string, scope: string, who: P, vis: string) =>
      h.one<{ id: string }>(
        "insert into memories (tenant_id, scope_id, owner_member_id, title, body, visibility) values ($1, $2, $3, '記憶', '中身', $4) returning id",
        [tenant, scope, who.id, vis],
      );
    const self = await mem(co.tenantId, co.rootScope, mine, "self");
    const rec = await mem(co.tenantId, co.rootScope, mine, "recommended");
    const mineElsewhere = await mem(w.tenantId, w.eg, w.member, "self");
    await tasks(co.tenantId, co.rootScope, mine, true);
    expect((await leave(w.member, co.tenantId)).status).toBe(200);
    const del = async (id: string) =>
      (await h.one<{ d: Date | null }>("select deleted_at as d from memories where id = $1", [id])).d;
    expect(await del(self.id)).not.toBeNull();
    expect(await del(rec.id)).toBeNull();
    expect(await del(mineElsewhere.id)).toBeNull();
    expect(
      await h.num("select count(*) as n from tickets where tenant_id = $1 and created_by = $2 and deleted_at is null", [
        co.tenantId,
        mine.id,
      ]),
    ).toBe(1);
    expect((await h.one<{ n: string }>("select display_name as n from members where id = $1", [mine.id])).n).toBe(
      w.member.name,
    );
  });

  it("K838-API-007 グループの所属（兼務も）：抜けた会社の主・兼務の所属の行が全部消え（人の行の抜けた印と同じ時刻）・別の会社の所属は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine } = await company(w, w.member);
    const jd = (
      await h.one<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '開発', 'KD') returning id",
        [co.tenantId, co.rootScope],
      )
    ).id;
    await h.f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $2, $3, true, 'member'), ($1, $4, $3, false, 'manager')",
      [co.tenantId, co.rootScope, mine.id, jd],
    );
    const there = await h.num(
      "select count(*) as n from scope_memberships where member_id = $1 and deleted_at is null",
      [w.member.id],
    );
    expect((await leave(w.member, co.tenantId)).status).toBe(200);
    expect(
      await h.num("select count(*) as n from scope_memberships where member_id = $1 and deleted_at is null", [mine.id]),
    ).toBe(0);
    expect(
      await h.num(
        "select count(*) as n from scope_memberships s join members m on m.id = s.member_id where s.member_id = $1 and s.deleted_at = m.deleted_at",
        [mine.id],
      ),
    ).toBe(2);
    expect(
      await h.num("select count(*) as n from scope_memberships where member_id = $1 and deleted_at is null", [
        w.member.id,
      ]),
    ).toBe(there);
  });

  it("K838-API-008 ほかの管理者へのお知らせ：その会社の有効な管理者（自分以外）に member.left の受け箱の行が 1 行ずつ・止めた管理者・メンバー・抜けた本人には出ない・メールは送らない", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine, boss } = await company(w, w.member, "admin");
    const boss2 = await h.make({ tenantId: co.tenantId, eg: co.rootScope }, "boss2", "二人目", { role: "admin" });
    const sus = await h.make({ tenantId: co.tenantId, eg: co.rootScope }, "sus", "止めた管理者", {
      role: "admin",
      status: "suspended",
    });
    const plain = await h.make({ tenantId: co.tenantId, eg: co.rootScope }, "plain", "メンバー");
    expect((await leave(w.member, co.tenantId)).status).toBe(200);
    for (const p of [boss, boss2]) expect((await h.notes(p.id, "member.left")).length, p.name).toBe(1);
    for (const p of [sus, plain, mine]) expect((await h.notes(p.id, "member.left")).length, p.name).toBe(0);
    expect(h.mails.length).toBe(0);
  });

  it("K838-API-009 見つからない：入っていない会社・無い会社・もう抜けた会社・別の人の会社は 404（欄・details なし）で何も変わらない・id が uuid でなければ 422", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine } = await company(w, w.member);
    for (const id of [w.other.tenantId, randomUUID()]) {
      const r = await leave(w.member, id);
      expect(r.status, id).toBe(404);
      const b = await h.json(r);
      expect(b.field).toBeUndefined();
      expect(b.details).toBeUndefined();
    }
    expect((await leave(w.member, "not-a-uuid")).status).toBe(422);
    expect((await leave(w.member, co.tenantId)).status).toBe(200);
    expect((await leave(w.member, co.tenantId)).status).toBe(404);
    expect((await tm(mine)).status).toBe("left");
    expect((await tm(w.member)).status).toBe("active");
  });

  it("K838-API-010 抜けた人が戻れる元：人の行の抜けた印（deleted_at）・所属の行の消した印（同じ時刻）・権限の行の失効が残り、新しい表は作らない（K-817 が 30 日の招き直しで読む）", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine } = await company(w, w.member);
    await h.f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $2, $3, true, 'manager')",
      [co.tenantId, co.rootScope, mine.id],
    );
    expect((await leave(w.member, co.tenantId)).status).toBe(200);
    const m = await h.one<{ d: Date }>("select deleted_at as d from members where id = $1", [mine.id]);
    const s = await h.one<{ d: Date; r: string }>(
      "select deleted_at as d, role as r from scope_memberships where member_id = $1",
      [mine.id],
    );
    expect(s.d.getTime()).toBe(m.d.getTime());
    expect(s.r).toBe("manager");
    expect((await tm(mine)).status).toBe("left");
  });

  it("K838-API-011 手順 1（DB に書く）の失敗：503・E-PAGE-003・所属・セッション・個人の物・お知らせ（受け箱）・会社の記録のどれも変わらない（全部か無しか）。お知らせの行が書けなくても全部戻る", async () => {
    await h.ready();
    const w = await h.world();
    const { co, mine } = await company(w, w.member, "admin");
    const boss2 = await h.make({ tenantId: co.tenantId, eg: co.rootScope }, "boss2", "二人目", { role: "admin" });
    const web = await h.session(mine);
    await h.captureLogs(async () => {
      for (const [table, op] of [
        ["members", "update"],
        ["notifications", "insert"],
      ] as const) {
        await h.breakOn(table, co.tenantId, op, async () => {
          const r = await leave(w.member, co.tenantId);
          expect(r.status, table).toBe(503);
          expect((await h.json(r)).code).toBe("E-PAGE-003");
        });
      }
    });
    expect((await tm(mine)).status).toBe("active");
    expect(await gone(mine)).toBeNull();
    expect(await alive(web.auth)).toBe(1);
    expect(await h.audits(co.tenantId, "member.left")).toBe(0);
    expect((await h.notes(boss2.id, "member.left")).length).toBe(0);
  });

  it("K838-API-012 守り：ログインなし 401・止めた人は 401／403・他人の会社の id は 404・別の会社の人が抜けても、この会社の人は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    expect(
      (
        await h.call(w.member, "DELETE", `/me/workspaces/${w.tenantId}`, {
          su: h.suNow(),
          headers: { authorization: "" },
        })
      ).status,
    ).toBe(401);
    expect([401, 403]).toContain((await leave(w.stopped, w.tenantId)).status);
    expect((await tm(w.stopped)).status).toBe("suspended");
    expect((await leave(w.outsider, w.tenantId)).status).toBe(404);
    expect((await tm(w.member)).status).toBe("active");
  });

  it("K838-API-013 二度押し（同じ Idempotency-Key・冪等は作る口だけに効くので消す口には効かない）：1 回目は 200・2 回目はもう抜けた会社なので 404（欄・details なし）・会社の記録とお知らせは増えない（1 行ずつ）", async () => {
    await h.ready();
    const w = await h.world();
    const { co, boss } = await company(w, w.member);
    const key = randomUUID();
    const r1 = await leave(w.member, co.tenantId, { key });
    const r2 = await leave(w.member, co.tenantId, { key });
    expect([r1.status, r2.status]).toEqual([200, 404]);
    const j2 = await h.json(r2);
    expect(j2.details).toBeUndefined();
    expect(j2.data).toBeUndefined();
    expect(await h.audits(co.tenantId, "member.left")).toBe(1);
    expect((await h.notes(boss.id, "member.left")).length).toBe(1);
  });

  it("K838-API-014 同時に管理者 2 人が抜ける（会社に有効な管理者がちょうど 2 人）：片方だけ 200・もう片方は 409・E-ME-051（最後の管理者を 0 人にしない・会社ごとの錠）", async () => {
    await h.ready();
    const w = await h.world();
    const co = await h.f.company(`二人の管理者-${randomUUID().slice(0, 4)}`, "ZZ");
    const base = { tenantId: co.tenantId, eg: co.rootScope };
    const a = await h.make(base, "a", "管理者 A", { role: "admin", owner: true });
    const b = await h.make(base, "b", "管理者 B", { role: "admin" });
    const [r1, r2] = await Promise.all([leave(a, co.tenantId), leave(b, co.tenantId)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const bad = r1.status === 409 ? r1 : r2;
    expect((await h.json(bad)).code).toBe("E-ME-051");
    const active = await h.num(
      "select count(*) as n from tenant_memberships where tenant_id = $1 and role = 'admin' and status = 'active'",
      [co.tenantId],
    );
    expect(active).toBe(1);
    void w;
  });
});
