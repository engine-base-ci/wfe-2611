// K-835「メールを変える」の口の試験（本物の DB・メールの送出と認証の部品は偽・口の入口は createApp と契約の op・偽の画面のログイン。土台 me.harness.ts）。
//   行 ID（K835-API-…）は 11_tickets/K-835.md の表と 1 対 1。
//   requestEmailChange POST /me/email-change { email }（本人確認の取り直しが要る）→ 201 { data: { pending_email, expires_at } }
//   verifyEmailChange  POST /me/email-change/verify { token }（確かめのリンクを持つ本人）→ 201 { data: { changed: true, email } }
//   待っている変更は app.member_email_changes（app スキーマ・アプリの役は直に触れない・関数だけ）（token_hash・new_email・expires_at・used_at・revoked_at）。確かめのリンクは 24 時間・1 回だけ（D-154.12）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { msg, setupMe, type P } from "./me.harness.js";

const h = setupMe("me-email.ts", { extraHooks: ["me-profile.ts"] });
const ask = (p: P, email: unknown, o: { su?: number; key?: string } = {}) =>
  h.call(p, "POST", "/me/email-change", { body: { email }, su: o.su ?? h.suNow(), ...(o.key ? { key: o.key } : {}) });
const verify = (p: P, token: unknown) => h.call(p, "POST", "/me/email-change/verify", { body: { token } });
const tokenOf = (to: string): string => {
  const m = [...h.mails].reverse().find((x) => x.to === to);
  const t = /token=([A-Za-z0-9_-]+)/.exec(m?.text ?? "")?.[1];
  if (!t) throw new Error(`${to} への確かめのメールにリンクが無い`);
  return t;
};
const mailsTo = (to: string) => h.mails.filter((m) => m.to === to);
const loginEmail = async (p: P) =>
  (
    await h.one<{ e: string }>(
      'select u.email as e from kaname_auth."user" u join tenant_memberships tm on tm.auth_user_id = u.id where tm.member_id = $1',
      [p.id],
    )
  ).e;
const pending = (p: P) =>
  h.rows<Record<string, any>>("select * from app.member_email_changes where member_id = $1 order by created_at", [
    p.id,
  ]);
const fresh = () => `new-${randomUUID().slice(0, 8)}@engine-base.example`;

