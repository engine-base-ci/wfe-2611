// K-144「K-57・K-60 の口で、契約（openapi）と実際の振る舞いをそろえる」の単体の試験（口・本物の DB）。
// 名前の頭の行 ID（K144-API-…）は 11_tickets/K-144.md の表のマスに 1 対 1 で結ぶ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   答えを、契約から作った生成物で確かめる：状態コードは registry（packages/contracts/src/registry.ts の success・errors）、
//   成功の data の形は入口と同じ zod（packages/contracts/src/schemas.ts・z.strictObject。知らない欄も、null を許さない欄の null も赤）。
//   契約そのもの（openapi の additionalProperties・format: uuid・応答の並び）は scripts/ci/contract_shape_test.py が見る。
//   決まり（D-129.42）：uuid の欄は入口で正式な uuid の形を確かめ、違えば 422（欄の名前・理由 "uuid"）。中で 500 にしない。知らない項目も 422
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENDPOINTS } from "@kaname/contracts/registry";
import { SCHEMAS } from "@kaname/contracts/schemas";
import { s3Client, s3Presigner } from "@kaname/storage";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";
import { FAKE_S3, startFakeS3 } from "../../fake-s3.js";

let f: Fixture;
let T: { tenantId: string; rootScope: string };
let writer: Person;
let mate: Person;
let task: { id: string };

// 正式な uuid でない値（D-129.42）。前の口の正規表現（/^[0-9a-f-]{36}$/i）は 1・2 を通していた
const NOT_UUID = [
  "------------------------------------", // 1. 36 個のハイフン（前は通って、DB の ::uuid で落ちていた）
  "3fa85f64-5717-0562-b3fc-2c963f66afa6", // 2. 版の桁が 0（RFC 9562 の形でない）
  "", // 3. 空
  "not-a-uuid", // 4. 形が違う
  `${randomUUID()}0`, // 5. 長すぎる
];
// 表記ゆらぎ（入口の normalize が NFKC と前後の空白をそろえる）。同じ uuid として受ける
const fullWidth = (s: string) =>
  [...s].map((c) => (c === "-" ? "－" : String.fromCharCode(c.charCodeAt(0) + 0xfee0))).join("");

type Json = Record<string, unknown> & { data?: unknown; details?: { field: string; message: string }[] };
const json = async (r: Response) => (await r.clone().json()) as Json;
const def = (op: string) => {
  const d = ENDPOINTS.find((e) => e.operationId === op);
  if (!d) throw new Error(`registry に ${op} が無い`);
  return d;
};
/** 答えが契約どおりか：状態コードが契約の並びにあり、成功の data は契約の形（strict）に合う */
const conforms = async (op: string, r: Response) => {
  const d = def(op);
  const allowed = [d.success, ...d.errors];
  expect(allowed, `${op} が ${r.status} を返したが、契約の並び（${allowed.join(",")}）に無い`).toContain(r.status);
  const ct = r.headers.get("content-type") ?? "";
  if (r.status !== d.success || !ct.includes("application/json")) return;
  const schema = SCHEMAS[d.output!];
  expect(schema, `${op} の答えの形 ${d.output} が schemas に無い`).toBeDefined();
  const data = (await json(r)).data;
  const rows = d.outputList ? (data as unknown[]) : [data];
  for (const row of rows) {
    const p = schema!.safeParse(row);
    expect(
      p.success,
      `${op} の答えが契約の形 ${d.output} に合わない: ${JSON.stringify(p.error?.issues)} ${JSON.stringify(row)}`,
    ).toBe(true);
  }
};
const fields = (j: Json) => (j.details ?? []).map((x) => x.field);
const uuidReason = (j: Json, field: string) => (j.details ?? []).find((x) => x.field === field)?.message;
const count = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);

// PC をつなぐ（K-57）の小さな手順
const pair = async (p: Person) => {
  const r = await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: p.auth });
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await json(r)).data as { code: string }).code;
};
const claim = (code: string, extra: Record<string, unknown> = {}) =>
  f.req("POST", "/bridge/claim", { body: { code, device_label: "試験の PC", ...extra }, ip: nextIp() });
