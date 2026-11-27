// K-852「外された人が招待から戻る」（口と DB）の単体の試験（D-154.88・D-154.89・D-154.86・D-154.87・D-154.85・D-154.26・D-154.41）。
//   ログインの口（パスワード・6 けた）は、体の invitation（招待のリンクの印）が本人宛てで使え、本人が止められていないときだけ、使える会社が無い人にもログインの印を渡す。
//   パスキーの道は、確かめの要求の頭 x-kaname-invitation の印を部品の hook が同じ判定で見る。招いた会社がその人を外した会社かどうかは問わない（別の会社の初めての招待でも開ける）。
//   その印は本人宛ての使える招待の下見と参加の口だけで本人と見る（会社の口は 401・印はどの招待で開けたかを覚えない）。参加の関数 app.join_invitation が外した人の同じ行を生き返らせ、30 日の内の兼務と役割を戻す。
//   止められている人（使える会社で止められている／どこかの会社で止めたまま外された）・招待の印の無いログインは今のまま断る。
// 名前の頭の行 ID（K852-API-…）は 11_tickets/K-852.md の表に 1 対 1 で結ぶ。土台は F2/invite.harness.ts（K-331・本番と同じ bootApi・本物の DB・本物のログインの部品）。
// 外した印は K-849 の app.member_erase と同じ形を DB に直に置く（members.deleted_at・所属の status left・グループの所属の行に同じ時刻の消した印・セッションの失効）。
//   外す口（K-848）は本人確認と引き継ぎ先が要り、この葉の分岐と関係が無いので通さない（外す口の通しは K-845 の中間テストが持つ）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { describe, expect, it } from "vitest";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign, type KeyObject } from "node:crypto";
import { createApp } from "../../../src/app.js";
import { PW, msg, setupInvite, type User } from "../F2/invite.harness.js";
import { pendingOf, totp } from "../F1/login.harness.js";

const h = setupInvite("k852");
const SIGN_IN = "/api/v1/auth/sign-in";
const VERIFY_CODE = "/api/v1/auth/two-factor/verify";

interface Joined {
  email: string;
  userId: string;
  memberId: string;
  tenantId: string;
}
/** host のワークスペースに新しいアカウントで参加した人（参加の口・K-332）。その会社しか持たない */
async function joinNew(host: User, tag: string): Promise<Joined> {
  const inv = await h.invite(host, { email: h.email(tag) });
  const r = await h.accept(inv.token, { name: `外される ${tag}`, password: PW });
  expect(r.status, await r.clone().text()).toBe(201);
  const m = await h.admin.query<{ m: string; u: string }>(
    `select m.id as m, u.id as u from kaname_auth."user" u join members m on m.auth_user_id = u.id
      where lower(u.email) = lower($1) and m.tenant_id = $2`,
    [inv.email, host.tenantId],
  );
  return { email: inv.email, userId: m.rows[0]!.u, memberId: m.rows[0]!.m, tenantId: host.tenantId };
}
/** 自分の会社を持つ人が、host のワークスペースに今のアカウントで参加した（参加の口・K-333）。ほかに使える会社を持つ */
async function joinCurrent(host: User, tag: string): Promise<Joined & { me: User }> {
  const me = await h.makeUser(tag);
  const inv = await h.invite(host, { email: me.email });
  const r = await h.accept(inv.token, {}, { headers: h.bearer(await h.tokenOf(me)) });
  expect(r.status, await r.clone().text()).toBe(201);
  const m = await h.admin.query<{ m: string }>(
    "select member_id as m from tenant_memberships where tenant_id = $1 and auth_user_id = $2",
    [host.tenantId, me.userId],
  );
  return { me, email: me.email, userId: me.userId, memberId: m.rows[0]!.m, tenantId: host.tenantId };
}
/** K-849 の外した印と同じ形を置く（ago 前に外した）。グループの所属の行は members と同じ時刻で消す */
async function removed(memberId: string, ago = "1 minute"): Promise<void> {
  await h.admin.query("update members set deleted_at = now() - $2::interval where id = $1", [memberId, ago]);
  await h.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [memberId]);
  await h.admin.query(
    "update scope_memberships set deleted_at = (select deleted_at from members where id = $1) where member_id = $1 and deleted_at is null",
    [memberId],
  );
  await h.admin.query("update sessions set revoked_at = now() where member_id = $1 and revoked_at is null", [memberId]);
}
async function groupOf(host: User, name: string, prefix: string): Promise<string> {
  const top = await h.admin.query<{ id: string }>(
    "select id from scopes where tenant_id = $1 and parent_id is null and deleted_at is null order by created_at limit 1",
    [host.tenantId],
  );
  const r = await h.admin.query<{ id: string }>(
    "insert into scopes (tenant_id, name, parent_id, ticket_prefix) values ($1, $2, $3, $4) returning id",
    [host.tenantId, name, top.rows[0]!.id, prefix],
  );
  return r.rows[0]!.id;
}
const alsoIn = (j: Joined, scopeId: string, role: string) =>
  h.admin.query(
    "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, false, $4)",
    [j.tenantId, j.memberId, scopeId, role],
  );
const membershipsOf = async (memberId: string) =>
  (
    await h.admin.query<{ scope_id: string; role: string; is_primary: boolean }>(
      "select scope_id, role, is_primary from scope_memberships where member_id = $1 and deleted_at is null order by is_primary desc, scope_id",
      [memberId],
    )
  ).rows;
