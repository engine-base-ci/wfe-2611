// K-364「AI が使うブラウザを PC ごとに選ぶ口（updateMyDevice・browser だけ）」の単体の試験（口・本物の DB・本物の PC の印の解決）。
//   名前の頭の行 ID（K364-API-…）は 11_tickets/K-364.md の表に 1 対 1 で結ぶ。
//   PC はアカウントのもの（D-128.137・D-128.156）。持ち主は口（app.bridge_devices）と DB の関数（app.device_set_browser）の 2 重で確かめる（D-128.166）
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";
import { leafHooks } from "./leaf-hooks.js";

type Browser = "chrome" | "dedicated" | "off";
let f: Fixture;
let T1: { tenantId: string; rootScope: string };
let T2: { tenantId: string; rootScope: string };

const json = async (r: Response) => (await r.json()) as Record<string, unknown> & { data?: Record<string, unknown> };
/** 接続コードを出して PC を引き取る（K-57 の契約の口） */
const connect = async (p: Person, label = "高本の MacBook") => {
  const c = await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: p.auth });
  expect(c.status, await c.clone().text()).toBe(201);
  const code = ((await json(c)).data as { code: string }).code;
  const r = await f.req("POST", "/bridge/claim", { body: { code, device_label: label }, ip: nextIp() });
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as { device_token: string; device_id: string };
};
const dev = (token: string) => ({ "x-bridge-session": token });
const beat = (token: string) =>
  f.req("POST", "/bridge/heartbeat", { body: { health: [], protocol: 5, version: "1.4.0" }, headers: dev(token) });
const pick = (headers: Record<string, string>, id: string, body: unknown) =>
  f.req("PATCH", `/bridge/devices/${id}`, { body, headers });
const browserOf = async (id: string) =>
  (await f.admin.query<{ b: Browser }>("select browser as b from sessions where id = $1", [id])).rows[0]!.b;
const listed = async (headers: Record<string, string>) => {
  const r = await f.req("GET", "/bridge/devices", { headers });
  expect(r.status, await r.clone().text()).toBe(200);
  return (await json(r)).data as unknown as Record<string, unknown>[];
};
const listedBrowser = async (headers: Record<string, string>, id: string) =>
  (await listed(headers)).find((x) => x["id"] === id)?.["browser"];
const fields = (j: Record<string, unknown>) =>
  ((j["details"] as { field: string }[] | undefined) ?? []).map((d) => d.field);
const newPerson = (o: Parameters<Fixture["person"]>[2] = {}) => f.person(T1.tenantId, T1.rootScope, o);

