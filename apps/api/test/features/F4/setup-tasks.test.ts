// K-250「はじめにやることの口」の単体の試験（口・本物の DB）。名前の頭の行 ID（K250-API-…）は 11_tickets/K-250.md の行の表と 1 対 1。
// 口：GET /api/v1/me/setup-tasks（listSetupTasks）→ { data: [{ key, label, desc, done, href, available, optional, skipped }], meta: { dismissed } }
//     POST /api/v1/me/setup-tasks/dismiss（dismissSetupTasks）→ 201
//       体 {}：箱を閉じる（members.setup_dismissed_at を最初の 1 回だけ立てる）
//       体 { key }：任意の項目（credentials）を「あとで」で飛ばす（members.setup_skipped_keys に重ねずに足す）。ほかの key は 422（欄 key）
// 項目は決定どおり 3 つ（D-125.146・D-128.62）：passkey（パスキー。機能ができるまで使えない）・pc（自分の PC）・credentials（預けたログイン情報）。
// 済みの判定は決める人の答え（D-145.11〜.13）と D-128.137：
//   passkey＝パスキーの機能ができるまで使えない（available false）・済みにしない（2 段階認証では済みにしない）／
//   pc＝一度でも知らせ（alive_at）が届き、外していない PC が在れば済み。外したら済んでいないに戻す・電源を切っただけ（知らせが古い）なら済み（D-145.12・answer=20e64d6fae6d）。PC はアカウント全体で使える（D-128.137）ので、同じログインの人の別の会社でつないだ PC も数える／
//   credentials＝任意（optional）で本人が飛ばせる（skipped）。預けた場合は今の会社で自分が預け、取り消し・消していないものが 1 つ以上で済み（PM の決め）
// 試験ごとに別の会社と人を作る。PC は前からある口（pairing-codes → claim → heartbeat）でつなぐ。外すのは DB で revoked_at を立てる（外す口は K-91）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { migrateAuth } from "@kaname/auth/migrate";
import { setupTaskHooks } from "../../../src/hooks/setup-tasks.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
const ADMIN = process.env["DATABASE_URL"]!;

type Task = {
  key: string;
  label: string;
  desc: string;
  done: boolean;
  href: string | null;
  available: boolean;
  optional: boolean;
  skipped: boolean;
};
type Page = { data: Task[]; meta: { dismissed: boolean } };

async function person(name = "高本"): Promise<{ p: Person; tenantId: string; root: string; authUserId: string }> {
  const c = await f.company(`K250 の会社 ${randomUUID().slice(0, 6)}`, "EG");
  const authUserId = randomUUID();
  await f.admin.query(
    'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
    [authUserId, name, `${authUserId}@example.com`],
  );
  const p = await f.person(c.tenantId, c.rootScope, { name, ticketAbility: "edit", authUserId });
  return { p, tenantId: c.tenantId, root: c.rootScope, authUserId };
}
const list = (p: Person, headers: Record<string, string> = {}) =>
  f.req("GET", "/me/setup-tasks", { headers: { ...p.auth, ...headers } });
async function listOk(p: Person): Promise<Page> {
  const r = await list(p);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await r.json()) as Page;
}
const doneOf = (pg: Page) => Object.fromEntries(pg.data.map((t) => [t.key, t.done]));
const skip = (p: Person, key: unknown, headers: Record<string, string> = {}) =>
  f.req("POST", "/me/setup-tasks/dismiss", {
    body: key === undefined ? { key: "" } : { key },
    headers: { ...p.auth, ...headers },
  });
const skippedKeys = async (id: string) =>
  (await f.admin.query<{ k: string[] }>("select setup_skipped_keys as k from members where id = $1", [id])).rows[0]!.k;
const dismissedAt = async (id: string) =>
  (await f.admin.query<{ t: string | null }>("select setup_dismissed_at::text as t from members where id = $1", [id]))
    .rows[0]!.t;
