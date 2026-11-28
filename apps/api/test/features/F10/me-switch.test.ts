// K-851「ワークスペースを切り替える・自分に届いた招待を読む」の口の試験（本物の DB・偽の画面のログイン・認証の部品は getSession だけの偽。土台 me.harness.ts）。
//   行 ID（K851-API-…）は 11_tickets/K-851.md の表と 1 対 1。
//   switchWorkspace     POST /me/workspaces/:id/switch → 200 { data: { tenant_id, switched } }（今のログインの部品のセッションの行を、その会社の同じログインの人に結び直す）
//   listMyInvitations   GET  /me/invitations           → 200 { data: { invitations: [{ id, workspace_name, inviter_name, expires_at }], total } }
//   D-154.81。止められた人・抜けた会社・入っていない会社は同じ 404（欄・details を付けない）。DB の失敗は 503 E-PAGE-003。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupMe, type MeWorld, type P } from "./me.harness.js";

const h = setupMe("me-switch.ts");
/** 届いた招待の 1 行（試験で読む欄だけ型にする） */
type Inv = Record<string, unknown> & { id: unknown; inviter_name: unknown; workspace_name: unknown };
const sw = (p: P, id: string, sid?: string, key?: string) =>
  h.call(p, "POST", `/me/workspaces/${id}/switch`, { body: {}, ...(sid ? { sid } : {}), ...(key ? { key } : {}) });
const invs = (p: P) => h.call(p, "GET", "/me/invitations");
const row = (auth: string) =>
  h.one<{ t: string; m: string; at: Date; rv: Date | null }>(
    "select tenant_id as t, member_id as m, updated_at as at, revoked_at as rv from sessions where auth_session_id = $1",
    [auth],
  );
const loginOf = async (p: P) =>
  (await h.one<{ a: string }>("select auth_user_id as a from tenant_memberships where member_id = $1", [p.id])).a;
/** 同じログインを別の会社にも入れる（状態を選べる） */
async function another(w: MeWorld, status = "active") {
  const co = await h.f.company(`別の会社-${randomUUID().slice(0, 4)}`, "ZZ");
  const there = await h.f.alsoIn(w.member, co.tenantId, co.rootScope);
  if (status !== "active")
    await h.f.admin.query("update tenant_memberships set status = $1 where member_id = $2", [status, there.id]);
  return { co, there };
}
async function invite(
  w: MeWorld,
  email: string,
  o: {
    tenant?: string;
    expiresHours?: number;
    accepted?: boolean;
    revoked?: boolean;
    deleted?: boolean;
    by?: string | null;
  } = {},
) {
  const tenant = o.tenant ?? w.other.tenantId;
  const r = await h.one<{ id: string }>(
    `insert into invitations (tenant_id, email, role_id, token_hash, expires_at, created_by, accepted_member_id, revoked_at, deleted_at)
     values ($1, $2, 'member', $3, now() + make_interval(hours => $4), $5, $6, $7, $8) returning id`,
    [
      tenant,
      email,
      `hash-${randomUUID()}`,
      o.expiresHours ?? 72,
      o.by === undefined ? w.outsider.id : o.by,
      o.accepted ? w.outsider.id : null,
      o.revoked ? new Date() : null,
      o.deleted ? new Date() : null,
    ],
  );
  return r.id;
}

