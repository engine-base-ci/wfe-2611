// K-365「もう一度確かめる仕事をその PC に宛てる口（checkMyDeviceBrowser）」の単体の試験（口・本物の DB・本物の PC の印の解決）。
//   名前の頭の行 ID（K365-API-…）は 11_tickets/K-365.md の表に 1 対 1 で結ぶ。
//   宛先の列 bridge_jobs.target_session_id と、受け取る関数 app.bridge_take_job の「宛先が無いか自分宛て」の条件を見る。
//   眠っている PC のエラーの番号は取り込む時点で決まるので、番号でなく目録の where.state（browser_check_asleep）で引く。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { CATALOG } from "@kaname/errors";
import { BROWSER_CHECK_PROMPT } from "../../../src/auth/conventions.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";
import { leafHooks } from "./leaf-hooks.js";

let f: Fixture;
let T1: { tenantId: string; rootScope: string };
let T2: { tenantId: string; rootScope: string };

const json = async (r: Response) => (await r.json()) as Record<string, unknown> & { data?: Record<string, unknown> };
const connect = async (p: Person, label = "高本の MacBook") => {
  const c = await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: p.auth });
  expect(c.status, await c.clone().text()).toBe(201);
  const code = ((await json(c)).data as { code: string }).code;
  const r = await f.req("POST", "/bridge/claim", { body: { code, device_label: label }, ip: nextIp() });
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as { device_token: string; device_id: string };
};
const dev = (token: string) => ({ "x-bridge-session": token });
/** 生きている PC にする（最初の知らせ） */
const live = async (p: Person, label?: string) => {
  const d = await connect(p, label);
  const b = await f.req("POST", "/bridge/heartbeat", {
    body: { health: [], protocol: 5, version: "1.4.0" },
    headers: dev(d.device_token),
  });
  expect(b.status, await b.clone().text()).toBe(201);
  return d;
};
const check = (headers: Record<string, string>, id: string, body: unknown = {}) =>
  f.req("POST", `/bridge/devices/${id}/browser-check`, { body, headers });
const jobsFor = async (sessionId: string) =>
  (
    await f.admin.query<Record<string, unknown>>(
      "select * from bridge_jobs where target_session_id = $1 order by created_at",
      [sessionId],
    )
  ).rows;
const jobCount = async (memberId: string) =>
  Number(
    (await f.admin.query<{ n: string }>("select count(*) as n from bridge_jobs where member_id = $1", [memberId]))
      .rows[0]!.n,
  );
const take = async (token: string) => {
  const r = await f.req("POST", "/bridge/jobs/take", {
    body: { protocol: 99, idle: false, wait_sec: 0 },
    headers: dev(token),
  });
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  const job = ((await json(r)).data as unknown as { job?: Record<string, unknown> | null } | null)?.job ?? null;
  return job ? String(job["job_id"] ?? job["id"]) : null;
};
const asleepCode = () => {
  const e = Object.values(CATALOG).find((x) => (x.where as { state?: string }).state === "browser_check_asleep");
  expect(e, "目録に where.state が browser_check_asleep のエラーが無い（errors.d/K-365.json）").toBeTruthy();
  return e!;
};
const newPerson = (o: Parameters<Fixture["person"]>[2] = {}) => f.person(T1.tenantId, T1.rootScope, o);

