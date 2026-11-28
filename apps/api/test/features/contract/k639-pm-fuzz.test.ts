// K-639「記憶・接続コードの引き取り・チケットを作るの契約 fuzz の借り」の単体の試験（記憶の口の行 K639-API-001〜004・013 は K-712 が口ごと外した・D-152.20）（口・本物の DB）。名前の頭の行 ID（K639-API-…）は 11_tickets/K-639.md の表と 1 対 1。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   形どおりの入力（契約に合う入力）は 422 で断らない。形の誤りは契約に書いた形のとおり 422。
//   DB の中身で決まる断りは 422 にしない：使えない接続コードは 404 E-CONN-013。チケットを作るの分は K-437 へ移した。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { CATALOG } from "@kaname/errors";
import { agentHooks } from "../../../src/hooks/agent.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
let T: { tenantId: string; rootScope: string };

type Json = Record<string, unknown> & { data?: Record<string, unknown>; details?: { field: string }[] };
const json = async (r: Response) => (await r.clone().json()) as Json;
const fields = (j: Json) => (j.details ?? []).map((d) => d.field);
const msg = (code: string) => CATALOG[code]?.message ?? `（errors.json に ${code} が無い）`;
const count = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);

const pair = async (p: Person) => {
  const r = await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: p.auth });
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await json(r)).data as { code: string }).code;
};
const claim = (code: string) =>
  f.req("POST", "/bridge/claim", { body: { code, device_label: "試験の PC" }, ip: nextIp() });
const bridgeRows = (memberId: string) =>
  count("select count(*) as n from sessions where member_id = $1 and kind_id = 'bridge'", [memberId]);

beforeAll(async () => {
  f = await makeFixture([agentHooks]);
  f.limits["createPairingCode"] = 10_000;
  T = await f.company("K639 の会社", "KF");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-639 PC をつなぐ（引き取り）：使えない接続コードは 404 E-CONN-013", () => {
  it("K639-API-005 形どおりで使えないコード：404・E-CONN-013・正本の文。欄・details・detail は付けない。PC は 1 台もできない", async () => {
    const p = await f.person(T.tenantId, T.rootScope, { name: "PC の人 5" });
    await pair(p); // 本人は接続コードを出している（引き取られていない）。別のコードを入れても PC はできない
    const r = await claim("ZZZZZZ");
    expect(r.status, await r.clone().text()).toBe(404);
    const j = await json(r);
    expect(j["code"]).toBe("E-CONN-013");
    expect(j["message"]).toBe(msg("E-CONN-013"));
    expect(j["error"]).toBe("not_found");
    for (const k of ["field", "details"]) expect(j[k], k).toBeUndefined();
    expect(j["detail"] ?? {}, "detail は空（差し込む値を付けない）").toEqual({});
    expect(await bridgeRows(p.id)).toBe(0);
  });

  it("K639-API-006 違う・期限切れ・使い終わった・出し直す前のコード：どれも同じ 404 の答え（どれかを見分けさせない）", async () => {
    const p = await f.person(T.tenantId, T.rootScope, { name: "PC の人 6" });
    const wrong = await json(await claim("ZZZZZZ"));
    const old = await pair(p); // 出し直す前（次の pair で死ぬ）
    const used = await pair(p);
    expect((await claim(used)).status).toBe(201);
    const expired = await pair(p);
    await f.admin.query(
      "update bridge_pairing_codes set created_at = created_at - interval '11 minutes', expires_at = expires_at - interval '11 minutes' where member_id = $1 and code_hash = $2",
      [p.id, createHash("sha256").update(expired).digest("hex")],
    );
    for (const [name, code] of [
      ["出し直す前", old],
      ["使い終わった", used],
      ["期限切れ", expired],
    ] as const) {
      const r = await claim(code);
      expect(r.status, name).toBe(404);
      expect(await json(r), name).toEqual(wrong);
    }
    const again = await pair(p);
    expect((await claim(again)).status, "出し直した後の新しいコードは 201").toBe(201);
  });

  it("K639-API-007 形の誤りのコード（5 文字・空・33 文字・使わない字）は 422・欄 code（変えない）", async () => {
    for (const code of ["ABCDE", "", "x".repeat(33), "ABC10O"]) {
      const r = await claim(code);
      expect(r.status, JSON.stringify(code)).toBe(422);
      expect(fields(await json(r)), JSON.stringify(code)).toContain("code");
    }
  });

  it("K639-API-008 404 の後も、正しいコードはそのまま使える（コードは使ったことにならない）", async () => {
    const p = await f.person(T.tenantId, T.rootScope, { name: "PC の人 8" });
    const code = await pair(p);
    expect((await claim("ZZZZZZ")).status).toBe(404);
    const r = await claim(code);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await bridgeRows(p.id)).toBe(1);
  });
});