describe("K-851 ワークスペースを切り替える（switchWorkspace）", () => {
  it("K851-API-001 切り替える：200・tenant_id と switched true・今の部品のセッションの行がその会社の同じログインの人に結び直る・入口の解き方（session_check）も新しい会社を返す・ほかの端末と PC の行は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const { co, there } = await another(w);
    const cur = await h.session(w.member);
    const other = await h.session(w.member, { label: "別のブラウザ" });
    const pc = await h.session(w.member, { kind: "bridge", label: "会社の PC" });
    const r = await sw(w.member, co.tenantId, cur.auth);
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.json(r)).data).toEqual({ tenant_id: co.tenantId, switched: true });
    const now = await row(cur.auth);
    expect([now.t, now.m, now.rv]).toEqual([co.tenantId, there.id, null]);
    const chk = await h.one<{ t: string; m: string }>(
      "select tenant_id as t, member_id as m from app.session_check($1, null, null, null)",
      [cur.auth],
    );
    expect([chk.t, chk.m]).toEqual([co.tenantId, there.id]);
    expect((await row(other.auth)).t).toBe(w.tenantId);
    expect((await h.one<{ t: string }>("select tenant_id as t from sessions where id = $1", [pc.id])).t).toBe(
      w.tenantId,
    );
  });

  it("K851-API-002 今いる会社を指す：200・switched false・行は変わらない（updated_at も同じ）", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const before = await row(cur.auth);
    const r = await sw(w.member, w.tenantId, cur.auth);
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toEqual({ tenant_id: w.tenantId, switched: false });
    const after = await row(cur.auth);
    expect([after.t, after.m, after.at.getTime()]).toEqual([before.t, before.m, before.at.getTime()]);
  });

  it("K851-API-003 入れない会社はどれも同じ 404（欄・details なし）で行は変わらない：無い会社・別のログインの会社・止められた・抜けた・招待中・人が止まっている・会社を消した", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const targets: string[] = [randomUUID(), w.other.tenantId];
    for (const st of ["suspended", "left", "invited"]) targets.push((await another(w, st)).co.tenantId);
    const stoppedCo = await another(w);
    await h.f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [
      stoppedCo.there.id,
    ]);
    targets.push(stoppedCo.co.tenantId);
    const gone = await another(w);
    await h.f.admin.query("update tenants set deleted_at = now() where id = $1", [gone.co.tenantId]);
    targets.push(gone.co.tenantId);
    for (const t of targets) {
      const r = await sw(w.member, t, cur.auth);
      expect(r.status, t).toBe(404);
      const b = await h.json(r);
      expect(b.field, t).toBeUndefined();
      expect(b.details, t).toBeUndefined();
      expect((await row(cur.auth)).t, t).toBe(w.tenantId);
    }
  });

  it("K851-API-004 今の端末が分からない（sid が無い・行が切れている）：401 で何も変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const { co } = await another(w);
    expect((await sw(w.member, co.tenantId)).status).toBe(401);
    const cut = await h.session(w.member, { revoked: true });
    expect((await sw(w.member, co.tenantId, cut.auth)).status).toBe(401);
    expect((await row(cut.auth)).t).toBe(w.tenantId);
  });

  it("K851-API-005 道の id が uuid でない・体に欄がある：入口が 422 で何も変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    expect((await sw(w.member, "not-a-uuid", cur.auth)).status).toBe(422);
    const { co } = await another(w);
    const r = await h.call(w.member, "POST", `/me/workspaces/${co.tenantId}/switch`, {
      body: { member_id: randomUUID() },
      sid: cur.auth,
    });
    expect(r.status).toBe(422);
    expect((await row(cur.auth)).t).toBe(w.tenantId);
  });

  it("K851-API-006 同時に 2 つの会社へ切り替える：両方 200 で落ちず、行は 1 つのまま・どちらかの会社に結ばれている", async () => {
    await h.ready();
    const w = await h.world();
    const a = await another(w);
    const b = await another(w);
    const cur = await h.session(w.member);
    const rs = await Promise.all([sw(w.member, a.co.tenantId, cur.auth), sw(w.member, b.co.tenantId, cur.auth)]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    expect(await h.num("select count(*)::int as n from sessions where auth_session_id = $1", [cur.auth])).toBe(1);
    expect([a.co.tenantId, b.co.tenantId]).toContain((await row(cur.auth)).t);
  });

  it("K851-API-007 手順 1（行を結び直す）で DB が落ちる：503・E-PAGE-003・行は前の会社のまま", async () => {
    await h.ready();
    const w = await h.world();
    const { co } = await another(w);
    const cur = await h.session(w.member);
    await h.breakPool(["switchWorkspace"], async () => {
      const r = await sw(w.member, co.tenantId, cur.auth);
      expect(r.status).toBe(503);
      expect((await h.json(r)).code).toBe("E-PAGE-003");
    });
    expect((await row(cur.auth)).t).toBe(w.tenantId);
  });

  it("K851-API-008 記録しない：切り替えは会社の記録（audit_events）・安全の記録・受け箱を増やさない（D-154.55）・二度送り（同じ Idempotency-Key）も同じ答え", async () => {
    await h.ready();
    const w = await h.world();
    const { co, there } = await another(w);
    const cur = await h.session(w.member);
    const count = () =>
      h.num(
        "select ((select count(*) from audit_events where tenant_id in ($1, $2)) + (select count(*) from security_events where tenant_id in ($1, $2)) + (select count(*) from notifications where member_id in ($3, $4)))::int as n",
        [w.tenantId, co.tenantId, w.member.id, there.id],
      );
    const before = await count();
    const key = randomUUID();
    const r1 = await sw(w.member, co.tenantId, cur.auth, key);
    const r2 = await sw(w.member, co.tenantId, cur.auth, key);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect((await h.json(r2)).data).toEqual({ tenant_id: co.tenantId, switched: true });
    expect(await count()).toBe(before);
  });
});

