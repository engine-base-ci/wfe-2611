// K-807「招待を送り直す・取り消す口（resendInvitation・revokeInvitation）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・
//   偽の画面のログイン・メールは試験の偽。土台 admin.harness.ts）。行 ID（K807-API-…／K807-DB-…）は 11_tickets/K-807.md の表と 1 対 1。
//   入力と答えの形は K-800 の契約：
//     resendInvitation POST   /invitations/:id/resend ← 体なし → 200 { data: { id, email, expires_at, mail: "sent" | "failed" } }
//     revokeInvitation DELETE /invitations/:id        ← 体なし → 200 { data: { id, revoked_at } }
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupAdmin, type P, type World } from "./admin.harness.js";

const h = setupAdmin();
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const DAY = 86_400_000;

interface InvOpts {
  expires?: string;
  revoked?: boolean;
  used?: boolean;
  deleted?: boolean;
  resentAgo?: string;
  tenant?: string;
  scope?: string;
  by?: P;
}
const invite = async (w: World, email: string, o: InvOpts = {}) =>
  h.one<{ id: string; token_hash: string }>(
    `insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, created_by, revoked_at, accepted_member_id, deleted_at, resent_at, message)
     values ($1, $2, $3, 'member', $4, now() + ($5::text)::interval, $6, $7, $8, $9, case when $10::text is null then null else now() - ($10::text)::interval end, 'よろしくお願いします')
     returning id, token_hash`,
    [
      o.tenant ?? w.tenantId,
      email,
      o.scope ?? w.eg,
      sha(randomUUID()),
      o.expires ?? "3 days",
      (o.by ?? w.admin).id,
      o.revoked ? new Date() : null,
      o.used ? w.member.id : null,
      o.deleted ? new Date() : null,
      o.resentAgo ?? null,
    ],
  );
const fresh = (tag: string) => `${tag}-${randomUUID().slice(0, 8)}@engine-base.example`;
const resend = (p: P, id: string, o: { key?: string } = {}) =>
  h.call(p, "POST", `/invitations/${id}/resend`, { body: {}, ...(o.key ? { key: o.key } : {}) });
const revoke = (p: P, id: string) => h.call(p, "DELETE", `/invitations/${id}`);
const inv = (id: string) =>
  h.one<{
    token_hash: string;
    expires_at: Date;
    revoked_at: Date | null;
    resent_at: Date | null;
    resend_requested_at: Date | null;
  }>("select token_hash, expires_at, revoked_at, resent_at, resend_requested_at from invitations where id = $1", [id]);
const tokenOf = (mail: { text: string }) => /\/invite\/([A-Za-z0-9_-]+)/.exec(mail.text)?.[1] ?? "";

