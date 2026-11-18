// K-332「新しく作って参加する口」（acceptInvitation・POST /api/v1/auth/invitations/:token/accept・ログインしていない人）の単体の試験。
// 名前の頭の行 ID（K332-API-…）は 11_tickets/K-332.md の表に 1 対 1 で結ぶ。土台は invite.harness.ts（K-331）。
// 入り方は登録と同じ形（名前とパスワード → 入った直後に「付けるまで進めない」の印 mfa_pending・answer=becc3d3aa526 ①・K-308 の関数）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { describe, expect, it } from "vitest";
import { PW, msg, setupInvite, type Invite } from "./invite.harness.js";

const h = setupInvite("k332");
const NAME = "木村 優";

const memberOf = async (email: string) =>
  (
    await h.admin.query<{
      member_id: string;
      tenant_id: string;
      scope_id: string | null;
      display_name: string;
      user_id: string;
    }>(
      `select m.id as member_id, m.tenant_id, m.scope_id, m.display_name, u.id as user_id
         from kaname_auth."user" u join members m on m.auth_user_id = u.id
        where lower(u.email) = lower($1) and m.deleted_at is null`,
      [email],
    )
  ).rows;
const nothingMade = async (inv: Invite) => {
  expect(await h.authUsers(inv.email)).toBe(0);
  expect((await h.row(inv.id)).accepted_member_id).toBeNull();
};
const errOf = async (r: Response) => JSON.stringify(await h.json(r));