beforeAll(async () => {
  f = await makeFixture();
  leafHooks(f, ["device-browser"]); // 葉の hooks のファイル（K-326 の register）を最初の要求で足す
  T1 = await f.company("K364 の会社 1");
  T2 = await f.company("K364 の会社 2");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-364 PC のブラウザを選ぶ：状態 × 入口 × 利用者の状態（口・本物の DB）", () => {
  it("K364-API-001 つないだばかりの PC：一覧の browser は chrome（既定）・DB も chrome", async () => {
    const p = await newPerson();
    const d = await connect(p);
    expect(await listedBrowser(p.auth, d.device_id)).toBe("chrome");
    expect(await browserOf(d.device_id)).toBe("chrome");
  });

  it("K364-API-002 chrome → dedicated：200・答えは id と browser だけ。DB と一覧が dedicated。走っている仕事の行は変わらない", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const job = (
      await f.admin.query<{ id: string }>(
        `insert into bridge_jobs (tenant_id, member_id, state_id, prompt, created_by)
         values ($1, $2, 'running', '走っている仕事', $2) returning id`,
        [p.tenantId, p.id],
      )
    ).rows[0]!.id;
    const r = await pick(p.auth, d.device_id, { browser: "dedicated" });
    expect(r.status, await r.clone().text()).toBe(200);
    const data = (await json(r)).data!;
    expect(Object.keys(data).sort()).toEqual(["browser", "id"]);
    expect(data).toEqual({ id: d.device_id, browser: "dedicated" });
    expect(await browserOf(d.device_id)).toBe("dedicated");
    expect(await listedBrowser(p.auth, d.device_id)).toBe("dedicated");
    const j = (
      await f.admin.query<{ browser: string | null; state_id: string }>(
        "select browser, state_id from bridge_jobs where id = $1",
        [job],
      )
    ).rows[0]!;
    expect(j).toEqual({ browser: null, state_id: "running" });
  });

  it("K364-API-003 dedicated → off → chrome と続けて：3 回とも 200。毎回 DB と一覧がその値", async () => {
    const p = await newPerson();
    const d = await connect(p);
    for (const b of ["dedicated", "off", "chrome"] as const) {
      const r = await pick(p.auth, d.device_id, { browser: b });
      expect(r.status, `${b}: ${await r.clone().text()}`).toBe(200);
      expect(await browserOf(d.device_id)).toBe(b);
      expect(await listedBrowser(p.auth, d.device_id)).toBe(b);
    }
  });

  it("K364-API-004 選んだ直後の生きている知らせ：答えの browser が選んだ値（次の仕事から Bridge に渡る）", async () => {
    const p = await newPerson();
    const d = await connect(p);
    expect((await pick(p.auth, d.device_id, { browser: "off" })).status).toBe(200);
    const b = await beat(d.device_token);
    expect(b.status, await b.clone().text()).toBe(201);
    expect((await json(b)).data!["browser"]).toBe("off");
  });

  it("K364-API-005 眠っている PC（最後の知らせが 5 分前）でも選べる：値は残り、起きた知らせの答えで渡る", async () => {
    const p = await newPerson();
    const d = await connect(p);
    expect((await beat(d.device_token)).status).toBe(201);
    await f.admin.query("update sessions set last_seen_at = now() - interval '5 minutes' where id = $1", [d.device_id]);
    const r = await pick(p.auth, d.device_id, { browser: "dedicated" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await browserOf(d.device_id)).toBe("dedicated");
    expect((await json(await beat(d.device_token))).data!["browser"]).toBe("dedicated");
  });

  it("K364-API-006 PC 2 台：A だけ off。B は chrome のまま。一覧は 2 行でそれぞれの値・並びは選ぶ前と同じ", async () => {
    const p = await newPerson();
    const a = await connect(p, "PC A");
    const b = await connect(p, "PC B");
    expect((await beat(a.device_token)).status).toBe(201);
    expect((await beat(b.device_token)).status).toBe(201);
    const before = (await listed(p.auth)).map((x) => x["id"]);
    expect((await pick(p.auth, a.device_id, { browser: "off" })).status).toBe(200);
    const after = await listed(p.auth);
    expect(after.map((x) => x["id"])).toEqual(before);
    expect(after.find((x) => x["id"] === a.device_id)?.["browser"]).toBe("off");
    expect(after.find((x) => x["id"] === b.device_id)?.["browser"]).toBe("chrome");
  });

  it("K364-API-007 会社 1 でつないだ PC を、同じログインの会社 2 の画面から dedicated：200。どちらの一覧でも dedicated（D-128.156）", async () => {
    const p = await newPerson({ authUserId: `k364-au-${randomUUID()}` });
    const d = await connect(p);
    const there = await f.alsoIn(p, T2.tenantId, T2.rootScope);
    const r = await pick(there.auth, d.device_id, { browser: "dedicated" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await listedBrowser(p.auth, d.device_id)).toBe("dedicated");
    expect(await listedBrowser(there.auth, d.device_id)).toBe("dedicated");
  });

  it("K364-API-008 他の人の PC（同じ会社・別の会社）：どちらも 404・NOT_FOUND。相手の値は chrome のまま", async () => {
    const p = await newPerson();
    const near = await newPerson();
    const far = await f.person(T2.tenantId, T2.rootScope);
    const dn = await connect(near);
    const df = await connect(far);
    for (const id of [dn.device_id, df.device_id]) {
      const r = await pick(p.auth, id, { browser: "off" });
      expect(r.status, await r.clone().text()).toBe(404);
      expect((await json(r))["code"]).toBe("NOT_FOUND");
      expect(await browserOf(id)).toBe("chrome");
    }
  });

  it("K364-API-009 外した PC・消した行・無い uuid：どれも 404・NOT_FOUND。外した・消した行の値は変わらない", async () => {
    const p = await newPerson();
    const gone = await connect(p, "外した PC");
    const del = await connect(p, "消した PC");
    await f.admin.query("update sessions set revoked_at = now() where id = $1", [gone.device_id]);
    await f.admin.query("update sessions set deleted_at = now() where id = $1", [del.device_id]);
    for (const id of [gone.device_id, del.device_id, randomUUID()]) {
      const r = await pick(p.auth, id, { browser: "off" });
      expect(r.status, `${id}: ${await r.clone().text()}`).toBe(404);
      expect((await json(r))["code"]).toBe("NOT_FOUND");
    }
    expect(await browserOf(gone.device_id)).toBe("chrome");
    expect(await browserOf(del.device_id)).toBe("chrome");
  });

  it("K364-API-010 :id が uuid でない：422", async () => {
    const p = await newPerson();
    const r = await pick(p.auth, "abc", { browser: "off" });
    expect(r.status).toBe(422);
  });
});

describe("K-364 入力・操作の揺れ・守り・失敗", () => {
  it("K364-API-011 browser が firefox・空・CHROME・数・null：どれも 422・欄 browser。DB は chrome のまま", async () => {
    const p = await newPerson();
    const d = await connect(p);
    for (const browser of ["firefox", "", "CHROME", 1, null]) {
      const r = await pick(p.auth, d.device_id, { browser });
      expect(r.status, `${JSON.stringify(browser)}: ${await r.clone().text()}`).toBe(422);
      expect(fields(await json(r))).toContain("browser");
    }
    expect(await browserOf(d.device_id)).toBe("chrome");
  });

  it("K364-API-012 表記ゆらぎ：全角の ｄｅｄｉｃａｔｅｄ は dedicated・前後に空白の off は off（200）", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const a = await pick(p.auth, d.device_id, { browser: "ｄｅｄｉｃａｔｅｄ" });
    expect(a.status, await a.clone().text()).toBe(200);
    expect((await json(a)).data!["browser"]).toBe("dedicated");
    expect(await browserOf(d.device_id)).toBe("dedicated");
    const b = await pick(p.auth, d.device_id, { browser: " off " });
    expect(b.status, await b.clone().text()).toBe(200);
    expect(await browserOf(d.device_id)).toBe("off");
  });

  it("K364-API-013 browser と一緒に member_id・kind_id・revoked_at・device_label：422。どの列も変わらない", async () => {
    const p = await newPerson();
    const other = await newPerson();
    const d = await connect(p, "元の名前");
    const r = await pick(p.auth, d.device_id, {
      browser: "off",
      member_id: other.id,
      kind_id: "web",
      revoked_at: new Date().toISOString(),
      device_label: "変えた名前",
    });
    expect(r.status, await r.clone().text()).toBe(422);
    const s = (
      await f.admin.query<Record<string, unknown>>(
        "select browser, member_id, kind_id, revoked_at, device_label from sessions where id = $1",
        [d.device_id],
      )
    ).rows[0]!;
    expect(s).toEqual({
      browser: "chrome",
      member_id: p.id,
      kind_id: "bridge",
      revoked_at: null,
      device_label: "元の名前",
    });
  });

  it("K364-API-014 空の体 {}：422・欄 browser。DB は変わらない", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const r = await pick(p.auth, d.device_id, {});
    expect(r.status, await r.clone().text()).toBe(422);
    expect(fields(await json(r))).toContain("browser");
    expect(await browserOf(d.device_id)).toBe("chrome");
  });

  it("K364-API-015 守り：ログインしていない 401／取引先・運営 403／PC の印 403／同意し直しが要る 403・E-AUTH-010。どれも値は変わらない", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const body = { browser: "off" };
    expect((await pick({}, d.device_id, body)).status).toBe(401);
    for (const role of ["client", "ops"] as const) {
      expect((await pick(f.as(p, role), d.device_id, body)).status, role).toBe(403);
    }
    expect((await pick(dev(d.device_token), d.device_id, body)).status).toBe(403);
    const pending = await pick(f.pending(p), d.device_id, body);
    expect(pending.status).toBe(403);
    expect((await json(pending))["code"]).toBe("E-AUTH-010");
    expect(await browserOf(d.device_id)).toBe("chrome");
  });

  it("K364-API-016 同じ人が 1 分に 61 回目：429・retry_after_sec は 1〜60 の整数", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const order: Browser[] = ["dedicated", "off", "chrome"];
    for (let i = 0; i < 60; i += 1) {
      const r = await pick(p.auth, d.device_id, { browser: order[i % 3] });
      expect(r.status, `${i + 1} 回目`).toBe(200);
    }
    const r = await pick(p.auth, d.device_id, { browser: "off" });
    expect(r.status).toBe(429);
    const sec = (await json(r))["retry_after_sec"];
    expect(Number.isInteger(sec)).toBe(true);
    expect(sec as number).toBeGreaterThanOrEqual(1);
    expect(sec as number).toBeLessThanOrEqual(60);
  }, 60_000);

  it("K364-API-017 今と同じ値（chrome）を選び直す：200・chrome のまま", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const r = await pick(p.auth, d.device_id, { browser: "chrome" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await json(r)).data!["browser"]).toBe("chrome");
    expect(await browserOf(d.device_id)).toBe("chrome");
  });

  it("K364-API-018 2 つのタブから同時に dedicated と off：どちらも 200。DB と一覧は同じ 1 つの値で、どちらか", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const [a, b] = await Promise.all([
      pick(p.auth, d.device_id, { browser: "dedicated" }),
      pick(p.auth, d.device_id, { browser: "off" }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const now = await browserOf(d.device_id);
    expect(["dedicated", "off"]).toContain(now);
    expect(await listedBrowser(p.auth, d.device_id)).toBe(now);
  });

  it("K364-API-019 答えに PC の印・そのハッシュ・member_id を出さない。Cache-Control に no-store", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const r = await pick(p.auth, d.device_id, { browser: "off" });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const text = await r.text();
    expect(text).not.toContain(d.device_token);
    const hash = (
      await f.admin.query<{ h: string }>("select device_token_hash as h from sessions where id = $1", [d.device_id])
    ).rows[0]!.h;
    expect(text).not.toContain(hash);
    expect(text).not.toContain(p.id);
  });

  it("K364-API-020 2 重の 1 つ目が壊れた形：口を通らずに DB の関数を kaname_app で直に呼んで他の人の PC：null・相手は chrome のまま", async () => {
    const p = await newPerson();
    const other = await newPerson();
    const d = await connect(other);
    const r = await f.pool.query<{ v: unknown }>("select app.device_set_browser($1, $2, $3) as v", [
      p.id,
      d.device_id,
      "off",
    ]);
    expect(r.rows[0]!.v).toBeNull();
    expect(await browserOf(d.device_id)).toBe("chrome");
  });

  it("K364-API-021 2 重の 2 つ目が壊れた形：DB の関数を持ち主を見ない写しに替えて口から他の人の PC：口の確かめが 404・相手は chrome のまま", async () => {
    const p = await newPerson();
    const other = await newPerson();
    const d = await connect(other);
    const def = (
      await f.admin.query<{ d: string }>(
        "select pg_get_functiondef('app.device_set_browser(uuid, uuid, text)'::regprocedure) as d",
      )
    ).rows[0]!.d;
    try {
      await f.admin
        .query(`create or replace function app.device_set_browser(p_member uuid, p_session uuid, p_browser text)
        returns jsonb language sql security definer set search_path = public, app, pg_temp as $$
          update sessions set browser = p_browser where id = p_session and kind_id = 'bridge' and revoked_at is null
          returning jsonb_build_object('id', id, 'browser', browser)
        $$`);
      const r = await pick(p.auth, d.device_id, { browser: "off" });
      expect(r.status, await r.clone().text()).toBe(404);
      expect((await json(r))["code"]).toBe("NOT_FOUND");
      expect(await browserOf(d.device_id)).toBe("chrome");
    } finally {
      await f.admin.query(def);
    }
  });

  it("K364-API-022 S1 の失敗：kaname_app から DB の関数の実行権を外して選ぶ：503・E-PAGE-003。DB は chrome のまま", async () => {
    const p = await newPerson();
    const d = await connect(p);
    try {
      await f.admin.query("revoke execute on function app.device_set_browser(uuid, uuid, text) from kaname_app");
      const r = await pick(p.auth, d.device_id, { browser: "off" });
      expect(r.status, await r.clone().text()).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("grant execute on function app.device_set_browser(uuid, uuid, text) to kaname_app");
    }
    expect(await browserOf(d.device_id)).toBe("chrome");
  });
});