const dismiss = (p: Person, headers: Record<string, string> = {}) =>
  f.req("POST", "/me/setup-tasks/dismiss", { body: {}, headers: { ...p.auth, ...headers } });

/** 前からある口で PC をつなぐ（コード → 引き取り）。beat を true にすると知らせを 1 回送る */
async function connectPc(p: Person, beat: boolean): Promise<{ token: string; deviceId: string }> {
  const code = (
    (await (await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: p.auth })).json()) as {
      data: { code: string };
    }
  ).data.code;
  const r = await f.req("POST", "/bridge/claim", { body: { code, device_label: "高本の MacBook" }, ip: nextIp() });
  expect(r.status, await r.clone().text()).toBe(201);
  const d = ((await r.json()) as { data: { device_token: string; device_id: string } }).data;
  if (beat) {
    const b = await f.req("POST", "/bridge/heartbeat", {
      body: { health: [], protocol: 5, version: "1.4.0" },
      headers: { "x-bridge-session": d.device_token },
    });
    expect(b.status, await b.clone().text()).toBe(201);
  }
  return { token: d.device_token, deviceId: d.device_id };
}
async function addCredential(tenantId: string, scopeId: string, owner: string): Promise<string> {
  return (
    await f.admin.query<{ id: string }>(
      "insert into credentials (tenant_id, scope_id, owner_member_id, vault_ref) values ($1, $2, $3, 'vault://k250') returning id",
      [tenantId, scopeId, owner],
    )
  ).rows[0]!.id;
}

