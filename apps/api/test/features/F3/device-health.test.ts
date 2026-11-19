// K-360「PC の一覧に自己診断の時刻を足し、生きている知らせの答えに PC の番号を足す」の単体の試験（口・本物の DB）。
// 名前の頭の行 ID（K360-API-…）は 11_tickets/K-360.md の表に 1 対 1 で結ぶ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   時刻は眠らずに、DB の行の時刻（last_seen_at・health_at）を動かして進める
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SCHEMAS } from "@kaname/contracts/schemas";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
let T1: { tenantId: string; rootScope: string };
let T2: { tenantId: string; rootScope: string };

type Row = Record<string, unknown>;
const json = async (r: Response) => (await r.json()) as Row & { data?: unknown };
const newPerson = (o: Parameters<Fixture["person"]>[2] = {}) => f.person(T1.tenantId, T1.rootScope, o);
/** 接続コードを出して引き取る（K-57 の口）。PC の印と一覧の番号を返す */
const connect = async (p: Person, label = "高本の MacBook") => {
  const c = await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: p.auth });
  expect(c.status, await c.clone().text()).toBe(201);
  const code = ((await json(c)).data as { code: string }).code;
  const r = await f.req("POST", "/bridge/claim", { body: { code, device_label: label }, ip: nextIp() });
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as { device_token: string; device_id: string };
};
const beat = (token: string, body: unknown) =>
  f.req("POST", "/bridge/heartbeat", { body, headers: { "x-bridge-session": token } });
const beatOk = async (token: string, body: unknown) => {
  const r = await beat(token, body);
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as Row;
};
const devices = async (p: Person) => {
  const r = await f.req("GET", "/bridge/devices", { headers: p.auth });
  expect(r.status, await r.clone().text()).toBe(200);
  return (await json(r)).data as Row[];
};
const one = async (p: Person, id: string) => (await devices(p)).find((d) => d["id"] === id)!;
const sessionRow = async (id: string) =>
  (await f.admin.query<Row>("select health, health_at, last_seen_at from sessions where id = $1", [id])).rows[0]!;
/** 時刻をミリ秒に。DB の行の時刻（Date）はそのまま読む（String(Date) は秒までしか出ないので、文字に直すとミリ秒が落ちる） */
const ms = (v: unknown) => (v instanceof Date ? v : new Date(String(v))).getTime();

/** Claude Code の 2 行（Bridge の claudeChecks の形・K-359） */
const INSTALL = [
  { name: "本人のサブスクの Claude Code がある", ok: false, detail: "この PC にありません", fix: "install" },
  { name: "Claude Code にログインできている", ok: false, detail: "先に Claude Code を入れてください", fix: "install" },
];
const LOGIN = [
  { name: "本人のサブスクの Claude Code がある", ok: true, detail: "/usr/local/bin/claude" },
  {
    name: "Claude Code にログインできている",
    ok: false,
    detail: "まだログインしていません",
    fix: "login",
    code: "E-CONN-010",
  },
];
const OK = [
  { name: "本人のサブスクの Claude Code がある", ok: true, detail: "/usr/local/bin/claude" },
  { name: "Claude Code にログインできている", ok: true, detail: "できています" },
];
const body = (health: unknown) => ({ health, protocol: 5, version: "1.5.0" });