const restoredEvents = async (tenantId: string) =>
  (
    await h.admin.query<{ n: number }>(
      "select count(*)::int as n from security_events where tenant_id = $1 and kind_id = 'member_restored'",
      [tenantId],
    )
  ).rows[0]!.n;
const aliveCount = async (memberId: string) =>
  (
    await h.admin.query<{ n: number }>("select count(*)::int as n from members where id = $1 and deleted_at is null", [
      memberId,
    ])
  ).rows[0]!.n;
/** パスワードの口。invitation を渡せば体に入れる（招待のリンクから開いたログインの画面と同じ形・K-855） */
const signInWith = async (email: string, invitation?: string) => {
  const r = await h.req(
    "POST",
    SIGN_IN,
    invitation === undefined ? { email, password: PW } : { email, password: PW, invitation },
  );
  return { status: r.status, body: await h.json(r) };
};
/** 入り方を 1 つ持つ人にする（invite.harness.ts の tokenOf と同じ「試験の鍵」・K-321 の付けるまで進めない印 mfa_pending を立てない） */
async function addEntry(userId: string): Promise<void> {
  await h.admin.query(
    `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
     select gen_random_uuid()::text, '試験の鍵', 'test-entry', $1, 'test-entry-' || gen_random_uuid()::text, 0, 'singleDevice', false, 'internal', now()
      where not exists (select 1 from kaname_auth.passkey where "userId" = $1 and name = '試験の鍵')`,
    [userId],
  );
}
const ticketKinds = (token: string) => h.req("GET", "/api/v1/ticket_kinds", undefined, { headers: h.bearer(token) });
/** その会社しか持たない外した人が、招待の印つきでログインして、その招待に今のアカウントで参加する */
async function returnByInvite(j: Joined, inviteToken: string): Promise<Response> {
  const s = await signInWith(j.email, inviteToken);
  expect(s.status, JSON.stringify(s.body)).toBe(201);
  return h.accept(inviteToken, {}, { headers: h.bearer(String(s.body.data!["token"])) });
}

