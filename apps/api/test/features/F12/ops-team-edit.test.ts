// K-1009「運営の人のできることを変える・外す」の単体の試験（本物の DB・本物のログインの部品・bootApi・土台 ops-team.harness.ts＝K-985）。
// テストの名前の頭の行 ID（K1009-…）は 11_tickets/K-1009.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
// 最後の 1 人の行は共用の DB でほかの試験の運営の人が数に入るので、印をこの回の人だけが持つ形に一時的に寄せ、finally で戻す（G-10）。
import { describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { MEMBERS, OPS_MEMBER_KEYS, OPS_TENANT, setupTeam } from "./ops-team.harness.js";

const t = setupTeam("k1009");
const { h } = t.o;
const one = (id: string) => `${MEMBERS}/${id}`;

const admin = async (tag: string, caps?: readonly string[]) => {
  const s = await t.signedIn(tag, caps);
  await t.stepUp(s.p.memberId);
  return s;
};
const patch = (token: string, id: string, body: unknown) => t.call(token, "PATCH", one(id), body);
const del = (token: string, id: string) => t.call(token, "DELETE", one(id));
const capsOf = async (memberId: string) =>
  (await t.row<{ caps: string[] }>("select caps from ops_members where member_id = $1", [memberId]))?.caps;
const revokedAt = async (memberId: string) =>
  (await t.row<{ r: Date | null }>("select revoked_at as r from ops_members where member_id = $1", [memberId]))?.r;
const audits = (action: string, memberId: string) =>
  t.n(
    `select count(*)::int as n from ops_audit_events
      where action = $1 and target_id = (select id::text from ops_members where member_id = $2)`,
    [action, memberId],
  );

/** cap を、keep の人だけが持つ形にする（ほかの生きている運営の人から外す）。返す関数で戻す */
const alone = async (cap: string, keep: readonly string[]) => {
  const others = await h.admin.query<{ id: string; caps: string[] }>(
    `select id, caps from ops_members where not (member_id = any($1::uuid[]))
        and revoked_at is null and deleted_at is null and $2 = any(caps)`,
    [keep, cap],
  );
  await h.admin.query("update ops_members set caps = array_remove(caps, $2) where id = any($1::uuid[])", [
    others.rows.map((x) => x.id),
    cap,
  ]);
  return async () => {
    for (const x of others.rows) await h.admin.query("update ops_members set caps = $2 where id = $1", [x.id, x.caps]);
  };
};

describe("K-1009 できることを変える", () => {
  it("K1009-API-001 変える：200・8 欄・caps は送った物（9 つの順）・記録 ops_member.caps の before・after", async () => {
    const me = await admin("cap-me");
    const sano = await t.o.makeOps("cap-sano", { caps: ["inquiry"] });
    const r = await patch(me.token, sano.memberId, { caps: ["notice", "inquiry"] });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await t.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual([...OPS_MEMBER_KEYS]);
    expect(d["caps"]).toEqual(["inquiry", "notice"]);
    expect(await capsOf(sano.memberId)).toEqual(["inquiry", "notice"]);
    const a = await t.row<{ payload: { before: string[]; after: string[] } }>(
      `select payload from ops_audit_events where action = 'ops_member.caps'
          and target_id = (select id::text from ops_members where member_id = $1)`,
      [sano.memberId],
    );
    expect(a?.payload.before).toEqual(["inquiry"]);
    expect(a?.payload.after).toEqual(["inquiry", "notice"]);
  });

  it("K1009-API-002 自分を変える：409・E-OPS-017・欄なし・自分の caps はそのまま", async () => {
    const me = await admin("self-cap");
    const before = await capsOf(me.p.memberId);
    const r = await patch(me.token, me.p.memberId, { caps: ["inquiry"] });
    expect(r.status).toBe(409);
    const j = await t.json(r);
    expect(j["code"]).toBe("E-OPS-017");
    expect(j["field"]).toBeUndefined();
    expect(await capsOf(me.p.memberId)).toEqual(before);
  });

  it("K1009-API-003 最後の 1 人の印を外す：plan_decide を持つのが相手だけなら 409・E-OPS-018・detail.cap plan_decide・caps はそのまま。2 人居れば外せる", async () => {
    const me = await admin("last-cap-me", ["ops_people"]);
    const target = await t.o.makeOps("last-cap-t", { caps: ["plan_decide", "inquiry"] });
    const back = await alone("plan_decide", [target.memberId]);
    try {
      const r = await patch(me.token, target.memberId, { caps: ["inquiry"] });
      expect(r.status).toBe(409);
      const j = await t.json(r);
      expect(j["code"]).toBe("E-OPS-018");
      expect(j["field"]).toBeUndefined();
      expect((j["detail"] as Record<string, unknown>)["cap"]).toBe("plan_decide");
      expect(await capsOf(target.memberId)).toEqual(["plan_decide", "inquiry"]);
      await t.o.makeOps("last-cap-second", { caps: ["plan_decide"] });
      const ok = await patch(me.token, target.memberId, { caps: ["inquiry"] });
      expect(ok.status, await ok.clone().text()).toBe(200);
    } finally {
      await back();
    }
  });

  it("K1009-API-004 同じ：並びだけ違う同じ caps で 200・記録が増えない", async () => {
    const me = await admin("same-me");
    const p = await t.o.makeOps("same-p", { caps: ["inquiry", "money"] });
    const r = await patch(me.token, p.memberId, { caps: ["money", "inquiry"] });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await audits("ops_member.caps", p.memberId)).toBe(0);
  });

  it("K1009-API-013 上限：変えるの上限の次が 429・retry_after_sec は 1〜60 の整数", async () => {
    const me = await admin("rate-me");
    const p = await t.o.makeOps("rate-p", { caps: ["inquiry"] });
    let last: Response | null = null;
    for (let i = 0; i < 70; i += 1) {
      last = await patch(me.token, p.memberId, { caps: ["inquiry"] });
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    const sec = Number((await t.json(last!))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
  });
});

describe("K-1009 外す", () => {
  it("K1009-API-005 外す：200・印が付き・パスキーとリンクが消え・その人の印で運営の口は 401・担当の問い合わせが空・記録", async () => {
    const me = await admin("rm-me");
    const gone = await t.signedIn("rm-gone", ["inquiry"]);
    const tenant = await t.o.company("rm-ws");
    await h.admin.query(
      "insert into ops_setup_links (ops_member_id, token_hash, expires_at) select id, $2, now() + interval '1 day' from ops_members where member_id = $1",
      [gone.p.memberId, randomUUID().replace(/-/g, "").padEnd(64, "0")],
    );
    const inq = await t.row<{ id: string }>(
      `insert into inquiries (tenant_id, assignee_ops_member_id, title, topic_key, state, last_message_at)
       values ($1, $2, 'k1009 担当のある問い合わせ', 'trouble', 'open', now()) returning id`,
      [tenant, gone.p.memberId],
    );
    expect((await t.call(gone.token, "GET", "/api/v1/ops/shell")).status).not.toBe(401);
    const r = await del(me.token, gone.p.memberId);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await t.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["member_id", "released_inquiries", "removed_at"]);
    expect(d["member_id"]).toBe(gone.p.memberId);
    expect(d["released_inquiries"]).toBe(1);
    expect(await revokedAt(gone.p.memberId)).toBeInstanceOf(Date);
    expect(await t.n('select count(*)::int as n from kaname_auth.passkey where "userId" = $1', [gone.p.userId])).toBe(
      0,
    );
    expect(
      await t.n(
        "select count(*)::int as n from ops_setup_links l join ops_members m on m.id = l.ops_member_id where m.member_id = $1 and l.used_at is null",
        [gone.p.memberId],
      ),
    ).toBe(0);
    expect((await t.call(gone.token, "GET", "/api/v1/ops/shell")).status).toBe(401);
    expect(
      (await t.row<{ a: string | null }>("select assignee_ops_member_id as a from inquiries where id = $1", [inq!.id]))
        ?.a,
    ).toBeNull();
    expect(await audits("ops_member.remove", gone.p.memberId)).toBe(1);
    await h.admin.query("delete from inquiries where id = $1", [inq!.id]);
  });

  it("K1009-API-006 自分を外す：409・E-OPS-017・revoked_at が空のまま", async () => {
    const me = await admin("rm-self");
    const r = await del(me.token, me.p.memberId);
    expect(r.status).toBe(409);
    expect((await t.json(r))["code"]).toBe("E-OPS-017");
    expect(await revokedAt(me.p.memberId)).toBeNull();
  });

  it("K1009-API-007 最後の 1 人を外す：plan_decide を持つのが相手だけなら 409・E-OPS-018・detail.cap plan_decide・相手は生きている", async () => {
    const me = await admin("rm-last-me", ["ops_people"]);
    const target = await t.o.makeOps("rm-last-t", { caps: ["plan_decide"] });
    const back = await alone("plan_decide", [target.memberId]);
    try {
      const r = await del(me.token, target.memberId);
      expect(r.status).toBe(409);
      const j = await t.json(r);
      expect(j["code"]).toBe("E-OPS-018");
      expect((j["detail"] as Record<string, unknown>)["cap"]).toBe("plan_decide");
      expect(await revokedAt(target.memberId)).toBeNull();
    } finally {
      await back();
    }
  });

  it("K1009-API-008 無い・外した：外した人・顧客の会社の人・無い uuid は変えるも外すも 404・欄なし", async () => {
    const me = await admin("nf-me");
    const gone = await t.o.makeOps("nf-gone");
    await t.revoke(gone.memberId);
    const cust = await h.makeUser("nf-cust");
    for (const id of [gone.memberId, cust.memberId, randomUUID()]) {
      const a = await patch(me.token, id, { caps: ["inquiry"] });
      expect(a.status, id).toBe(404);
      expect((await t.json(a))["field"]).toBeUndefined();
      expect((await del(me.token, id)).status, id).toBe(404);
    }
  });

  it("K1009-API-009 入口：ログインなし 401・ops_people を持たない 403・取り直していない 403 STEP_UP_REQUIRED・相手は変わらない", async () => {
    const p = await t.o.makeOps("entry-p", { caps: ["inquiry"] });
    expect((await patch("", p.memberId, { caps: ["money"] })).status).toBe(401);
    const weak = await admin("entry-weak", ["inquiry"]);
    expect((await patch(weak.token, p.memberId, { caps: ["money"] })).status).toBe(403);
    expect((await del(weak.token, p.memberId)).status).toBe(403);
    const noStep = await t.signedIn("entry-nostep");
    const r = await del(noStep.token, p.memberId);
    expect(r.status).toBe(403);
    expect((await t.json(r))["code"]).toBe("STEP_UP_REQUIRED");
    expect(await capsOf(p.memberId)).toEqual(["inquiry"]);
    expect(await revokedAt(p.memberId)).toBeNull();
  });

  it("K1009-API-010 形の誤り：caps の空・知らない字・重なり・余計な欄・:id が uuid でないは 422・相手は変わらない", async () => {
    const me = await admin("bad-me");
    const p = await t.o.makeOps("bad-p", { caps: ["inquiry"] });
    for (const b of [
      { caps: [] },
      { caps: ["owner"] },
      { caps: ["money", "money"] },
      { caps: ["money"], email: "x@example.com" },
      {},
    ]) {
      expect((await patch(me.token, p.memberId, b)).status, JSON.stringify(b)).toBe(422);
    }
    expect((await patch(me.token, "not-a-uuid", { caps: ["money"] })).status).toBe(422);
    expect((await del(me.token, "not-a-uuid")).status).toBe(422);
    expect(await capsOf(p.memberId)).toEqual(["inquiry"]);
  });

  it("K1009-API-011 同時に外す：plan_decide を持つ 2 人を同時に外すと 200 と 409 E-OPS-018 が 1 つずつ・1 人残る", async () => {
    const me = await admin("race-me", ["ops_people"]);
    const a = await t.o.makeOps("race-a", { caps: ["plan_decide"] });
    const b = await t.o.makeOps("race-b", { caps: ["plan_decide"] });
    const back = await alone("plan_decide", [a.memberId, b.memberId]);
    try {
      const rs = await Promise.all([del(me.token, a.memberId), del(me.token, b.memberId)]);
      expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
      const live = await t.n(
        "select count(*)::int as n from ops_members where member_id = any($1::uuid[]) and revoked_at is null",
        [[a.memberId, b.memberId]],
      );
      expect(live).toBe(1);
    } finally {
      await back();
    }
  });

  it("K1009-API-012 書けない：ops_members への書き込みを落とすと外すは 503・E-PAGE-003・revoked_at が空・パスキーが残る", async () => {
    const me = await admin("break-me");
    const p = await t.signedIn("break-p", ["inquiry"]);
    const fix = await t.breakWrites("ops_members", { member_id: p.p.memberId });
    try {
      const r = await del(me.token, p.p.memberId);
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect(await revokedAt(p.p.memberId)).toBeNull();
    expect(await t.n('select count(*)::int as n from kaname_auth.passkey where "userId" = $1', [p.p.userId])).toBe(1);
  });

  it("K1009-DB-001 2 層目：会社の人の文脈で app.ops_member_remove を直に呼ぶと 42501・PUBLIC は app.ops_member_caps を呼べない", async () => {
    const p = await t.o.makeOps("db-p", { caps: ["inquiry"] });
    const app = new pg.Client({
      connectionString: process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
    });
    await app.connect();
    try {
      await app.query("begin");
      await app.query("select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true)", [
        OPS_TENANT,
      ]);
      await expect(app.query("select app.ops_member_remove($1)", [p.memberId])).rejects.toMatchObject({
        code: "42501",
      });
      await app.query("rollback");
    } finally {
      await app.end();
    }
    const pub = await t.row<{ ok: boolean }>(
      "select has_function_privilege('public', 'app.ops_member_caps(uuid, text[])', 'execute') as ok",
    );
    expect(pub?.ok).toBe(false);
    expect(await revokedAt(p.memberId)).toBeNull();
  });
});