beforeAll(async () => {
  f = await makeFixture();
  T1 = await f.company("K360 の会社 1");
  T2 = await f.company("K360 の会社 2");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-360 自己診断を一覧で運ぶ（口・本物の DB）", { timeout: 30_000 }, () => {
  it("K360-API-001 生きている知らせに Claude Code の 2 行：一覧の health にそのまま（直し方・エラーの ID も）、health_at は DB の時刻", async () => {
    const p = await newPerson();
    const d = await connect(p);
    await beatOk(d.device_token, body(LOGIN));
    const row = await one(p, d.device_id);
    expect(row["state"]).toBe("live");
    expect(row["health"]).toEqual(LOGIN);
    const s = await sessionRow(d.device_id);
    expect(typeof row["health_at"]).toBe("string");
    expect(ms(row["health_at"])).toBe(ms(s["health_at"]));
    expect(Math.abs(ms(row["health_at"]) - Date.now())).toBeLessThan(60_000);
  });

  it("K360-API-002 生きている知らせの答えに、その PC の番号（device_id＝一覧の id）。PC の印は入らない", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const a = await beatOk(d.device_token, body([]));
    expect(a["device_id"]).toBe(d.device_id);
    expect(a["device_id"]).not.toBe(d.device_token);
    expect(JSON.stringify(a)).not.toContain(d.device_token);
    expect((await devices(p)).map((x) => x["id"])).toContain(a["device_id"]);
  });

  it("K360-API-003 health の鍵が無い知らせ：自己診断も報告の時刻も前のまま（最後に見えた時刻だけ進む）", async () => {
    const p = await newPerson();
    const d = await connect(p);
    await beatOk(d.device_token, body(INSTALL));
    await f.admin.query(
      "update sessions set health_at = now() - interval '10 minutes', last_seen_at = now() - interval '20 seconds' where id = $1",
      [d.device_id],
    );
    const before = await sessionRow(d.device_id);
    await beatOk(d.device_token, { protocol: 5, version: "1.5.0" });
    const row = await one(p, d.device_id);
    expect(row["health"]).toEqual(INSTALL);
    expect(ms(row["health_at"])).toBe(ms(before["health_at"]));
    expect(ms((await sessionRow(d.device_id))["last_seen_at"])).toBeGreaterThan(ms(before["last_seen_at"]));
  });

  it("K360-API-004 つないだがまだ知らせが無い（waiting）：health は []・health_at は null", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const row = await one(p, d.device_id);
    expect(row).toMatchObject({ state: "waiting", health: [], health_at: null });
  });

  it("K360-API-005 次の知らせで直った（login → できる）：health が入れ替わり、health_at が進む", async () => {
    const p = await newPerson();
    const d = await connect(p);
    await beatOk(d.device_token, body(LOGIN));
    await f.admin.query("update sessions set health_at = now() - interval '5 minutes' where id = $1", [d.device_id]);
    const old = ms((await one(p, d.device_id))["health_at"]);
    await beatOk(d.device_token, body(OK));
    const row = await one(p, d.device_id);
    expect(row["health"]).toEqual(OK);
    expect(ms(row["health_at"])).toBeGreaterThan(old);
  });

  it("K360-API-006 眠っている PC（最後の知らせから 75 秒より前）：state は asleep で、古い自己診断と報告の時刻をそのまま返す", async () => {
    const p = await newPerson();
    const d = await connect(p);
    await beatOk(d.device_token, body(INSTALL));
    await f.admin.query(
      "update sessions set last_seen_at = now() - interval '3 hours', health_at = now() - interval '3 hours' where id = $1",
      [d.device_id],
    );
    const s = await sessionRow(d.device_id);
    const row = await one(p, d.device_id);
    expect(row["state"]).toBe("asleep");
    expect(row["health"]).toEqual(INSTALL);
    expect(ms(row["health_at"])).toBe(ms(s["health_at"]));
  });

  it("K360-API-007 入力：health が並びでない（文字・物）：health は []・health_at は進む（空の報告として残す）。500 にしない", async () => {
    const p = await newPerson();
    const d = await connect(p);
    for (const bad of ["壊れた", { name: "x", ok: false }]) {
      await f.admin.query("update sessions set health_at = now() - interval '5 minutes' where id = $1", [d.device_id]);
      const old = ms((await sessionRow(d.device_id))["health_at"]);
      await beatOk(d.device_token, body(bad));
      const row = await one(p, d.device_id);
      expect(row["health"]).toEqual([]);
      expect(ms(row["health_at"])).toBeGreaterThan(old);
    }
  });

  it("K360-API-008 入力：行の中の知らない鍵は捨て、説明は 500 字で切り、知らない直し方は字のまま、名前の無い行は捨てる", async () => {
    const p = await newPerson();
    const d = await connect(p);
    await beatOk(
      d.device_token,
      body([
        {
          name: "Claude Code にログインできている",
          ok: false,
          detail: "あ".repeat(600),
          fix: "explode",
          token: "kpc_x",
          url: "https://claude.ai/?state=X",
        },
        { ok: false, fix: "install" },
      ]),
    );
    const h = (await one(p, d.device_id))["health"] as Row[];
    expect(h).toHaveLength(1);
    expect(Object.keys(h[0]!).sort()).toEqual(["detail", "fix", "name", "ok"]);
    expect([...String(h[0]!["detail"])]).toHaveLength(500);
    expect(h[0]!["fix"]).toBe("explode");
  });

  it("K360-API-009 同じアカウントの別のワークスペースから開く：同じ PC の同じ自己診断と報告の時刻（D-128.137）", async () => {
    const p = await newPerson({ authUserId: `k360-au-${Date.now()}` });
    const d = await connect(p);
    await beatOk(d.device_token, body(LOGIN));
    const there = await f.alsoIn(p, T2.tenantId, T2.rootScope);
    const a = await one(p, d.device_id);
    const b = await one(there, d.device_id);
    expect(b["health"]).toEqual(a["health"]);
    expect(b["health_at"]).toBe(a["health_at"]);
  });

  it("K360-API-010 守り：他の人・他の会社の PC の自己診断は一覧に出ない（件数にも入らない）", async () => {
    const p = await newPerson();
    const other = await newPerson();
    const far = await f.person(T2.tenantId, T2.rootScope);
    const mine = await connect(p);
    for (const x of [other, far]) {
      const d = await connect(x);
      await beatOk(d.device_token, body([{ ...INSTALL[0]!, detail: "K360-OTHER" }]));
    }
    const list = await devices(p);
    expect(list.map((x) => x["id"])).toEqual([mine.device_id]);
    expect(JSON.stringify(list)).not.toContain("K360-OTHER");
  });

  it("K360-API-011 外した PC（revoked_at）：一覧に出ない（自己診断も報告の時刻も）", async () => {
    const p = await newPerson();
    const d = await connect(p);
    await beatOk(d.device_token, body(INSTALL));
    await f.admin.query("update sessions set revoked_at = now() where id = $1", [d.device_id]);
    expect((await devices(p)).map((x) => x["id"])).not.toContain(d.device_id);
  });

  it("K360-API-012 契約の形：一覧（health_at が文字・null）と生きている知らせの答え（device_id）が、形の決まり（知らない鍵を通さない）に合う", async () => {
    const p = await newPerson();
    const waiting = await connect(p, "まだの PC");
    const live = await connect(p, "動いている PC");
    const a = await beatOk(live.device_token, body(LOGIN));
    expect(SCHEMAS["BridgeHeartbeat"]!.safeParse(a).success, JSON.stringify(a)).toBe(true);
    const list = await devices(p);
    expect(list.map((x) => x["health_at"] === null)).toEqual(list.map((x) => x["id"] === waiting.device_id));
    for (const row of list) {
      const r = SCHEMAS["BridgeDevice"]!.safeParse(row);
      expect(r.success, `${JSON.stringify(r.error?.issues)} ${JSON.stringify(row)}`).toBe(true);
    }
  });

  it("K360-API-013 失敗：生きている知らせを DB に書けない（app.bridge_beat が落ちる）：503・E-PAGE-003 で（DB の文は答えに出さない）、ログは例外の名前だけ。自己診断も報告の時刻も前のまま。一覧は前の報告を返す", async () => {
    const p = await newPerson();
    const d = await connect(p);
    await beatOk(d.device_token, body(INSTALL));
    const before = await sessionRow(d.device_id);
    await f.admin.query(`create or replace function app.k360_fail() returns trigger language plpgsql as $$ begin
      if new.id = '${d.device_id}' then raise exception 'k360 試験の失敗'; end if; return new; end $$`);
    await f.admin.query(
      // last_seen_at を進める更新（app.bridge_beat）だけで落とす。PC の印の解決（app.bridge_device_check）の更新は通す
      "create trigger k360_fail before update on sessions for each row when (new.last_seen_at is distinct from old.last_seen_at) execute function app.k360_fail()",
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await beat(d.device_token, body(OK));
      expect(r.status).toBe(503);
      const text = await r.text();
      expect(text).not.toContain("k360 試験の失敗");
      expect((JSON.parse(text) as Row)["code"]).toBe("E-PAGE-003");
      const logs = spy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
      expect(spy).toHaveBeenCalled();
      expect(logs).not.toContain("k360 試験の失敗");
      expect(logs).not.toContain(d.device_token);
    } finally {
      spy.mockRestore();
      await f.admin.query("drop trigger k360_fail on sessions");
      await f.admin.query("drop function app.k360_fail()");
    }
    const after = await sessionRow(d.device_id);
    expect(after["health"]).toEqual(INSTALL);
    expect(ms(after["health_at"])).toBe(ms(before["health_at"]));
    expect((await one(p, d.device_id))["health"]).toEqual(INSTALL);
  });
});