describe("K-852 ログインの口：使える会社が無い人 × 招待の印（D-154.87）", () => {
  it("K852-API-001 その会社しか持たない人を外し、同じ会社が同じメールで招き直した × 体にその招待の印：201・鍵は今のまま token・two_factor・pending・token は文字", async () => {
    const host = await h.owner("h001");
    const b = await joinNew(host, "b001");
    await removed(b.memberId);
    const inv = await h.invite(host, { email: b.email });
    const r = await signInWith(b.email, inv.token);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(Object.keys(r.body.data!).sort()).toEqual(["pending", "token", "two_factor"]);
    expect(typeof r.body.data!["token"]).toBe("string");
  });

  it("K852-API-002 同じ人・使える招待はあるが体に招待の印が無い：今までどおり 403・E-AUTH-007・その人の認証のセッションは残らない", async () => {
    const host = await h.owner("h002");
    const b = await joinNew(host, "b002");
    await removed(b.memberId);
    await h.invite(host, { email: b.email });
    const before = await h.authSessions(b.userId);
    const r = await signInWith(b.email);
    expect(r.status).toBe(403);
    expect(r.body["code"]).toBe("E-AUTH-007");
    expect(await h.authSessions(b.userId)).toBe(before);
  });

  it.each([
    ["期限切れ", { expired: true }],
    ["取り消した", { revoked: true }],
    ["使った", { used: true }],
  ] as const)(
    "K852-API-003 体の招待の印が使えない（%s）：403・E-AUTH-007・認証のセッションは残らない",
    async (label, o) => {
      // メールの宛ての名前に日本語の表題を入れない（認証の部品が Invalid email address で断る）。表題は 16 進にして使う
      const tag = Buffer.from(String(label)).toString("hex").slice(0, 12);
      const host = await h.owner(`h003-${tag}`);
      const b = await joinNew(host, `b003-${tag}`);
      await removed(b.memberId);
      const inv = await h.invite(host, { email: b.email, ...o });
      const before = await h.authSessions(b.userId);
      const r = await signInWith(b.email, inv.token);
      expect(r.status).toBe(403);
      expect(r.body["code"]).toBe("E-AUTH-007");
      expect(await h.authSessions(b.userId)).toBe(before);
    },
  );

  it("K852-API-004 体の招待がほかのメール宛て：403・E-AUTH-007。宛てを大文字にした招待・宛ての前後に空白がある招待は本人宛てとみなし 201", async () => {
    const host = await h.owner("h004");
    const b = await joinNew(host, "b004");
    await removed(b.memberId);
    const other = await h.invite(host, { email: h.email("someone-else-004") });
    expect((await signInWith(b.email, other.token)).status).toBe(403);
    const upper = await h.invite(host, { email: h.email("upper-004") });
    await h.admin.query("update invitations set email = $2 where id = $1", [upper.id, b.email.toUpperCase()]);
    expect((await signInWith(b.email, upper.token)).status).toBe(201);
    const padded = await h.invite(host, { email: h.email("pad-004") });
    await h.admin.query("update invitations set email = $2 where id = $1", [padded.id, `  ${b.email} `]);
    expect((await signInWith(b.email, padded.token)).status).toBe(201);
  });

  it("K852-API-005 体の招待の印が無い招待（でたらめの印）：403・E-AUTH-007", async () => {
    const host = await h.owner("h005");
    const b = await joinNew(host, "b005");
    await removed(b.memberId);
    await h.invite(host, { email: b.email });
    const r = await signInWith(b.email, "no-such-invitation-token-005");
    expect(r.status).toBe(403);
    expect(r.body["code"]).toBe("E-AUTH-007");
  });

  it("K852-API-006 招いた会社が止められている（subscriptions.suspended_at）：本人宛ての招待の印でも 403・E-AUTH-007", async () => {
    const host = await h.owner("h006");
    const b = await joinNew(host, "b006");
    await removed(b.memberId);
    const inv = await h.invite(host, { email: b.email });
    await h.admin.query("update subscriptions set suspended_at = now() where tenant_id = $1", [host.tenantId]);
    const r = await signInWith(b.email, inv.token);
    expect(r.status).toBe(403);
    expect(r.body["code"]).toBe("E-AUTH-007");
  });

  it("K852-API-007 使える会社で止められている人に、ほかの会社から本人宛ての招待の印：今までどおり 403・E-AUTH-011（止めが先・文は正本）", async () => {
    const host = await h.owner("h007");
    const me = await h.makeUser("me007");
    await h.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [me.memberId]);
    const inv = await h.invite(host, { email: me.email });
    const r = await signInWith(me.email, inv.token);
    expect(r.status).toBe(403);
    expect(r.body["code"]).toBe("E-AUTH-011");
    expect(r.body["message"]).toBe(msg("E-AUTH-011"));
  });

  it("K852-API-008 止めたまま外された人（外した行に suspended_at が残る）× 同じ会社からの招待の印：403・E-AUTH-007（止められている人は通さない）・行は消えたまま", async () => {
    const host = await h.owner("h008");
    const b = await joinNew(host, "b008");
    await h.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      b.memberId,
      host.memberId,
    ]);
    await removed(b.memberId);
    const inv = await h.invite(host, { email: b.email });
    const r = await signInWith(b.email, inv.token);
    expect(r.status).toBe(403);
    expect(r.body["code"]).toBe("E-AUTH-007");
    expect(await aliveCount(b.memberId)).toBe(0);
  });

  it("K852-API-009 使える会社のある人 × 招待の印：今までどおり 201・その印で会社の口が 200（招待の印は振る舞いを変えない）", async () => {
    const host = await h.owner("h009");
    const me = await h.makeUser("me009");
    await h.tokenOf(me);
    const inv = await h.invite(host, { email: me.email });
    const r = await signInWith(me.email, inv.token);
    expect(r.status).toBe(201);
    expect((await ticketKinds(String(r.body.data!["token"]))).status).toBe(200);
  });

  it("K852-API-010 招待の印つきのログインの印で会社の口を呼ぶ：401（会社の画面は開けない）。public.sessions にその印の生きた行は無い", async () => {
    const host = await h.owner("h010");
    const b = await joinNew(host, "b010");
    await removed(b.memberId);
    const inv = await h.invite(host, { email: b.email });
    const t = String((await signInWith(b.email, inv.token)).body.data!["token"]);
    expect((await ticketKinds(t)).status).toBe(401);
    const rows = await h.admin.query<{ n: number }>(
      "select count(*)::int as n from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1 and x.revoked_at is null",
      [t],
    );
    expect(rows.rows[0]!.n).toBe(0);
  });

  it("K852-API-011 2 段階を付けた人（その人の唯一の会社から外し、その会社が同じメールで招き直した）：6 けたの口に招待の印が無ければ 403・E-AUTH-007、あれば 201・鍵は今のまま token・backup_codes_left（2 人で見る・同じコードを 2 回使わない）", async () => {
    const a1 = await h.makeUser("me011a", { twoFactor: true });
    const a2 = await h.makeUser("me011b", { twoFactor: true });
    await removed(a1.memberId);
    await removed(a2.memberId);
    // 招き直しは、外した会社（その人が作った会社）が同じメールで招く
    await h.invite(a1, { email: a1.email });
    const inv2 = await h.invite(a2, { email: a2.email });
    const without = await h.verifyCode({ pending: await pendingOf(h, a1), code: totp(a1.secret!) });
    expect(without.status).toBe(403);
    expect((await h.json(without))["code"]).toBe("E-AUTH-007");
    const r = await h.req("POST", VERIFY_CODE, {
      pending: await pendingOf(h, a2),
      code: totp(a2.secret!),
      invitation: inv2.token,
    });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(Object.keys((await h.json(r)).data!).sort()).toEqual(["backup_codes_left", "token"]);
  });

  it("K852-API-024 体の招待の印が 513 文字（上限 512 を超える）：422（入口の形の確かめ）・パスワードの失敗に数えない・認証のセッションは増えない", async () => {
    const host = await h.owner("h024");
    const b = await joinNew(host, "b024");
    await removed(b.memberId);
    await h.invite(host, { email: b.email });
    const before = await h.authSessions(b.userId);
    const fails = (await h.attempts(b.email))?.fails ?? 0;
    const r = await signInWith(b.email, "x".repeat(513));
    expect(r.status).toBe(422);
    expect((await h.attempts(b.email))?.fails ?? 0).toBe(fails);
    expect(await h.authSessions(b.userId)).toBe(before);
  });

  it("K852-API-025 X だけに入っていて外された人に、外されていない会社 Y から初めての招待の印：ログイン 201 → その招待に今のアカウントで参加 201・Y に新しい人の行が 1 つ・その印の sessions の行が Y・会社の口 200。X の行は消えたまま・member_restored 0（D-154.88）", async () => {
    const x = await h.owner("h025-x");
    const y = await h.owner("h025-y");
    const b = await joinNew(x, "b025");
    await addEntry(b.userId);
    await removed(b.memberId, "10 days");
    const inv = await h.invite(y, { email: b.email });
    const s = await signInWith(b.email, inv.token);
    expect(s.status, JSON.stringify(s.body)).toBe(201);
    const t = String(s.body.data!["token"]);
    const r = await h.accept(inv.token, {}, { headers: h.bearer(t) });
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await h.json(r)).data!;
    expect(d["workspace_id"]).toBe(y.tenantId);
    const inY = await h.admin.query<{ id: string }>(
      `select m.id from members m where m.tenant_id = $1 and m.deleted_at is null
          and (m.auth_user_id = $2 or exists (select 1 from tenant_memberships tm where tm.member_id = m.id and tm.auth_user_id = $2))`,
      [y.tenantId, b.userId],
    );
    expect(inY.rows).toHaveLength(1);
    const token = String(d["token"] ?? t);
    const sess = await h.admin.query<{ tenant_id: string; member_id: string }>(
      "select x.tenant_id, x.member_id from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1 and x.revoked_at is null",
      [token],
    );
    expect(sess.rows).toEqual([{ tenant_id: y.tenantId, member_id: inY.rows[0]!.id }]);
    expect((await ticketKinds(token)).status).toBe(200);
    expect(await aliveCount(b.memberId), "X の外した行は消えたまま").toBe(0);
    expect(await restoredEvents(y.tenantId)).toBe(0);
    expect(await restoredEvents(x.tenantId)).toBe(0);
  });

  it("K852-API-027 X で止めたまま外された人（ほかに会社なし）に、別の会社 Y から本人宛ての招待の印：403・E-AUTH-007（止められている人は除く・D-154.88）・認証のセッションは増えない・Y の招待は使われない", async () => {
    const x = await h.owner("h027-x");
    const y = await h.owner("h027-y");
    const b = await joinNew(x, "b027");
    await h.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      b.memberId,
      x.memberId,
    ]);
    await removed(b.memberId);
    const inv = await h.invite(y, { email: b.email });
    const before = await h.authSessions(b.userId);
    const r = await signInWith(b.email, inv.token);
    expect(r.status).toBe(403);
    expect(r.body["code"]).toBe("E-AUTH-007");
    expect(await h.authSessions(b.userId)).toBe(before);
    expect((await h.row(inv.id)).accepted_member_id).toBeNull();
  });
});