beforeAll(async () => {
  await migrateAuth(ADMIN);
  f = await makeFixture([setupTaskHooks]);
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-250 はじめにやることの口", () => {
  it("K250-API-001 登録したばかりの人：3 つが passkey・pc・credentials の順・どれも済んでいない・パスキーは使えない（行き先は空・説明はキャンバスの字）・預けるは任意・閉じていない", async () => {
    const { p } = await person();
    const pg = await listOk(p);
    expect(pg.data.map((t) => [t.key, t.label, t.href, t.available, t.optional, t.skipped])).toEqual([
      ["passkey", "パスキーを付ける", null, false, false, false],
      ["pc", "PC をつなぐ", "/setup/bridge", true, false, false],
      ["credentials", "ログイン情報を預ける", "/settings/credentials", true, true, false],
    ]);
    expect(pg.data.every((t) => t.done === false)).toBe(true);
    expect(pg.data.find((t) => t.key === "passkey")!.desc).toBe("まだ付けられません。数には入れていません");
    expect(pg.data.find((t) => t.key === "pc")!.desc).toBe(
      "分身はあなたの PC で動く。つなぐまで、分身は話すだけで実行はしない",
    );
    expect(pg.data.find((t) => t.key === "credentials")!.desc).toBe(
      "分身に使わせるメール・サービスのログイン。値は誰にも見せない",
    );
    expect(pg.meta).toEqual({ dismissed: false });
  });

  it("K250-API-002 2 段階認証を有効にした人：パスキーは済みにならず使えないまま（D-145.11）", async () => {
    const { p, authUserId } = await person();
    await f.admin.query('update kaname_auth."user" set "twoFactorEnabled" = true where id = $1', [authUserId]);
    const pg = await listOk(p);
    expect(doneOf(pg)).toEqual({ passkey: false, pc: false, credentials: false });
    expect(pg.data.find((t) => t.key === "passkey")!.available).toBe(false);
    expect(JSON.stringify(pg)).not.toContain("付けました");
  });

  it("K250-API-003 PC：引き取っただけ（知らせが 0 回）は済んでいない・知らせが届くと済み・電源を切っただけ（知らせが古い）なら済み・外したら済んでいないに戻る（answer=20e64d6fae6d）", async () => {
    const { p } = await person();
    const d = await connectPc(p, false);
    expect(doneOf(await listOk(p))["pc"]).toBe(false);
    const b = await f.req("POST", "/bridge/heartbeat", {
      body: { health: [], protocol: 5, version: "1.4.0" },
      headers: { "x-bridge-session": d.token },
    });
    expect(b.status, await b.clone().text()).toBe(201);
    expect(doneOf(await listOk(p))["pc"]).toBe(true);
    // 電源を切った：最後に見えた時刻が古い（つながっている扱いの 75 秒を過ぎた）。外していないので済みのまま
    const asleep = await f.admin.query(
      "update sessions set last_seen_at = now() - interval '1 day' where member_id = $1 and kind_id = 'bridge' and revoked_at is null",
      [p.id],
    );
    expect(asleep.rowCount).toBe(1);
    expect(doneOf(await listOk(p))["pc"]).toBe(true);
    // 外す口（revokeMyDevice）は K-91。ここでは外した状態を DB で作る
    const off = await f.admin.query(
      "update sessions set revoked_at = now(), revoke_reason_id = 'admin' where member_id = $1 and kind_id = 'bridge' and revoked_at is null",
      [p.id],
    );
    expect(off.rowCount).toBe(1);
    expect(doneOf(await listOk(p))["pc"]).toBe(false);
  });

  it("K250-API-004 ログイン情報：自分の預けた物が在れば済み。取り消した・消した・他の人の物だけなら済んでいない", async () => {
    const { p, tenantId, root } = await person();
    const mate = await f.person(tenantId, root, { name: "山田" });
    await addCredential(tenantId, root, mate.id);
    expect(doneOf(await listOk(p))["credentials"]).toBe(false);
    const mine = await addCredential(tenantId, root, p.id);
    expect(doneOf(await listOk(p))["credentials"]).toBe(true);
    await f.admin.query("update credentials set revoked_at = now() where id = $1", [mine]);
    expect(doneOf(await listOk(p))["credentials"]).toBe(false);
    const gone = await addCredential(tenantId, root, p.id);
    await f.admin.query("update credentials set deleted_at = now() where id = $1", [gone]);
    expect(doneOf(await listOk(p))["credentials"]).toBe(false);
  });

  it("K250-API-005 同じログインの人が 2 つの会社に入っている：別の会社でつないだ PC は今の会社でも済み（アカウント全体）・預けた物は済ませた会社だけ", async () => {
    const a = await person();
    const other = await f.company(`K250 の別の会社 ${randomUUID().slice(0, 6)}`, "OT");
    const there = await f.alsoIn(a.p, other.tenantId, other.rootScope);
    await connectPc(there, true);
    await addCredential(other.tenantId, other.rootScope, there.id);
    expect(doneOf(await listOk(there))).toMatchObject({ pc: true, credentials: true });
    expect(doneOf(await listOk(a.p))).toMatchObject({ pc: true, credentials: false });
    // ほかの人の PC は数えない
    const stranger = await person("別の人");
    expect(doneOf(await listOk(stranger.p))["pc"]).toBe(false);
  });

  it("K250-API-006 閉じる：201 で答えは { dismissed: true, skipped: [] }・次の一覧で dismissed が true・2 回目も 201 で閉じた時刻は最初のまま・同じ冪等キーの 2 回目は同じ答えで違う体は 409・同じ会社の別の人は閉じていない", async () => {
    const { p, tenantId, root } = await person();
    const mate = await f.person(tenantId, root, { name: "山田" });
    const r1 = await dismiss(p);
    expect(r1.status).toBe(201);
    expect(((await r1.json()) as { data: unknown }).data).toEqual({ dismissed: true, skipped: [] });
    expect((await listOk(p)).meta.dismissed).toBe(true);
    const first = (
      await f.admin.query<{ t: string }>("select setup_dismissed_at::text as t from members where id = $1", [p.id])
    ).rows[0]!.t;
    expect(first).toBeTruthy();
    expect((await dismiss(p)).status).toBe(201);
    const again = (
      await f.admin.query<{ t: string }>("select setup_dismissed_at::text as t from members where id = $1", [p.id])
    ).rows[0]!.t;
    expect(again).toBe(first);
    expect((await listOk(mate)).meta.dismissed).toBe(false);
    // 同じ冪等キーで 2 回：2 回目は最初の答え。同じキーで体を変えると 409 で何も書かない
    const { p: q } = await person("冪等の人");
    const key = randomUUID();
    const h = { "idempotency-key": key };
    const a1 = await dismiss(q, h);
    const a2 = await dismiss(q, h);
    expect([a1.status, a2.status]).toEqual([201, 201]);
    expect(await a2.json()).toEqual(await a1.json());
    const clash = await skip(q, "credentials", h);
    expect(clash.status).toBe(409);
    expect(await skippedKeys(q.id)).toEqual([]);
  });

  it("K250-API-007 答えの形：1 件の鍵はちょうど key・label・desc・done・href・available・optional・skipped・meta は dismissed だけ（預けた物の参照や PC の印を返さない）", async () => {
    const { p, tenantId, root } = await person();
    await addCredential(tenantId, root, p.id);
    await connectPc(p, true);
    const raw = await (await list(p)).text();
    const pg = JSON.parse(raw) as Page;
    for (const t of pg.data)
      expect(Object.keys(t).sort()).toEqual([
        "available",
        "desc",
        "done",
        "href",
        "key",
        "label",
        "optional",
        "skipped",
      ]);
    expect(Object.keys(pg.meta)).toEqual(["dismissed"]);
    expect(raw).not.toContain("vault://");
    expect(raw).not.toContain("kpc_");
  });

  it("K250-API-008 取引先の人・運営の人は 403（一覧も閉じるも飛ばすも）・閉じた時刻も飛ばした印も立たない", async () => {
    const { p } = await person();
    for (const role of ["client", "ops"] as const) {
      expect((await list(p, f.as(p, role))).status, role).toBe(403);
      expect((await dismiss(p, f.as(p, role))).status, role).toBe(403);
      expect((await skip(p, "credentials", f.as(p, role))).status, role).toBe(403);
    }
    expect(await dismissedAt(p.id)).toBeNull();
    expect(await skippedKeys(p.id)).toEqual([]);
  });

  it("K250-API-009 ログインしていない：401（一覧も閉じるも）。同意し直しが要るセッション：403・E-AUTH-010 で何も書かない", async () => {
    expect((await f.req("GET", "/me/setup-tasks")).status).toBe(401);
    expect((await f.req("POST", "/me/setup-tasks/dismiss", { body: {} })).status).toBe(401);
    expect((await f.req("POST", "/me/setup-tasks/dismiss", { body: { key: "credentials" } })).status).toBe(401);
    const { p } = await person();
    for (const r of [
      await list(p, f.pending(p)),
      await dismiss(p, f.pending(p)),
      await skip(p, "credentials", f.pending(p)),
    ]) {
      expect(r.status).toBe(403);
      expect(((await r.json()) as { code?: string }).code).toBe("E-AUTH-010");
    }
    expect(await dismissedAt(p.id)).toBeNull();
    expect(await skippedKeys(p.id)).toEqual([]);
  });

  it("K250-API-010 預けるを飛ばす：201・skipped が true（done は false のまま）・2 回目も 201 で印は 1 つだけ・同じ会社の別の人は飛ばしていない・後で預けると done も true", async () => {
    const { p, tenantId, root } = await person();
    const mate = await f.person(tenantId, root, { name: "山田" });
    expect((await skip(p, "credentials")).status).toBe(201);
    let c = (await listOk(p)).data.find((t) => t.key === "credentials")!;
    expect([c.skipped, c.done]).toEqual([true, false]);
    expect((await skip(p, "credentials")).status).toBe(201);
    expect(await skippedKeys(p.id)).toEqual(["credentials"]);
    expect(await dismissedAt(p.id)).toBeNull(); // 飛ばすのは箱を閉じない
    expect((await listOk(mate)).data.find((t) => t.key === "credentials")!.skipped).toBe(false);
    await addCredential(tenantId, root, p.id);
    c = (await listOk(p)).data.find((t) => t.key === "credentials")!;
    expect([c.skipped, c.done]).toEqual([true, true]);
  });

  it("K250-API-011 任意でない項目（passkey・pc）・知らない key・空の key・知らない欄・一覧の limit=0 は 422（欄 key／その欄／limit）・DB に何も残らず箱も閉じない", async () => {
    const { p } = await person();
    for (const key of ["passkey", "pc", "other", undefined]) {
      const r = await skip(p, key);
      expect(r.status, String(key)).toBe(422);
      const fields = (((await r.json()) as { details?: { field: string }[] }).details ?? []).map((d) => d.field);
      expect(fields, String(key)).toContain("key");
    }
    const badLimit = await f.req("GET", "/me/setup-tasks?limit=0", { headers: p.auth });
    expect(badLimit.status).toBe(422);
    expect(
      (((await badLimit.json()) as { details?: { field: string }[] }).details ?? []).map((d) => d.field),
    ).toContain("limit");
    const extra = await f.req("POST", "/me/setup-tasks/dismiss", { body: { kind_id: "x" }, headers: p.auth });
    expect(extra.status).toBe(422);
    expect((((await extra.json()) as { details?: { field: string }[] }).details ?? []).map((d) => d.field)).toContain(
      "kind_id",
    );
    expect((await listOk(p)).data.every((t) => t.skipped === false)).toBe(true);
    expect(await skippedKeys(p.id)).toEqual([]);
    expect(await dismissedAt(p.id)).toBeNull();
  });

  it("K250-API-012 飛ばす key の表記ゆらぎ（前後の空白・大文字・全角）はそろえて受ける：どれも 201・印はちょうど credentials 1 つ", async () => {
    const { p } = await person();
    for (const key of ["  credentials ", "CREDENTIALS", "ｃｒｅｄｅｎｔｉａｌｓ"]) {
      const r = await skip(p, key);
      expect(r.status, key).toBe(201);
    }
    expect(await skippedKeys(p.id)).toEqual(["credentials"]);
    expect((await listOk(p)).data.find((t) => t.key === "credentials")!.skipped).toBe(true);
  });

  it("K250-API-013 上限を超えると 429・待つ秒数（一覧も閉じるも）", async () => {
    const { p } = await person();
    for (const [op, call] of [
      ["listSetupTasks", () => list(p)],
      ["dismissSetupTasks", () => dismiss(p)],
    ] as const) {
      const saved = f.limits[op];
      f.limits[op] = 2;
      try {
        let last: Response | null = null;
        for (let i = 0; i < 3; i += 1) last = await call();
        expect(last!.status, op).toBe(429);
        expect(((await last!.json()) as { retry_after_sec?: number }).retry_after_sec, op).toBeGreaterThan(0);
      } finally {
        if (saved === undefined) delete f.limits[op];
        else f.limits[op] = saved;
      }
    }
  });

  it("K250-API-014 セッションの人が今の会社のメンバーでない（別の会社のメンバー・無い人）：一覧も閉じるも飛ばすも 403・FORBIDDEN。どの会社の members にも閉じた時刻・飛ばした印を書かない", async () => {
    const { tenantId } = await person("今の会社の人");
    const other = await person("別の会社の人");
    for (const [label, who] of [
      ["別の会社のメンバー", other.p.id],
      ["無い人", randomUUID()],
    ] as const) {
      const h = { authorization: `Bearer fake:member:${tenantId}:${who}` };
      for (const r of [
        await f.req("GET", "/me/setup-tasks", { headers: h }),
        await f.req("POST", "/me/setup-tasks/dismiss", { body: {}, headers: h }),
        await f.req("POST", "/me/setup-tasks/dismiss", { body: { key: "credentials" }, headers: h }),
      ]) {
        expect(r.status, label).toBe(403);
        expect(((await r.json()) as { code?: string }).code, label).toBe("FORBIDDEN");
      }
    }
    expect(await dismissedAt(other.p.id)).toBeNull();
    expect(await skippedKeys(other.p.id)).toEqual([]);
  });
});