describe("K-807 招待を送り直す（resendInvitation）", () => {
  it("K807-API-001 送り直す：200・鍵がちょうど 4・期限が今から 7 日・メール 1 通（件名・リンクのトークンの sha256 が新しい token_hash・前のリンクは使えない）・証跡 invitation.resend 1 行（宛てのドメインだけ）", async () => {
    await h.ready();
    const w = await h.world();
    const email = fresh("a");
    const i = await invite(w, email);
    h.mails.length = 0;
    const r = await resend(w.admin, i.id);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["email", "expires_at", "id", "mail"]);
    expect(d).toMatchObject({ id: i.id, email, mail: "sent" });
    const after = await inv(i.id);
    expect(after.token_hash).not.toBe(i.token_hash);
    expect(Math.abs(after.expires_at.getTime() - (Date.now() + 7 * DAY))).toBeLessThan(60_000);
    expect(after.resent_at).not.toBeNull();
    const mail = h.mails.find((m) => m.to === email)!;
    expect(mail.subject).toContain("招待");
    expect(sha(tokenOf(mail))).toBe(after.token_hash);
    expect(h.mails.filter((m) => m.to === email).length).toBe(1);
    expect(await h.audits(w.tenantId, "invitation.resend")).toBe(1);
    const a = await h.one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'invitation.resend'",
      [w.tenantId],
    );
    expect(JSON.stringify(a.payload)).not.toContain(email);
    expect(a.payload).toMatchObject({ invitation_id: i.id, email_domain: "engine-base.example" });
  });

  it("K807-API-002 期限切れの招待も送り直せる：期限が新しく 7 日になり、メンバーの並び（K-419）の招待中にまた出る（left_days 7）", async () => {
    await h.ready();
    const w = await h.world();
    const i = await invite(w, fresh("exp"), { expires: "-1 hour" });
    const before = (await h.json(await h.call(w.admin, "GET", "/workspace/members"))).data as {
      invitations: { id: string }[];
    };
    expect(before.invitations.map((x) => x.id)).not.toContain(i.id);
    expect((await resend(w.admin, i.id)).status).toBe(200);
    const after = (await h.json(await h.call(w.admin, "GET", "/workspace/members"))).data as {
      invitations: { id: string; left_days: number }[];
    };
    expect(after.invitations.find((x) => x.id === i.id)).toMatchObject({ left_days: 7 });
  });

  it("K807-API-003 送り直しを頼まれていた招待（K-334）：頼みの印 resend_requested_at が空になり、受け箱の「送り直しを頼む」の行が片付く（消した扱い）。別の招待の行は残る", async () => {
    await h.ready();
    const w = await h.world();
    const a = await invite(w, fresh("req"), { expires: "-1 day" });
    const b = await invite(w, fresh("other"), { expires: "-1 day" });
    await h.f.admin.query("update invitations set resend_requested_at = now() where id = any($1::uuid[])", [
      [a.id, b.id],
    ]);
    for (const [id, who] of [
      [a.id, w.admin.id],
      [b.id, w.admin.id],
    ] as const)
      await h.f.admin.query(
        "insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload) values ($1, $2, 'inapp', 'invitation_resend_requested', $3::jsonb)",
        [w.tenantId, who, JSON.stringify({ invitation_id: id })],
      );
    expect((await resend(w.admin, a.id)).status).toBe(200);
    expect((await inv(a.id)).resend_requested_at).toBeNull();
    const rows = await h.rows<{ payload: { invitation_id: string }; deleted_at: Date | null }>(
      "select payload, deleted_at from notifications where tenant_id = $1 and event_kind_id = 'invitation_resend_requested'",
      [w.tenantId],
    );
    expect(rows.find((x) => x.payload.invitation_id === a.id)!.deleted_at).not.toBeNull();
    expect(rows.find((x) => x.payload.invitation_id === b.id)!.deleted_at).toBeNull();
    expect((await inv(b.id)).resend_requested_at).not.toBeNull();
  });

  it("K807-API-004 同じ招待は 1 日 1 回まで（時間の境）：直後 → 409・E-INV-019（detail に次に送れる時刻）・メールは増えない／23 時間前・24 時間の 10 秒前 → 409／24 時間と 10 秒前・25 時間前 → 200／二度押し（同じ冪等キー）は同じ 200・メール 1", async () => {
    await h.ready();
    const w = await h.world();
    const email = fresh("day");
    const i = await invite(w, email);
    h.mails.length = 0;
    const key = randomUUID();
    const [x, y] = [await resend(w.admin, i.id, { key }), await resend(w.admin, i.id, { key })];
    expect([x.status, y.status]).toEqual([200, 200]);
    expect(h.mails.filter((m) => m.to === email).length).toBe(1);
    const again = await resend(w.admin, i.id);
    expect(again.status).toBe(409);
    const j = await h.json(again);
    expect(j.code).toBe("E-INV-019");
    expect(j.field).toBeUndefined();
    expect(j.details).toBeUndefined();
    expect(Object.keys(j.detail ?? {})).toEqual(["次に送れる時刻"]);
    expect(h.mails.filter((m) => m.to === email).length).toBe(1);
    for (const [ago, status] of [
      ["23 hours", 409],
      ["23 hours 59 minutes 50 seconds", 409],
      ["24 hours 10 seconds", 200],
      ["25 hours", 200],
    ] as const) {
      const k = await invite(w, fresh("edge"), { resentAgo: ago });
      expect((await resend(w.admin, k.id)).status, ago).toBe(status);
    }
  });

  it("K807-API-005 送り直せない招待：使われた → 409・E-INV-017／取り消した → 409・E-INV-018／無い id・別の会社の招待・消した招待 → 404・E-INV-016（欄・details なし）。どれもメールも変更も無い", async () => {
    await h.ready();
    const w = await h.world();
    const used = await invite(w, fresh("used"), { used: true });
    const revoked = await invite(w, fresh("rev"), { revoked: true });
    const gone = await invite(w, fresh("gone"), { deleted: true });
    const theirs = await invite(w, fresh("theirs"), {
      tenant: w.other.tenantId,
      scope: w.other.rootScope,
      by: w.outsider,
    });
    h.mails.length = 0;
    const cases: [string, number, string][] = [
      [used.id, 409, "E-INV-017"],
      [revoked.id, 409, "E-INV-018"],
      [randomUUID(), 404, "E-INV-016"],
      [gone.id, 404, "E-INV-016"],
      [theirs.id, 404, "E-INV-016"],
    ];
    for (const [id, status, code] of cases) {
      const r = await resend(w.admin, id);
      expect(r.status, code).toBe(status);
      const j = await h.json(r);
      expect(j.code).toBe(code);
      expect(j.details).toBeUndefined();
      if (status === 404) expect(j.field).toBeUndefined();
    }
    expect(h.mails.length).toBe(0);
    expect((await inv(theirs.id)).resent_at).toBeNull();
    expect(await h.audits(w.tenantId, "invitation.resend")).toBe(0);
  });

  it("K807-API-006 メールが送れない（手順 2・残る）：200・mail failed・証跡 invitation.mail_failed（宛てのドメインだけ）・新しいリンクは有効のまま・送り直しの回数に数えない（次の送り直しが通る）", async () => {
    await h.ready();
    const w = await h.world();
    const email = fresh("fail");
    const i = await invite(w, email);
    h.failMailTo.add(email);
    try {
      const r = await resend(w.admin, i.id);
      expect(r.status).toBe(200);
      expect(((await h.json(r)).data as { mail: string }).mail).toBe("failed");
    } finally {
      h.failMailTo.delete(email);
    }
    const after = await inv(i.id);
    expect(after.token_hash).not.toBe(i.token_hash);
    expect(after.resent_at).toBeNull();
    expect(await h.audits(w.tenantId, "invitation.mail_failed")).toBe(1);
    const a = await h.one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'invitation.mail_failed'",
      [w.tenantId],
    );
    expect(JSON.stringify(a.payload)).not.toContain(email);
    expect((await resend(w.admin, i.id)).status).toBe(200);
  });

  it("K807-API-007 後片付けの失敗（手順 3）：メールが送れず、送れなかった証跡も書けない → 200・mail failed・ログに「招待のメールの結果を書けなかった」1 行（宛ての字は無い）・新しいリンクは有効のまま", async () => {
    await h.ready();
    const w = await h.world();
    const email = fresh("fail2");
    const i = await invite(w, email);
    h.failMailTo.add(email);
    let status = 0;
    let mail = "";
    const logs = await h.captureLogs(async () => {
      await h.breakOn(
        "audit_events",
        w.tenantId,
        "insert",
        async () => {
          const r = await resend(w.admin, i.id);
          status = r.status;
          mail = String(((await h.json(r)).data as { mail?: string } | undefined)?.mail);
        },
        "new.action = 'invitation.mail_failed'",
      );
    });
    h.failMailTo.delete(email);
    expect(status).toBe(200);
    expect(mail).toBe("failed");
    expect(logs).toContain("招待のメールの結果を書けなかった");
    expect(logs).not.toContain(email);
    expect((await inv(i.id)).token_hash).not.toBe(i.token_hash);
    expect(await h.audits(w.tenantId, "invitation.mail_failed")).toBe(0);
  });

  it("K807-API-008 権限：管理者・members の invite を付けた人は 200・マネージャー・メンバー・閲覧のみ・止めた人は 403（変わらない・メール 0）・ログインしていない 401・上限 1 回で 2 回目 429", async () => {
    await h.ready();
    const w = await h.world();
    const granted = await h.make(w, "granted", "招く権限の人");
    await h.f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'invite')",
      [w.tenantId, granted.id],
    );
    const a = await invite(w, fresh("p1"));
    const b = await invite(w, fresh("p2"));
    expect((await resend(w.admin, a.id)).status).toBe(200);
    expect((await resend(granted, b.id)).status).toBe(200);
    const c = await invite(w, fresh("p3"));
    h.mails.length = 0;
    for (const p of [w.mgr, w.member, w.viewer, w.stopped]) expect((await resend(p, c.id)).status, p.name).toBe(403);
    expect(h.mails.length).toBe(0);
    expect((await inv(c.id)).token_hash).toBe(c.token_hash);
    expect((await h.f.req("POST", `/invitations/${c.id}/resend`, { body: {} })).status).toBe(401);
    h.limits["resendInvitation"] = 1;
    try {
      const d1 = await invite(w, fresh("p4"));
      const d2 = await invite(w, fresh("p5"));
      expect((await resend(w.admin, d1.id)).status).toBe(200);
      expect((await resend(w.admin, d2.id)).status).toBe(429);
    } finally {
      h.limits["resendInvitation"] = 10_000;
    }
  });

  it("K807-API-009 操作の揺れ（G-16）：同じ招待を別の冪等キーで同時に 2 本 → 200 と 409（E-INV-019）・メールは 1 通。送り直しと取り消しを同時に → 片方だけが勝ち、取り消した招待は新しいリンクを持たない", async () => {
    await h.ready();
    const w = await h.world();
    const email = fresh("race");
    const i = await invite(w, email);
    h.mails.length = 0;
    const rs = await Promise.all([
      resend(w.admin, i.id, { key: randomUUID() }),
      resend(w.admin2, i.id, { key: randomUUID() }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(h.mails.filter((m) => m.to === email).length).toBe(1);
    const j = await invite(w, fresh("race2"));
    const [a, b] = await Promise.all([resend(w.admin, j.id), revoke(w.admin2, j.id)]);
    const after = await inv(j.id);
    if (b.status === 200) {
      expect(after.revoked_at).not.toBeNull();
      expect([200, 409]).toContain(a.status);
    } else {
      expect(b.status).toBe(409);
      expect(after.revoked_at).toBeNull();
    }
  });

  it("K807-API-010 失敗（手順 1）：招待の更新・証跡を書く所で DB が落ちる → 503・E-PAGE-003・リンクも期限も送り直しの印も変わらない・メール 0。やり直すと 200", async () => {
    await h.ready();
    const w = await h.world();
    const email = fresh("db");
    const i = await invite(w, email);
    const before = await inv(i.id);
    h.mails.length = 0;
    for (const [table, op] of [
      ["invitations", "update"],
      ["audit_events", "insert"],
    ] as const)
      await h.breakOn(table, w.tenantId, op, async () => {
        const r = await resend(w.admin, i.id);
        expect(r.status, table).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    expect(await inv(i.id)).toEqual(before);
    expect(h.mails.length).toBe(0);
    expect((await resend(w.admin, i.id)).status).toBe(200);
  });
});

describe("K-807 招待を取り消す（revokeInvitation）", () => {
  it("K807-API-011 取り消す：200・鍵がちょうど 2（id・revoked_at）・revoked_at が入る・メンバーの並びの招待中から消える・リンクは使えなくなる（招待の下見 getInvitation が使えない）・証跡 invitation.revoke 1 行・K-334 の頼みの行が片付く", async () => {
    await h.ready();
    const w = await h.world();
    const i = await invite(w, fresh("rv"), { expires: "-1 day" });
    await h.f.admin.query("update invitations set resend_requested_at = now() where id = $1", [i.id]);
    await h.f.admin.query(
      "insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload) values ($1, $2, 'inapp', 'invitation_resend_requested', $3::jsonb)",
      [w.tenantId, w.admin.id, JSON.stringify({ invitation_id: i.id })],
    );
    const live = await invite(w, fresh("live"));
    const r = await revoke(w.admin, live.id);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["id", "revoked_at"]);
    expect((await inv(live.id)).revoked_at).not.toBeNull();
    const list = (await h.json(await h.call(w.admin, "GET", "/workspace/members"))).data as {
      invitations: { id: string }[];
    };
    expect(list.invitations.map((x) => x.id)).not.toContain(live.id);
    expect(await h.audits(w.tenantId, "invitation.revoke")).toBe(1);
    expect((await revoke(w.admin, i.id)).status).toBe(200);
    expect((await inv(i.id)).resend_requested_at).toBeNull();
    const n = await h.one<{ deleted_at: Date | null }>(
      "select deleted_at from notifications where tenant_id = $1 and event_kind_id = 'invitation_resend_requested'",
      [w.tenantId],
    );
    expect(n.deleted_at).not.toBeNull();
  });

  it("K807-API-012 取り消せない招待：使われた → 409・E-INV-017／もう取り消した（二度押し）→ 409・E-INV-018／無い id・別の会社・消した → 404・E-INV-016（欄・details なし）・どれも変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const used = await invite(w, fresh("u"), { used: true });
    const done = await invite(w, fresh("d"), { revoked: true });
    const gone = await invite(w, fresh("g"), { deleted: true });
    const theirs = await invite(w, fresh("t"), { tenant: w.other.tenantId, scope: w.other.rootScope, by: w.outsider });
    for (const [id, status, code] of [
      [used.id, 409, "E-INV-017"],
      [done.id, 409, "E-INV-018"],
      [randomUUID(), 404, "E-INV-016"],
      [gone.id, 404, "E-INV-016"],
      [theirs.id, 404, "E-INV-016"],
    ] as const) {
      const r = await revoke(w.admin, id);
      expect(r.status, code).toBe(status);
      const j = await h.json(r);
      expect(j.code).toBe(code);
      expect(j.details).toBeUndefined();
      if (status === 404) expect(j.field).toBeUndefined();
    }
    expect((await inv(theirs.id)).revoked_at).toBeNull();
    expect(await h.audits(w.tenantId, "invitation.revoke")).toBe(0);
  });

  it("K807-API-013 権限：管理者・invite を付けた人は 200・マネージャー・メンバー・閲覧のみ・止めた人は 403（取り消されない）・ログインしていない 401", async () => {
    await h.ready();
    const w = await h.world();
    const granted = await h.make(w, "granted", "招く権限の人");
    await h.f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'invite')",
      [w.tenantId, granted.id],
    );
    const a = await invite(w, fresh("x1"));
    const b = await invite(w, fresh("x2"));
    expect((await revoke(granted, a.id)).status).toBe(200);
    for (const p of [w.mgr, w.member, w.viewer, w.stopped]) expect((await revoke(p, b.id)).status, p.name).toBe(403);
    expect((await inv(b.id)).revoked_at).toBeNull();
    expect((await h.f.req("DELETE", `/invitations/${b.id}`)).status).toBe(401);
    expect((await revoke(w.admin, b.id)).status).toBe(200);
  });

  it("K807-API-014 失敗（手順 1）：取り消しの更新・証跡で DB が落ちる → 503・E-PAGE-003・取り消されない・証跡 0。やり直すと 200", async () => {
    await h.ready();
    const w = await h.world();
    const i = await invite(w, fresh("rdb"));
    for (const [table, op] of [
      ["invitations", "update"],
      ["audit_events", "insert"],
    ] as const)
      await h.breakOn(table, w.tenantId, op, async () => {
        const r = await revoke(w.admin, i.id);
        expect(r.status, table).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    expect((await inv(i.id)).revoked_at).toBeNull();
    expect(await h.audits(w.tenantId, "invitation.revoke")).toBe(0);
    expect((await revoke(w.admin, i.id)).status).toBe(200);
  });

  it("K807-DB-015 守り：kaname_app から直に呼べるのは app.invitation_resend・app.invitation_revoke・app.invitation_mail_failed だけ。書けない人が直に呼ぶと forbidden・行は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const i = await invite(w, fresh("db15"));
    const v = (
      await h.asOwner<{ v: { error?: string } }>(w.member, "select app.invitation_revoke($1::uuid) as v", [i.id])
    )[0]!.v;
    expect(v).toMatchObject({ error: "forbidden" });
    const v2 = (
      await h.asOwner<{ v: { error?: string } }>(w.member, "select app.invitation_resend($1::uuid, $2) as v", [
        i.id,
        sha("x"),
      ])
    )[0]!.v;
    expect(v2).toMatchObject({ error: "forbidden" });
    expect((await inv(i.id)).revoked_at).toBeNull();
    const ok = (
      await h.asOwner<{ v: { ok?: boolean } }>(w.admin, "select app.invitation_revoke($1::uuid) as v", [i.id])
    )[0]!.v;
    expect(ok.ok).toBe(true);
  });
});