describe("K-852 招待の下見と参加：招待の印つきのログインの印", () => {
  it("K852-API-012 下見（getInvitation）をその招待で開く：200・signed_in は { email: 本人のメール, email_matches: 真, already_member: 偽 }", async () => {
    const host = await h.owner("h012");
    const b = await joinNew(host, "b012");
    await removed(b.memberId);
    const inv = await h.invite(host, { email: b.email });
    const t = String((await signInWith(b.email, inv.token)).body.data!["token"]);
    const r = await h.preview(inv.token, { headers: h.bearer(t) });
    expect(r.status).toBe(200);
    expect((await h.json(r)).data!["signed_in"]).toEqual({
      email: b.email.toLowerCase(),
      email_matches: true,
      already_member: false,
    });
  });

  it("K852-API-013 その印で (1) 別の会社の本人宛ての使える招待の下見と参加：signed_in は本人・参加 201・workspace_id はその会社（印はどの招待で開けたかを覚えない・D-154.88）。外した行は消えたまま (2) 本人宛てでない招待の下見：signed_in は null", async () => {
    const host = await h.owner("h013");
    const other = await h.owner("h013-other");
    const b = await joinNew(host, "b013");
    await addEntry(b.userId);
    await removed(b.memberId);
    const inv = await h.invite(host, { email: b.email });
    const inv2 = await h.invite(other, { email: b.email });
    const notMine = await h.invite(other, { email: h.email("not-mine-013") });
    const t = String((await signInWith(b.email, inv.token)).body.data!["token"]);
    const q = await h.preview(notMine.token, { headers: h.bearer(t) });
    expect(q.status).toBe(200);
    expect((await h.json(q)).data!["signed_in"], "本人宛てでない招待ではログインしていない人と同じ").toBeNull();
    const p = await h.preview(inv2.token, { headers: h.bearer(t) });
    expect(p.status).toBe(200);
    expect((await h.json(p)).data!["signed_in"]).toEqual({
      email: b.email.toLowerCase(),
      email_matches: true,
      already_member: false,
    });
    const r = await h.accept(inv2.token, {}, { headers: h.bearer(t) });
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await h.json(r)).data!["workspace_id"]).toBe(other.tenantId);
    expect((await h.row(inv2.id)).accepted_member_id).not.toBeNull();
    expect((await h.row(inv.id)).accepted_member_id, "使わなかった招待は使われないまま").toBeNull();
    expect(await aliveCount(b.memberId), "外した会社の行は消えたまま").toBe(0);
  });

  it("K852-API-014 その招待に今のアカウントで参加：201・workspace_id は招いた会社。外す前と同じ会社の人の行が生き返り、その印の sessions の行が 1 つでその会社・会社の口が 200（入り方を 1 つ持つ人なので付けるまで進めない印は立たない）", async () => {
    const host = await h.owner("h014");
    const b = await joinNew(host, "b014");
    await addEntry(b.userId);
    await removed(b.memberId);
    const inv = await h.invite(host, { email: b.email });
    const t = String((await signInWith(b.email, inv.token)).body.data!["token"]);
    const r = await h.accept(inv.token, {}, { headers: h.bearer(t) });
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await h.json(r)).data!;
    expect(d["workspace_id"]).toBe(host.tenantId);
    expect(await aliveCount(b.memberId), "外す前と同じ行が生き返る").toBe(1);
    const token = String(d["token"] ?? t);
    const s = await h.admin.query<{ tenant_id: string; member_id: string }>(
      "select x.tenant_id, x.member_id from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1 and x.revoked_at is null",
      [token],
    );
    expect(s.rows).toEqual([{ tenant_id: host.tenantId, member_id: b.memberId }]);
    expect((await ticketKinds(token)).status).toBe(200);
  });

  it("K852-API-015 参加の途中で失敗：(1) 参加の直前に招待が取り消された → 410・E-INV-002・その印は会社の口で 401 のまま。(2) 戻す手順の後で落ちる（参加の関数を生きた招待・本人・無いログインの印で直に呼ぶ）→ 取引ごと戻る。どちらも行は消えたまま・所属 0・member_restored 0・生きた招待は使われないまま", async () => {
    const host = await h.owner("h015");
    const b = await joinNew(host, "b015");
    const acct = await groupOf(host, "経理部", "ACC015");
    await alsoIn(b, acct, "member");
    await removed(b.memberId, "10 days");
    const gone = await h.invite(host, { email: b.email });
    const t = String((await signInWith(b.email, gone.token)).body.data!["token"]);
    await h.admin.query("update invitations set revoked_at = now() where id = $1", [gone.id]);
    const r = await h.accept(gone.token, {}, { headers: h.bearer(t) });
    expect(r.status).toBe(410);
    expect((await h.json(r))["code"]).toBe("E-INV-002");
    expect((await ticketKinds(t)).status).toBe(401);
    const live = await h.invite(host, { email: b.email });
    const hash = await h.admin.query<{ token_hash: string }>("select token_hash from invitations where id = $1", [
      live.id,
    ]);
    await expect(
      h.admin.query("select * from app.join_invitation($1, $2, $3)", [
        hash.rows[0]!.token_hash,
        b.userId,
        "no-such-session",
      ]),
    ).rejects.toThrow(/切り替えるセッションが無い/);
    expect(await aliveCount(b.memberId)).toBe(0);
    expect(await membershipsOf(b.memberId)).toEqual([]);
    expect(await restoredEvents(host.tenantId)).toBe(0);
    expect((await h.row(live.id)).accepted_member_id).toBeNull();
  });
});

