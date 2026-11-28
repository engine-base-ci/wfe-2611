// K-881「チケットの見せる相手（ゲストのグループ）の表と、見せる相手を読む・付け外しする口（listTicketGuestShares・updateTicketGuestShares）」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン）。行 ID（K881-API-…）は 11_tickets/K-881.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/ticket-guest-shares.ts の register（K-326）。
// 試験が決める口の形（契約は 05_flow/screen_api.d/K-881.py で作る）:
//   listTicketGuestShares   GET   /api/v1/tickets/:id/guest-shares   200 { data: { shared: [{ guest_group_id, name, summary }], choices: [{ id, name, summary }], can_change } }
//     shared＝今見せているゲストのグループ（名前の順）。choices＝まだ見せていないグループ（名前の順）。choices はチケットに書ける人（担当者・マネージャー・書く権限のある人）にだけ出し、読むだけの人には []
//   updateTicketGuestShares PATCH /api/v1/tickets/:id/guest-shares   body { add?: uuid[]（1〜20）, remove?: uuid[]（1〜20）}（どちらか 1 つは要る・知らない欄は 422＝1 人ずつ・項目ごとは持たない。同じ id が両方にあれば先に外してから足す＝足す方が勝つ）
//     200 { data: { shared: [{ guest_group_id, name, summary }] } }（付け外しの後の全部）。同じ物を足す・無い物を外すは何も変えず 200（冪等）
//     断る：道の id のチケットが見えない・無い・消した・別の会社は入口の 404（NOT_FOUND・欄なし）／書けないのは入口の 403（FORBIDDEN）／
//          見せる相手が無い・消した・別の会社は口の 404・E-GST-040（欄・details なし）／結果が 20 を超える 409・E-GST-041／503 E-PAGE-003
//     見せたら、そのグループのゲスト（今いる・止めていない人）の受け箱（notifications・channel inapp・種類 ticket.guest_shared）に 1 件ずつ入る。メールは送らない。外しても送らない（D-155.45）
//     見せる相手を持つチケットだけがゲストに見える（芯：チケットはチケット・D-155.41）。見えるのは題・本文・詳細・チャットと段の札 3 つ（中身の形は先方の口 K-906・K-882）
// DB（migration 20261127094100_ticket_guest_shares.sql）:
//   ticket_guest_shares（id・tenant_id・ticket_id・guest_group_id・shared_by・監査の列・deleted_at。消していない物は (ticket_id, guest_group_id) で一意）
//   app.guest_sees_ticket(tid)（K-878）を「見せる相手に自分のグループが選ばれた」だけに作り直す（K-878 の橋＝依頼から作ったチケットの枝は外す。依頼から作るときの見せる相手は K-894 が入れる）
//   app.ticket_guest_shares_drop_group(p_group) … ゲストのグループを消すとき K-927 が同じ取引の中で呼ぶ：そのグループの見せる相手の行を外す（件数を返す）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const HOOKS_DIR = join(HERE, "..", "..", "..", "src", "hooks");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (code: string): string => ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${code} が無い）`;
const NO_SUCH = "00000000-0000-4000-8000-0000000000bb";

let f: Fixture;
let loaded = false;
/** 口に渡すメール送りの偽。見せても外しても 1 通も送らないことを見る（K881-API-015） */
const mails: unknown[] = [];
async function ready(): Promise<void> {
  if (loaded) return;
  const m = (await import(join(HOOKS_DIR, "ticket-guest-shares.ts"))) as { register: HookModule };
  const mailer = async (x: unknown) => {
    mails.push(x);
  };
  Object.assign(f.hooks, m.register.make({ appPool: f.pool, mailer } as unknown as HookDeps));
  loaded = true;
}
beforeAll(async () => {
  f = await makeFixture([]);
}, 60_000);
afterAll(async () => {
  await f?.close();
});