describe("K-851 自分に届いた招待（listMyInvitations）", () => {
  it("K851-API-009 読む：200・no-store・確かめ済みのログインのメールに届いた、待っている・期限内の招待だけ・鍵は id・workspace_name・inviter_name・expires_at・期限の近い順・total", async () => {
    await h.ready();
    const w = await h.world();
    const late = await invite(w, w.member.email, { expiresHours: 100 });
    const soon = await invite(w, w.member.email, { expiresHours: 2 });
    const r = await invs(w.member);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    const d = (await h.json(r)).data!;
    const list = d["invitations"] as [Inv, ...Inv[]];
    expect(list.map((x) => x.id)).toEqual([soon, late]);
    expect(Object.keys(list[0]).sort()).toEqual(["expires_at", "id", "inviter_name", "workspace_name"]);
    expect(typeof list[0].workspace_name).toBe("string");
    expect(d["total"]).toBe(2);
  });

  it("K851-API-010 出さない招待：受けた・取り消した・消した・期限切れ・別のメール・消した会社・もう入っている会社（同じログインの人が在る）", async () => {
    await h.ready();
    const w = await h.world();
    await invite(w, w.member.email, { accepted: true });
    await invite(w, w.member.email, { revoked: true });
    await invite(w, w.member.email, { deleted: true });
    await invite(w, w.member.email, { expiresHours: -1 });
    await invite(w, `someone-${randomUUID().slice(0, 6)}@engine-base.example`);
    const gone = await h.f.company(`消した会社-${randomUUID().slice(0, 4)}`, "GG");
    await invite(w, w.member.email, { tenant: gone.tenantId });
    await h.f.admin.query("update tenants set deleted_at = now() where id = $1", [gone.tenantId]);
    const inside = await another(w);
    await invite(w, w.member.email, { tenant: inside.co.tenantId });
    const keep = await invite(w, w.member.email);
    const d = (await h.json(await invs(w.member))).data!;
    expect((d["invitations"] as [Inv, ...Inv[]]).map((x) => x.id)).toEqual([keep]);
    expect(d["total"]).toBe(1);
  });

  it("K851-API-011 表記ゆらぎ：招待のメールの大文字・前後の空白は同じ宛てとみなす", async () => {
    await h.ready();
    const w = await h.world();
    const id = await invite(w, `  ${w.member.email.toUpperCase()} `);
    const d = (await h.json(await invs(w.member))).data!;
    expect((d["invitations"] as [Inv, ...Inv[]]).map((x) => x.id)).toEqual([id]);
  });

  it("K851-API-012 ログインのメールが確かめ前：0 件（届いた招待を出さない）", async () => {
    await h.ready();
    const w = await h.world();
    await invite(w, w.member.email);
    await h.f.admin.query('update kaname_auth."user" set "emailVerified" = false where id = $1', [
      await loginOf(w.member),
    ]);
    const d = (await h.json(await invs(w.member))).data!;
    expect(d["invitations"]).toEqual([]);
    expect(d["total"]).toBe(0);
  });

  it("K851-API-013 秘密を出さない：答えの中に招待の印（token・token_hash）・宛て・ほかの人の id が無い。招いた人が無ければ inviter_name は null", async () => {
    await h.ready();
    const w = await h.world();
    await invite(w, w.member.email, { by: null });
    const r = await invs(w.member);
    const text = await r.clone().text();
    for (const bad of ["token", "hash-", w.member.email, w.outsider.id]) expect(text).not.toContain(bad);
    const list = (await h.json(r)).data!["invitations"] as [Inv, ...Inv[]];
    expect(list[0].inviter_name).toBeNull();
  });

  it("K851-API-014 多いとき：21 件あれば 20 件を返し total は 21", async () => {
    await h.ready();
    const w = await h.world();
    for (let i = 0; i < 21; i += 1) await invite(w, w.member.email, { expiresHours: 10 + i });
    const d = (await h.json(await invs(w.member))).data!;
    expect((d["invitations"] as [Inv, ...Inv[]]).length).toBe(20);
    expect(d["total"]).toBe(21);
  });

  it("K851-API-015 守り：ログインなしは 2 口とも 401・止めた人は 401／403・別の人の招待は混ざらない", async () => {
    await h.ready();
    const w = await h.world();
    await invite(w, w.admin.email);
    const none = await h.f.req("GET", "/me/invitations");
    expect(none.status).toBe(401);
    const none2 = await h.f.req("POST", `/me/workspaces/${w.tenantId}/switch`, { body: {} });
    expect(none2.status).toBe(401);
    expect([401, 403]).toContain((await invs(w.stopped)).status);
    const mine = (await h.json(await invs(w.member))).data!["invitations"] as [Inv, ...Inv[]];
    expect(mine).toEqual([]);
  });

  it("K851-API-016 DB が落ちる：503・E-PAGE-003", async () => {
    await h.ready();
    const w = await h.world();
    await h.breakPool(["listMyInvitations"], async () => {
      const r = await invs(w.member);
      expect(r.status).toBe(503);
      expect((await h.json(r)).code).toBe("E-PAGE-003");
    });
  });
});