describe("K-852 参加で 30 日の内の兼務と役割を戻す（D-154.26・D-154.41）", () => {
  it("K852-API-016 外して 10 日：招いたグループが主（招いた役割）・外す前の兼務が戻る。役割は外す前と招いた役割の低いほう（経理部 manager → member）。member_restored が 1 行（detail の鍵はちょうど removed_member_id と groups・その人と 1・メールと名前の字は無い）。戻すのは所属と役割だけ：外したときに消した個人の記憶・個別の権限は消えたまま（D-128.96）", async () => {
    const host = await h.owner("h016");
    const b = await joinNew(host, "b016");
    const acct = await groupOf(host, "経理部", "ACC016");
    await alsoIn(b, acct, "manager");
    await h.admin.query(
      "insert into memories (tenant_id, scope_id, owner_member_id, title, body, kind_id, visibility) select tenant_id, scope_id, id, '個人の記憶', '中身', 'preference', 'self' from members where id = $1",
      [b.memberId],
    );
    await h.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'invite')",
      [b.tenantId, b.memberId],
    );
    await removed(b.memberId, "10 days");
    // K-849 の member_erase と同じ時刻で個人の記憶と個別の権限を消す（removed() は所属と人の行だけ）
    await h.admin.query(
      "update memories set deleted_at = (select deleted_at from members where id = $1) where owner_member_id = $1 and visibility = 'self'",
      [b.memberId],
    );
    await h.admin.query(
      "update permissions set revoked_at = (select deleted_at from members where id = $1) where grantee_member_id = $1 and bundle_role is null and revoked_at is null",
      [b.memberId],
    );
    const inv = await h.invite(host, { email: b.email, role: "member" });
    expect((await returnByInvite(b, inv.token)).status).toBe(201);
    expect(await membershipsOf(b.memberId)).toEqual([
      { scope_id: inv.scopeId, role: "member", is_primary: true },
      { scope_id: acct, role: "member", is_primary: false },
    ]);
    expect(await restoredEvents(host.tenantId)).toBe(1);
    const ev = (
      await h.admin.query<{ detail: Record<string, unknown> }>(
        "select detail from security_events where tenant_id = $1 and kind_id = 'member_restored'",
        [host.tenantId],
      )
    ).rows[0]!.detail;
    expect(Object.keys(ev).sort()).toEqual(["groups", "removed_member_id"]);
    expect(ev).toEqual({ removed_member_id: b.memberId, groups: 1 });
    expect(JSON.stringify(ev)).not.toContain(b.email);
    const n = async (sql: string) => (await h.admin.query<{ n: number }>(sql, [b.memberId])).rows[0]!.n;
    expect(await n("select count(*)::int as n from memories where owner_member_id = $1 and deleted_at is null")).toBe(
      0,
    );
    expect(
      await n(
        "select count(*)::int as n from permissions where grantee_member_id = $1 and bundle_role is null and revoked_at is null",
      ),
    ).toBe(0);
  });

  it("K852-API-017 30 日の境の外側の端：外して 30 日と 1 分たってから招かれて参加（招待は今）：招いたグループだけ（兼務は戻らない）・member_restored は 0", async () => {
    const host = await h.owner("h017");
    const b = await joinNew(host, "b017");
    const acct = await groupOf(host, "経理部", "ACC017");
    await alsoIn(b, acct, "member");
    await removed(b.memberId, "30 days 1 minute");
    const inv = await h.invite(host, { email: b.email });
    expect((await returnByInvite(b, inv.token)).status).toBe(201);
    expect((await membershipsOf(b.memberId)).map((r) => r.scope_id)).toEqual([inv.scopeId]);
    expect(await restoredEvents(host.tenantId)).toBe(0);
  });

  it("K852-API-018 外す前 member・招いた役割 manager（外して 10 日・兼務 経理部 member）：主＝招いたグループ manager・兼務 経理部は member のまま（招いた役割まで上げない）。member_restored は 1", async () => {
    const host = await h.owner("h018");
    const b = await joinNew(host, "b018");
    const acct = await groupOf(host, "経理部", "ACC018");
    await alsoIn(b, acct, "member");
    await removed(b.memberId, "10 days");
    const inv = await h.invite(host, { email: b.email, role: "manager" });
    expect((await returnByInvite(b, inv.token)).status).toBe(201);
    expect(await membershipsOf(b.memberId)).toEqual([
      { scope_id: inv.scopeId, role: "manager", is_primary: true },
      { scope_id: acct, role: "member", is_primary: false },
    ]);
    expect(await restoredEvents(host.tenantId)).toBe(1);
  });

  it("K852-API-019 招いたグループが外す前の主と違う（外す前の主は一番上のグループ manager・招いたのは経理部 member）：主＝経理部 member・外す前の主（一番上）は兼務で戻り役割は低いほう（member）。主の所属は 1 つだけ。外す前は会社の管理者（admin）でも、会社の役割は招いた member（管理者に戻らない）", async () => {
    const host = await h.owner("h019");
    const b = await joinNew(host, "b019");
    const top = await h.admin.query<{ scope_id: string }>(
      "select scope_id from scope_memberships where member_id = $1 and is_primary and deleted_at is null",
      [b.memberId],
    );
    const topId = top.rows[0]!.scope_id;
    await h.admin.query("update scope_memberships set role = 'manager' where member_id = $1 and scope_id = $2", [
      b.memberId,
      topId,
    ]);
    const acct = await groupOf(host, "経理部", "ACC019");
    await h.admin.query("update tenant_memberships set role = 'admin' where member_id = $1", [b.memberId]);
    await removed(b.memberId, "10 days");
    const inv = await h.invite(host, { email: b.email, role: "member", scopeId: acct });
    expect((await returnByInvite(b, inv.token)).status).toBe(201);
    expect(await membershipsOf(b.memberId)).toEqual([
      { scope_id: acct, role: "member", is_primary: true },
      { scope_id: topId, role: "member", is_primary: false },
    ]);
    expect(await restoredEvents(host.tenantId)).toBe(1);
    expect(
      (await h.admin.query<{ role: string }>("select role from tenant_memberships where member_id = $1", [b.memberId]))
        .rows[0]!.role,
    ).toBe("member");
  });

  it("K852-API-020 30 日は招いた時刻で見る（境の内側の端）：外して 31 日 23 時間・招待は 2 日前に作った（招いたのは外して 29 日 23 時間後）・今参加 → 兼務 経理部が戻る・member_restored 1", async () => {
    const host = await h.owner("h020");
    const b = await joinNew(host, "b020");
    const acct = await groupOf(host, "経理部", "ACC020");
    await alsoIn(b, acct, "member");
    await removed(b.memberId, "31 days 23 hours");
    const inv = await h.invite(host, { email: b.email });
    await h.admin.query("update invitations set created_at = now() - interval '2 days' where id = $1", [inv.id]);
    expect((await returnByInvite(b, inv.token)).status).toBe(201);
    expect((await membershipsOf(b.memberId)).map((r) => r.scope_id)).toEqual([inv.scopeId, acct]);
    expect(await restoredEvents(host.tenantId)).toBe(1);
  });

  it("K852-API-021 招待が外す前に作られていた（招待を作った 2 分前の後、1 分前に外した＝招き直しではない）：参加は 201 だが兼務は戻らない（招いたグループだけ）・member_restored 0", async () => {
    const host = await h.owner("h021");
    const b = await joinNew(host, "b021");
    const acct = await groupOf(host, "経理部", "ACC021");
    await alsoIn(b, acct, "member");
    const inv = await h.invite(host, { email: b.email });
    await h.admin.query("update invitations set created_at = now() - interval '2 minutes' where id = $1", [inv.id]);
    await removed(b.memberId, "1 minute");
    expect((await returnByInvite(b, inv.token)).status).toBe(201);
    expect((await membershipsOf(b.memberId)).map((r) => r.scope_id)).toEqual([inv.scopeId]);
    expect(await restoredEvents(host.tenantId)).toBe(0);
  });

  it("K852-API-022 外して 10 日・兼務の 1 つのグループを外した後に消した：今も在る兼務（経理部）だけ戻り、消したグループ（総務部）は戻さない。前の外しの記録（40 日前に消した兼務 企画部）も戻さない＝いちばん新しく外したときの行だけ。member_restored は 1・groups 1", async () => {
    const host = await h.owner("h022");
    const b = await joinNew(host, "b022");
    const acct = await groupOf(host, "経理部", "ACC022");
    const gone = await groupOf(host, "総務部", "GEN022");
    await alsoIn(b, acct, "member");
    await alsoIn(b, gone, "member");
    const older = await groupOf(host, "企画部", "PLN022");
    await alsoIn(b, older, "member");
    await h.admin.query(
      "update scope_memberships set deleted_at = now() - interval '40 days' where member_id = $1 and scope_id = $2",
      [b.memberId, older],
    );
    await removed(b.memberId, "10 days");
    await h.admin.query("update scopes set deleted_at = now() where id = $1", [gone]);
    const inv = await h.invite(host, { email: b.email });
    expect((await returnByInvite(b, inv.token)).status).toBe(201);
    expect(await membershipsOf(b.memberId)).toEqual([
      { scope_id: inv.scopeId, role: "member", is_primary: true },
      { scope_id: acct, role: "member", is_primary: false },
    ]);
    expect(await restoredEvents(host.tenantId)).toBe(1);
    expect(
      (
        await h.admin.query<{ g: number }>(
          "select (detail->>'groups')::int as g from security_events where tenant_id = $1 and kind_id = 'member_restored'",
          [host.tenantId],
        )
      ).rows[0]!.g,
    ).toBe(1);
  });

  it("K852-API-023 ほかの会社を持つ外した人が、招待の印なしでログインして今のアカウントで参加し直す（外して 10 日・兼務 経理部 member）：201・外す前と同じ行が生き返り、兼務が戻る・member_restored 1", async () => {
    const host = await h.owner("h023");
    const b = await joinCurrent(host, "b023");
    const acct = await groupOf(host, "経理部", "ACC023");
    await alsoIn(b, acct, "member");
    await removed(b.memberId, "10 days");
    const inv = await h.invite(host, { email: b.email });
    const r = await h.accept(inv.token, {}, { headers: h.bearer(await h.tokenOf(b.me)) });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await aliveCount(b.memberId)).toBe(1);
    expect(await membershipsOf(b.memberId)).toEqual([
      { scope_id: inv.scopeId, role: "member", is_primary: true },
      { scope_id: acct, role: "member", is_primary: false },
    ]);
    expect(await restoredEvents(host.tenantId)).toBe(1);
  });

  it("K852-API-026 ほかの会社を持つ人が、止めたまま外された会社から招き直され、今のアカウントで参加し直す：403・E-AUTH-011（止めたままの行は生き返らせない）。行は消えたまま・所属 0・招待は使われないまま・自分の会社の口は 200 のまま", async () => {
    const host = await h.owner("h026");
    const b = await joinCurrent(host, "b026");
    await h.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      b.memberId,
      host.memberId,
    ]);
    await removed(b.memberId, "10 days");
    const inv = await h.invite(host, { email: b.email });
    const t0 = await h.tokenOf(b.me);
    const r = await h.accept(inv.token, {}, { headers: h.bearer(t0) });
    expect(r.status).toBe(403);
    expect((await h.json(r))["code"]).toBe("E-AUTH-011");
    expect(await aliveCount(b.memberId)).toBe(0);
    expect(await membershipsOf(b.memberId)).toEqual([]);
    expect((await h.row(inv.id)).accepted_member_id).toBeNull();
    expect((await ticketKinds(t0)).status).toBe(200);
  });

  it("K852-API-030 ほかの会社を持つ人が会社 X で止めたまま外され、別の会社 Y から招かれて、招待の印なしでログインし今のアカウントで参加：ログイン 201・参加 201・workspace_id は Y・X の行は消えたまま（止めはその会社の中だけ・PM の決め D-154.89）", async () => {
    const x = await h.owner("h030-x");
    const y = await h.owner("h030-y");
    const b = await joinCurrent(x, "b030");
    await h.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      b.memberId,
      x.memberId,
    ]);
    await removed(b.memberId, "10 days");
    const inv = await h.invite(y, { email: b.email });
    const s = await signInWith(b.email);
    expect(s.status, JSON.stringify(s.body)).toBe(201);
    const r = await h.accept(inv.token, {}, { headers: h.bearer(String(s.body.data!["token"])) });
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await h.json(r)).data!["workspace_id"]).toBe(y.tenantId);
    expect(await aliveCount(b.memberId), "X の止めたままの行は生き返らせない").toBe(0);
  });
});

