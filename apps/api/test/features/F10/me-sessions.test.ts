// K-836「入っている端末」の口の試験（本物の DB・偽の画面のログイン・認証の部品は getSession と期限を今にする所だけの偽。土台 me.harness.ts）。
//   行 ID（K836-API-…）は 11_tickets/K-836.md の表と 1 対 1。
//   listMySessions         GET    /me/sessions            → 200 { data: { sessions: [{ id, kind, name, place, issued_at, last_seen_at, current }], events: [{ id, kind, occurred_at, device, place }] } }
//   revokeMySession        DELETE /me/sessions/:id        →（本人確認が要る） 200 { data: { revoked: true } }（その端末の行を切る。PC は PC の接続ごと）
//   revokeOtherSessions    POST   /me/sessions/revoke-others → 201 { data: { revoked: <切った端末の数> } }
//   端末の 1 行 ＝ sessions の 1 行。1 つの部品のセッションは 1 つの会社にだけ結ぶ（auth_session_id は一意・0004。切り替えは K-851 が行の会社を替える）。
//   ログイン（同じ auth_user_id の全部のワークスペース）の端末を並べる。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupMe, type MeWorld, type P } from "./me.harness.js";

const h = setupMe("me-sessions.ts");
/** 端末の 1 行・安全の記録の 1 行（試験で読む欄だけ型にする） */
type Sess = Record<string, unknown> & { id: unknown; name: unknown; current: unknown; kind: unknown; place: unknown };
type SecEv = Record<string, unknown> & { kind: unknown; device: unknown; place: unknown; occurred_at: string };
const list = (p: P, sid?: string) => h.call(p, "GET", "/me/sessions", sid ? { sid } : {});
const drop = (p: P, id: string, sid?: string, key?: string) =>
  h.call(p, "DELETE", `/me/sessions/${id}`, { su: h.suNow(), ...(sid ? { sid } : {}), ...(key ? { key } : {}) });
const others = (p: P, sid: string, key?: string) =>
  h.call(p, "POST", "/me/sessions/revoke-others", { body: {}, sid, su: h.suNow(), ...(key ? { key } : {}) });
const alive = async (auth: string) =>
  (await h.f.admin.query("select * from app.session_alive($1)", [auth])).rows.length;
const reason = async (id: string) =>
  await h.one<{ r: string | null; at: Date | null }>(
    "select revoke_reason_id as r, revoked_at as at from sessions where id = $1",
    [id],
  );
const job = async (w: MeWorld, who: P, state: string, session?: string) =>
  (
    await h.one<{ id: string }>(
      "insert into bridge_jobs (tenant_id, member_id, state_id, prompt, taken_session_id) values ($1, $2, $3, 'テスト', $4) returning id",
      [who.tenantId, who.id, state, session ?? null],
    )
  ).id;
const jobState = async (id: string) =>
  h.one<{ s: string; why: string | null }>(
    "select state_id as s, stopped_reason as why from bridge_jobs where id = $1",
    [id],
  );
/** 同じログインを別の会社にも入れ、今の会社の端末（部品のセッション auth）と、別の会社に結んだ端末を 1 つずつ持たせる
 *  （1 つの部品のセッションは 1 つの会社にだけ結ぶ。auth_session_id は一意で、同じ auth の行を 2 つの会社に入れない・K-851 と同じ前提） */
async function twoCompanies(w: MeWorld, auth: string) {
  const co = await h.f.company(`別の会社-${randomUUID().slice(0, 4)}`, "ZZ");
  const there = await h.f.alsoIn(w.member, co.tenantId, co.rootScope);
  const here = await h.session(w.member, { auth, label: "MacBook・Chrome" });
  const that = await h.session(there, { label: "iPad・Safari" });
  return { co, there, here, that };
}