const claimOk = async (p: Person, extra: Record<string, unknown> = {}) => {
  const r = await claim(await pair(p), extra);
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as { device_token: string; device_id: string };
};
const dev = (token: string) => ({ "x-bridge-session": token });
const newPerson = () => f.person(T.tenantId, T.rootScope, { name: "PC の人" });
const RELEASE = () => {
  const dir = mkdtempSync(join(tmpdir(), "k144-release-"));
  const bytes = Buffer.from("Kaname-Bridge の中身（K-144 の試験）");
  writeFileSync(join(dir, "Kaname-Bridge-1.4.0-arm64.dmg"), bytes);
  writeFileSync(join(dir, "Kaname-Bridge-1.4.0-arm64-mac.zip"), bytes);
  const file = (platform: string, kind: string, name: string) => ({
    platform,
    arch: "arm64",
    kind,
    name,
    sha256: "a".repeat(64),
    size: bytes.length,
  });
  writeFileSync(
    join(dir, "kaname-bridge.json"),
    JSON.stringify({
      version: "1.4.0",
      released_at: "2026-11-01T00:00:00Z",
      files: [
        file("mac", "installer", "Kaname-Bridge-1.4.0-arm64.dmg"),
        file("mac", "app", "Kaname-Bridge-1.4.0-arm64-mac.zip"),
      ],
    }),
  );
  return { dir, bytes };
};
const setRelease = (dir: string, base = "") => {
  f.release.dir = dir;
  f.release.base = base;
};

