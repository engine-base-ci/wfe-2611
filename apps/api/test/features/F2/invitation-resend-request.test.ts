// K-334「送り直しを頼む口」（requestInvitationResend・POST /api/v1/auth/invitations/:token/resend-request・新しい口）の単体の試験。
// 名前の頭の行 ID（K334-API-…）は 11_tickets/K-334.md の表に 1 対 1 で結ぶ。土台は invite.harness.ts（K-331）。
// 期限切れの招待だけ。招いた人（抜けていれば管理者全員）に知らせる（関門 C6・answer=7fe1f09fdab4 ⑤・D-128.63）。同じ招待で 1 日 1 回。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { describe, expect, it } from "vitest";
import { failMailTo, mails } from "../F1/login.harness.js";
import { msg, setupInvite } from "./invite.harness.js";

const h = setupInvite("k334");
const KIND = "invitation_resend_requested";

const notes = async (tenantId: string) =>
  (
    await h.admin.query<{ member_id: string; payload: Record<string, unknown> }>(
      "select member_id, payload from notifications where tenant_id = $1 and event_kind_id = $2 order by created_at",
      [tenantId, KIND],
    )
  ).rows;
const result = async (r: Response) => ((await h.json(r)).data as Record<string, unknown> | undefined)?.result;
const errOf = async (r: Response) => JSON.stringify(await h.json(r));