describe("K-836 入っている端末（listMySessions・revokeMySession・revokeOtherSessions）", () => {
  it("K836-API-001 一覧：生きている端末だけ・鍵は id・kind・name・place・issued_at・last_seen_at・current・今の端末（sid）に current true で先頭・あとは最後に使った順・切った端末と別の人の端末は出ない", async () => {
    await h.ready();
    const w = await h.world();
    const a = await h.session(w.member, { label: "MacBook・Chrome", seenMinutesAgo: 1 });
    const b = await h.session(w.member, { label: "iPhone・アプリ", seenMinutesAgo: 120, region: "JP" });
    const pc = await h.session(w.member, { kind: "bridge", label: "会社の PC", seenMinutesAgo: 30 });
    await h.session(w.member, { label: "切った端末", revoked: true });
    await h.session(w.admin, { label: "ほかの人の端末" });
    const r = await list(w.member, b.auth);
    expect(r.status, await r.clone().text()).toBe(200);
    const s = (await h.json(r)).data!["sessions"] as [Sess, ...Sess[]];
    expect(s.map((x) => x.name)).toEqual(["iPhone・アプリ", "MacBook・Chrome", "会社の PC"]);
    expect(Object.keys(s[0]).sort()).toEqual(["current", "id", "issued_at", "kind", "last_seen_at", "name", "place"]);
    expect(s.map((x) => x.current)).toEqual([true, false, false]);
    expect(s.map((x) => x.kind)).toEqual(["web", "web", "bridge"]);
    expect(s.find((x) => x.name === "iPhone・アプリ")!.place).toBe("JP");
    void a;
    void pc;
  });

  it("K836-API-002 端末は同じログインの全部のワークスペースから並べる（1 つの部品のセッション＝1 行・1 つの会社に結ぶ）・今いない会社に結んだ端末も出る・今の端末だけ current true・sid が無ければ current はどれも false", async () => {
    await h.ready();
    const w = await h.world();
    const auth = `me-${randomUUID()}`;
    const { here, that } = await twoCompanies(w, auth);
    await h.session(w.member, { label: "別のブラウザ" });
    const s = (await h.json(await list(w.member, auth))).data!["sessions"] as [Sess, ...Sess[]];
    expect(s.length).toBe(3);
    expect(s.map((x) => x.name).sort()).toEqual(["MacBook・Chrome", "iPad・Safari", "別のブラウザ"].sort());
    expect(s.map((x) => x.id)).toEqual(expect.arrayContaining([here.id, that.id]));
    expect(s.filter((x) => x.current).map((x) => x.id)).toEqual([here.id]);
    const none = (await h.json(await list(w.member))).data!["sessions"] as [Sess, ...Sess[]];
    expect(none.every((x) => x.current === false)).toBe(true);
  });

  it("K836-API-003 切る（画面の端末・今いない会社に結んだ端末も）：200・revoked true・その端末の行が失効（理由 self_revoked）・セッションは使えなくなる・認証の側の期限も今にする・安全の記録が残る・ほかの端末は生きている・一覧から消える", async () => {
    await h.ready();
    const w = await h.world();
    const auth = `me-${randomUUID()}`;
    const { here, that, there } = await twoCompanies(w, auth);
    const cur = await h.session(w.member, { label: "今の端末", seenMinutesAgo: 0 });
    const evs = "select count(*) as n from security_events where member_id = any($1::uuid[])";
    const before = await h.num(evs, [[w.member.id, there.id]]);
    const r = await drop(w.member, that.id, cur.auth);
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.json(r)).data).toEqual({ revoked: true });
    expect((await reason(that.id)).r).toBe("self_revoked");
    expect((await reason(here.id)).at).toBeNull();
    expect(await alive(that.auth)).toBe(0);
    expect(await alive(auth)).toBe(1);
    expect(await alive(cur.auth)).toBe(1);
    expect(h.authExpired).toContain(that.auth);
    expect(h.authExpired).not.toContain(auth);
    expect(await h.num(evs, [[w.member.id, there.id]])).toBeGreaterThan(before);
    const s = (await h.json(await list(w.member, cur.auth))).data!["sessions"] as [Sess, ...Sess[]];
    expect(s.map((x) => x.name)).toEqual(["今の端末", "MacBook・Chrome"]);
  });

  it("K836-API-004 切る（PC）：PC の行が失効（理由 device_removed）・その PC が受け取って動いている仕事（running・asking）は stopped で理由つき・待っている仕事とほかの PC の仕事は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const pc = await h.session(w.member, { kind: "bridge", label: "会社の PC" });
    const pc2 = await h.session(w.member, { kind: "bridge", label: "家の PC" });
    const running = await job(w, w.member, "running", pc.id);
    const queued = await job(w, w.member, "queued");
    const other = await job(w, w.member, "running", pc2.id);
    const r = await drop(w.member, pc.id, cur.auth);
    expect(r.status).toBe(200);
    expect((await reason(pc.id)).r).toBe("device_removed");
    expect(await alive(pc.auth)).toBe(0);
    expect((await jobState(running)).s).toBe("stopped");
    expect((await jobState(running)).why).toBeTruthy();
    expect((await jobState(queued)).s).toBe("queued");
    expect((await jobState(other)).s).toBe("running");
    expect(await alive(pc2.auth)).toBe(1);
  });

  it("K836-API-005 今の端末は切れない：409・E-ME-030（ログアウトを使ってください）・セッションは生きたまま", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const r = await drop(w.member, cur.id, cur.auth);
    expect(r.status).toBe(409);
    expect((await h.json(r)).code).toBe("E-ME-030");
    expect((await h.json(r)).details).toBeUndefined();
    expect(await alive(cur.auth)).toBe(1);
  });

  it("K836-API-006 見つからない：無い id・切ってある端末・ほかの人の端末・別の会社の人の端末は 404（欄・details なし）で、どれも触らない・id が uuid でなければ 422", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const dead = await h.session(w.member, { revoked: true });
    const theirs = await h.session(w.admin);
    const out = await h.session(w.outsider);
    for (const id of [randomUUID(), dead.id, theirs.id, out.id]) {
      const r = await drop(w.member, id, cur.auth);
      expect(r.status, id).toBe(404);
      const b = await h.json(r);
      expect(b.field).toBeUndefined();
      expect(b.details).toBeUndefined();
    }
    expect(await alive(theirs.auth)).toBe(1);
    expect(await alive(out.auth)).toBe(1);
    expect((await drop(w.member, "not-a-uuid", cur.auth)).status).toBe(422);
  });

  it("K836-API-007 この端末以外をすべて切る：201・revoked は切った端末の数（画面・API は 1 つの部品のセッションで 1・別の会社に結んだ端末も 1・PC も 1 台ずつ）・今の端末は生きたまま・ほかの人の端末は変わらない・PC の動いている仕事を止める・認証の側は今の端末のほかを今にする・安全の記録（sessions_revoked）が増える", async () => {
    await h.ready();
    const w = await h.world();
    const auth = `me-${randomUUID()}`;
    const { here, that, there } = await twoCompanies(w, auth);
    const cur = await h.session(w.member, { label: "今の端末" });
    const pc = await h.session(w.member, { kind: "bridge", label: "会社の PC" });
    const running = await job(w, w.member, "running", pc.id);
    const mate = await h.session(w.admin);
    const evs = "select count(*) as n from security_events where member_id = any($1::uuid[])";
    const evBefore = await h.num(evs, [[w.member.id, there.id]]);
    const r = await others(w.member, cur.auth);
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await h.json(r)).data).toEqual({ revoked: 3 });
    expect(await h.num(evs, [[w.member.id, there.id]])).toBeGreaterThan(evBefore);
    expect(await alive(cur.auth)).toBe(1);
    for (const a of [auth, that.auth, pc.auth]) expect(await alive(a), a).toBe(0);
    for (const id of [here.id, that.id]) expect((await reason(id)).r).toBe("self_revoked");
    expect((await jobState(running)).s).toBe("stopped");
    expect(await alive(mate.auth)).toBe(1);
    expect(h.authExpired).toEqual(expect.arrayContaining([auth, that.auth]));
    expect(h.authExpired).not.toContain(cur.auth);
  });

  it("K836-API-008 ほかの端末が無いとき：201・revoked 0・何も変わらない・安全の記録は増えない", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const n = await h.num("select count(*) as n from security_events where member_id = $1", [w.member.id]);
    const r = await others(w.member, cur.auth);
    expect(r.status).toBe(201);
    expect((await h.json(r)).data).toEqual({ revoked: 0 });
    expect(await alive(cur.auth)).toBe(1);
    expect(await h.num("select count(*) as n from security_events where member_id = $1", [w.member.id])).toBe(n);
  });

  it("K836-API-009 手順 2（認証の側の期限を今にする後片付け）の失敗 [残る]：200 のまま・Kaname のセッションは切れている・ログに [me-sessions] の行が 1 つ（部品の印を出さない）", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const x = await h.session(w.member, { label: "切る端末" });
    h.authFlags.failCleanup = true;
    let logs: string;
    try {
      logs = await h.captureLogs(async () => {
        expect((await drop(w.member, x.id, cur.auth)).status).toBe(200);
      });
    } finally {
      h.authFlags.failCleanup = false;
    }
    expect(await alive(x.auth)).toBe(0);
    expect(logs.split("\n").filter((l) => l.includes("[me-sessions]")).length).toBe(1);
    expect(logs).not.toContain(x.auth);
  });

  it("K836-API-010 手順 1（DB に書く）の失敗：切る口・全部切る口・一覧の口とも 503・E-PAGE-003・どの端末も切れない・認証の側の期限も触らない", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const x = await h.session(w.member, { label: "切る端末" });
    const n = h.authExpired.length;
    await h.captureLogs(async () => {
      await h.breakPool(["revokeMySession", "revokeOtherSessions", "listMySessions"], async () => {
        for (const r of [
          await drop(w.member, x.id, cur.auth),
          await others(w.member, cur.auth),
          await list(w.member, cur.auth),
        ]) {
          expect(r.status).toBe(503);
          expect((await h.json(r)).code).toBe("E-PAGE-003");
        }
      });
    });
    expect(await alive(x.auth)).toBe(1);
    expect(h.authExpired.length).toBe(n);
  });

  it("K836-API-011 守り：ログインなし 401・止めた人は 401／403・他人の端末は一覧に出ず切れない・別の会社の人の一覧に出ない", async () => {
    await h.ready();
    const w = await h.world();
    const mine = await h.session(w.member);
    await h.session(w.outsider, { label: "外の人の端末" });
    expect((await h.call(w.member, "GET", "/me/sessions", { headers: { authorization: "" } })).status).toBe(401);
    expect(
      (
        await h.call(w.member, "POST", "/me/sessions/revoke-others", {
          body: {},
          su: h.suNow(),
          headers: { authorization: "" },
        })
      ).status,
    ).toBe(401);
    expect([401, 403]).toContain((await list(w.stopped)).status);
    const s = (await h.json(await list(w.member, mine.auth))).data!["sessions"] as [Sess, ...Sess[]];
    expect(s.every((x) => x.name !== "外の人の端末")).toBe(true);
  });

  it("K836-API-012 二度押し：切るを同じ Idempotency-Key で 2 回は 1 回目 200・2 回目 404（欄・details なし。切る口は DELETE で、同じ key の答えの使い回しは効かない）・安全の記録と認証の側の期限は 1 回だけ／全部切るを同じ key で 2 回は 201・同じ答え", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const x = await h.session(w.member);
    const evs = "select count(*) as n from security_events where member_id = $1";
    const before = await h.num(evs, [w.member.id]);
    const key = randomUUID();
    const r1 = await drop(w.member, x.id, cur.auth, key);
    const after1 = await h.num(evs, [w.member.id]);
    const r2 = await drop(w.member, x.id, cur.auth, key);
    expect([r1.status, r2.status]).toEqual([200, 404]);
    const j2 = await h.json(r2);
    expect(j2.field).toBeUndefined();
    expect(j2.details).toBeUndefined();
    expect(after1).toBeGreaterThan(before);
    expect(await h.num(evs, [w.member.id])).toBe(after1);
    expect(h.authExpired.filter((a) => a === x.auth).length).toBe(1);
    await h.session(w.member);
    const k2 = randomUUID();
    const a = await others(w.member, cur.auth, k2);
    const b = await others(w.member, cur.auth, k2);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect((await h.json(b)).data).toEqual((await h.json(a)).data);
  });

  it("K836-API-013 同時に同じ端末を切る：1 回は 200・もう 1 回は 404・端末は切れている／切るのと全部切るを同時にしても落ちずどちらも終わる", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const x = await h.session(w.member);
    const [a, b] = await Promise.all([drop(w.member, x.id, cur.auth), drop(w.member, x.id, cur.auth)]);
    expect([a.status, b.status].sort()).toEqual([200, 404]);
    const y = await h.session(w.member);
    const [c, d] = await Promise.all([drop(w.member, y.id, cur.auth), others(w.member, cur.auth)]);
    expect([200, 404]).toContain(c.status);
    expect(d.status).toBe(201);
    expect(await alive(y.auth)).toBe(0);
    expect(await alive(cur.auth)).toBe(1);
  });

  it("K836-API-014 本人確認：切る・全部切るとも、取り直しが無い・15 分より前は 403・STEP_UP_REQUIRED で何も切れず、取り直した後（14 分前）は 200／201・一覧は取り直し無しで読める", async () => {
    await h.ready();
    const w = await h.world();
    const cur = await h.session(w.member);
    const x = await h.session(w.member);
    for (const su of [undefined, h.suAgo(16)]) {
      const extra = su ? { su } : {};
      const a = await h.call(w.member, "DELETE", `/me/sessions/${x.id}`, { sid: cur.auth, ...extra });
      const b = await h.call(w.member, "POST", "/me/sessions/revoke-others", { body: {}, sid: cur.auth, ...extra });
      for (const r of [a, b]) {
        expect(r.status).toBe(403);
        expect((await h.json(r)).code).toBe("STEP_UP_REQUIRED");
      }
    }
    expect(await alive(x.auth)).toBe(1);
    expect((await list(w.member, cur.auth)).status).toBe(200);
    const ok = await h.call(w.member, "DELETE", `/me/sessions/${x.id}`, { sid: cur.auth, su: h.suAgo(14) });
    expect(ok.status).toBe(200);
    expect(await alive(x.auth)).toBe(0);
    const y = await h.session(w.member);
    expect(
      (await h.call(w.member, "POST", "/me/sessions/revoke-others", { body: {}, sid: cur.auth, su: h.suAgo(14) }))
        .status,
    ).toBe(201);
    expect(await alive(y.auth)).toBe(0);
  });

  it("K836-API-015 最近の安全の記録：答えの events は同じログインの全部のワークスペースの security_events の新しい順 10 件・鍵は id・kind・occurred_at・device・place だけ・消した行と別の人の行は出ない（D-154.79）", async () => {
    await h.ready();
    const w = await h.world();
    const auth = `me-${randomUUID()}`;
    const { co, there } = await twoCompanies(w, auth);
    const ev = async (
      tenant: string,
      who: string,
      kind: string,
      minutesAgo: number,
      o: { deleted?: boolean; device?: string } = {},
    ) =>
      h.f.admin.query(
        "insert into security_events (tenant_id, kind_id, member_id, ip_region, detail, occurred_at, deleted_at) values ($1, $2, $3, 'JP', $4, now() - make_interval(mins => $5), $6)",
        [
          tenant,
          kind,
          who,
          JSON.stringify(o.device ? { device: o.device } : {}),
          minutesAgo,
          o.deleted ? new Date() : null,
        ],
      );
    for (let i = 0; i < 11; i += 1) await ev(w.tenantId, w.member.id, "step_up", 10 + i);
    await ev(co.tenantId, there.id, "suspicious_connection", 1, { device: "Windows・Edge" });
    await ev(w.tenantId, w.member.id, "password_changed", 2, { deleted: true });
    await ev(w.tenantId, w.admin.id, "passkey_added", 3);
    const r = await list(w.member, auth);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["events", "sessions"]);
    const e = d["events"] as [SecEv, ...SecEv[]];
    expect(e.length).toBe(10);
    expect(Object.keys(e[0]).sort()).toEqual(["device", "id", "kind", "occurred_at", "place"]);
    expect(e[0].kind).toBe("suspicious_connection");
    expect(e[0].device).toBe("Windows・Edge");
    expect(e[0].place).toBe("JP");
    expect(e.slice(1).every((x) => x.kind === "step_up" && x.device === null)).toBe(true);
    const times = e.map((x) => Date.parse(x.occurred_at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(e.some((x) => x.kind === "password_changed" || x.kind === "passkey_added")).toBe(false);
  });
});
