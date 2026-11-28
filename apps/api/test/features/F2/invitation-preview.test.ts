// K-331「招待の下見の口」（getInvitation・GET /api/v1/auth/invitations/:token）の単体の試験（口・本物の DB・本物のログインの部品）。
// 名前の頭の行 ID（K331-API-…・K331-DB-…）は 11_tickets/K-331.md の表に 1 対 1 で結ぶ。土台は invite.harness.ts（このチケットが持ち込む）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { describe, expect, it } from "vitest";
import { msg, setupInvite } from "./invite.harness.js";

const h = setupInvite("k331");
const KEYS = [
  "account_exists",
  "email",
  "expires_at",
  "group_name",
  "inviter_name",
  "message",
  "role",
  "signed_in",
  "state",
  "workspace_name",
];

const data = async (r: Response) => (await h.json(r)).data as Record<string, unknown>;

describe("K-331 招待の下見：招待の状態 × ログインの状態", () => {
  it("K331-API-001 使える招待 × ログインしていない：200・state ok。答えの欄はワークスペース名・招いた人・グループ・役割・ひとこと・宛てのメール・期限・アカウントの有無・ログインの様子だけ（token_hash・id・tenant_id は出さない）", async () => {
    const o = await h.owner("own001", "株式会社下見");
    const inv = await h.invite(o, { message: "月次をいっしょに回してもらいます" });
    const r = await h.preview(inv.token);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = await data(r);
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d.state).toBe("ok");
    expect(d.workspace_name).toBe("株式会社下見");
    expect(typeof d.inviter_name).toBe("string");
    expect((d.inviter_name as string).length).toBeGreaterThan(0);
    expect(typeof d.group_name).toBe("string");
    expect(d.role).toBe("member");
    expect(d.message).toBe("月次をいっしょに回してもらいます");
    expect(d.email).toBe(inv.email);
    expect(new Date(d.expires_at as string).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(d.account_exists).toBe(false);
    expect(d.signed_in).toBeNull();
    expect(JSON.stringify(await h.json(await h.preview(inv.token)))).not.toMatch(/token_hash|tenant_id/);
  });

  it("K331-API-002 ひとことの無い招待・グループを決めていない招待：message と group_name は null（空の文字にしない）", async () => {
    const o = await h.owner("own002");
    const inv = await h.invite(o, { scopeId: null });
    const d = await data(await h.preview(inv.token));
    expect(d.state).toBe("ok");
    expect(d.message).toBeNull();
    expect(d.group_name).toBeNull();
  });

  it("K331-API-003 期限切れ（expires_at を過ぎた）：200・state expired。ワークスペース名と招いた人は出す（送り直しを頼む画面のため・D-128.63）", async () => {
    const o = await h.owner("own003", "株式会社期限");
    const inv = await h.invite(o, { expired: true });
    const r = await h.preview(inv.token);
    expect(r.status).toBe(200);
    const d = await data(r);
    expect(d.state).toBe("expired");
    expect(d.workspace_name).toBe("株式会社期限");
    expect(typeof d.inviter_name).toBe("string");
  });

  it("K331-API-004 取り消し済み（revoked_at）と消した招待（deleted_at）：どちらも 200・state revoked", async () => {
    const o = await h.owner("own004");
    const a = await h.invite(o, { revoked: true });
    const b = await h.invite(o);
    await h.admin.query("update invitations set deleted_at = now() where id = $1", [b.id]);
    expect((await data(await h.preview(a.token))).state).toBe("revoked");
    expect((await data(await h.preview(b.token))).state).toBe("revoked");
  });

  it("K331-API-005 使われた（accepted_member_id がある）：200・state used（期限切れ・取り消しより先に used を返す）", async () => {
    const o = await h.owner("own005");
    const inv = await h.invite(o, { used: true, expired: true });
    expect((await data(await h.preview(inv.token))).state).toBe("used");
  });

  it("K331-API-006 見つからない（でたらめ・空白入り・とても長いトークン）：どれも 404・E-INV-001 とその文。どの欄も出さない", async () => {
    for (const t of ["no-such-token-k331", " spaced token ", "x".repeat(600)]) {
      const r = await h.preview(t);
      expect(r.status, t.slice(0, 20)).toBe(404);
      const j = await h.json(r);
      expect(JSON.stringify(j)).toContain("E-INV-001");
      expect(JSON.stringify(j)).toContain(msg("E-INV-001"));
      expect(j.data ?? null).toBeNull();
    }
  });

  it("K331-API-007 宛てのメールにもうアカウントがある × ログインしていない：account_exists true・signed_in null（ログインして参加する画面のため・answer=becc3d3aa526 ③）", async () => {
    const o = await h.owner("own007");
    const someone = await h.makeUser("has-account");
    const inv = await h.invite(o, { email: someone.email });
    const d = await data(await h.preview(inv.token));
    expect(d.account_exists).toBe(true);
    expect(d.signed_in).toBeNull();
  });

  it("K331-API-008 ログイン中 × 宛てと同じメール：signed_in { email_matches: true, already_member: false }・account_exists true", async () => {
    const o = await h.owner("own008");
    const me = await h.makeUser("same-mail");
    const inv = await h.invite(o, { email: me.email });
    const d = await data(await h.preview(inv.token, { headers: h.bearer(await h.tokenOf(me)) }));
    expect(d.signed_in).toEqual({ email: me.email, email_matches: true, already_member: false });
    expect(d.account_exists).toBe(true);
  });

  it("K331-API-009 ログイン中 × 別のメール宛て：signed_in { email_matches: false, already_member: false }（answer=becc3d3aa526 ②）", async () => {
    const o = await h.owner("own009");
    const me = await h.makeUser("other-mail");
    const inv = await h.invite(o);
    const d = await data(await h.preview(inv.token, { headers: h.bearer(await h.tokenOf(me)) }));
    expect(d.signed_in).toEqual({ email: me.email, email_matches: false, already_member: false });
  });

  it("K331-API-010 ログイン中 × その招待のワークスペースにもう入っている：already_member true（answer=7fe1f09fdab4 ⑦）。抜けた所属（status left）は入っていない扱い", async () => {
    const o = await h.owner("own010");
    const inv = await h.invite(o, { email: o.email });
    const t = await h.tokenOf(o);
    expect(
      ((await data(await h.preview(inv.token, { headers: h.bearer(t) }))).signed_in as Record<string, unknown>)
        .already_member,
    ).toBe(true);

    const p = await h.owner("own010b");
    const left = await h.makeUser("left010");
    const m = await h.admin.query<{ id: string }>(
      "insert into members (tenant_id, scope_id, kind_id, display_name, role_id) select $1, s.id, 'human', '抜けた人', 'member' from scopes s where s.tenant_id = $1 and s.parent_id is null and s.deleted_at is null order by s.created_at limit 1 returning id",
      [p.tenantId],
    );
    await h.admin.query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, 'member', 'left')",
      [p.tenantId, m.rows[0]!.id, left.userId],
    );
    const inv2 = await h.invite(p, { email: left.email });
    const d2 = await data(await h.preview(inv2.token, { headers: h.bearer(await h.tokenOf(left)) }));
    expect(d2.signed_in).toEqual({ email: left.email, email_matches: true, already_member: false });
  });

  it("K331-API-011 役割：invitations.role_id の viewer は viewer、決まった 5 つ（admin・manager・member・viewer・requester）に無い古い値（staff など）は member として返す", async () => {
    const o = await h.owner("own011");
    const v = await h.invite(o, { role: "viewer" });
    const s = await h.invite(o, { role: "staff" });
    expect((await data(await h.preview(v.token))).role).toBe("viewer");
    expect((await data(await h.preview(s.token))).role).toBe("member");
  });

  it("K331-API-012 下見は何も変えない：招待の行（updated_at・accepted_member_id）はそのまま・宛ての利用者も増えない", async () => {
    const o = await h.owner("own012");
    const inv = await h.invite(o);
    const before = await h.row(inv.id);
    const users = await h.authUsers(inv.email);
    await h.preview(inv.token);
    const after = await h.row(inv.id);
    expect(after.updated_at.getTime()).toBe(before.updated_at.getTime());
    expect(after.accepted_member_id).toBeNull();
    expect(await h.authUsers(inv.email)).toBe(users);
  });

  it("K331-API-013 同じ IP から 1 分に 11 回目：429・retry_after_sec が 1 以上（10 回／分／IP・契約）", async () => {
    const o = await h.owner("own013");
    const inv = await h.invite(o);
    const ip = "198.51.100.231";
    for (let i = 0; i < 10; i++) expect((await h.preview(inv.token, { ip })).status).toBe(200);
    const r = await h.preview(inv.token, { ip });
    expect(r.status).toBe(429);
    const sec = Number((await h.json(r))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60, String(sec)).toBe(true);
  });

  it("K331-API-014 答えは貯めない：Cache-Control に no-store（ログイン中の様子と宛てのメールを含むため）", async () => {
    const o = await h.owner("own014");
    const inv = await h.invite(o);
    const r = await h.preview(inv.token);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
  });

  it("K331-API-015 ログインの印が壊れている・切れている：ログインしていない扱いで 200（signed_in null）。401 にしない（ログイン前の画面の口）", async () => {
    const o = await h.owner("own015");
    const inv = await h.invite(o);
    const r = await h.preview(inv.token, { headers: h.bearer("broken-token-k331") });
    expect(r.status).toBe(200);
    expect((await data(r)).signed_in).toBeNull();
  });
  it("K331-API-016 外に影響する手順の失敗：下見の関数が使えない（実行の権限を一時的に外す）：503・E-PAGE-003。招待の行は変わらない", async () => {
    const o = await h.owner("own016");
    const inv = await h.invite(o);
    const before = await h.row(inv.id);
    await h.admin.query("revoke execute on function app.invitation_preview2(text, text) from kaname_app");
    let status = 0;
    let body = "";
    try {
      await h.captureLogs(async () => {
        const r = await h.preview(inv.token);
        status = r.status;
        body = await r.text();
      });
    } finally {
      await h.admin.query("grant execute on function app.invitation_preview2(text, text) to kaname_app");
    }
    expect(status).toBe(503);
    expect(body).toContain("E-PAGE-003");
    expect((await h.row(inv.id)).updated_at.getTime()).toBe(before.updated_at.getTime());
  });
});

describe("K-331 招待の表（DB）", () => {
  it("K331-DB-001 invitations.message：空を許す text・500 文字までの決まり（501 文字は入れられない）", async () => {
    const o = await h.owner("db001");
    const inv = await h.invite(o);
    await h.admin.query("update invitations set message = $2 where id = $1", [inv.id, "あ".repeat(500)]);
    await expect(
      h.admin.query("update invitations set message = $2 where id = $1", [inv.id, "あ".repeat(501)]),
    ).rejects.toThrow();
    await h.admin.query("update invitations set message = null where id = $1", [inv.id]);
  });
});