// チケットを作る（K-60）の小さな手順
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const ticketBody = (extra: Record<string, unknown> = {}) => ({
  scope_id: T.rootScope,
  kind_id: task.id,
  title: "契約の形を確かめる",
  assignee_member_id: mate.id,
  due_on: jst(3),
  sections: { purpose: "目的", done: "完了の条件", todo: "実施事項" },
  ...extra,
});
const create = (b: unknown) => f.req("POST", "/tickets", { body: b, headers: writer.auth });
const saveDraft = (b: unknown) => f.req("POST", "/me/ticket-drafts", { body: b, headers: writer.auth });
const ticketsOf = () => count("select count(*) as n from tickets where tenant_id = $1", [T.tenantId]);
const draftsOf = () => count("select count(*) as n from app.ticket_drafts where member_id = $1", [writer.id]);

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  f.limits["createTicket"] = 10_000;
  f.limits["saveMyTicketDraft"] = 10_000;
  f.limits["createPairingCode"] = 10_000;
  f.limits["downloadBridgeRelease"] = 10_000;
  T = await f.company("K144 の会社", "KS");
  writer = await f.person(T.tenantId, T.rootScope, { name: "書く人", ticketAbility: "edit" });
  mate = await f.person(T.tenantId, T.rootScope, { name: "担当の人", ticketAbility: "edit" });
  const kinds = (await json(await f.req("GET", "/ticket_kinds", { headers: writer.auth }))).data as {
    id: string;
    name: string;
  }[];
  task = kinds.find((k) => k.name === "タスク")!;
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-144 ① 配布物の受け取り（downloadBridgeRelease）と新しい版（getLatestBridgeRelease）：返す答えが全部契約にある", () => {
  it("K144-API-001 配布物が無い（mac・win）：404・E-CONN-014。契約の 404 にある", async () => {
    setRelease("");
    const p = await newPerson();
    for (const os of ["mac", "win"]) {
      const r = await f.req("GET", `/bridge/releases/${os}/file`, { headers: p.auth });
      expect(r.status, os).toBe(404);
      expect((await json(r))["code"]).toBe("E-CONN-014");
      await conforms("downloadBridgeRelease", r);
    }
  });

  it("K144-API-002 目録に無い名前・置き場の外を指す名前：404・NOT_FOUND。契約の 404 にある", async () => {
    setRelease(RELEASE().dir);
    const p = await newPerson();
    for (const name of ["Other-1.0.0.dmg", "kaname-bridge.json", "..%2F..%2Fetc%2Fpasswd"]) {
      const r = await f.req("GET", `/bridge/releases/${name}/file`, { headers: p.auth });
      expect(r.status, name).toBe(404);
      expect((await json(r))["code"]).toBe("NOT_FOUND");
      await conforms("downloadBridgeRelease", r);
    }
  });

  it("K144-API-003 小文字だけの知らない名前（linux）：422・欄は name。契約の 422 にある", async () => {
    setRelease(RELEASE().dir);
    const p = await newPerson();
    const r = await f.req("GET", "/bridge/releases/linux/file", { headers: p.auth });
    expect(r.status).toBe(422);
    expect(fields(await json(r))).toContain("name");
    await conforms("downloadBridgeRelease", r);
  });

  it("K144-API-004 置き場に届かない：受け取るも新しい版も 503・E-PAGE-007。両方の契約に 503 がある（G-15：空を成功にしない）", async () => {
    setRelease("", "http://127.0.0.1:9/k144-unreachable");
    const p = await newPerson();
    const file = await f.req("GET", "/bridge/releases/mac/file", { headers: p.auth });
    expect(file.status).toBe(503);
    expect((await json(file))["code"]).toBe("E-PAGE-007");
    await conforms("downloadBridgeRelease", file);
    const latest = await f.req("GET", "/bridge/releases/latest", { headers: p.auth });
    expect(latest.status).toBe(503);
    expect((await json(latest))["code"]).toBe("E-PAGE-007");
    await conforms("getLatestBridgeRelease", latest);
  });

  it("K144-API-005 手元のフォルダの配布物：200 でファイルそのもの（application/octet-stream）。契約の 200 にその中身の形がある", async () => {
    const { dir, bytes } = RELEASE();
    setRelease(dir);
    const p = await newPerson();
    const r = await f.req("GET", "/bridge/releases/mac/file", { headers: p.auth });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type") ?? "").toContain("application/octet-stream");
    expect(Buffer.from(await r.arrayBuffer()).equals(bytes)).toBe(true);
    await conforms("downloadBridgeRelease", r);
  });

  it("K144-API-006 外の置き場の配布物：200 で期限つき URL（JSON）。契約の形 BridgeReleaseLink に合う", async () => {
    const { dir, bytes } = RELEASE();
    const fake = await startFakeS3();
    const client = s3Client({
      endpoint: fake.endpoint,
      region: FAKE_S3.region,
      bucket: "k144-bridge",
      accessKeyId: FAKE_S3.accessKeyId,
      secretAccessKey: FAKE_S3.secretAccessKey,
    });
    const prefix = `k144-${randomUUID()}`;
    fake.objects.set(`k144-bridge/${prefix}/kaname-bridge.json`, {
      body: readFileSync(join(dir, "kaname-bridge.json")),
      public: true,
    });
    fake.objects.set(`k144-bridge/${prefix}/Kaname-Bridge-1.4.0-arm64.dmg`, { body: bytes });
    f.signer.current = s3Presigner(client, fake.endpoint);
    try {
      setRelease("", `${fake.endpoint}/k144-bridge/${prefix}`);
      const p = await newPerson();
      const r = await f.req("GET", "/bridge/releases/mac/file", { headers: p.auth });
      expect(r.status, await r.clone().text()).toBe(200);
      await conforms("downloadBridgeRelease", r);
    } finally {
      f.signer.current = null;
      await fake.close();
    }
  });

  it("K144-API-007 新しい版：配っていない（released: false）・配っていて更新あり・配っていて OS／CPU が無い・違う値（update: null）。どれも契約の形 BridgeRelease に合う", async () => {
    const p = await newPerson();
    setRelease("");
    await conforms("getLatestBridgeRelease", await f.req("GET", "/bridge/releases/latest", { headers: p.auth }));
    setRelease(RELEASE().dir);
    const withUpdate = await f.req("GET", "/bridge/releases/latest?os=mac&arch=arm64", { headers: p.auth });
    expect(((await json(withUpdate)).data as { update: unknown }).update).not.toBeNull();
    await conforms("getLatestBridgeRelease", withUpdate);
    for (const q of ["", "?os=win&arch=x64", "?os=linux&arch=riscv"]) {
      const r = await f.req("GET", `/bridge/releases/latest${q}`, { headers: p.auth });
      expect(r.status, q).toBe(200);
      expect(((await json(r)).data as { update: unknown }).update, q).toBeNull();
      await conforms("getLatestBridgeRelease", r);
    }
  });
});