type Json = Record<string, unknown>;
const asJson = async (r: Response): Promise<Json> => (await r.clone().json()) as Json;
const bare = (j: Json): void => {
  for (const k of ["field", "details", "detail"]) expect(Object.keys(j), `${k} を付けない`).not.toContain(k);
};
interface Share {
  guest_group_id: string;
  name: string;
  summary: string;
}
/** グループの人の要約（K-905 の画面がそのまま出す）。ゲストが 0 人で招待中も 0 なら NO_GUESTS。今いるゲストの名前を名前の順（コード順）に最大 2 人・「 様」を付けて「・」でつなぎ、3 人以上なら「 ほか」・最後に「（N 人」と、招待中が 1 以上なら「・招待中 M」と「）」 */
const NO_GUESTS = "まだゲストはいません";
interface World {
  tenantId: string;
  root: string;
  g1: string;
  g2: string;
  boss: Person; // 全体に書ける
  e1: Person; // g1 に書ける（g2 は見えない）
  e2: Person; // g2 に書ける（g1 は見えない）
  viewer: Person; // g1 を読むだけ
}
async function world(): Promise<World> {
  await ready();
  const c = await f.company(`K881 の会社 ${Math.random().toString(36).slice(2, 7)}`, "GS");
  const grp = async (name: string, prefix: string) =>
    (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, $2, $3, $4) returning id",
        [c.tenantId, name, prefix, c.rootScope],
      )
    ).rows[0]!.id;
  const g1 = await grp("営業", "GA");
  const g2 = await grp("受託開発", "GB");
  return {
    tenantId: c.tenantId,
    root: c.rootScope,
    g1,
    g2,
    boss: await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" }),
    e1: await f.person(c.tenantId, g1, { name: "営業の人", ticketAbility: "edit" }),
    e2: await f.person(c.tenantId, g2, { name: "開発の人", ticketAbility: "edit" }),
    viewer: await f.person(c.tenantId, g1, { name: "読むだけの人", ticketAbility: "view" }),
  };
}
const ticket = async (w: World, scope: string, o: { assignee?: string; deleted?: boolean } = {}): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, deleted_at)
       select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'),
              (select id from ticket_stages where tenant_id = $1 and key = 'todo'), '見せるチケット', $3, $4
       returning id`,
      [w.tenantId, scope, o.assignee ?? null, o.deleted ? new Date() : null],
    )
  ).rows[0]!.id;
/** ゲストのグループを 1 つ作る（届け先は同じ会社のいちばん上のグループ。別の会社に作るときは scope にその会社のいちばん上のグループを渡す） */
const gg = async (
  w: World,
  name: string,
  o: { tenant?: string; scope?: string; deleted?: boolean } = {},
): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      "insert into guest_groups (tenant_id, name, request_scope_id, deleted_at) values ($1, $2, $3, $4) returning id",
      [o.tenant ?? w.tenantId, name, o.scope ?? w.root, o.deleted ? new Date() : null],
    )
  ).rows[0]!.id;
/** ゲスト（役割 requester）を 1 人作り、グループに入れる */
const guest = async (w: World, name: string, g: string): Promise<Person> => {
  const p = await f.person(w.tenantId, w.root, { name });
  await f.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, null, 'requester', 'active')",
    [w.tenantId, p.id],
  );
  await f.admin.query("insert into guest_group_members (tenant_id, guest_group_id, member_id) values ($1, $2, $3)", [
    w.tenantId,
    g,
    p.id,
  ]);
  return p;
};
const get = (id: string, p: Person | null, role: "member" | "client" = "member") =>
  f.req("GET", `/tickets/${id}/guest-shares`, p ? { headers: f.as(p, role) } : {});
const patch = (id: string, body: unknown, p: Person | null, role: "member" | "client" = "member") =>
  f.req("PATCH", `/tickets/${id}/guest-shares`, { body, ...(p ? { headers: f.as(p, role) } : {}) });
const sharedOf = async (r: Response): Promise<Share[]> => ((await asJson(r)).data as { shared: Share[] }).shared;
const n = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const active = (t: string) =>
  n("select count(*) as n from ticket_guest_shares where ticket_id = $1 and deleted_at is null", [t]);
const asGuest = (w: World, p: Person): TenantContext => ({
  tenantId: w.tenantId,
  userId: p.id,
  role: "client",
  stepUpAt: null,
});
const guestSees = async (w: World, p: Person, t: string): Promise<number> =>
  withTenant(
    f.pool,
    asGuest(w, p),
    async (cl) => (await cl.query("select id from tickets where id = $1", [t])).rowCount ?? 0,
  );
async function failOn(table: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k881_fail_${randomUUID().replaceAll("-", "")}`;
  await f.admin.query(
    `create function app.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'K881 試験の失敗'; end if; return new; end $$`,
  );
  await f.admin.query(`create trigger ${name} before insert on ${table} for each row execute function app.${name}()`);
  try {
    await fn();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on ${table}`);
    await f.admin.query(`drop function if exists app.${name}()`);
  }
}

describe("K-881 見せる相手を読む（listTicketGuestShares）", () => {
  it("K881-API-001 読む：見せている 2 つと、まだ見せていない選べる物が名前の順で出る。鍵はちょうど（shared・choices・can_change／guest_group_id・name・summary／id・name・summary）。人の要約（summary）は「名前 様・名前 様 ほか（N 人・招待中 M）」の形。消したグループ・別の会社のグループは出ない", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const [a, b, c] = [await gg(w, "Ａ社"), await gg(w, "Ｂ社"), await gg(w, "Ｃ社")];
    await gg(w, "消した社", { deleted: true });
    const other = await f.company("K881 別の会社", "OX");
    await gg(w, "別の会社のグループ", { tenant: other.tenantId, scope: other.rootScope });
    for (const name of ["あ 花子", "い 健太", "う 一郎"]) await guest(w, name, a);
    await f.admin.query(
      "insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, guest_group_id) values ($1, $2, null, 'requester', $3, now() + interval '7 days', $4)",
      [w.tenantId, `pending-${randomUUID().slice(0, 6)}@guest.example`, randomUUID(), a],
    );
    for (const g of [b, a])
      await f.admin.query(
        "insert into ticket_guest_shares (tenant_id, ticket_id, guest_group_id, shared_by) values ($1, $2, $3, $4)",
        [w.tenantId, t, g, w.boss.id],
      );
    const r = await get(t, w.boss);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await asJson(r)).data as {
      shared: Share[];
      choices: { id: string; name: string; summary: string }[];
      can_change: boolean;
    };
    expect(Object.keys(d).sort()).toEqual(["can_change", "choices", "shared"]);
    expect(d.can_change).toBe(true);
    expect(d.shared).toEqual([
      { guest_group_id: a, name: "Ａ社", summary: "あ 花子 様・い 健太 様 ほか（3 人・招待中 1）" },
      { guest_group_id: b, name: "Ｂ社", summary: NO_GUESTS },
    ]);
    expect(d.choices).toEqual([{ id: c, name: "Ｃ社", summary: NO_GUESTS }]);
  });

  it("K881-API-002 0 件：何も見せていないチケットは shared が空・choices は会社のグループ全部。グループが 1 つも無い会社は両方空", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    expect((await asJson(await get(t, w.boss))).data).toEqual({ shared: [], choices: [], can_change: true });
    const g = await gg(w, "唯一の社");
    expect((await asJson(await get(t, w.boss))).data).toEqual({
      shared: [],
      choices: [{ id: g, name: "唯一の社", summary: NO_GUESTS }],
      can_change: true,
    });
  });

  it("K881-API-003 読める人の範囲：書ける人（全体・そのグループ）は choices 付き・読むだけの人は shared だけで choices は空・見えない人と別の会社の人は 404（NOT_FOUND）・ゲストの文脈は 403・ログインしていない人は 401", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const g = await gg(w, "範囲の社");
    for (const p of [w.boss, w.e1]) {
      const d = (await asJson(await get(t, p))).data as { choices: unknown[]; can_change: boolean };
      expect(d.choices, p.id).toHaveLength(1);
      expect(d.can_change, `${p.id} は書ける人`).toBe(true);
    }
    const v = await get(t, w.viewer);
    expect(v.status).toBe(200);
    expect((await asJson(v)).data).toEqual({ shared: [], choices: [], can_change: false });
    const hidden = await get(t, w.e2);
    expect(hidden.status).toBe(404);
    expect((await asJson(hidden))["code"]).toBe("NOT_FOUND");
    const other = await f.company("K881 範囲外", "OY");
    const stranger = await f.person(other.tenantId, other.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    expect((await get(t, stranger)).status).toBe(404);
    const gst = await guest(w, "ゲスト", g);
    expect((await get(t, gst, "client")).status).toBe(403);
    expect((await get(t, null)).status).toBe(401);
  });
});

describe("K-881 見せる相手を付け外しする（updateTicketGuestShares）", () => {
  it("K881-API-004 足す：2 つ足すと 200・shared が名前の順で 2 つ。DB は消していない行が 2 つで、shared_by は足した人・tenant_id と ticket_id が入る", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const [a, b] = [await gg(w, "Ａ社"), await gg(w, "Ｂ社")];
    const r = await patch(t, { add: [b, a] }, w.boss);
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await sharedOf(r)).map((x) => x.guest_group_id)).toEqual([a, b]);
    const rows = (
      await f.admin.query(
        "select tenant_id, ticket_id, shared_by from ticket_guest_shares where ticket_id = $1 and deleted_at is null",
        [t],
      )
    ).rows;
    expect(rows).toHaveLength(2);
    for (const x of rows) expect(x).toEqual({ tenant_id: w.tenantId, ticket_id: t, shared_by: w.boss.id });
  });

  it("K881-API-005 外す：1 つ外すと shared から消える。DB の行は消さずに deleted_at を付け、もう 1 つは生きたまま", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const [a, b] = [await gg(w, "Ａ社"), await gg(w, "Ｂ社")];
    await patch(t, { add: [a, b] }, w.boss);
    const r = await patch(t, { remove: [a] }, w.boss);
    expect((await sharedOf(r)).map((x) => x.guest_group_id)).toEqual([b]);
    const rows = (
      await f.admin.query<{ guest_group_id: string; deleted_at: Date | null }>(
        "select guest_group_id, deleted_at from ticket_guest_shares where ticket_id = $1",
        [t],
      )
    ).rows;
    expect(rows.find((x) => x.guest_group_id === a)!.deleted_at).not.toBeNull();
    expect(rows.find((x) => x.guest_group_id === b)!.deleted_at).toBeNull();
  });

  it("K881-API-006 同じ物を重ねて足す（冪等）：2 回とも 200・生きている行は 1 つのまま。外してからもう一度足すと新しく生きる行ができる", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const a = await gg(w, "Ａ社");
    expect((await patch(t, { add: [a] }, w.boss)).status).toBe(200);
    expect((await patch(t, { add: [a] }, w.boss)).status).toBe(200);
    expect(await active(t)).toBe(1);
    await patch(t, { remove: [a] }, w.boss);
    expect(await active(t)).toBe(0);
    await patch(t, { add: [a] }, w.boss);
    expect(await active(t)).toBe(1);
    expect(await n("select count(*) as n from ticket_guest_shares where ticket_id = $1", [t])).toBe(2);
  });

  it("K881-API-007 元から無い物を外す：200・何も変わらない（行も証跡も増えない）", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const a = await gg(w, "Ａ社");
    const before = await n("select count(*) as n from audit_events where tenant_id = $1", [w.tenantId]);
    const r = await patch(t, { remove: [a] }, w.boss);
    expect(r.status).toBe(200);
    expect(await sharedOf(r)).toEqual([]);
    expect(await n("select count(*) as n from ticket_guest_shares where ticket_id = $1", [t])).toBe(0);
    expect(await n("select count(*) as n from audit_events where tenant_id = $1", [w.tenantId])).toBe(before);
  });

  it("K881-API-008 入力の形（422）：どちらも空・体が空・21 個・uuid でない・知らない欄（1 人ずつの member_ids・項目ごとの items）。何も変えない。同じ id が 2 つあれば 1 つにして通る。足す物と外す物が重なれば先に外してから足す（足す方が勝つ）", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const a = await gg(w, "Ａ社");
    const bad: [string, unknown][] = [
      ["空", { add: [], remove: [] }],
      ["体が空", {}],
      ["21 個", { add: Array.from({ length: 21 }, () => randomUUID()) }],
      ["uuid でない", { add: ["abc"] }],
      ["1 人ずつ", { add: [a], member_ids: [randomUUID()] }],
      ["項目ごと", { add: [a], items: ["body"] }],
    ];
    for (const [label, body] of bad) {
      const r = await patch(t, body, w.boss);
      expect(r.status, label).toBe(422);
    }
    expect(await active(t)).toBe(0);
    const ok = await patch(t, { add: [a, a] }, w.boss);
    expect(ok.status, await ok.clone().text()).toBe(200);
    expect(await active(t)).toBe(1);
    const both = await patch(t, { add: [a], remove: [a] }, w.boss);
    expect((await sharedOf(both)).map((x) => x.guest_group_id)).toEqual([a]);
    expect(await active(t)).toBe(1);
  });

  it("K881-API-009 無い・消した・別の会社の見せる相手：404・E-GST-040（欄・details なし・正本の文）。足す 2 つのうち 1 つが無ければ、良い方も足さない（全部か無しか）", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const good = await gg(w, "Ａ社");
    const gone = await gg(w, "消した社", { deleted: true });
    const other = await f.company("K881 他社", "OZ");
    const foreign = await gg(w, "他社のグループ", { tenant: other.tenantId, scope: other.rootScope });
    for (const id of [gone, foreign, NO_SUCH]) {
      const r = await patch(t, { add: [good, id] }, w.boss);
      expect(r.status, id).toBe(404);
      const b = await asJson(r);
      expect(b["code"]).toBe("E-GST-040");
      expect(b["message"]).toBe(msg("E-GST-040"));
      bare(b);
      expect(await active(t), id).toBe(0);
    }
  });

  it("K881-API-010 見せる相手は 1 つのチケットに 20 まで：20 まで足せる・21 個目は 409・E-GST-041（欄・details なし）で何も変えない。外す物と足す物が同じ要求で、結果が 20 なら通る", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) ids.push(await gg(w, `社${String(i).padStart(2, "0")}`));
    expect((await patch(t, { add: ids.slice(0, 20) }, w.boss)).status).toBe(200);
    expect(await active(t)).toBe(20);
    const r = await patch(t, { add: [ids[20]!] }, w.boss);
    expect(r.status).toBe(409);
    const b = await asJson(r);
    expect(b["code"]).toBe("E-GST-041");
    bare(b);
    expect(await active(t)).toBe(20);
    const swap = await patch(t, { add: [ids[20]!], remove: [ids[0]!] }, w.boss);
    expect(swap.status, await swap.clone().text()).toBe(200);
    expect(await active(t)).toBe(20);
  });

  it("K881-API-011 権限：全体に書ける人・そのグループに書ける人・担当者は 200。読むだけの人は 403（FORBIDDEN）・チケットが見えない人と別の会社の人は 404（NOT_FOUND）・ゲストの文脈は 403・ログインしていない人は 401。足した物は 200 の人の分だけ", async () => {
    const w = await world();
    const a = await gg(w, "Ａ社");
    const tBoss = await ticket(w, w.g1);
    const tOwn = await ticket(w, w.g1, { assignee: w.viewer.id });
    expect((await patch(tBoss, { add: [a] }, w.boss)).status).toBe(200);
    expect((await patch(tBoss, { add: [a] }, w.e1)).status).toBe(200);
    expect((await patch(tOwn, { add: [a] }, w.viewer)).status).toBe(200);
    expect((await patch(tBoss, { remove: [a] }, w.viewer)).status).toBe(403);
    expect(await active(tBoss)).toBe(1);
    const hidden = await patch(tBoss, { add: [a] }, w.e2);
    expect(hidden.status).toBe(404);
    expect((await asJson(hidden))["code"]).toBe("NOT_FOUND");
    const other = await f.company("K881 権限外", "OW");
    const stranger = await f.person(other.tenantId, other.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    expect((await patch(tBoss, { add: [a] }, stranger)).status).toBe(404);
    const gst = await guest(w, "ゲスト", a);
    expect((await patch(tBoss, { remove: [a] }, gst, "client")).status).toBe(403);
    expect((await patch(tBoss, { remove: [a] }, null)).status).toBe(401);
    expect(await active(tBoss)).toBe(1);
  });

  it("K881-API-012 チケットが無い・消した：読むも付け外しも 404（NOT_FOUND）。何も書かない", async () => {
    const w = await world();
    const a = await gg(w, "Ａ社");
    const gone = await ticket(w, w.g1, { deleted: true });
    for (const t of [gone, NO_SUCH]) {
      expect((await get(t, w.boss)).status, t).toBe(404);
      const r = await patch(t, { add: [a] }, w.boss);
      expect(r.status, t).toBe(404);
      expect((await asJson(r))["code"]).toBe("NOT_FOUND");
    }
    expect(await n("select count(*) as n from ticket_guest_shares where tenant_id = $1", [w.tenantId])).toBe(0);
  });

  it("K881-API-013 証跡：足した 1 つごとに ticket.guest_share_added・外した 1 つごとに ticket.guest_share_removed を 1 行（payload は ticket_id と guest_group_id だけ・グループの名前は載せない）。変わらなければ書かない", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const [a, b] = [await gg(w, "秘密の名前Ａ"), await gg(w, "秘密の名前Ｂ")];
    await patch(t, { add: [a, b] }, w.boss);
    await patch(t, { add: [a] }, w.boss);
    await patch(t, { remove: [b] }, w.boss);
    const ev = async (action: string) =>
      (
        await f.admin.query<{ payload: Record<string, unknown> }>(
          "select payload from audit_events where tenant_id = $1 and action = $2 and target_id = $3",
          [w.tenantId, action, t],
        )
      ).rows;
    const added = await ev("ticket.guest_share_added");
    const removed = await ev("ticket.guest_share_removed");
    expect(added.map((x) => x.payload["guest_group_id"]).sort()).toEqual([a, b].sort());
    expect(removed.map((x) => x.payload["guest_group_id"])).toEqual([b]);
    for (const x of [...added, ...removed]) {
      expect(Object.keys(x.payload).sort()).toEqual(["guest_group_id", "ticket_id"]);
      expect(JSON.stringify(x.payload)).not.toContain("秘密の名前");
    }
  });

  it("K881-API-014 同時に同じ物を足す：2 本とも 200・生きている行は 1 つ", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const a = await gg(w, "Ａ社");
    const rs = await Promise.all([patch(t, { add: [a] }, w.boss), patch(t, { add: [a] }, w.e1)]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    expect(await active(t)).toBe(1);
  });

  it("K881-API-015 見せたら、そのグループのゲストの受け箱に 1 件ずつ入る（今いる・止めていない人だけ・別のグループの人・止めた人には入らない）。メールは送らない。もう一度足しても外しても増えない・外して足し直すとまた 1 件。中身は ticket_id・number・title・url だけ（期限・担当は載せない）", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const [a, b] = [await gg(w, "Ａ社"), await gg(w, "Ｂ社")];
    const [a1, a2, b1] = [await guest(w, "Ａの 1", a), await guest(w, "Ａの 2", a), await guest(w, "Ｂの 1", b)];
    const stopped = await guest(w, "止めたＡ", a);
    await f.admin.query("update tenant_memberships set status = 'suspended' where member_id = $1", [stopped.id]);
    const inbox = async (p: Person) =>
      (
        await f.admin.query<{ payload: Record<string, unknown> }>(
          "select payload from notifications where tenant_id = $1 and member_id = $2 and event_kind_id = 'ticket.guest_shared' and channel_id = 'inapp'",
          [w.tenantId, p.id],
        )
      ).rows;
    const mailsBefore = mails.length;
    expect((await patch(t, { add: [a] }, w.boss)).status).toBe(200);
    expect([
      (await inbox(a1)).length,
      (await inbox(a2)).length,
      (await inbox(b1)).length,
      (await inbox(stopped)).length,
    ]).toEqual([1, 1, 0, 0]);
    const payload = (await inbox(a1))[0]!.payload;
    expect(Object.keys(payload).sort()).toEqual(["number", "ticket_id", "title", "url"]);
    expect(payload["ticket_id"]).toBe(t);
    expect(payload["title"]).toBe("見せるチケット");
    await patch(t, { add: [a] }, w.boss); // もう一度足す（冪等）
    await patch(t, { remove: [a] }, w.boss); // 外しても送らない
    expect([(await inbox(a1)).length, (await inbox(a2)).length]).toEqual([1, 1]);
    await patch(t, { add: [a] }, w.boss); // 外して足し直すと新しく見せたことになる
    expect([(await inbox(a1)).length, (await inbox(a2)).length]).toEqual([2, 2]);
    expect(mails.length, "メールは 1 通も送らない").toBe(mailsBefore);
  });
});

describe("K-881 DB：表と行の守り", () => {
  it("K881-API-016 表の列は決めた物だけ：人ごと（member_id）・項目ごと（items・fields）・種別の既定を持たない", async () => {
    const cols = (
      await f.admin.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'ticket_guest_shares' order by column_name",
      )
    ).rows.map((r) => r.column_name);
    expect(cols).toEqual(
      [
        "created_at",
        "created_by",
        "deleted_at",
        "guest_group_id",
        "id",
        "shared_by",
        "tenant_id",
        "ticket_id",
        "updated_at",
        "updated_by",
      ].sort(),
    );
  });

  it("K881-API-017 同じ会社の物だけ：別の会社のチケット・別の会社のグループに結ぶ行は 22023", async () => {
    const w = await world();
    const other = await f.company("K881 結べない", "OV");
    const ot = (
      await f.admin.query<{ id: string }>(
        `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title)
         select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'),
                (select id from ticket_stages where tenant_id = $1 and key = 'todo'), '他社のチケット' returning id`,
        [other.tenantId, other.rootScope],
      )
    ).rows[0]!.id;
    const t = await ticket(w, w.g1);
    const og = await gg(w, "他社のグループ", { tenant: other.tenantId, scope: other.rootScope });
    const g = await gg(w, "自社のグループ");
    const put = async (tenant: string, tid: string, gid: string) => {
      try {
        await f.admin.query(
          "insert into ticket_guest_shares (tenant_id, ticket_id, guest_group_id) values ($1, $2, $3)",
          [tenant, tid, gid],
        );
        return "ok";
      } catch (e) {
        return String((e as { code?: unknown }).code);
      }
    };
    expect(await put(w.tenantId, ot, g)).toBe("22023");
    expect(await put(w.tenantId, t, og)).toBe("22023");
    expect(await put(w.tenantId, t, g)).toBe("ok");
  });

  it("K881-API-018 行の守り（社内）：チケットが見える人は読める・見えない人・別の会社の人は 0 行・書けるのは書ける人だけ（読むだけの人の insert は断られる）", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const g = await gg(w, "Ａ社");
    await f.admin.query("insert into ticket_guest_shares (tenant_id, ticket_id, guest_group_id) values ($1, $2, $3)", [
      w.tenantId,
      t,
      g,
    ]);
    const ctx = (p: Person, tenantId = w.tenantId): TenantContext => ({
      tenantId,
      userId: p.id,
      role: "member",
      stepUpAt: null,
    });
    const rows = (p: Person, tenantId?: string) =>
      withTenant(
        f.pool,
        ctx(p, tenantId),
        async (cl) => (await cl.query("select id from ticket_guest_shares where ticket_id = $1", [t])).rowCount ?? 0,
      );
    expect(await rows(w.boss)).toBe(1);
    expect(await rows(w.viewer)).toBe(1);
    expect(await rows(w.e2)).toBe(0);
    const other = await f.company("K881 守り外", "OU");
    const stranger = await f.person(other.tenantId, other.rootScope, { name: "他社の人", ticketAbility: "edit" });
    expect(await rows(stranger, other.tenantId)).toBe(0);
    let denied = false;
    try {
      await withTenant(f.pool, ctx(w.viewer), (cl) =>
        cl.query("insert into ticket_guest_shares (tenant_id, ticket_id, guest_group_id) values ($1, $2, $3)", [
          w.tenantId,
          t,
          g,
        ]),
      );
    } catch (e) {
      denied = /row-level security|permission denied/.test(String(e));
    }
    expect(denied).toBe(true);
  });
});

describe("K-881 ゲストの側から見える（K-878 の守りに足す）", () => {
  it("K881-API-019 見せると、そのゲストのグループの全員に見える（同じグループの別のゲストにも）。別のゲストのグループには見えない・社内のほかのチケットは見えない", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const other = await ticket(w, w.g1);
    const [a, b] = [await gg(w, "Ａ社"), await gg(w, "Ｂ社")];
    const [a1, a2, b1] = [await guest(w, "Ａの 1", a), await guest(w, "Ａの 2", a), await guest(w, "Ｂの 1", b)];
    expect(await guestSees(w, a1, t)).toBe(0);
    expect((await patch(t, { add: [a] }, w.boss)).status).toBe(200);
    expect(await guestSees(w, a1, t)).toBe(1);
    expect(await guestSees(w, a2, t)).toBe(1);
    expect(await guestSees(w, b1, t)).toBe(0);
    expect(await guestSees(w, a1, other)).toBe(0);
  });

  it("K881-API-020 外すとすぐ見えなくなる（次の読みから 0 行）。もう一度足すとまた見える", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const a = await gg(w, "Ａ社");
    const g1 = await guest(w, "Ａの 1", a);
    await patch(t, { add: [a] }, w.boss);
    expect(await guestSees(w, g1, t)).toBe(1);
    await patch(t, { remove: [a] }, w.boss);
    expect(await guestSees(w, g1, t)).toBe(0);
    await patch(t, { add: [a] }, w.boss);
    expect(await guestSees(w, g1, t)).toBe(1);
  });

  it("K881-API-021 グループを消す・チケットを消すと、見せる行が残っていてもゲストには見えない", async () => {
    const w = await world();
    const [t1, t2] = [await ticket(w, w.g1), await ticket(w, w.g1)];
    const [a, b] = [await gg(w, "Ａ社"), await gg(w, "Ｂ社")];
    const [ga, gb] = [await guest(w, "Ａの 1", a), await guest(w, "Ｂの 1", b)];
    await patch(t1, { add: [a] }, w.boss);
    await patch(t2, { add: [b] }, w.boss);
    expect([await guestSees(w, ga, t1), await guestSees(w, gb, t2)]).toEqual([1, 1]);
    await f.admin.query("update guest_groups set deleted_at = now() where id = $1", [a]);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [t2]);
    expect([await guestSees(w, ga, t1), await guestSees(w, gb, t2)]).toEqual([0, 0]);
  });
});

describe("K-881 手順の失敗・口の入口", () => {
  it("K881-API-022 手順（DB に書く）：証跡を書けなければ 503・E-PAGE-003 で、見せる行も残らない（1 つの取引）", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const a = await gg(w, "Ａ社");
    await failOn("audit_events", "new.action = 'ticket.guest_share_added'", async () => {
      const r = await patch(t, { add: [a] }, w.boss);
      expect(r.status).toBe(503);
      expect((await asJson(r))["code"]).toBe("E-PAGE-003");
    });
    expect(await active(t)).toBe(0);
  });

  it("K881-API-023 入口：上限を超えると 429・retry_after_sec は 1〜60 の整数・答えは no-store", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const p = await f.person(w.tenantId, w.root, { name: "回数の人", ticketAbility: "edit" });
    f.limits["updateTicketGuestShares"] = 2;
    try {
      const a = await gg(w, "Ａ社");
      const statuses: number[] = [];
      let last: Response | null = null;
      for (let i = 0; i < 3; i++) {
        last = await patch(t, { remove: [a] }, p);
        statuses.push(last.status);
      }
      expect(statuses).toEqual([200, 200, 429]);
      const b = await asJson(last!);
      expect(Number.isInteger(b["retry_after_sec"])).toBe(true);
      expect(b["retry_after_sec"] as number).toBeGreaterThanOrEqual(1);
      expect(b["retry_after_sec"] as number).toBeLessThanOrEqual(60);
      expect(last!.headers.get("cache-control") ?? "").toContain("no-store");
    } finally {
      delete f.limits["updateTicketGuestShares"];
    }
  });
});

describe("K-881 ゲストのグループを消すとき・依頼から作ったチケット", () => {
  it("K881-API-024 ゲストのグループを消すときの関数 app.ticket_guest_shares_drop_group(グループ)：そのグループの見せる相手の行を全部外して件数を返す（別のグループの行は残る・ゲストはすぐ見えなくなる・外した 1 つごとに証跡 ticket.guest_share_removed）。もう一度呼ぶと 0。メンバーを直す権限（members の edit）の無い人は 42501", async () => {
    const w = await world();
    const [t1, t2] = [await ticket(w, w.g1), await ticket(w, w.g1)];
    const [a, b] = [await gg(w, "Ａ社"), await gg(w, "Ｂ社")];
    const [ga, gb] = [await guest(w, "Ａの 1", a), await guest(w, "Ｂの 1", b)];
    await patch(t1, { add: [a, b] }, w.boss);
    await patch(t2, { add: [a] }, w.boss);
    expect([await guestSees(w, ga, t1), await guestSees(w, ga, t2), await guestSees(w, gb, t1)]).toEqual([1, 1, 1]);
    const editor = await f.person(w.tenantId, w.root, { name: "メンバーを直す人" });
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'edit')",
      [w.tenantId, editor.id],
    );
    const call = (p: Person) =>
      withTenant(f.pool, { tenantId: w.tenantId, userId: p.id, role: "member", stepUpAt: null }, async (cl) =>
        Number((await cl.query<{ v: number }>("select app.ticket_guest_shares_drop_group($1) as v", [a])).rows[0]!.v),
      );
    await expect(call(w.boss)).rejects.toMatchObject({ code: "42501" });
    expect(await call(editor)).toBe(2);
    expect([await guestSees(w, ga, t1), await guestSees(w, ga, t2), await guestSees(w, gb, t1)]).toEqual([0, 0, 1]);
    expect(
      await n("select count(*) as n from ticket_guest_shares where guest_group_id = $1 and deleted_at is null", [a]),
    ).toBe(0);
    expect(
      await n("select count(*) as n from ticket_guest_shares where guest_group_id = $1 and deleted_at is null", [b]),
    ).toBe(1);
    expect(
      await n(
        "select count(*) as n from audit_events where tenant_id = $1 and action = 'ticket.guest_share_removed' and payload->>'guest_group_id' = $2",
        [w.tenantId, a],
      ),
    ).toBe(2);
    expect(await call(editor)).toBe(0);
  });

  it("K881-API-024 失敗（ゲストのグループを消すとき）：消す取引の途中（証跡 ticket.guest_share_removed を書けない）で関数が落ちると、見せる相手の行は何も外れず、ゲストにはまだ見えている（1 つの取引）", async () => {
    const w = await world();
    const [t1, t2] = [await ticket(w, w.g1), await ticket(w, w.g1)];
    const a = await gg(w, "Ａ社");
    const ga = await guest(w, "Ａの 1", a);
    await patch(t1, { add: [a] }, w.boss);
    await patch(t2, { add: [a] }, w.boss);
    const editor = await f.person(w.tenantId, w.root, { name: "メンバーを直す人" });
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'edit')",
      [w.tenantId, editor.id],
    );
    await failOn("audit_events", "new.action = 'ticket.guest_share_removed'", async () => {
      await expect(
        withTenant(f.pool, { tenantId: w.tenantId, userId: editor.id, role: "member", stepUpAt: null }, (cl) =>
          cl.query("select app.ticket_guest_shares_drop_group($1)", [a]),
        ),
      ).rejects.toThrow(/K881 試験の失敗/);
    });
    expect(
      await n("select count(*) as n from ticket_guest_shares where guest_group_id = $1 and deleted_at is null", [a]),
    ).toBe(2);
    expect([await guestSees(w, ga, t1), await guestSees(w, ga, t2)]).toEqual([1, 1]);
  });

  it("K881-API-025 依頼から作ったチケットも、見せる相手の行で決まる（K-878 の橋の枝は外した）：依頼につながっていても見せる相手の行が無い・外したときはゲストに見えない。足すと見える", async () => {
    const w = await world();
    const t = await ticket(w, w.g1);
    const a = await gg(w, "Ａ社");
    const g1 = await guest(w, "Ａの 1", a);
    await f.admin.query(
      "insert into client_requests (tenant_id, guest_group_id, title, state, ticket_id, created_by) values ($1, $2, '依頼', 'ticketed', $3, $4)",
      [w.tenantId, a, t, g1.id],
    );
    expect(await guestSees(w, g1, t)).toBe(0);
    await patch(t, { add: [a] }, w.boss);
    expect(await guestSees(w, g1, t)).toBe(1);
    await patch(t, { remove: [a] }, w.boss);
    expect(await guestSees(w, g1, t)).toBe(0);
  });
});