beforeAll(async () => {
  f = await makeFixture();
  leafHooks(f, ["device-browser-check"]); // 葉の hooks のファイル（K-326 の register）を最初の要求で足す
  T1 = await f.company("K365 の会社 1");
  T2 = await f.company("K365 の会社 2");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-365 もう一度確かめる：状態 × 入口 × 利用者の状態（口・本物の DB）", () => {
  it("K365-API-001 生きている PC で押す：201・答えは job_id だけ。その PC に宛てた chrome の仕事が 1 つ（会話なし・決まった文）", async () => {
    const p = await newPerson();
    const d = await live(p);
    const r = await check(p.auth, d.device_id);
    expect(r.status, await r.clone().text()).toBe(201);
    const data = (await json(r)).data!;
    expect(Object.keys(data)).toEqual(["job_id"]);
    const jobs = await jobsFor(d.device_id);
    expect(jobs).toHaveLength(1);
    const j = jobs[0]!;
    expect(j["id"]).toBe(data["job_id"]);
    expect(j["state_id"]).toBe("queued");
    expect(j["browser"]).toBe("chrome");
    expect(j["conversation_id"]).toBeNull();
    expect(j["member_id"]).toBe(p.id);
    expect(j["prompt"]).toBe(BROWSER_CHECK_PROMPT);
  });

  it("K365-API-002 確かめの仕事が queued のときと running のときにもう一度：同じ job_id・仕事は 1 つのまま", async () => {
    const p = await newPerson();
    const d = await live(p);
    const first = (await json(await check(p.auth, d.device_id))).data!["job_id"];
    const again = await check(p.auth, d.device_id);
    expect(again.status).toBe(201);
    expect((await json(again)).data!["job_id"]).toBe(first);
    await f.admin.query("update bridge_jobs set state_id = 'running' where id = $1", [first]);
    const third = await check(p.auth, d.device_id);
    expect(third.status).toBe(201);
    expect((await json(third)).data!["job_id"]).toBe(first);
    expect(await jobsFor(d.device_id)).toHaveLength(1);
  });

  it("K365-API-003 前の確かめが done の後に押す：201 で新しい job_id。queued の仕事が 1 つ増える", async () => {
    const p = await newPerson();
    const d = await live(p);
    const first = (await json(await check(p.auth, d.device_id))).data!["job_id"];
    await f.admin.query("update bridge_jobs set state_id = 'done', finished_at = now() where id = $1", [first]);
    const r = await check(p.auth, d.device_id);
    expect(r.status).toBe(201);
    const next = (await json(r)).data!["job_id"];
    expect(next).not.toBe(first);
    const jobs = await jobsFor(d.device_id);
    expect(jobs.map((x) => x["state_id"])).toEqual(["done", "queued"]);
  });

  it("K365-API-004 眠っている PC（最後の知らせが 5 分前）：409・目録の browser_check_asleep の code と文。仕事は増えない", async () => {
    const p = await newPerson();
    const d = await live(p);
    await f.admin.query("update sessions set last_seen_at = now() - interval '5 minutes' where id = $1", [d.device_id]);
    const e = asleepCode();
    const r = await check(p.auth, d.device_id);
    expect(r.status, await r.clone().text()).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe(e.id);
    expect(j["message"]).toBe(e.message);
    expect(await jobCount(p.id)).toBe(0);
  });

  it("K365-API-005 つないだが返事がまだ（最初の知らせが来ていない）：409・同じ code。仕事は増えない", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const r = await check(p.auth, d.device_id);
    expect(r.status, await r.clone().text()).toBe(409);
    expect((await json(r))["code"]).toBe(asleepCode().id);
    expect(await jobCount(p.id)).toBe(0);
  });

  it("K365-API-006 PC 2 台：A で押した仕事は B の取る口では渡らず、A の取る口で渡る（受け取った PC は A）", async () => {
    const p = await newPerson();
    const a = await live(p, "PC A");
    const b = await live(p, "PC B");
    const job = String((await json(await check(p.auth, a.device_id))).data!["job_id"]);
    expect(await take(b.device_token)).toBeNull();
    expect(await take(a.device_token)).toBe(job);
    const t = (await f.admin.query<{ s: string }>("select taken_session_id as s from bridge_jobs where id = $1", [job]))
      .rows[0]!.s;
    expect(t).toBe(a.device_id);
  });

  it("K365-API-007 宛先の無い仕事が待っていて B が取りに来る：今までどおり B に渡る", async () => {
    const p = await newPerson();
    await live(p, "PC A");
    const b = await live(p, "PC B");
    const job = (
      await f.admin.query<{ id: string }>(
        `insert into bridge_jobs (tenant_id, member_id, state_id, prompt, created_by)
         values ($1, $2, 'queued', '宛先の無い仕事', $2) returning id`,
        [p.tenantId, p.id],
      )
    ).rows[0]!.id;
    expect(await take(b.device_token)).toBe(job);
  });

  it("K365-API-008 会社 1 でつないだ PC を、同じログインの会社 2 の画面から押す：201。仕事は会社 1 のその人のもの・宛先はその PC", async () => {
    const p = await newPerson({ authUserId: `k365-au-${randomUUID()}` });
    const d = await live(p);
    const there = await f.alsoIn(p, T2.tenantId, T2.rootScope);
    const r = await check(there.auth, d.device_id);
    expect(r.status, await r.clone().text()).toBe(201);
    const j = (await jobsFor(d.device_id))[0]!;
    expect(j["tenant_id"]).toBe(T1.tenantId);
    expect(j["member_id"]).toBe(p.id);
    expect(j["target_session_id"]).toBe(d.device_id);
  });

  it("K365-API-009 他の人の PC（同じ会社・別の会社）・外した PC・無い uuid：どれも 404・NOT_FOUND。仕事は増えない", async () => {
    const p = await newPerson();
    const near = await newPerson();
    const far = await f.person(T2.tenantId, T2.rootScope);
    const dn = await live(near);
    const df = await live(far);
    const gone = await live(p, "外した PC");
    await f.admin.query("update sessions set revoked_at = now() where id = $1", [gone.device_id]);
    for (const id of [dn.device_id, df.device_id, gone.device_id, randomUUID()]) {
      const r = await check(p.auth, id);
      expect(r.status, `${id}: ${await r.clone().text()}`).toBe(404);
      expect((await json(r))["code"]).toBe("NOT_FOUND");
    }
    expect(await jobCount(p.id)).toBe(0);
    expect(await jobCount(near.id)).toBe(0);
    expect(await jobCount(far.id)).toBe(0);
  });

  it("K365-API-010 守り：ログインしていない 401／取引先・運営 403／PC の印 403／同意し直しが要る 403・E-AUTH-010。仕事は増えない", async () => {
    const p = await newPerson();
    const d = await live(p);
    expect((await check({}, d.device_id)).status).toBe(401);
    for (const role of ["client", "ops"] as const) {
      expect((await check(f.as(p, role), d.device_id)).status, role).toBe(403);
    }
    expect((await check(dev(d.device_token), d.device_id)).status).toBe(403);
    const pending = await check(f.pending(p), d.device_id);
    expect(pending.status).toBe(403);
    expect((await json(pending))["code"]).toBe("E-AUTH-010");
    expect(await jobCount(p.id)).toBe(0);
  });
});