// ---- パスキーの道（D-154.88・D-154.89）：仮の認証器と入る道の道具は K-308 の passkey-gate.test.ts の頭の分を写した（K-308 の持ち物なので import しない） ----
const WEB = "http://127.0.0.1:3123"; // 土台（login.harness.ts）の config.webBaseUrl。画面の origin
const RP_ID = new URL(WEB).hostname;
const UA_A =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36";
const PK_OPTIONS = "/api/auth/passkey/generate-authenticate-options";
const PK_VERIFY = "/api/auth/passkey/verify-authentication";
const CHALLENGE_HEADER = "x-passkey-challenge";
/** 招待の印を運ぶ頭（K-852 が packages/auth から INVITATION_HEADER として出す名前） */
const INVITATION_HEAD = "x-kaname-invitation";
const b64u = (b: Buffer) => b.toString("base64url");
const digest = (b: Buffer | string) => createHash("sha256").update(b).digest();
interface Authenticator {
  credentialId: Buffer;
  privateKey: KeyObject;
  cose: Buffer;
}
const cborBytes = (b: Buffer) => Buffer.concat([Buffer.from([0x58, b.length]), b]);
const makeAuthenticator = (): Authenticator => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const cose = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21]),
    cborBytes(Buffer.from(jwk.x, "base64url")),
    Buffer.from([0x22]),
    cborBytes(Buffer.from(jwk.y, "base64url")),
  ]);
  return { credentialId: randomBytes(32), privateKey, cose };
};
/** 付いているパスキーを部品の表に置く（入り方を 1 つ持つ人にもなる） */
const storePasskey = async (userId: string, a: Authenticator) => {
  await h.admin.query(
    `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
     values ($1, $2, $3, $4, $5, 0, 'singleDevice', false, 'internal', now())`,
    [randomUUID(), `${h.run}-鍵`, a.cose.toString("base64"), userId, b64u(a.credentialId)],
  );
};
const assertion = (a: Authenticator, userId: string, challenge: string) => {
  const cnt = Buffer.alloc(4);
  cnt.writeUInt32BE(1);
  const authData = Buffer.concat([digest(RP_ID), Buffer.from([0x05]), cnt]);
  const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin: WEB, crossOrigin: false }));
  const signature = sign("sha256", Buffer.concat([authData, digest(clientData)]), a.privateKey);
  return {
    id: b64u(a.credentialId),
    rawId: b64u(a.credentialId),
    type: "public-key",
    response: {
      authenticatorData: b64u(authData),
      clientDataJSON: b64u(clientData),
      signature: b64u(signature),
      userHandle: b64u(Buffer.from(userId)),
    },
    clientExtensionResults: {},
    authenticatorAttachment: "platform",
  };
};
/** パスキーで入る（問い → 応答）。invitation を渡せば確かめの要求の頭 x-kaname-invitation に付ける（招待のリンクから開いたログインの画面と同じ形・K-855） */
async function passkeyLogin(j: Joined, a: Authenticator, invitation?: string): Promise<Response> {
  const head = { "user-agent": UA_A, origin: WEB };
  const o = await h.req("GET", PK_OPTIONS, undefined, { headers: head });
  expect(o.status, await o.clone().text()).toBe(200);
  const oj = (await h.json(o)) as unknown as Record<string, unknown>;
  return h.req(
    "POST",
    PK_VERIFY,
    { response: assertion(a, j.userId, String(oj["challenge"])) },
    {
      headers: {
        ...head,
        [CHALLENGE_HEADER]: String(oj["challenge_token"]),
        ...(invitation === undefined ? {} : { [INVITATION_HEAD]: invitation }),
      },
    },
  );
}

