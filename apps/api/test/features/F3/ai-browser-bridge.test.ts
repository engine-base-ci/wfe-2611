// K-366「Bridge の窓でも AI が使うブラウザを選び直せる口（setBridgeBrowser）」の単体の試験（口・本物の DB・本物の PC の印の解決）。
//   名前の頭の行 ID（K366-API-…）は 11_tickets/K-366.md の表に 1 対 1 で結ぶ。
//   PC の印で呼ぶので、その PC 自身の値だけが変わる。Kaname が正本で、画面（updateMyDevice・K-364）と同じ値（D-120）
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";
import { leafHooks } from "./leaf-hooks.js";
// 作り物の秘密の値は _fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K366_UNKNOWN_DEVICE_TOKEN } from "../../_fake/secrets.js";

let f: Fixture;
let T1: { tenantId: string; rootScope: string };

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
const choose = (headers: Record<string, string>, body: unknown) => f.req("POST", "/bridge/browser", { body, headers });
const beat = (token: string) =>
  f.req("POST", "/bridge/heartbeat", { body: { health: [], protocol: 5, version: "1.4.0" }, headers: dev(token) });
const browserOf = async (id: string) =>
  (await f.admin.query<{ b: string }>("select browser as b from sessions where id = $1", [id])).rows[0]!.b;
const listedBrowser = async (p: Person, id: string) => {
  const r = await f.req("GET", "/bridge/devices", { headers: p.auth });
  expect(r.status).toBe(200);
  return ((await json(r)).data as unknown as Record<string, unknown>[]).find((x) => x["id"] === id)?.["browser"];
};
const newPerson = () => f.person(T1.tenantId, T1.rootScope);

beforeAll(async () => {
  f = await makeFixture();
  leafHooks(f, ["device-browser", "bridge-browser"]); // 葉の hooks のファイル（K-326 の register）を最初の要求で足す
  T1 = await f.company("K366 の会社");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-366 Bridge の窓から選び直す（口・本物の DB）", () => {
  it("K366-API-001 PC の印で dedicated：201・答えは browser だけ。DB・人の一覧・次の知らせの答えが dedicated", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const r = await choose(dev(d.device_token), { browser: "dedicated" });
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await json(r)).data).toEqual({ browser: "dedicated" });
    expect(await browserOf(d.device_id)).toBe("dedicated");
    expect(await listedBrowser(p, d.device_id)).toBe("dedicated");
    expect((await json(await beat(d.device_token))).data!["browser"]).toBe("dedicated");
  });

  it("K366-API-002 3 つの値を順に・表記ゆらぎ（全角・前後の空白）：どれも 201 で DB がその値", async () => {
    const p = await newPerson();
    const d = await connect(p);
    for (const [sent, want] of [
      ["off", "off"],
      ["chrome", "chrome"],
      ["ｄｅｄｉｃａｔｅｄ", "dedicated"],
      [" off ", "off"],
    ] as const) {
      const r = await choose(dev(d.device_token), { browser: sent });
      expect(r.status, `${sent}: ${await r.clone().text()}`).toBe(201);
      expect(await browserOf(d.device_id)).toBe(want);
    }
  });

  it("K366-API-003 入力の誤り（3 つ以外・別の PC の id つき・空の体）：どれも 422。DB は chrome のまま・別の PC も変わらない", async () => {
    const p = await newPerson();
    const d = await connect(p, "PC A");
    const other = await connect(p, "PC B");
    for (const body of [
      { browser: "firefox" },
      { browser: "" },
      { browser: "CHROME" },
      { browser: 1 },
      { browser: null },
      { browser: "off", device_id: other.device_id },
      {},
    ]) {
      const r = await choose(dev(d.device_token), body);
      expect(r.status, `${JSON.stringify(body)}: ${await r.clone().text()}`).toBe(422);
    }
    expect(await browserOf(d.device_id)).toBe("chrome");
    expect(await browserOf(other.device_id)).toBe("chrome");
  });

  it("K366-API-004 守り：頭が無い 401／知らない印 401／外した PC の印 401／画面のログインで呼ぶ 403。DB は変わらない", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const gone = await connect(p, "外した PC");
    await f.admin.query("update sessions set revoked_at = now() where id = $1", [gone.device_id]);
    const body = { browser: "off" };
    expect((await choose({}, body)).status).toBe(401);
    expect((await choose(dev(K366_UNKNOWN_DEVICE_TOKEN), body)).status).toBe(401);
    expect((await choose(dev(gone.device_token), body)).status).toBe(401);
    expect((await choose(p.auth, body)).status).toBe(403);
    expect(await browserOf(d.device_id)).toBe("chrome");
    expect(await browserOf(gone.device_id)).toBe("chrome");
  });

  it("K366-API-005 同じ人の PC 2 台で A の印から off：A だけ off・B は chrome のまま", async () => {
    const p = await newPerson();
    const a = await connect(p, "PC A");
    const b = await connect(p, "PC B");
    expect((await choose(dev(a.device_token), { browser: "off" })).status).toBe(201);
    expect(await browserOf(a.device_id)).toBe("off");
    expect(await browserOf(b.device_id)).toBe("chrome");
  });

  it("K366-API-006 同じ PC の印で 1 分に 61 回目：429・retry_after_sec は 1〜60 の整数", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const order = ["dedicated", "off", "chrome"];
    for (let i = 0; i < 60; i += 1) {
      const r = await choose(dev(d.device_token), { browser: order[i % 3] });
      expect(r.status, `${i + 1} 回目`).toBe(201);
    }
    const r = await choose(dev(d.device_token), { browser: "off" });
    expect(r.status).toBe(429);
    const sec = (await json(r))["retry_after_sec"];
    expect(Number.isInteger(sec)).toBe(true);
    expect(sec as number).toBeGreaterThanOrEqual(1);
    expect(sec as number).toBeLessThanOrEqual(60);
  }, 60_000);

  it("K366-API-007 画面（updateMyDevice）から dedicated と、窓から off を同時に：どちらも 2xx。DB・一覧・知らせの答えが同じ 1 つの値", async () => {
    const p = await newPerson();
    const d = await connect(p);
    const [web, win] = await Promise.all([
      f.req("PATCH", `/bridge/devices/${d.device_id}`, { body: { browser: "dedicated" }, headers: p.auth }),
      choose(dev(d.device_token), { browser: "off" }),
    ]);
    expect(web.status, await web.clone().text()).toBe(200);
    expect(win.status, await win.clone().text()).toBe(201);
    const now = await browserOf(d.device_id);
    expect(["dedicated", "off"]).toContain(now);
    expect(await listedBrowser(p, d.device_id)).toBe(now);
    expect((await json(await beat(d.device_token))).data!["browser"]).toBe(now);
  });

  it("K366-API-008 S1 の失敗：kaname_app から app.bridge_set_browser の実行権を外して選ぶ：503・E-PAGE-003。DB は chrome のまま", async () => {
    const p = await newPerson();
    const d = await connect(p);
    try {
      await f.admin.query("revoke execute on function app.bridge_set_browser(uuid, text) from kaname_app");
      const r = await choose(dev(d.device_token), { browser: "off" });
      expect(r.status, await r.clone().text()).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("grant execute on function app.bridge_set_browser(uuid, text) to kaname_app");
    }
    expect(await browserOf(d.device_id)).toBe("chrome");
  });
});