describe("K-365 入力・操作の揺れ・守り・失敗", () => {
  it("K365-API-011 体：{} は 201・prompt つきは 422（仕事は増えない）・:id が uuid でないは 422", async () => {
    const p = await newPerson();
    const d = await live(p);
    const bad = await check(p.auth, d.device_id, { prompt: "ほかの文" });
    expect(bad.status, await bad.clone().text()).toBe(422);
    expect(await jobCount(p.id)).toBe(0);
    expect((await check(p.auth, "abc")).status).toBe(422);
    expect((await check(p.auth, d.device_id, {})).status).toBe(201);
  });

  it("K365-API-012 同じ人が 1 分に 11 回目（押し重ねも数える）：429・retry_after_sec は 1〜60 の整数", async () => {
    const p = await newPerson();
    const d = await live(p);
    for (let i = 0; i < 10; i += 1) {
      const r = await check(p.auth, d.device_id);
      expect(r.status, `${i + 1} 回目`).toBe(201);
    }
    const r = await check(p.auth, d.device_id);
    expect(r.status).toBe(429);
    const sec = (await json(r))["retry_after_sec"];
    expect(Number.isInteger(sec)).toBe(true);
    expect(sec as number).toBeGreaterThanOrEqual(1);
    expect(sec as number).toBeLessThanOrEqual(60);
  });

  it("K365-API-013 S1 の失敗：kaname_app から DB の関数の実行権を外して押す：503・E-PAGE-003。仕事は増えない", async () => {
    const p = await newPerson();
    const d = await live(p);
    try {
      await f.admin.query("revoke execute on function app.device_browser_check(uuid, uuid, text) from kaname_app");
      const r = await check(p.auth, d.device_id);
      expect(r.status, await r.clone().text()).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("grant execute on function app.device_browser_check(uuid, uuid, text) to kaname_app");
    }
    expect(await jobCount(p.id)).toBe(0);
  });

  it("K365-API-014 A が確かめの仕事を受け取り done で返す：会話の発言も会話も増えない", async () => {
    const p = await newPerson();
    const a = await live(p);
    const count = async () =>
      (
        await f.admin.query<{ m: string; c: string }>(
          `select (select count(*) from messages m join conversations c on c.id = m.conversation_id where c.owner_member_id = $1) as m,
                  (select count(*) from conversations where owner_member_id = $1) as c`,
          [p.id],
        )
      ).rows[0]!;
    const before = await count();
    const job = String((await json(await check(p.auth, a.device_id))).data!["job_id"]);
    expect(await take(a.device_token)).toBe(job);
    const fin = await f.req("POST", `/bridge/jobs/${job}/finish`, {
      body: { state: "done", result: "つながっています" },
      headers: dev(a.device_token),
    });
    expect(fin.status, await fin.clone().text()).toBeLessThan(300);
    expect(await count()).toEqual(before);
  });

  it("K365-API-015 2 重の 1 つ目が壊れた形：口を通らずに DB の関数を kaname_app で直に呼んで他の人の PC：not_found・仕事は増えない", async () => {
    const p = await newPerson();
    const other = await newPerson();
    const d = await live(other);
    const r = await f.pool.query<{ v: { state: string } }>("select app.device_browser_check($1, $2, $3) as v", [
      p.id,
      d.device_id,
      BROWSER_CHECK_PROMPT,
    ]);
    expect(r.rows[0]!.v).toEqual({ state: "not_found" });
    expect(await jobCount(other.id)).toBe(0);
  });

  it("K365-API-016 2 重の 2 つ目が壊れた形：DB の関数を持ち主を見ない写しに替えて口から他の人の PC：口の確かめが 404・仕事は増えない", async () => {
    const p = await newPerson();
    const other = await newPerson();
    const d = await live(other);
    const def = (
      await f.admin.query<{ d: string }>(
        "select pg_get_functiondef('app.device_browser_check(uuid, uuid, text)'::regprocedure) as d",
      )
    ).rows[0]!.d;
    try {
      await f.admin
        .query(`create or replace function app.device_browser_check(p_member uuid, p_session uuid, p_prompt text)
        returns jsonb language plpgsql security definer set search_path = public, app, pg_temp as $$
        declare v uuid;
        begin
          insert into bridge_jobs (tenant_id, member_id, state_id, prompt, browser, target_session_id, created_by)
            select s.tenant_id, s.member_id, 'queued', p_prompt, 'chrome', s.id, p_member from sessions s where s.id = p_session
            returning id into v;
          return jsonb_build_object('state', 'queued', 'job_id', v);
        end $$`);
      const r = await check(p.auth, d.device_id);
      expect(r.status, await r.clone().text()).toBe(404);
      expect((await json(r))["code"]).toBe("NOT_FOUND");
    } finally {
      await f.admin.query(def);
    }
    expect(await jobCount(other.id)).toBe(0);
  });

  it("K365-API-017 同じ PC で同時に 2 回押す：どちらも 201 で同じ job_id。その PC 宛ての仕事は 1 つ", async () => {
    const p = await newPerson();
    const d = await live(p);
    const [a, b] = await Promise.all([check(p.auth, d.device_id), check(p.auth, d.device_id)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect((await json(a)).data!["job_id"]).toBe((await json(b)).data!["job_id"]);
    expect(await jobsFor(d.device_id)).toHaveLength(1);
  });

  it("K365-API-018 答えに確かめの文と PC の印を出さない。Cache-Control に no-store", async () => {
    const p = await newPerson();
    const d = await live(p);
    const r = await check(p.auth, d.device_id);
    expect(r.status).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const text = await r.text();
    expect(text).not.toContain(BROWSER_CHECK_PROMPT);
    expect(text).not.toContain(d.device_token);
  });

  it("K365-API-019 PC を外したら：その PC 宛ての queued は cancelled。running とほかの仕事は前のまま。deleted_at の道でも同じ", async () => {
    const p = await newPerson();
    const a = await live(p, "PC A");
    const b = await live(p, "PC B");
    const c = await live(p, "PC C");
    const jobA = String((await json(await check(p.auth, a.device_id))).data!["job_id"]);
    const jobB = String((await json(await check(p.auth, b.device_id))).data!["job_id"]);
    const jobC = String((await json(await check(p.auth, c.device_id))).data!["job_id"]);
    await f.admin.query("update bridge_jobs set state_id = 'running' where id = $1", [jobB]);
    const free = (
      await f.admin.query<{ id: string }>(
        `insert into bridge_jobs (tenant_id, member_id, state_id, prompt, created_by)
         values ($1, $2, 'queued', '宛先の無い仕事', $2) returning id`,
        [p.tenantId, p.id],
      )
    ).rows[0]!.id;
    await f.admin.query("update sessions set revoked_at = now() where id = any($1::uuid[])", [
      [a.device_id, b.device_id],
    ]);
    await f.admin.query("update sessions set deleted_at = now() where id = $1", [c.device_id]);
    const state = async (id: string) =>
      (
        await f.admin.query<{ s: string; fin: Date | null }>(
          "select state_id as s, finished_at as fin from bridge_jobs where id = $1",
          [id],
        )
      ).rows[0]!;
    const sa = await state(jobA);
    expect(sa.s).toBe("cancelled");
    expect(sa.fin).not.toBeNull();
    const sc = await state(jobC);
    expect(sc.s).toBe("cancelled");
    expect(sc.fin).not.toBeNull();
    expect((await state(jobB)).s).toBe("running");
    expect((await state(free)).s).toBe("queued");
  });

  it("K365-API-020 queued のまま 80 秒前なら同じ仕事・100 秒前なら古い仕事を cancelled にして新しい仕事（queued は 1 つ）", async () => {
    const p = await newPerson();
    const d = await live(p);
    const first = String((await json(await check(p.auth, d.device_id))).data!["job_id"]);
    await f.admin.query("update bridge_jobs set created_at = now() - interval '80 seconds' where id = $1", [first]);
    const near = await check(p.auth, d.device_id);
    expect(near.status, await near.clone().text()).toBe(201);
    expect((await json(near)).data!["job_id"]).toBe(first);
    await f.admin.query("update bridge_jobs set created_at = now() - interval '100 seconds' where id = $1", [first]);
    const far = await check(p.auth, d.device_id);
    expect(far.status, await far.clone().text()).toBe(201);
    const next = String((await json(far)).data!["job_id"]);
    expect(next).not.toBe(first);
    const jobs = await jobsFor(d.device_id);
    expect(jobs.find((x) => x["id"] === first)?.["state_id"]).toBe("cancelled");
    expect(jobs.filter((x) => x["state_id"] === "queued").map((x) => x["id"])).toEqual([next]);
  });

  it("K365-API-021 S2 の失敗：取り下げの trigger が落ちたら外す取引ごと戻る（PC は外れず・仕事は queued のまま）", async () => {
    const p = await newPerson();
    const d = await live(p);
    const job = String((await json(await check(p.auth, d.device_id))).data!["job_id"]);
    const def = (
      await f.admin.query<{ d: string }>(
        "select pg_get_functiondef('app.bridge_jobs_cancel_for_gone_device()'::regprocedure) as d",
      )
    ).rows[0]!.d;
    try {
      await f.admin.query(`create or replace function app.bridge_jobs_cancel_for_gone_device()
        returns trigger language plpgsql security definer set search_path = public, app, pg_temp as $$
        begin raise exception 'K365-API-021 の試験の失敗'; end $$`);
      await expect(
        f.admin.query("update sessions set revoked_at = now() where id = $1", [d.device_id]),
      ).rejects.toThrow(/K365-API-021/);
    } finally {
      await f.admin.query(def);
    }
    const s = (
      await f.admin.query<{ r: Date | null }>("select revoked_at as r from sessions where id = $1", [d.device_id])
    ).rows[0]!;
    expect(s.r).toBeNull();
    const j = (await f.admin.query<{ s: string }>("select state_id as s from bridge_jobs where id = $1", [job]))
      .rows[0]!;
    expect(j.s).toBe("queued");
  });
});