describe("K-852 パスキーの道 × 頭の招待の印（D-154.88・D-154.89）", () => {
  it("K852-API-028 その会社しか持たない外した人・外した会社の招き直し・パスキーの確かめの頭 x-kaname-invitation に招待の印：事前の確かめはその頭を許す・確かめ 200・頭 set-auth-token あり・その印で会社の口 401 → その招待に今のアカウントで参加 201・外す前の行が生き返り会社の口 200", async () => {
    const pre = await createApp({ version: "test", corsOrigin: WEB }).request(`http://localhost${PK_VERIFY}`, {
      method: "OPTIONS",
      headers: {
        origin: WEB,
        "access-control-request-method": "POST",
        "access-control-request-headers": `content-type,${CHALLENGE_HEADER},${INVITATION_HEAD}`,
      },
    });
    expect(pre.status).toBeLessThan(300);
    expect((pre.headers.get("access-control-allow-headers") ?? "").toLowerCase()).toContain(INVITATION_HEAD);
    const host = await h.owner("h028");
    const b = await joinNew(host, "b028");
    const a = makeAuthenticator();
    await storePasskey(b.userId, a);
    await removed(b.memberId);
    const inv = await h.invite(host, { email: b.email });
    const r = await passkeyLogin(b, a, inv.token);
    expect(r.status, await r.clone().text()).toBe(200);
    const t = r.headers.get("set-auth-token");
    expect(t, "セッションの印を返す").toBeTruthy();
    expect((await ticketKinds(t!)).status).toBe(401);
    const j = await h.accept(inv.token, {}, { headers: h.bearer(t!) });
    expect(j.status, await j.clone().text()).toBe(201);
    expect(await aliveCount(b.memberId), "外す前と同じ行が生き返る").toBe(1);
    const token = String((await h.json(j)).data!["token"] ?? t);
    expect((await ticketKinds(token)).status).toBe(200);
  });

  it.each([
    ["でたらめの印", "bogus"],
    ["513 文字の印", "long"],
    ["止めたまま外された人の、外した会社の招き直しの印", "suspended"],
  ] as const)(
    "K852-API-029 パスキーの確かめの頭の印が使えない（%s）：403・E-AUTH-007・セッションの印なし・認証のセッションは増えない",
    async (label, kind) => {
      const host = await h.owner(`h029-${kind}`);
      const b = await joinNew(host, `b029-${kind}`);
      const a = makeAuthenticator();
      await storePasskey(b.userId, a);
      if (kind === "suspended")
        await h.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
          b.memberId,
          host.memberId,
        ]);
      await removed(b.memberId);
      const inv = await h.invite(host, { email: b.email });
      const head =
        kind === "bogus" ? `no-such-invitation-${label.length}` : kind === "long" ? "x".repeat(513) : inv.token;
      const before = await h.authSessions(b.userId);
      const r = await passkeyLogin(b, a, head);
      expect(r.status, await r.clone().text()).toBe(403);
      expect(((await h.json(r)) as unknown as Record<string, unknown>)["code"]).toBe("E-AUTH-007");
      expect(r.headers.get("set-auth-token")).toBeNull();
      expect(await h.authSessions(b.userId)).toBe(before);
    },
  );
});