describe("K-332 新しく作って参加：招待の状態 × 入力", () => {
  it('K332-API-001 使える招待 × 名前とパスワード：201・{ token, workspace_id, next: "/mfa-setup" }（data の欄はこれだけ）。その印でログインできている', async () => {
    const o = await h.owner("own001");
    const inv = await h.invite(o);
    const r = await h.accept(inv.token, { name: NAME, password: PW });
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await h.json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["next", "token", "workspace_id"]);
    expect(d.workspace_id).toBe(o.tenantId);
    expect(d.next).toBe("/mfa-setup");
    expect(await h.resolves(d.token as string)).toBe(true);
  });

  it("K332-API-002 作られる物：認証側の利用者（メールは招待の宛て・確認済み）・members（招待のワークスペース・グループ・名前）・所属の行 tenant_memberships（役割・active・joined_at）・グループの所属 scope_memberships（主の所属）・招待の accepted_member_id・出来事 invitation_accepted。ワークスペースは増えない（会社を作らない・K-52 の申し送り）", async () => {
    const o = await h.owner("own002");
    const inv = await h.invite(o, { role: "viewer" });
    const before = await h.tenants();
    expect((await h.accept(inv.token, { name: NAME, password: PW })).status).toBe(201);
    const ms = await memberOf(inv.email);
    expect(ms).toHaveLength(1);
    const m = ms[0]!;
    expect(m.tenant_id).toBe(o.tenantId);
    expect(m.scope_id).toBe(inv.scopeId);
    expect(m.display_name).toBe(NAME);
    const u = await h.admin.query<{ emailVerified: boolean }>(
      'select "emailVerified" from kaname_auth."user" where id = $1',
      [m.user_id],
    );
    expect(u.rows[0]!.emailVerified).toBe(true);
    const tm = await h.admin.query<{ role: string; status: string; joined_at: Date | null }>(
      "select role, status, joined_at from tenant_memberships where tenant_id = $1 and member_id = $2",
      [o.tenantId, m.member_id],
    );
    expect(tm.rows).toHaveLength(1);
    expect(tm.rows[0]).toMatchObject({ role: "viewer", status: "active" });
    expect(tm.rows[0]!.joined_at).not.toBeNull();
    const sm = await h.admin.query<{ scope_id: string; is_primary: boolean }>(
      "select scope_id, is_primary from scope_memberships where tenant_id = $1 and member_id = $2",
      [o.tenantId, m.member_id],
    );
    expect(sm.rows).toEqual([{ scope_id: inv.scopeId, is_primary: true }]);
    expect((await h.row(inv.id)).accepted_member_id).toBe(m.member_id);
    const ev = await h.admin.query(
      "select 1 from security_events where tenant_id = $1 and kind_id = 'invitation_accepted' and member_id = $2",
      [o.tenantId, m.member_id],
    );
    expect(ev.rowCount).toBe(1);
    expect(await h.tenants()).toBe(before);
  });

  it("K332-API-003 入った直後のセッション：sessions の行に mfa_pending が立つ（パスキーも 2 段階も無い・登録と同じ「付けるまで進めない」）。今の版の規約への同意が記録され、同意し直しの印は立たない（続けると同意・D-128.137）", async () => {
    const o = await h.owner("own003");
    const inv = await h.invite(o);
    const d = (await h.json(await h.accept(inv.token, { name: NAME, password: PW }))).data!;
    const s = await h.admin.query<{ mfa_pending: boolean; id: string }>(
      "select x.mfa_pending, x.id from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1",
      [d.token],
    );
    expect(s.rows[0]?.mfa_pending).toBe(true);
    const userId = (await memberOf(inv.email))[0]!.user_id;
    const lack = await h.admin.query(
      "select t.id from app.current_terms() t where not exists (select 1 from terms_consents c where c.auth_user_id = $1 and c.terms_version_id = t.id)",
      [userId],
    );
    expect(lack.rowCount).toBe(0);
    const pend = await h.admin.query<{ p: boolean }>("select app.session_terms_pending($1) as p", [s.rows[0]!.id]);
    expect(pend.rows[0]!.p).toBe(false);
  });

  it("K332-API-004 名前：前後の空白を落とし NFKC で整える（「　ｷﾑﾗ　優 」→「キムラ 優」）。空・空白だけは 422・E-VAL-007 で何も作らない。101 文字は 422・E-VAL-007", async () => {
    const o = await h.owner("own004");
    const ok = await h.invite(o);
    expect((await h.accept(ok.token, { name: "　ｷﾑﾗ　優 ", password: PW })).status).toBe(201);
    expect((await memberOf(ok.email))[0]!.display_name).toBe("キムラ 優");
    for (const name of ["", "   　", "あ".repeat(101)]) {
      const inv = await h.invite(o);
      const r = await h.accept(inv.token, { name, password: PW });
      expect(r.status, name.slice(0, 5)).toBe(422);
      expect(await errOf(r)).toContain("E-VAL-007");
      await nothingMade(inv);
    }
  });

  it("K332-API-005 パスワード：11 文字は 422・E-VAL-005、129 文字は 422・E-VAL-026（部品の上限・K-314 と同じ）。どちらも何も作らない", async () => {
    const o = await h.owner("own005");
    for (const [pw, code] of [
      ["a1".repeat(5) + "x", "E-VAL-005"],
      ["a".repeat(129), "E-VAL-026"],
    ] as const) {
      const inv = await h.invite(o);
      const r = await h.accept(inv.token, { name: NAME, password: pw });
      expect(r.status, code).toBe(422);
      expect(await errOf(r)).toContain(code);
      await nothingMade(inv);
    }
  });

  it("K332-API-006 期限切れ：410・E-INV-003 とその文。取り消し：410・E-INV-002。使われた：410・E-INV-004。どれも利用者を作らない", async () => {
    const o = await h.owner("own006");
    for (const [opts, code] of [
      [{ expired: true }, "E-INV-003"],
      [{ revoked: true }, "E-INV-002"],
      [{ used: true }, "E-INV-004"],
    ] as const) {
      const inv = await h.invite(o, opts);
      const r = await h.accept(inv.token, { name: NAME, password: PW });
      expect(r.status, code).toBe(410);
      const t = await errOf(r);
      expect(t).toContain(code);
      expect(t).toContain(msg(code));
      expect(await h.authUsers(inv.email)).toBe(0);
    }
  });

  it("K332-API-007 見つからない：404・E-INV-001", async () => {
    const r = await h.accept("no-such-token-k332", { name: NAME, password: PW });
    expect(r.status).toBe(404);
    expect(await errOf(r)).toContain("E-INV-001");
  });

  it("K332-API-008 宛てのメールにもうアカウントがある × ログインしていない：409・E-INV-006（ログインしてから参加・answer=becc3d3aa526 ③）。利用者は増えず、招待は使われない・パスワードも変わらない", async () => {
    const o = await h.owner("own008");
    const someone = await h.makeUser("exists008");
    const inv = await h.invite(o, { email: someone.email });
    const r = await h.accept(inv.token, { name: NAME, password: "another-password-12345" });
    expect(r.status).toBe(409);
    expect(await errOf(r)).toContain("E-INV-006");
    expect(await h.authUsers(someone.email)).toBe(1);
    expect((await h.row(inv.id)).accepted_member_id).toBeNull();
    expect((await h.signIn(someone.email, "another-password-12345")).status).not.toBe(201);
  });

  it("K332-API-009 体の email は使わない：{ name, password, email: 別のアドレス } を送っても、利用者のメールは招待の宛て。別のアドレスの利用者はできない", async () => {
    const o = await h.owner("own009");
    const inv = await h.invite(o);
    const evil = h.email("evil009");
    expect((await h.accept(inv.token, { name: NAME, password: PW, email: evil })).status).toBe(201);
    expect(await h.authUsers(inv.email)).toBe(1);
    expect(await h.authUsers(evil)).toBe(0);
  });

  it("K332-API-010 同じ招待を同時に 2 回：201 は 1 回だけ・もう 1 回は 410・E-INV-004（か 409）。利用者も members も 1 つだけ", async () => {
    const o = await h.owner("own010");
    const inv = await h.invite(o);
    const [a, b] = await Promise.all([
      h.accept(inv.token, { name: NAME, password: PW }),
      h.accept(inv.token, { name: NAME, password: PW }),
    ]);
    expect([a.status, b.status].filter((s) => s === 201)).toHaveLength(1);
    expect([a.status, b.status].some((s) => s === 410 || s === 409)).toBe(true);
    expect(await h.authUsers(inv.email)).toBe(1);
    expect(await memberOf(inv.email)).toHaveLength(1);
  });

  it("K332-API-011 止められたワークスペース（subscriptions.suspended_at）の招待：403・E-AUTH-012（K-303 の止めと同じ文）。利用者を作らず、招待も使わない", async () => {
    const o = await h.owner("own011");
    const inv = await h.invite(o);
    // 会社を作っても subscriptions の行はできないので、止めた行を入れる（login-gate.test.ts の suspendWorkspace と同じ）
    await h.admin.query(
      "insert into subscriptions (tenant_id, status_id, started_at, suspended_at) values ($1, 'active', now(), now())",
      [o.tenantId],
    );
    try {
      const r = await h.accept(inv.token, { name: NAME, password: PW });
      expect(r.status).toBe(403);
      expect(await errOf(r)).toContain("E-AUTH-012");
      await nothingMade(inv);
    } finally {
      await h.admin.query("delete from subscriptions where tenant_id = $1", [o.tenantId]);
    }
  });

  it("K332-API-012 招待のグループが消えている：201。members.scope_id と主のグループの所属は、そのワークスペースのいちばん上の生きたグループ（作りかけの利用者を消す確かめは K332-API-017）", async () => {
    const o = await h.owner("own012");
    const top = (
      await h.admin.query<{ id: string }>(
        "select id from scopes where tenant_id = $1 and parent_id is null and deleted_at is null order by created_at limit 1",
        [o.tenantId],
      )
    ).rows[0]!.id;
    const sc = await h.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, parent_id, name) values ($1, $2, '消えるグループ') returning id",
      [o.tenantId, top],
    );
    const inv = await h.invite(o, { scopeId: sc.rows[0]!.id });
    await h.admin.query("update scopes set deleted_at = now() where id = $1", [sc.rows[0]!.id]);
    const r = await h.accept(inv.token, { name: NAME, password: PW });
    expect(r.status, await r.clone().text()).toBe(201);
    const m = (await memberOf(inv.email))[0]!;
    expect(m.scope_id).toBe(top);
    const sm = await h.admin.query<{ scope_id: string }>(
      "select scope_id from scope_memberships where member_id = $1 and is_primary",
      [m.member_id],
    );
    expect(sm.rows.map((x) => x.scope_id)).toEqual([top]);
  });

  it("K332-API-013 同じ IP から 1 分に 11 回目：429・retry_after_sec（10 回／分／IP）", async () => {
    const o = await h.owner("own013");
    const ip = "198.51.100.232";
    for (let i = 0; i < 10; i++) await h.accept("no-such-token-k332-rl", { name: NAME, password: PW }, { ip });
    const r = await h.accept("no-such-token-k332-rl", { name: NAME, password: PW }, { ip });
    expect(r.status).toBe(429);
    const sec = Number((await h.json(r))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60, String(sec)).toBe(true);
    void o;
  });

  it("K332-API-014 答えは貯めない（Cache-Control に no-store）。ログに宛てのメールとパスワードを出さない", async () => {
    const o = await h.owner("own014");
    const inv = await h.invite(o);
    let r: Response | undefined;
    const logs = await h.captureLogs(async () => {
      r = await h.accept(inv.token, { name: NAME, password: PW });
    });
    expect(r!.status).toBe(201);
    expect(r!.headers.get("cache-control") ?? "").toMatch(/no-store/);
    expect(logs).not.toContain(inv.email);
    expect(logs).not.toContain(PW);
  });

  it("K332-API-015 参加した後は、その招待の下見が state used になる（1 回だけ使える）", async () => {
    const o = await h.owner("own015");
    const inv = await h.invite(o);
    expect((await h.accept(inv.token, { name: NAME, password: PW })).status).toBe(201);
    expect(((await h.json(await h.preview(inv.token))).data as Record<string, unknown>).state).toBe("used");
  });
  // ---- 外に影響する手順（11_tickets/K-332.md の「外に影響する手順」）：① 認証の利用者を作る［残る］② 受諾（所属・グループ・規約の同意・出来事を 1 つの取引）③ セッションを作る［残る］
  it("K332-API-016 手順 ① が失敗（認証の利用者を作れない・試験の間だけの引き金で断る）：503・E-PAGE-003。利用者も members も無く、招待は使われない", async () => {
    const o = await h.owner("own016");
    const inv = await h.invite(o);
    const fn = `k332_no_user_${h.run.replace(/[^a-z0-9]/g, "_")}`;
    await h.admin.query(
      `create function public.${fn}() returns trigger language plpgsql as $$ begin
         if lower(new.email) = lower('${inv.email}') then raise exception 'K-332 の試験：利用者を作らせない'; end if; return new; end $$`,
    );
    await h.admin.query(
      `create trigger ${fn} before insert on kaname_auth."user" for each row execute function public.${fn}()`,
    );
    let r!: Response;
    try {
      await h.captureLogs(async () => {
        r = await h.accept(inv.token, { name: NAME, password: PW });
      });
    } finally {
      await h.admin.query(`drop trigger if exists ${fn} on kaname_auth."user"`);
      await h.admin.query(`drop function if exists public.${fn}()`);
    }
    expect(r.status).toBe(503);
    expect(await errOf(r)).toContain("E-PAGE-003");
    await nothingMade(inv);
    expect(await memberOf(inv.email)).toHaveLength(0);
  });

  it("K332-API-017 手順 ② が失敗（受諾の関数が使えない・実行の権限を一時的に外す）：503・E-PAGE-003。① で作った利用者は消す（宛ての利用者 0）・招待は使われない", async () => {
    const o = await h.owner("own017");
    const inv = await h.invite(o);
    await h.admin.query("revoke execute on function app.accept_invitation(text, text, text) from kaname_app");
    let r!: Response;
    try {
      await h.captureLogs(async () => {
        r = await h.accept(inv.token, { name: NAME, password: PW });
      });
    } finally {
      await h.admin.query("grant execute on function app.accept_invitation(text, text, text) to kaname_app");
    }
    expect(r.status).toBe(503);
    expect(await errOf(r)).toContain("E-PAGE-003");
    await nothingMade(inv);
  });

  it("K332-API-018 手順 ② が失敗し、その後片付け（① の利用者を消す）も失敗：503・E-PAGE-003。利用者は残り（1 人）、ログに招待の id と「後片付け」の語が出る（宛てのメールは出さない）。招待は使われない", async () => {
    const o = await h.owner("own018");
    const inv = await h.invite(o);
    const fn = `k332_keep_user_${h.run.replace(/[^a-z0-9]/g, "_")}`;
    await h.admin.query(
      `create function public.${fn}() returns trigger language plpgsql as $$ begin
         if lower(old.email) = lower('${inv.email}') then raise exception 'K-332 の試験：利用者を消させない'; end if; return old; end $$`,
    );
    await h.admin.query(
      `create trigger ${fn} before delete on kaname_auth."user" for each row execute function public.${fn}()`,
    );
    await h.admin.query("revoke execute on function app.accept_invitation(text, text, text) from kaname_app");
    let r!: Response;
    let logs = "";
    try {
      logs = await h.captureLogs(async () => {
        r = await h.accept(inv.token, { name: NAME, password: PW });
      });
    } finally {
      await h.admin.query("grant execute on function app.accept_invitation(text, text, text) to kaname_app");
      await h.admin.query(`drop trigger if exists ${fn} on kaname_auth."user"`);
      await h.admin.query(`drop function if exists public.${fn}()`);
    }
    expect(r.status).toBe(503);
    expect(await errOf(r)).toContain("E-PAGE-003");
    expect(await h.authUsers(inv.email)).toBe(1);
    expect((await h.row(inv.id)).accepted_member_id).toBeNull();
    expect(logs).toContain(inv.id);
    expect(logs).toContain("後片付け");
    expect(logs).not.toContain(inv.email);
  });

  it("K332-API-019 手順 ③ が失敗（セッションを作れない・試験の間だけの引き金で断る）：503・E-PAGE-003。参加は取り消さない（members と所属は残り、招待は使われた）。その後ログインの口でそのメールとパスワードで入れる（201）", async () => {
    const o = await h.owner("own019");
    const inv = await h.invite(o);
    const fn = `k332_no_session_${h.run.replace(/[^a-z0-9]/g, "_")}`;
    await h.admin.query(
      `create function public.${fn}() returns trigger language plpgsql as $$ begin
         if exists (select 1 from kaname_auth."user" u where u.id = new."userId" and lower(u.email) = lower('${inv.email}'))
         then raise exception 'K-332 の試験：セッションを作らせない'; end if; return new; end $$`,
    );
    await h.admin.query(
      `create trigger ${fn} before insert on kaname_auth.session for each row execute function public.${fn}()`,
    );
    let r!: Response;
    try {
      await h.captureLogs(async () => {
        r = await h.accept(inv.token, { name: NAME, password: PW });
      });
    } finally {
      await h.admin.query(`drop trigger if exists ${fn} on kaname_auth.session`);
      await h.admin.query(`drop function if exists public.${fn}()`);
    }
    expect(r.status).toBe(503);
    expect(await errOf(r)).toContain("E-PAGE-003");
    expect(await memberOf(inv.email)).toHaveLength(1);
    expect((await h.row(inv.id)).accepted_member_id).not.toBeNull();
    expect((await h.signIn(inv.email, PW)).status).toBe(201);
  });
});