describe("K-835 メールを変える（requestEmailChange・verifyEmailChange）", () => {
  it("K835-API-001 頼む：201・pending_email は表記をそろえた宛て（全角・大文字・前後の空白を直す）・expires_at は 24 時間後・新しいアドレスだけに確かめのメール（リンクは webBaseUrl の /account/email-confirm?token= で始まる・D-154.77）・ログインのメールはまだ今のまま・読み直すと email_pending が出る・DB にはリンクの印のハッシュだけ", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    const r = await ask(w.member, `　${to.toUpperCase()} `);
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await h.json(r)).data!;
    expect(d["pending_email"]).toBe(to);
    const left = Date.parse(String(d["expires_at"])) - Date.now();
    expect(left).toBeGreaterThan(23.9 * 3600_000);
    expect(left).toBeLessThanOrEqual(24 * 3600_000);
    expect(mailsTo(to).length).toBe(1);
    expect(mailsTo(w.member.email).length).toBe(0);
    const tok = tokenOf(to);
    expect(mailsTo(to)[0]!.text).toContain(`https://app.kaname.test/account/email-confirm?token=${tok}`);
    expect(await loginEmail(w.member)).toBe(w.member.email);
    const rows = await pending(w.member);
    expect(rows.length).toBe(1);
    expect(JSON.stringify(rows[0])).not.toContain(tok);
    expect(((await h.json(await h.call(w.member, "GET", "/me"))).data!["member"] as any).email_pending).toBe(to);
  });

  it("K835-API-002 本人確認：取り直しが無い・15 分より前なら 403・STEP_UP_REQUIRED・メールも待っている変更も作らない", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    for (const su of [undefined, h.suAgo(16)]) {
      const r = await h.call(w.member, "POST", "/me/email-change", { body: { email: to }, ...(su ? { su } : {}) });
      expect(r.status).toBe(403);
      expect((await h.json(r)).code).toBe("STEP_UP_REQUIRED");
    }
    expect((await ask(w.member, to, { su: h.suAgo(14) })).status).toBe(201);
    expect(mailsTo(to).length).toBe(1);
    expect((await pending(w.member)).length).toBe(1);
  });

  it("K835-API-003 宛ての形：形でない文字・空・@ だけ・ドットの無いドメイン・NUL は 422・E-ME-020（メールの形が違います）・メールも待っている変更も作らない", async () => {
    await h.ready();
    const w = await h.world();
    const before = h.mails.length;
    for (const v of ["takamoto@engine-base", "", "@", "名前", "a@b", "a b@c.example\u0000"]) {
      const r = await ask(w.member, v);
      expect(r.status, JSON.stringify(v)).toBe(422);
      expect((await h.json(r)).details?.[0]?.field).toBe("email");
    }
    expect((await h.json(await ask(w.member, "takamoto@engine-base"))).code).toBe("E-ME-020");
    expect(msg("E-ME-020")).toContain("メールの形");
    expect(h.mails.length).toBe(before);
    expect((await pending(w.member)).length).toBe(0);
  });

  it("K835-API-004 今のメールと同じ（全角・大文字でも同じ）は 409・E-ME-026・メールも待っている変更も作らない", async () => {
    await h.ready();
    const w = await h.world();
    const r = await ask(w.member, w.member.email.toUpperCase());
    expect(r.status).toBe(409);
    expect((await h.json(r)).code).toBe("E-ME-026");
    expect(mailsTo(w.member.email).length).toBe(0);
    expect((await pending(w.member)).length).toBe(0);
  });

  it("K835-API-005 もう別のアカウントで使われている宛て（大文字・全角でも同じ・ほかの会社の人でも）は 409・E-ME-021・メールも待っている変更も作らない", async () => {
    await h.ready();
    const w = await h.world();
    for (const taken of [w.admin.email, w.outsider.email.toUpperCase()]) {
      const r = await ask(w.member, taken);
      expect(r.status, taken).toBe(409);
      expect((await h.json(r)).code).toBe("E-ME-021");
      expect(mailsTo(taken.toLowerCase()).length).toBe(0);
    }
    expect((await pending(w.member)).length).toBe(0);
    expect(msg("E-ME-021")).toContain("もう別のアカウントで使われています");
  });

  it("K835-API-006 送り直す（同じ宛てをもう一度頼む）・別の宛てに替える：新しいリンクが届き前のリンクは使えなくなる・待っている変更は 1 つだけ", async () => {
    await h.ready();
    const w = await h.world();
    const a = fresh();
    await ask(w.member, a);
    const t1 = tokenOf(a);
    await ask(w.member, a);
    const t2 = tokenOf(a);
    expect(t2).not.toBe(t1);
    expect(mailsTo(a).length).toBe(2);
    const old = await verify(w.member, t1);
    expect(old.status).toBe(409);
    expect((await h.json(old)).code).toBe("E-PAGE-006");
    const b = fresh();
    await ask(w.member, b);
    expect((await verify(w.member, t2)).status).toBe(409);
    expect((await pending(w.member)).filter((x) => !x.revoked_at && !x.used_at).length).toBe(1);
    expect((await verify(w.member, tokenOf(b))).status).toBe(201);
    expect(await loginEmail(w.member)).toBe(b);
  });

  it("K835-API-007 頼みすぎ：1 時間に 5 回まで・6 回目は 429・E-ME-024・メールは送らない（1 時間たてばまた頼める）", async () => {
    await h.ready();
    const w = await h.world();
    for (let i = 0; i < 5; i++) expect((await ask(w.member, fresh())).status, `${i}`).toBe(201);
    const n = h.mails.length;
    const r = await ask(w.member, fresh());
    expect(r.status).toBe(429);
    expect((await h.json(r)).code).toBe("E-ME-024");
    expect(h.mails.length).toBe(n);
    await h.f.admin.query(
      "update app.member_email_changes set created_at = now() - interval '61 minutes' where member_id = $1",
      [w.member.id],
    );
    expect((await ask(w.member, fresh())).status).toBe(201);
  });

  it("K835-API-008 手順 2（確かめのメールを送る）の失敗：502・E-ME-025・待っている変更は残らない・email_pending は出ない（送れたと嘘をつかない）", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    h.failMailTo.add(to);
    const r = await ask(w.member, to);
    expect(r.status).toBe(502);
    expect((await h.json(r)).code).toBe("E-ME-025");
    expect((await pending(w.member)).filter((x) => !x.revoked_at && !x.used_at).length).toBe(0);
    expect(((await h.json(await h.call(w.member, "GET", "/me"))).data!["member"] as any).email_pending).toBeNull();
    h.failMailTo.delete(to);
    expect((await ask(w.member, to)).status).toBe(201);
  });

  it("K835-API-009 確かめる：201・changed true・ログインのメールが新しい宛てになる（emailVerified 真）・同じログインの別の会社でも新しいメール・email_pending は空・安全の記録 email_changed が残る・古いアドレスにだけ変わったと知らせる（リンクは入れない）", async () => {
    await h.ready();
    const w = await h.world();
    const co = await h.f.company(`別の会社-${randomUUID().slice(0, 4)}`, "ZZ");
    const other = await h.f.alsoIn(w.member, co.tenantId, co.rootScope);
    const to = fresh();
    await ask(w.member, to);
    const tok = tokenOf(to);
    const old = w.member.email;
    const r = await verify(w.member, tok);
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await h.json(r)).data).toMatchObject({ changed: true, email: to });
    expect(await loginEmail(w.member)).toBe(to);
    expect(
      (await h.one<{ v: boolean }>('select "emailVerified" as v from kaname_auth."user" where email = $1', [to])).v,
    ).toBe(true);
    const me = (await h.json(await h.call(other, "GET", "/me"))).data!["member"] as any;
    expect(me.email).toBe(to);
    expect(me.email_pending).toBeNull();
    expect(
      await h.num("select count(*) as n from security_events where tenant_id = $1 and kind_id = 'email_changed'", [
        w.tenantId,
      ]),
    ).toBeGreaterThanOrEqual(1);
    const told = mailsTo(old);
    expect(told.length).toBe(1);
    expect(told[0]!.text).not.toContain(tok);
    expect(told[0]!.text).not.toContain("token=");
  });

  it("K835-API-010 1 回だけ：使ったあとのリンクは 409・E-ME-023（このリンクはもう使いました）・メールは変わったまま・もう一度知らせも送らない", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    await ask(w.member, to);
    const tok = tokenOf(to);
    expect((await verify(w.member, tok)).status).toBe(201);
    const n = h.mails.length;
    const r = await verify(w.member, tok);
    expect(r.status).toBe(409);
    expect((await h.json(r)).code).toBe("E-ME-023");
    expect(await loginEmail(w.member)).toBe(to);
    expect(h.mails.length).toBe(n);
  });

  it("K835-API-011 期限：24 時間をすぎたリンクは 409・E-ME-022（リンクの期限が切れました）・メールは変わらない・直前（23 時間 59 分）は通る", async () => {
    await h.ready();
    const w = await h.world();
    const a = fresh();
    await ask(w.member, a);
    await h.f.admin.query(
      "update app.member_email_changes set expires_at = now() + interval '1 minute' where member_id = $1",
      [w.member.id],
    );
    expect((await verify(w.member, tokenOf(a))).status).toBe(201);
    const w2 = await h.world();
    const b = fresh();
    await ask(w2.member, b);
    await h.f.admin.query(
      "update app.member_email_changes set expires_at = now() - interval '1 second' where member_id = $1",
      [w2.member.id],
    );
    const r = await verify(w2.member, tokenOf(b));
    expect(r.status).toBe(409);
    expect((await h.json(r)).code).toBe("E-ME-022");
    expect(await loginEmail(w2.member)).toBe(w2.member.email);
  });

  it("K835-API-012 使えないリンク：でたらめ（409）・空と 201 字以上（422・契約の形）・他の人に届いたリンク・取り消された（送り直しで替わった）リンクは 409・E-PAGE-006（在るかを漏らさない）・メールは変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    await ask(w.member, to);
    const tok = tokenOf(to);
    expect((await verify(w.member, "でたらめ")).status).toBe(409);
    for (const t of ["", "x".repeat(300)]) expect((await verify(w.member, t)).status, `${t.length} 字`).toBe(422);
    expect((await h.json(await verify(w.member, "nonexistent-token-value"))).code).toBe("E-PAGE-006");
    const r = await verify(w.admin2, tok);
    expect(r.status).toBe(409);
    expect((await h.json(r)).code).toBe("E-PAGE-006");
    expect(await loginEmail(w.member)).toBe(w.member.email);
    expect(await loginEmail(w.admin2)).toBe(w.admin2.email);
  });

  it("K835-API-013 確かめるまでの間に宛てがほかの人に使われた：409・E-ME-021・メールは変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    await ask(w.member, to);
    const tok = tokenOf(to);
    await h.f.admin.query(
      'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
      [randomUUID(), "先に使った人", to],
    );
    const r = await verify(w.member, tok);
    expect(r.status).toBe(409);
    expect((await h.json(r)).code).toBe("E-ME-021");
    expect(await loginEmail(w.member)).toBe(w.member.email);
  });

  it("K835-API-014 手順 5（古いアドレスへの知らせ）の失敗：201 のまま・メールは変わった・ログに [me-email] の行が 1 つ（宛ては出さない）", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    await ask(w.member, to);
    const tok = tokenOf(to);
    h.failMailTo.add(w.member.email);
    let logs = "";
    try {
      logs = await h.captureLogs(async () => {
        expect((await verify(w.member, tok)).status).toBe(201);
      });
    } finally {
      h.failMailTo.delete(w.member.email);
    }
    expect(await loginEmail(w.member)).toBe(to);
    expect(logs.split("\n").filter((l) => l.includes("[me-email]")).length).toBe(1);
    expect(logs).not.toContain(w.member.email);
  });

  it("K835-API-015 手順 1（頼む口）・手順 4（確かめる口）の DB に書くの失敗：頼む口も確かめる口も 503・E-PAGE-003・頼む口は待っている変更もメールも作らず、確かめる口はメールを変えず印も使わない（やり直せる）", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    await h.captureLogs(async () => {
      await h.breakPool(["requestEmailChange"], async () => {
        const r = await ask(w.member, to);
        expect(r.status).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    });
    expect((await pending(w.member)).length).toBe(0);
    expect(mailsTo(to).length).toBe(0);
    await ask(w.member, to);
    const tok = tokenOf(to);
    await h.captureLogs(async () => {
      await h.breakPool(["verifyEmailChange"], async () => {
        const r = await verify(w.member, tok);
        expect(r.status).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    });
    expect(await loginEmail(w.member)).toBe(w.member.email);
    expect((await verify(w.member, tok)).status).toBe(201);
  });

  it("K835-API-016 守り：ログインなし 401（頼む・確かめる）・止めた人は 401／403・本人の頼みだけが本人のログインに効く（別の人の待っている変更は触らない）", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    expect(
      (
        await h.call(w.member, "POST", "/me/email-change", {
          body: { email: to },
          su: h.suNow(),
          headers: { authorization: "" },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await h.call(w.member, "POST", "/me/email-change/verify", {
          body: { token: "x" },
          headers: { authorization: "" },
        })
      ).status,
    ).toBe(401);
    expect([401, 403]).toContain((await ask(w.stopped, to)).status);
    expect(mailsTo(to).length).toBe(0);
    await ask(w.member, to);
    expect((await pending(w.admin)).length).toBe(0);
  });

  it("K835-API-017 二度押し（同じ Idempotency-Key）：2 回とも 201・同じ答え・確かめのメールは 1 通だけ", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    const key = randomUUID();
    const r1 = await ask(w.member, to, { key });
    const r2 = await ask(w.member, to, { key });
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect((await h.json(r2)).data).toEqual((await h.json(r1)).data);
    expect(mailsTo(to).length).toBe(1);
  });

  it("K835-API-018 同時に同じリンクで 2 回確かめる：1 回だけ 201・もう 1 回は 409・E-ME-023・知らせは 1 通", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    await ask(w.member, to);
    const tok = tokenOf(to);
    const [a, b] = await Promise.all([verify(w.member, tok), verify(w.member, tok)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const bad = a.status === 409 ? a : b;
    expect((await h.json(bad)).code).toBe("E-ME-023");
    expect(await loginEmail(w.member)).toBe(to);
    expect(mailsTo(w.member.email).length).toBe(1);
  });

  it("K835-API-019 手順 1（頼みの待ち）の後片付け（手順 3・送れなかった頼みを取り消す）の失敗 [残る]：502・E-ME-025 のまま・ログに [me-email] の行が 1 つ（宛てとリンクは出さない）・その待ちのリンクは誰にも届いていない", async () => {
    await h.ready();
    const w = await h.world();
    const to = fresh();
    h.failMailTo.add(to);
    let logs = "";
    try {
      await h.breakOn("app.member_email_changes", w.tenantId, "update", async () => {
        logs = await h.captureLogs(async () => {
          const r = await ask(w.member, to);
          expect(r.status).toBe(502);
          expect((await h.json(r)).code).toBe("E-ME-025");
        });
      });
    } finally {
      h.failMailTo.delete(to);
    }
    expect(logs.split("\n").filter((l) => l.includes("[me-email]")).length).toBe(1);
    expect(logs).not.toContain(to);
    expect(mailsTo(to).length).toBe(0);
  });
});