describe("K-144 ② 答えの null と欄：口が返す答えが契約の形（strict・null）に合う", () => {
  it("K144-API-008 チケットの種類の色が null（DB の列は null 可）：200 で color: null。契約の形 TicketKindChoice に合う", async () => {
    await f.admin.query(
      "insert into ticket_kinds (tenant_id, name, color, position) values ($1, '色の無い種類', null, 90)",
      [T.tenantId],
    );
    const r = await f.req("GET", "/ticket_kinds", { headers: writer.auth });
    expect(r.status).toBe(200);
    const kinds = (await json(r)).data as { name: string; color: unknown }[];
    expect(kinds.find((k) => k.name === "色の無い種類")?.color).toBeNull();
    await conforms("listTicketKinds", r);
  });

  it("K144-API-009 チケットの詳細：担当者がいない（assignee: null）ときも契約の形 TicketDetail に合う", async () => {
    const made = await create(ticketBody());
    expect(made.status, await made.clone().text()).toBe(201);
    await conforms("createTicket", made);
    const id = ((await json(made)).data as { id: string }).id;
    await conforms("getTicket", await f.req("GET", `/tickets/${id}`, { headers: writer.auth }));
    await f.admin.query("update tickets set assignee_member_id = null where id = $1", [id]);
    const r = await f.req("GET", `/tickets/${id}`, { headers: writer.auth });
    expect(r.status).toBe(200);
    expect(((await json(r)).data as { assignee: unknown }).assignee).toBeNull();
    await conforms("getTicket", r);
  });

  it("K144-API-010 PC の引き取り・生きている知らせ・端末の一覧（最初の知らせの前＝最後に見えた時刻と版が null）：どれも契約の形に合う。引き取りは PC の名前も返す", async () => {
    const p = await newPerson();
    const code = await pair(p);
    const c = await claim(code, { machine_id: randomUUID() });
    expect(c.status).toBe(201);
    expect(((await json(c)).data as { device_label: string }).device_label).toBe("試験の PC");
    await conforms("claimPairingCode", c);
    const token = ((await json(c)).data as { device_token: string }).device_token;
    const list0 = await f.req("GET", "/bridge/devices", { headers: p.auth });
    const waiting = (
      (await json(list0)).data as { last_seen_at: unknown; version: unknown; revoke_reason: unknown }[]
    )[0]!;
    expect(waiting.last_seen_at).toBeNull();
    expect(waiting.revoke_reason).toBeNull();
    await conforms("listMyDevices", list0);
    const beat = await f.req("POST", "/bridge/heartbeat", {
      body: { health: [], protocol: 4, version: "1.4.0" },
      headers: dev(token),
    });
    expect(beat.status).toBe(201);
    await conforms("sendHeartbeat", beat);
    await conforms("listMyDevices", await f.req("GET", "/bridge/devices", { headers: p.auth }));
  });

  it("K144-API-011 接続コードを出す：201 の答えが契約の形 PairingCode に合う", async () => {
    const p = await newPerson();
    await conforms("createPairingCode", await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: p.auth }));
  });

  it("K144-API-012 下書きを残す・一覧・捨てる（捨てた答えは body と saved_at が null）：答えが契約の形 TicketDraft に合う", async () => {
    const id = randomUUID();
    const s = await saveDraft({ draft_id: id, body: { title: "書きかけ" } });
    expect(s.status, await s.clone().text()).toBe(201);
    await conforms("saveMyTicketDraft", s);
    await conforms("listMyTicketDrafts", await f.req("GET", "/me/ticket-drafts", { headers: writer.auth }));
    const gone = await saveDraft({ draft_id: id, discard: true });
    expect(gone.status, await gone.clone().text()).toBe(201);
    expect((await json(gone)).data).toMatchObject({ draft_id: id, body: null, saved_at: null });
    await conforms("saveMyTicketDraft", gone);
  });
});

