// K-333「今のアカウントで参加する口」（acceptInvitation・ログイン中の人）の単体の試験。
// 名前の頭の行 ID（K333-API-…）は 11_tickets/K-333.md の表に 1 対 1 で結ぶ。土台は invite.harness.ts（K-331）。
// 1 人のアカウントは複数のワークスペースに入れる（D-125.150）。2 つ目からの members の行は auth_user_id を空にし、所属の行 tenant_memberships.auth_user_id で本人に結ぶ
// （members.auth_user_id は一意・0111 の引き方と同じ）。参加したら招かれたワークスペースへ切り替える（answer=becc3d3aa526 ④）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { describe, expect, it } from "vitest";
import { pairMemberForTest } from "../../bridge_pair.js";
import { K333_MISSING_INVITE_TOKEN, K333_UNUSED_PASSWORD } from "../../_fake/secrets.js";
import { setupInvite, type User } from "./invite.harness.js";

const h = setupInvite("k333");

/** その人の、そのワークスペースでの所属（tenant_memberships.auth_user_id か members.auth_user_id で本人に結ぶ） */
const membership = async (u: User, tenantId: string) =>
  (
    await h.admin.query<{
      member_id: string;
      role: string;
      status: string;
      scope_id: string | null;
      m_auth: string | null;
    }>(
      `select tm.member_id, tm.role, tm.status, m.scope_id, m.auth_user_id as m_auth
         from tenant_memberships tm join members m on m.id = tm.member_id
        where tm.tenant_id = $1 and (tm.auth_user_id = $2 or m.auth_user_id = $2) and tm.deleted_at is null`,
      [tenantId, u.userId],
    )
  ).rows;
/** そのログインの印の sessions の行（どのワークスペースのどの人か） */
const sessionOf = async (token: string) =>
  (
    await h.admin.query<{ tenant_id: string; member_id: string; mfa_pending: boolean }>(
      "select x.tenant_id, x.member_id, x.mfa_pending from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1",
      [token],
    )
  ).rows[0];
const errOf = async (r: Response) => JSON.stringify(await h.json(r));