describe("K-334 送り直しを頼む：招待の状態 × 回数", () => {
  it('K334-API-001 期限切れ × はじめて：201・{ result: "sent" }（data の欄はこれだけ）。招いた人に知らせが 1 つ（notifications・種類 invitation_resend_requested）とメールが 1 通', async () => {
    const o = await h.owner("own001", "株式会社送り直し");
    const inv = await h.invite(o, { expired: true });
    const before = mails.length;
    const r = await h.resendRequest(inv.token);
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await h.json(r)).data).toEqual({ result: "sent" });
    const n = await notes(o.tenantId);
    expect(n).toHaveLength(1);
    expect(n[0]!.member_id).toBe(o.memberId);
    expect(mails.length - before).toBe(1);
    expect(mails.at(-1)!.to).toBe(o.email);
  });

  it("K334-API-002 知らせの中身：宛てのメール（誰が頼んだか）と招いた日と期限は書くが、招待のトークン・リンク（/invite/…）は書かない（メールの本文にも無い）", async () => {
    const o = await h.owner("own002");
    const inv = await h.invite(o, { expired: true });
    expect((await h.resendRequest(inv.token)).status).toBe(201);
    const n = (await notes(o.tenantId))[0]!;
    const all = JSON.stringify(n.payload) + mails.at(-1)!.text + mails.at(-1)!.subject;
    expect(all).toContain(inv.email);
    expect(all).not.toContain(inv.token);
    expect(all).not.toMatch(/\/invite\//);
  });

  it('K334-API-003 同じ招待で 1 日に 2 回目：201・{ result: "already" }。知らせもメールも増えない', async () => {
    const o = await h.owner("own003");
    const inv = await h.invite(o, { expired: true });
    expect(await result(await h.resendRequest(inv.token))).toBe("sent");
    const before = mails.length;
    const r = await h.resendRequest(inv.token);
    expect(r.status).toBe(201);
    expect(await result(r)).toBe("already");
    expect(await notes(o.tenantId)).toHaveLength(1);
    expect(mails.length).toBe(before);
  });

  it("K334-API-004 前に頼んでから 24 時間を過ぎた：もう一度 sent（記録の時刻を 25 時間前にずらして確かめる）", async () => {
    const o = await h.owner("own004");
    const inv = await h.invite(o, { expired: true });
    expect(await result(await h.resendRequest(inv.token))).toBe("sent");
    await h.admin.query("update invitations set resend_requested_at = now() - interval '25 hours' where id = $1", [
      inv.id,
    ]);
    expect(await result(await h.resendRequest(inv.token))).toBe("sent");
    expect(await notes(o.tenantId)).toHaveLength(2);
  });

  it("K334-API-005 招いた人がもう居ない（members.deleted_at）：そのワークスペースの管理者全員に知らせる（会社を作った人が入り、消した招いた人は入らない）", async () => {
    const o = await h.owner("own005");
    const inviter = await h.admin.query<{ id: string }>(
      "insert into members (tenant_id, scope_id, kind_id, display_name, role_id) select $1, s.id, 'human', '招いた人', 'member' from scopes s where s.tenant_id = $1 and s.parent_id is null and s.deleted_at is null order by s.created_at limit 1 returning id",
      [o.tenantId],
    );
    const inv = await h.invite({ ...o, memberId: inviter.rows[0]!.id }, { expired: true });
    await h.admin.query("update members set deleted_at = now() where id = $1", [inviter.rows[0]!.id]);
    expect(await result(await h.resendRequest(inv.token))).toBe("sent");
    const to = (await notes(o.tenantId)).map((n) => n.member_id);
    expect(to).toContain(o.memberId);
    expect(to).not.toContain(inviter.rows[0]!.id);
  });

  it("K334-API-006 まだ使える招待：409・E-INV-008 とその文（送り直しは要らない）。知らせない", async () => {
    const o = await h.owner("own006");
    const inv = await h.invite(o);
    const r = await h.resendRequest(inv.token);
    expect(r.status).toBe(409);
    const t = await errOf(r);
    expect(t).toContain("E-INV-008");
    expect(t).toContain(msg("E-INV-008"));
    expect(await notes(o.tenantId)).toHaveLength(0);
  });

  it("K334-API-007 取り消し 410・E-INV-002／使われた 410・E-INV-004／見つからない 404・E-INV-001。どれも知らせない", async () => {
    const o = await h.owner("own007");
    for (const [opts, code] of [
      [{ revoked: true, expired: true }, "E-INV-002"],
      [{ used: true, expired: true }, "E-INV-004"],
    ] as const) {
      const inv = await h.invite(o, opts);
      const r = await h.resendRequest(inv.token);
      expect(r.status, code).toBe(410);
      expect(await errOf(r)).toContain(code);
    }
    const nf = await h.resendRequest("no-such-token-k334");
    expect(nf.status).toBe(404);
    expect(await errOf(nf)).toContain("E-INV-001");
    expect(await notes(o.tenantId)).toHaveLength(0);
  });

  it('K334-API-008 メールが送れなかった：201・{ result: "failed" }（502 にしない）。知らせの行は残り、もう一度押せば送り直す（1 日 1 回に数えない）', async () => {
    const o = await h.owner("own008");
    const inv = await h.invite(o, { expired: true });
    failMailTo.add(o.email);
    try {
      expect(await result(await h.resendRequest(inv.token))).toBe("failed");
      expect(await notes(o.tenantId)).toHaveLength(1);
    } finally {
      failMailTo.delete(o.email);
    }
    expect(await result(await h.resendRequest(inv.token))).toBe("sent");
  });

  it("K334-API-009 同じ IP から 1 分に 11 回目：429・retry_after_sec（10 回／分／IP）", async () => {
    const ip = "198.51.100.233";
    for (let i = 0; i < 10; i++) await h.resendRequest("no-such-token-k334-rl", { ip });
    const r = await h.resendRequest("no-such-token-k334-rl", { ip });
    expect(r.status).toBe(429);
    const sec = Number((await h.json(r))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60, String(sec)).toBe(true);
  });

  it("K334-API-010 頼んだ後の下見：state は expired のまま（送り直しは招いた人が新しい招待を出すこと・この口は招待を変えない）", async () => {
    const o = await h.owner("own010");
    const inv = await h.invite(o, { expired: true });
    expect(await result(await h.resendRequest(inv.token))).toBe("sent");
    expect(((await h.json(await h.preview(inv.token))).data as Record<string, unknown>).state).toBe("expired");
    expect((await h.row(inv.id)).accepted_member_id).toBeNull();
  });
  // ---- 外に影響する手順（11_tickets/K-334.md）：① 宛てを引き知らせの行を入れる（1 つの取引）③ メールを送る［残る：送ったメールは取り消せない］④ 頼んだ時刻を書く
  it("K334-API-011 手順 ① が失敗（宛てを引く関数が使えない・実行の権限を一時的に外す）：503・E-PAGE-003。知らせの行もメールも無い", async () => {
    const o = await h.owner("own011");
    const inv = await h.invite(o, { expired: true });
    const before = mails.length;
    await h.admin.query("revoke execute on function app.invitation_resend_targets(text) from kaname_app");
    let r!: Response;
    try {
      await h.captureLogs(async () => {
        r = await h.resendRequest(inv.token);
      });
    } finally {
      await h.admin.query("grant execute on function app.invitation_resend_targets(text) to kaname_app");
    }
    expect(r.status).toBe(503);
    expect(await errOf(r)).toContain("E-PAGE-003");
    expect(await notes(o.tenantId)).toHaveLength(0);
    expect(mails.length).toBe(before);
  });

  it('K334-API-012 手順 ③ の後に ④ が失敗（頼んだ時刻を書けない・試験の間だけの引き金で断る）：送ったメールは取り消せないので 201・{ result: "sent" }。ログに招待の id と「時刻を書けなかった」が出る。次に押すともう一度送る（時刻が無いので 1 日 1 回に数えない）', async () => {
    const o = await h.owner("own012");
    const inv = await h.invite(o, { expired: true });
    const fn = `k334_no_stamp_${h.run.replace(/[^a-z0-9]/g, "_")}`;
    await h.admin.query(
      `create function public.${fn}() returns trigger language plpgsql as $$ begin
         if new.id = '${inv.id}'::uuid and new.resend_requested_at is distinct from old.resend_requested_at
         then raise exception 'K-334 の試験：時刻を書かせない'; end if; return new; end $$`,
    );
    await h.admin.query(
      `create trigger ${fn} before update on invitations for each row execute function public.${fn}()`,
    );
    let r!: Response;
    let logs!: string;
    try {
      logs = await h.captureLogs(async () => {
        r = await h.resendRequest(inv.token);
      });
    } finally {
      await h.admin.query(`drop trigger if exists ${fn} on invitations`);
      await h.admin.query(`drop function if exists public.${fn}()`);
    }
    expect(r.status).toBe(201);
    expect(await result(r)).toBe("sent");
    expect(logs).toContain(inv.id);
    expect(logs).toContain("時刻を書けなかった");
    expect(await result(await h.resendRequest(inv.token))).toBe("sent");
    expect(await notes(o.tenantId)).toHaveLength(2);
  });
});

describe("K-334 招待の表（DB）", () => {
  it("K334-DB-001 invitations.resend_requested_at：空を許す timestamptz（最後に頼まれた時刻・1 日 1 回の判定に使う）", async () => {
    const o = await h.owner("db001");
    const inv = await h.invite(o, { expired: true });
    const r = await h.admin.query<{ t: Date | null }>(
      "select resend_requested_at as t from invitations where id = $1",
      [inv.id],
    );
    expect(r.rows[0]!.t).toBeNull();
  });
});
