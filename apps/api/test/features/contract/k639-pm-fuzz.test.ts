// K-639「記憶・接続コードの引き取り・チケットを作るの契約 fuzz の借り」の単体の試験（口・本物の DB）。名前の頭の行 ID（K639-API-…）は 11_tickets/K-639.md の表と 1 対 1。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   形どおりの入力（契約に合う入力）は 422 で断らない。形の誤りは契約に書いた形のとおり 422。
//   DB の中身で決まる断りは 422 にしない：使えない接続コードは 404 E-CONN-013。チケットを作るの分は K-437 へ移した。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { CATALOG } from "@kaname/errors";
import { agentHooks } from "../../../src/hooks/agent.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
let T: { tenantId: string; rootScope: string };
let writer: Person;

type Json = Record<string, unknown> & { data?: Record<string, unknown>; details?: { field: string }[] };
const json = async (r: Response) => (await r.clone().json()) as Json;
const fields = (j: Json) => (j.details ?? []).map((d) => d.field);
const msg = (code: string) => CATALOG[code]?.message ?? `（errors.json に ${code} が無い）`;
const count = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);

const remember = (body: Record<string, unknown>) => f.req("POST", "/memories", { body, headers: writer.auth });
const edit = (id: string, body: unknown) => f.req("PATCH", `/memories/${id}`, { body, headers: writer.auth });
const memoryRow = async (id: string) =>
  (await f.admin.query<Record<string, unknown>>("select * from memories where id = $1", [id])).rows[0]!;

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
  for (const op of ["createMemory", "updateMemory", "createPairingCode"]) f.limits[op] = 10_000;
  T = await f.company("K639 の会社", "KF");
  writer = await f.person(T.tenantId, T.rootScope, { name: "書く人", ticketAbility: "edit" });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-639 記憶：形どおりの入力は断らない", () => {
  it("K639-API-001 記憶を直す・作る：覚えること（body）が null は 422（欄 body・作る口も同じ）。直す口は空白だけも 422・文字なら 200。記憶は変わらず増えない", async () => {
    const made = await remember({ title: "直す前", body: "元の文" });
    expect(made.status, await made.clone().text()).toBe(201);
    const id = String((await json(made)).data!["id"]);
    for (const body of [{ body: null }, { body: "   " }, { title: "題だけ", body: null }]) {
      const r = await edit(id, body);
      expect(r.status, `${JSON.stringify(body)}：${await r.clone().text()}`).toBe(422);
      expect(fields(await json(r))).toContain("body");
    }
    expect((await memoryRow(id))["body"]).toBe("元の文");
    const before = await count("select count(*) as n from memories where tenant_id = $1", [T.tenantId]);
    for (const body of [{ body: null }, { title: "題", body: null }]) {
      const r = await remember(body);
      expect(r.status, `作る口も body が null は 422：${JSON.stringify(body)}`).toBe(422);
      expect(fields(await json(r))).toContain("body");
    }
    expect(await count("select count(*) as n from memories where tenant_id = $1", [T.tenantId])).toBe(before);
    const ok = await edit(id, { body: "直した文" });
    expect(ok.status, await ok.clone().text()).toBe(200);
    expect((await memoryRow(id))["body"]).toBe("直した文");
  });

  it("K639-API-002 記憶を作る：種類（kind_id）は rule・preference・example なら 201、知らない種類は 422。種類を入れなくても 201", async () => {
    for (const kind_id of ["rule", "preference", "example"]) {
      const r = await remember({ title: "種類", kind_id });
      expect(r.status, `${kind_id}：${await r.clone().text()}`).toBe(201);
      expect((await memoryRow(String((await json(r)).data!["id"])))["kind_id"]).toBe(kind_id);
    }
    const none = await remember({ title: "種類なし" });
    expect(none.status).toBe(201);
    const before = await count("select count(*) as n from memories where tenant_id = $1", [T.tenantId]);
    const bad = await remember({ title: "知らない種類", kind_id: "k639-無い種類" });
    expect(bad.status, await bad.clone().text()).toBe(422);
    expect(await count("select count(*) as n from memories where tenant_id = $1", [T.tenantId])).toBe(before);
  });

  it("K639-API-003 記憶を作る：本人が決めない欄（承認した人・承認の時刻・要約・置き換え先・持ち主）を送っても 201。値は入らず、持ち主は本人", async () => {
    const r = await remember({
      title: "決めない欄",
      approved_by: randomUUID(),
      approved_at: "2026-01-01T00:00:00Z",
      digest_id: randomUUID(),
      superseded_by: randomUUID(),
      owner_member_id: (await f.person(T.tenantId, T.rootScope, { name: "別の人" })).id,
    });
    expect(r.status, await r.clone().text()).toBe(201);
    const row = await memoryRow(String((await json(r)).data!["id"]));
    expect(row["approved_by"]).toBeNull();
    expect(row["approved_at"]).toBeNull();
    expect(row["digest_id"]).toBeNull();
    expect(row["superseded_by"]).toBeNull();
    expect(row["owner_member_id"]).toBe(writer.id);
  });

  it("K639-API-004 確かさ（confidence）は DB の桁（numeric(3,2)）と同じ：9.994・9.99・-9.99 は 201（9.99・9.99・-9.99 で入る）、9.995・-9.995・10 は 422", async () => {
    for (const [c, stored] of [
      ["9.994", "9.99"],
      ["9.99", "9.99"],
      ["-9.99", "-9.99"],
      ["0", "0.00"],
    ] as const) {
      const r = await remember({ title: "確かさ", confidence: c });
      expect(r.status, `${c}：${await r.clone().text()}`).toBe(201);
      expect(String((await memoryRow(String((await json(r)).data!["id"])))["confidence"])).toBe(stored);
    }
    for (const c of ["9.995", "-9.995", "9.9951", "10"]) {
      const r = await remember({ title: "確かさ", confidence: c });
      expect(r.status, c).toBe(422);
    }
  });
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

describe("K-639 記憶を作る：実物（G36）の形どおりの体は通る", () => {
  it("K639-API-013 実物の体（覚えることは文字・承認の時刻と各 uuid と種類 null・確かさ 0 を含む）：201。本人が決めない欄は入らず、覚えることは入る", async () => {
    const r = await remember({
      approved_at: "2000-01-01T00:00:00Z",
      approved_by: randomUUID(),
      body: "実物の形の覚えること",
      confidence: "0",
      digest_id: randomUUID(),
      kind_id: null,
      owner_member_id: randomUUID(),
      source_ref_id: randomUUID(),
      source_type_id: null,
      superseded_by: randomUUID(),
    });
    expect(r.status, await r.clone().text()).toBe(201);
    const row = await memoryRow(String((await json(r)).data!["id"]));
    expect(row["body"]).toBe("実物の形の覚えること");
    expect(row["approved_at"]).toBeNull();
    expect(row["approved_by"]).toBeNull();
    expect(row["digest_id"]).toBeNull();
    expect(row["superseded_by"]).toBeNull();
    expect(row["owner_member_id"]).toBe(writer.id);
  });
});