describe("K-144 ③ 入力の知らない項目（D-129.42）：K-57・K-60 の体を受ける口は全部 422 で、何も書かない", () => {
  it("K144-API-013 接続コードを出す（体は空の形）に知らない項目：422。コードは増えない", async () => {
    const p = await newPerson();
    const before = await count("select count(*) as n from bridge_pairing_codes where member_id = $1", [p.id]);
    for (const extra of [{ member_id: p.id }, { code_hash: "x" }, { anything: 1 }]) {
      const r = await f.req("POST", "/bridge/pairing-codes", { body: extra, headers: p.auth });
      expect(r.status, JSON.stringify(extra)).toBe(422);
      await conforms("createPairingCode", r);
    }
    expect(await count("select count(*) as n from bridge_pairing_codes where member_id = $1", [p.id])).toBe(before);
  });

  it("K144-API-014 引き取り・生きている知らせ・チケットを作る・下書きを残すに知らない項目：422。PC・チケット・下書きは増えない", async () => {
    const p = await newPerson();
    const code = await pair(p);
    const c = await claim(code, { tenant_id: T.tenantId });
    expect(c.status).toBe(422);
    await conforms("claimPairingCode", c);
    expect((await claim(code)).status, "422 の後もコードは使える").toBe(201);
    const d = await claimOk(p);
    const beat = await f.req("POST", "/bridge/heartbeat", {
      body: { health: [], protocol: 4, version: "1.4.0", member_id: p.id },
      headers: dev(d.device_token),
    });
    expect(beat.status).toBe(422);
    await conforms("sendHeartbeat", beat);
    const tickets = await ticketsOf();
    const t = await create(ticketBody({ tenant_id: T.tenantId }));
    expect(t.status).toBe(422);
    await conforms("createTicket", t);
    expect(await ticketsOf()).toBe(tickets);
    const drafts = await draftsOf();
    const s = await saveDraft({ draft_id: randomUUID(), body: {}, member_id: mate.id });
    expect(s.status).toBe(422);
    await conforms("saveMyTicketDraft", s);
    expect(await draftsOf()).toBe(drafts);
  });
});