describe("K-333 今のアカウントで参加：ログインの状態 × 招待の状態", () => {
  it('K333-API-001 ログイン中・宛てと同じメール・ほかのワークスペースに入っている：201・{ token, workspace_id: 招かれた所, next: "/" }。体は要らない（名前・パスワードを送っても使わない）', async () => {
    const host = await h.owner("host001", "株式会社招く側");
    const me = await h.makeUser("me001");
    const inv = await h.invite(host, { email: me.email });
    const t = await h.tokenOf(me);
    const r = await h.accept(
      inv.token,
      { name: "使わない名前", password: K333_UNUSED_PASSWORD },
      { headers: h.bearer(t) },
    );
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await h.json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["next", "token", "workspace_id"]);
    expect(d.workspace_id).toBe(host.tenantId);
    expect(d.next).toBe("/");
    expect((await h.signIn(me.email, K333_UNUSED_PASSWORD)).status).not.toBe(201);
  });

  it("K333-API-002 作られる物：招かれたワークスペースの members（auth_user_id は空・名前は今のアカウントの名前）と所属の行（auth_user_id＝本人・招待の役割・active）とグループの所属。元のワークスペースの所属はそのまま", async () => {
    const host = await h.owner("host002");
    const me = await h.makeUser("me002");
    const inv = await h.invite(host, { email: me.email, role: "manager" });
    expect((await h.accept(inv.token, {}, { headers: h.bearer(await h.tokenOf(me)) })).status).toBe(201);
    const there = await membership(me, host.tenantId);
    expect(there).toHaveLength(1);
    expect(there[0]).toMatchObject({ role: "manager", status: "active", scope_id: inv.scopeId, m_auth: null });
    const sm = await h.admin.query<{ scope_id: string; is_primary: boolean }>(
      "select scope_id, is_primary from scope_memberships where tenant_id = $1 and member_id = $2",
      [host.tenantId, there[0]!.member_id],
    );
    expect(sm.rows).toEqual([{ scope_id: inv.scopeId, is_primary: true }]);
    const name = await h.admin.query<{ n: string; u: string }>(
      'select m.display_name as n, u.name as u from members m, kaname_auth."user" u where m.id = $1 and u.id = $2',
      [there[0]!.member_id, me.userId],
    );
    expect(name.rows[0]!.n).toBe(name.rows[0]!.u);
    const home = await h.admin.query(
      "select 1 from members where id = $1 and deleted_at is null and auth_user_id = $2",
      [me.memberId, me.userId],
    );
    expect(home.rowCount).toBe(1);
    expect((await h.row(inv.id)).accepted_member_id).toBe(there[0]!.member_id);
  });

  it("K333-API-003 切り替え：その印の sessions の行が招かれたワークスペースの人に替わり、その印で解くと招かれたワークスペースになる。mfa_pending は立てない（もう入り方がある人）", async () => {
    const host = await h.owner("host003");
    const me = await h.makeUser("me003");
    const inv = await h.invite(host, { email: me.email });
    const t = await h.tokenOf(me);
    expect((await h.accept(inv.token, {}, { headers: h.bearer(t) })).status).toBe(201);
    const s = await sessionOf(t);
    const there = (await membership(me, host.tenantId))[0]!;
    expect(s).toMatchObject({ tenant_id: host.tenantId, member_id: there.member_id, mfa_pending: false });
    expect(await h.resolves(t)).toBe(true);
  });

  it("K333-API-004 同じ人のほかのセッション（別のブラウザ・PC）は元のワークスペースのまま（切り替えるのはその画面だけ）", async () => {
    const host = await h.owner("host004");
    const me = await h.makeUser("me004");
    const other = await h.tokenOf(me);
    const pc = await pairMemberForTest(h.admin, me.memberId, "K-333 の PC");
    const inv = await h.invite(host, { email: me.email });
    expect((await h.accept(inv.token, {}, { headers: h.bearer(await h.tokenOf(me)) })).status).toBe(201);
    expect((await sessionOf(other))!.tenant_id).toBe(me.tenantId);
    const p = await h.admin.query<{ tenant_id: string; revoked_at: Date | null }>(
      "select tenant_id, revoked_at from sessions where id = $1",
      [pc.sid],
    );
    expect(p.rows[0]).toMatchObject({ tenant_id: me.tenantId, revoked_at: null });
  });

  it("K333-API-005 ログイン中・別のメール宛て：403・E-INV-005 とその文（answer=becc3d3aa526 ②）。所属も招待も変わらない", async () => {
    const host = await h.owner("host005");
    const me = await h.makeUser("me005");
    const inv = await h.invite(host);
    const t = await h.tokenOf(me);
    const r = await h.accept(inv.token, {}, { headers: h.bearer(t) });
    expect(r.status).toBe(403);
    expect(await errOf(r)).toContain("E-INV-005");
    expect(await membership(me, host.tenantId)).toHaveLength(0);
    expect((await h.row(inv.id)).accepted_member_id).toBeNull();
    expect((await sessionOf(t))!.tenant_id).toBe(me.tenantId);
  });

  it("K333-API-006 もう入っているワークスペースの招待：409・E-INV-007（answer=7fe1f09fdab4 ⑦）。役割は変えず、招待は使ったことにしない", async () => {
    const host = await h.owner("host006");
    const inv = await h.invite(host, { email: host.email, role: "viewer" });
    const r = await h.accept(inv.token, {}, { headers: h.bearer(await h.tokenOf(host)) });
    expect(r.status).toBe(409);
    expect(await errOf(r)).toContain("E-INV-007");
    expect((await h.row(inv.id)).accepted_member_id).toBeNull();
    const role = await h.admin.query<{ role_id: string }>("select role_id from members where id = $1", [host.memberId]);
    expect(role.rows[0]!.role_id).not.toBe("viewer");
  });

  it("K333-API-007 前に抜けた（所属が left）ワークスペースへの招き直し：201・同じ所属の行を active に戻し、役割とグループは招待のものにする（D-128.96）。所属の行は 1 つのまま", async () => {
    const host = await h.owner("host007");
    const me = await h.makeUser("me007");
    const first = await h.invite(host, { email: me.email });
    expect((await h.accept(first.token, {}, { headers: h.bearer(await h.tokenOf(me)) })).status).toBe(201);
    await h.admin.query("update tenant_memberships set status = 'left' where tenant_id = $1 and auth_user_id = $2", [
      host.tenantId,
      me.userId,
    ]);
    const again = await h.invite(host, { email: me.email, role: "viewer" });
    expect((await h.accept(again.token, {}, { headers: h.bearer(await h.tokenOf(me)) })).status).toBe(201);
    const rows = await membership(me, host.tenantId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "active", role: "viewer" });
  });

  it("K333-API-008 ログイン中でも、期限切れ 410・E-INV-003／取り消し 410・E-INV-002／使われた 410・E-INV-004／見つからない 404・E-INV-001", async () => {
    const host = await h.owner("host008");
    const me = await h.makeUser("me008");
    const t = await h.tokenOf(me);
    for (const [opts, st, code] of [
      [{ expired: true }, 410, "E-INV-003"],
      [{ revoked: true }, 410, "E-INV-002"],
      [{ used: true }, 410, "E-INV-004"],
    ] as const) {
      const inv = await h.invite(host, { email: me.email, ...opts });
      const r = await h.accept(inv.token, {}, { headers: h.bearer(t) });
      expect(r.status, code).toBe(st);
      expect(await errOf(r)).toContain(code);
    }
    const nf = await h.accept(K333_MISSING_INVITE_TOKEN, {}, { headers: h.bearer(t) });
    expect(nf.status).toBe(404);
    expect(await errOf(nf)).toContain("E-INV-001");
    expect(await membership(me, host.tenantId)).toHaveLength(0);
  });

  it("K333-API-009 出来事：招かれたワークスペースに invitation_accepted（新しい所属の人）が 1 つ残る", async () => {
    const host = await h.owner("host009");
    const me = await h.makeUser("me009");
    const inv = await h.invite(host, { email: me.email });
    expect((await h.accept(inv.token, {}, { headers: h.bearer(await h.tokenOf(me)) })).status).toBe(201);
    const mid = (await membership(me, host.tenantId))[0]!.member_id;
    const ev = await h.admin.query(
      "select 1 from security_events where tenant_id = $1 and kind_id = 'invitation_accepted' and member_id = $2",
      [host.tenantId, mid],
    );
    expect(ev.rowCount).toBe(1);
  });

  it("K333-API-010 規約：今の版にもう同意している人は、参加で同意を足さず、同意し直しの印も立たない", async () => {
    const host = await h.owner("host010");
    const me = await h.makeUser("me010");
    const before = await h.admin.query<{ n: string }>(
      "select count(*) as n from terms_consents where auth_user_id = $1",
      [me.userId],
    );
    const inv = await h.invite(host, { email: me.email });
    const t = await h.tokenOf(me);
    expect((await h.accept(inv.token, {}, { headers: h.bearer(t) })).status).toBe(201);
    const after = await h.admin.query<{ n: string }>(
      "select count(*) as n from terms_consents where auth_user_id = $1",
      [me.userId],
    );
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
    const sid = await h.admin.query<{ id: string }>(
      "select x.id from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1",
      [t],
    );
    expect(
      (await h.admin.query<{ p: boolean }>("select app.session_terms_pending($1) as p", [sid.rows[0]!.id])).rows[0]!.p,
    ).toBe(false);
  });

  it("K333-API-011 同じ招待を同じ人が同時に 2 回：201 は 1 回だけ。所属の行は 1 つ", async () => {
    const host = await h.owner("host011");
    const me = await h.makeUser("me011");
    const inv = await h.invite(host, { email: me.email });
    const t = await h.tokenOf(me);
    const rs = await Promise.all([
      h.accept(inv.token, {}, { headers: h.bearer(t) }),
      h.accept(inv.token, {}, { headers: h.bearer(t) }),
    ]);
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await membership(me, host.tenantId)).toHaveLength(1);
  });

  it("K333-API-012 メールの大文字と小文字は同じに見る：招待の宛てが大文字まじりでも、小文字で登録した本人はログイン中のまま参加できる", async () => {
    const host = await h.owner("host012");
    const me = await h.makeUser("me012");
    const inv = await h.invite(host, { email: me.email.toUpperCase() });
    expect((await h.accept(inv.token, {}, { headers: h.bearer(await h.tokenOf(me)) })).status).toBe(201);
  });
  it("K333-API-013 外に影響する手順（参加と切り替えを 1 つの取引）の失敗：参加の関数が使えない（実行の権限を一時的に外す）：503・E-PAGE-003。所属は無く、招待は使われず、その印の行は元のワークスペースのまま", async () => {
    const host = await h.owner("host013");
    const me = await h.makeUser("me013");
    const inv = await h.invite(host, { email: me.email });
    const t = await h.tokenOf(me);
    await h.admin.query("revoke execute on function app.join_invitation(text, text, text) from kaname_app");
    let r!: Response;
    try {
      await h.captureLogs(async () => {
        r = await h.accept(inv.token, {}, { headers: h.bearer(t) });
      });
    } finally {
      await h.admin.query("grant execute on function app.join_invitation(text, text, text) to kaname_app");
    }
    expect(r.status).toBe(503);
    expect(await errOf(r)).toContain("E-PAGE-003");
    expect(await membership(me, host.tenantId)).toHaveLength(0);
    expect((await h.row(inv.id)).accepted_member_id).toBeNull();
    expect((await sessionOf(t))!.tenant_id).toBe(me.tenantId);
  });
});