describe("K-144 ④ uuid の欄（D-129.42）：入口が正式な uuid の形を確かめ、違えば 422（欄の名前・理由 uuid）。500 にしない", () => {
  it("K144-API-015 下書きを残す：draft_id が uuid でない（36 個のハイフン・版の桁が 0・空・形違い・長すぎる）は 422・欄 draft_id。下書きは増えない", async () => {
    const drafts = await draftsOf();
    for (const v of NOT_UUID) {
      const r = await saveDraft({ draft_id: v, body: { title: "x" } });
      expect(r.status, JSON.stringify(v)).toBe(422);
      expect(fields(await json(r)), JSON.stringify(v)).toContain("draft_id");
      expect(uuidReason(await json(r), "draft_id"), JSON.stringify(v)).toBe("uuid");
      await conforms("saveMyTicketDraft", r);
    }
    expect(await draftsOf()).toBe(drafts);
  });

  it("K144-API-016 下書きを残す：draft_id の表記ゆらぎ（大文字・前後の空白・全角）は同じ uuid として受ける（201）", async () => {
    for (const make of [(u: string) => u.toUpperCase(), (u: string) => `  ${u}  `, fullWidth]) {
      const id = randomUUID();
      const r = await saveDraft({ draft_id: make(id), body: { title: "ゆらぎ" } });
      expect(r.status, await r.clone().text()).toBe(201);
      expect(String(((await json(r)).data as { draft_id: string }).draft_id).toLowerCase()).toBe(id);
      await conforms("saveMyTicketDraft", r);
    }
  });

  it("K144-API-017 チケットを作る：id の欄（グループ・種別・担当者・親・下書き・元の下書き）が uuid でないと 422・その欄。チケットは増えない", async () => {
    const tickets = await ticketsOf();
    for (const field of [
      "scope_id",
      "kind_id",
      "assignee_member_id",
      "parent_ticket_id",
      "draft_id",
      "source_draft_id",
    ]) {
      for (const v of NOT_UUID) {
        const r = await create(ticketBody({ [field]: v }));
        expect(r.status, `${field}=${JSON.stringify(v)}`).toBe(422);
        expect(fields(await json(r)), `${field}=${JSON.stringify(v)}`).toContain(field);
        await conforms("createTicket", r);
      }
    }
    expect(await ticketsOf()).toBe(tickets);
  });

  it("K144-API-018 チケットを作る：知らせる人の並びに uuid でない値が 1 つでもあると 422・欄は notify_member_ids の中。チケットは増えない", async () => {
    const tickets = await ticketsOf();
    const r = await create(ticketBody({ notify_member_ids: [mate.id, "------------------------------------"] }));
    expect(r.status).toBe(422);
    expect(fields(await json(r)).some((x) => x.startsWith("notify_member_ids"))).toBe(true);
    await conforms("createTicket", r);
    expect(await ticketsOf()).toBe(tickets);
  });

  it("K144-API-019 チケットを作る：無い親（正式な uuid）は 404・E-PAGE-001。契約の 404 にある", async () => {
    const r = await create(ticketBody({ parent_ticket_id: randomUUID() }));
    expect(r.status).toBe(404);
    expect((await json(r))["code"]).toBe("E-PAGE-001");
    await conforms("createTicket", r);
  });

  it("K144-API-020 PC の引き取り：machine_id が uuid でない（36 個のハイフン・版の桁が 0 ほか）は 422・欄 machine_id。コードは使い終わりにならない。大文字・null・送らないは受ける", async () => {
    const p = await newPerson();
    const code = await pair(p);
    for (const v of NOT_UUID) {
      const r = await claim(code, { machine_id: v });
      expect(r.status, JSON.stringify(v)).toBe(422);
      expect(fields(await json(r)), JSON.stringify(v)).toContain("machine_id");
      await conforms("claimPairingCode", r);
    }
    const m = randomUUID();
    const ok = await claim(code, { machine_id: m.toUpperCase() });
    expect(ok.status, await ok.clone().text()).toBe(201);
    const sid = ((await json(ok)).data as { device_id: string }).device_id;
    expect(
      (await f.admin.query<{ machine_id: string }>("select machine_id from sessions where id = $1", [sid])).rows[0]!
        .machine_id,
    ).toBe(m);
    expect((await claim(await pair(p), { machine_id: null })).status).toBe(201);
    expect((await claim(await pair(p))).status).toBe(201);
  });

  it("K144-API-021 道の id（/tickets/{id}）と一覧の scope_id が uuid でない：422・欄 id／scope_id。404 や 500 にしない", async () => {
    for (const v of ["------------------------------------", "3fa85f64-5717-0562-b3fc-2c963f66afa6"]) {
      const r = await f.req("GET", `/tickets/${v}`, { headers: writer.auth });
      expect(r.status, v).toBe(422);
      expect(fields(await json(r)), v).toContain("id");
      await conforms("getTicket", r);
      const m = await f.req("GET", `/members?scope_id=${v}`, { headers: writer.auth });
      expect(m.status, v).toBe(422);
      expect(fields(await json(m)), v).toContain("scope_id");
      await conforms("listMembers", m);
    }
  });
});
