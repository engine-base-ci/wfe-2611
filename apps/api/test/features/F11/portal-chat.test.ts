// K-882「見せたチケットのチャット：書き込みの印 ticket_messages.guest_visible・ゲストが読む関数 app.portal_ticket_messages・ゲストが書く口 postPortalTicketMessage」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン）。行 ID（K882-API-…）は 11_tickets/K-882.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/portal-ticket-chat.ts の register（K-326）。
// 試験が決める形（契約は 05_flow/screen_api.d/K-882.py で作る）:
//   postPortalTicketMessage  POST /api/v1/portal/tickets/:id/messages  body { body: string }（知らない欄は 422）→ 201 { data: { id } }
//     見えない（見せていない・外した・グループ／チケットを消した・別のグループ・無い）は 404・E-GST-060（欄・details なし）／社内の人は 403／ログインなしは 401／503 E-PAGE-003
//     書いたら担当者の受け箱（notifications・inapp・ticket.message）に 1 件。メールは送らない。証跡 ticket.guest_message_posted（ticket_id・message_id だけ）
// DB（migration 20261127094200_portal_ticket_chat.sql）:
//   ticket_messages.guest_visible（boolean・not null）… 見せたチケットに見せた後で書いた post に引き金が自動で true を付ける（明示の値はそのまま）
//   ticket_messages.from_request（boolean・not null・既定 false）… 依頼から来た書き込み（K-894 が true で入れる）
//   app.portal_ticket_messages(tid) … ゲストに見えるチケットの「印が付いた post（社内の人と自分のグループのゲストの物）」を古い順に [{ id, side, name, at, text }]（from_request が true の行にだけ from_request: true を足す）。見えなければ null
//   app.ticket_timeline_item … 段 7 の読む関数の 1 件の message に、from_request が true の行にだけ from_request: true を足す
//   app.portal_ticket_message_post(tid, body) … 口の中身（42501＋E-GST-060 で断る）
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
const NO_SUCH = "00000000-0000-4000-8000-0000000000cc";

let f: Fixture;
let loaded = false;
/** 口に渡すメール送りの偽。書いても 1 通も送らないことを見る（K882-API-013） */
const mails: unknown[] = [];
async function ready(): Promise<void> {
  if (loaded) return;
  const m = (await import(join(HOOKS_DIR, "portal-ticket-chat.ts"))) as { register: HookModule };
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
interface Msg {
  id: string;
  side: string;
  name: string;
  at: string;
  text: string;
  from_request?: true;
}
interface World {
  tenantId: string;
  root: string;
  boss: Person; // 全体に書ける・チケットの担当者でない
  assignee: Person; // チケットの担当者（社内の人）
  staff: Person; // 社内の書き手
}
async function world(): Promise<World> {
  await ready();
  const c = await f.company(`K882 の会社 ${Math.random().toString(36).slice(2, 7)}`, "PM");
  return {
    tenantId: c.tenantId,
    root: c.rootScope,
    boss: await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" }),
    assignee: await f.person(c.tenantId, c.rootScope, { name: "担当の人", ticketAbility: "edit" }),
    staff: await f.person(c.tenantId, c.rootScope, { name: "営業の人", ticketAbility: "edit" }),
  };
}
const ticket = async (
  w: World,
  o: { assignee?: string | null; deleted?: boolean; stage?: string } = {},
): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, deleted_at)
       select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'),
              (select id from ticket_stages where tenant_id = $1 and key = $5), 'チャットのチケット', $3, $4
       returning id`,
      [
        w.tenantId,
        w.root,
        o.assignee === undefined ? w.assignee.id : o.assignee,
        o.deleted ? new Date() : null,
        o.stage ?? "doing",
      ],
    )
  ).rows[0]!.id;
const gg = async (w: World, name: string, o: { deleted?: boolean } = {}): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      "insert into guest_groups (tenant_id, name, request_scope_id, deleted_at) values ($1, $2, $3, $4) returning id",
      [w.tenantId, `${name}${randomUUID().slice(0, 4)}`, w.root, o.deleted ? new Date() : null],
    )
  ).rows[0]!.id;
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
const share = async (w: World, t: string, g: string): Promise<void> => {
  await f.admin.query(
    "insert into ticket_guest_shares (tenant_id, ticket_id, guest_group_id, shared_by) values ($1, $2, $3, $4)",
    [w.tenantId, t, g, w.boss.id],
  );
};
const unshare = (t: string, g: string) =>
  f.admin.query(
    "update ticket_guest_shares set deleted_at = now() where ticket_id = $1 and guest_group_id = $2 and deleted_at is null",
    [t, g],
  );
/** 書き込みを 1 件入れる（印は書かない＝引き金が決める。visible を渡せば明示）。時刻は ago だけ前にずらす */
const chat = async (
  w: World,
  t: string,
  by: Person | null,
  text: string,
  o: { kind?: string; visible?: boolean; deleted?: boolean; ago?: string; fromRequest?: boolean } = {},
): Promise<{ id: string; visible: boolean }> => {
  const r = await f.admin.query<{ id: string; guest_visible: boolean }>(
    `insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, guest_visible, deleted_at, created_at, from_request)
     values ($1, $2, $3, $4, $5, $6, $7, now() - $8::interval, $9) returning id, guest_visible`,
    [
      w.tenantId,
      t,
      by?.id ?? null,
      o.kind ?? "post",
      text,
      o.visible ?? null,
      o.deleted ? new Date() : null,
      o.ago ?? "0 seconds",
      o.fromRequest ?? false,
    ],
  );
  return { id: r.rows[0]!.id, visible: r.rows[0]!.guest_visible };
};
const asGuest = (w: World, p: Person): TenantContext => ({
  tenantId: w.tenantId,
  userId: p.id,
  role: "client",
  stepUpAt: null,
});
const asMember = (w: World, p: Person): TenantContext => ({
  tenantId: w.tenantId,
  userId: p.id,
  role: "member",
  stepUpAt: null,
});
const readMsgs = async (w: World, p: Person, t: string): Promise<Msg[] | null> =>
  withTenant(
    f.pool,
    asGuest(w, p),
    async (cl) => (await cl.query<{ v: Msg[] | null }>("select app.portal_ticket_messages($1) as v", [t])).rows[0]!.v,
  );
interface TItem {
  kind: string;
  actor: { id: string } | null;
  message: (Record<string, unknown> & { body: string }) | null;
}
/** 社内の人が段 7 の読む関数（app.ticket_timeline）で 1 チケットのスレッドを読む */
const timeline = async (w: World, p: Person, t: string): Promise<TItem[]> =>
  withTenant(f.pool, asMember(w, p), async (cl) => {
    const v = (
      await cl.query<{ v: { items: TItem[] } }>("select app.ticket_timeline($1, 50, null, null, 'all') as v", [t])
    ).rows[0]!.v;
    return v.items;
  });
const post = (
  t: string,
  body: unknown,
  p: Person | null,
  role: "member" | "client" = "client",
  headers: Record<string, string> = {},
) => f.req("POST", `/portal/tickets/${t}/messages`, { body, headers: { ...(p ? f.as(p, role) : {}), ...headers } });
const n = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const rows = (t: string) => n("select count(*) as n from ticket_messages where ticket_id = $1", [t]);
const inbox = (m: string, t: string) =>
  n(
    "select count(*) as n from notifications where member_id = $1 and event_kind_id = 'ticket.message' and channel_id = 'inapp' and payload->>'ticket_id' = $2",
    [m, t],
  );
async function failOn(table: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k882_fail_${randomUUID().replaceAll("-", "")}`;
  await f.admin.query(
    `create function app.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'K882 試験の失敗'; end if; return new; end $$`,
  );
  await f.admin.query(`create trigger ${name} before insert on ${table} for each row execute function app.${name}()`);
  try {
    await fn();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on ${table}`);
    await f.admin.query(`drop function if exists app.${name}()`);
  }
}

describe("K-882 ゲストが読む（app.portal_ticket_messages）", () => {
  it("K882-API-001 読む：社内の人 2 件・ゲスト 2 件（同じグループ）の印付きの書き込みは古い順 4 件。鍵はちょうど id・side・name・at・text（依頼から来た行が無いので鍵は増えない）・社内の人は we・ゲストは they・name は表示名。何も書かない", async () => {
    const w = await world();
    const g = await gg(w, "Ａ社");
    const [a, a2] = [await guest(w, "山田", g), await guest(w, "鈴木", g)];
    const t = await ticket(w);
    await share(w, t, g);
    await chat(w, t, w.staff, "始めました", { ago: "4 hours" });
    await chat(w, t, a, "お願いします", { ago: "3 hours" });
    await chat(w, t, w.staff, "確認します", { ago: "2 hours" });
    await chat(w, t, a2, "こちらも見ます", { ago: "1 hour" });
    const before = await n(
      "select count(*) as n from ticket_messages where ticket_id = $1 and updated_at <> created_at",
      [t],
    );
    const m = (await readMsgs(w, a, t))!;
    expect(m.map((x) => [x.side, x.name, x.text])).toEqual([
      ["we", "営業の人", "始めました"],
      ["they", "山田", "お願いします"],
      ["we", "営業の人", "確認します"],
      ["they", "鈴木", "こちらも見ます"],
    ]);
    expect(Object.keys(m[0]!).sort()).toEqual(["at", "id", "name", "side", "text"]);
    expect(Number.isNaN(Date.parse(m[0]!.at))).toBe(false);
    expect(await rows(t)).toBe(4);
    expect(
      await n("select count(*) as n from ticket_messages where ticket_id = $1 and updated_at <> created_at", [t]),
    ).toBe(before);
    expect((await readMsgs(w, a2, t))!.length).toBe(4);
  });

  it("K882-API-002 出さない書き込み：変更・仕組みの行・消した書き込み・印が false の post は、見せたチケットでも出ない", async () => {
    const w = await world();
    const g = await gg(w, "Ｂ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    await chat(w, t, w.staff, "見える物", { ago: "5 minutes" });
    await chat(w, t, w.staff, "期限を変えました", { kind: "change", visible: true, ago: "4 minutes" });
    await chat(w, t, null, "仕組みの行", { kind: "system", visible: true, ago: "3 minutes" });
    await chat(w, t, w.staff, "消した物", { deleted: true, visible: true, ago: "2 minutes" });
    await chat(w, t, w.staff, "社内だけの物", { visible: false, ago: "1 minute" });
    expect((await readMsgs(w, a, t))!.map((x) => x.text)).toEqual(["見える物"]);
  });

  it("K882-API-003 見えない形（G-14）：見せていない・見せる相手を外した直後・グループを消した・チケットを消したは null。足し直すとまた読める", async () => {
    const w = await world();
    const g = await gg(w, "Ｃ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await chat(w, t, w.staff, "社内の話", { visible: true });
    expect(await readMsgs(w, a, t), "見せていない").toBeNull();
    await share(w, t, g);
    expect((await readMsgs(w, a, t))!.length).toBe(1);
    await unshare(t, g);
    expect(await readMsgs(w, a, t), "外した直後").toBeNull();
    await share(w, t, g);
    expect((await readMsgs(w, a, t))!.length).toBe(1);
    await f.admin.query("update guest_groups set deleted_at = now() where id = $1", [g]);
    expect(await readMsgs(w, a, t), "グループを消した").toBeNull();
    await f.admin.query("update guest_groups set deleted_at = null where id = $1", [g]);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [t]);
    expect(await readMsgs(w, a, t), "チケットを消した").toBeNull();
    expect(await readMsgs(w, a, NO_SUCH), "無いチケット").toBeNull();
  });

  it("K882-API-004 別のグループ：同じチケットを見せた別のグループのゲストの書き込みは見えない。社内の人の書き込みは両方に見える。自分のグループの別のゲストの書き込みは見える", async () => {
    const w = await world();
    const [g1, g2] = [await gg(w, "甲社"), await gg(w, "乙社")];
    const [a, a2, b] = [await guest(w, "甲の山田", g1), await guest(w, "甲の鈴木", g1), await guest(w, "乙の佐藤", g2)];
    const t = await ticket(w);
    await share(w, t, g1);
    await share(w, t, g2);
    await chat(w, t, w.staff, "社内から", { ago: "3 hours" });
    await chat(w, t, a, "甲から", { ago: "2 hours" });
    await chat(w, t, b, "乙から", { ago: "1 hour" });
    expect((await readMsgs(w, a2, t))!.map((x) => x.text)).toEqual(["社内から", "甲から"]);
    expect((await readMsgs(w, b, t))!.map((x) => x.text)).toEqual(["社内から", "乙から"]);
    const stranger = await guest(w, "見せていない丙", await gg(w, "丙社"));
    expect(await readMsgs(w, stranger, t)).toBeNull();
  });
});

describe("K-882 見せた後に書いた物が自動で見える（引き金）", () => {
  it("K882-API-005 見せた後に社内が書いた post は guest_visible が true。見せていないチケットの post・見せたチケットの change・system の行は false", async () => {
    const w = await world();
    const g = await gg(w, "Ｄ社");
    const [shown, plain] = [await ticket(w), await ticket(w)];
    await share(w, shown, g);
    expect((await chat(w, shown, w.staff, "見せたあと")).visible).toBe(true);
    expect((await chat(w, plain, w.staff, "見せていない")).visible).toBe(false);
    expect((await chat(w, shown, w.staff, "期限を変えました", { kind: "change" })).visible).toBe(false);
    expect((await chat(w, shown, null, "仕組みの行", { kind: "system" })).visible).toBe(false);
  });

  it("K882-API-006 見せる前の物・明示：見せる前に書いた post は見せた後も false。明示の false は見せた後も保たれ、明示の true は見せる前でも保たれる。見せるのをやめても付いた印は消えない", async () => {
    const w = await world();
    const g = await gg(w, "Ｅ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    const early = await chat(w, t, w.staff, "見せる前の話");
    const explicitTrue = await chat(w, t, w.staff, "見せる前でも明示の true", { visible: true });
    expect([early.visible, explicitTrue.visible]).toEqual([false, true]);
    await share(w, t, g);
    const explicitFalse = await chat(w, t, w.staff, "社内だけにする", { visible: false });
    const late = await chat(w, t, w.staff, "見せたあと");
    expect([explicitFalse.visible, late.visible]).toEqual([false, true]);
    expect((await readMsgs(w, a, t))!.map((x) => x.text)).toEqual(["見せる前でも明示の true", "見せたあと"]);
    await unshare(t, g);
    expect(
      await n("select count(*) as n from ticket_messages where ticket_id = $1 and guest_visible", [t]),
      "印は消えない",
    ).toBe(2);
    expect(await readMsgs(w, a, t), "でも今は見えない").toBeNull();
  });

  it("K882-API-023 依頼から来た書き込み（ゲストの読み）：from_request を true で入れた 1 件だけに from_request: true が付き、ほかの行には鍵が無い。同じグループのゲストには本文も見え、別のグループのゲストには見えない。列は boolean・null でなく、書く口の書き込みは false のまま", async () => {
    const w = await world();
    const g = await gg(w, "Ｑ社");
    const g2 = await gg(w, "Ｒ社");
    const [a, other] = [await guest(w, "山田", g), await guest(w, "別の人", g2)];
    const t = await ticket(w);
    await share(w, t, g);
    await share(w, t, g2);
    await chat(w, t, a, "依頼の本文です", { visible: true, fromRequest: true, ago: "3 hours" });
    await chat(w, t, w.staff, "依頼への返事です", { visible: true, fromRequest: true, ago: "2 hours" });
    await chat(w, t, w.staff, "ここからチケットのやり取り", { ago: "1 hour" });
    const m = (await readMsgs(w, a, t))!;
    expect(m.map((x) => [x.text, x.from_request ?? null])).toEqual([
      ["依頼の本文です", true],
      ["依頼への返事です", true],
      ["ここからチケットのやり取り", null],
    ]);
    expect(Object.keys(m[2]!).sort()).toEqual(["at", "id", "name", "side", "text"]);
    expect(
      (await readMsgs(w, other, t))!.map((x) => x.text),
      "別のグループのゲストの書き込みは見えない",
    ).toEqual(["依頼への返事です", "ここからチケットのやり取り"]);
    const col = (
      await f.admin.query<{ data_type: string; is_nullable: string; column_default: string | null }>(
        "select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'ticket_messages' and column_name = 'from_request'",
      )
    ).rows[0];
    expect([col?.data_type, col?.is_nullable, col?.column_default]).toEqual(["boolean", "NO", "false"]);
    const written = await post(t, { body: "ゲストが書いた" }, a);
    expect(written.status).toBe(201);
    expect(await n("select count(*) as n from ticket_messages where ticket_id = $1 and from_request", [t])).toBe(2);
  });

  it("K882-API-024 依頼から来た書き込み（社内の読み）：段 7 の読む関数で読むと、from_request を true で入れた 1 件の message にだけ from_request: true があり、ほかの書き込みの message には鍵が無い", async () => {
    const w = await world();
    const g = await gg(w, "Ｓ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    await chat(w, t, a, "依頼の本文です", { visible: true, fromRequest: true, ago: "2 hours" });
    await chat(w, t, w.staff, "普通の書き込み", { ago: "1 hour" });
    const posts = (await timeline(w, w.boss, t)).filter((x) => x.kind === "post");
    const byBody = Object.fromEntries(posts.map((x) => [x.message!.body, x.message!["from_request"] ?? null]));
    expect(byBody).toEqual({ 依頼の本文です: true, 普通の書き込み: null });
  });

  it("K882-API-007 列：ticket_messages.guest_visible は boolean・null でない。ゲストの印を書かずに入れた行にも値が入る", async () => {
    await world();
    const col = (
      await f.admin.query<{ data_type: string; is_nullable: string }>(
        "select data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'ticket_messages' and column_name = 'guest_visible'",
      )
    ).rows[0];
    expect(col).toEqual({ data_type: "boolean", is_nullable: "NO" });
    expect(await n("select count(*) as n from ticket_messages where guest_visible is null")).toBe(0);
  });
});

describe("K-882 ゲストが書く（postPortalTicketMessage）", () => {
  it("K882-API-008 書く：201・答えの鍵は id だけ・DB は kind post・author はゲスト・guest_visible true・tenant と ticket が入る・本文は前後の空白が取れている。社内の人が読むと同じ書き込みが 1 件", async () => {
    const w = await world();
    const g = await gg(w, "Ｆ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    const r = await post(t, { body: "  確認をお願いします  " }, a);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
    const d = (await asJson(r)).data as { id: string };
    expect(Object.keys(d)).toEqual(["id"]);
    const row = (
      await f.admin.query<{
        kind: string;
        author_member_id: string;
        guest_visible: boolean;
        tenant_id: string;
        ticket_id: string;
        body: string;
        created_by: string;
      }>(
        "select kind, author_member_id, guest_visible, tenant_id, ticket_id, body, created_by from ticket_messages where id = $1",
        [d.id],
      )
    ).rows[0]!;
    expect(row).toEqual({
      kind: "post",
      author_member_id: a.id,
      guest_visible: true,
      tenant_id: w.tenantId,
      ticket_id: t,
      body: "確認をお願いします",
      created_by: a.id,
    });
    const staffSees = await withTenant(
      f.pool,
      asMember(w, w.boss),
      async (cl) =>
        (await cl.query("select id from ticket_messages where ticket_id = $1 and kind = 'post'", [t])).rowCount ?? 0,
    );
    expect(staffSees).toBe(1);
    expect((await readMsgs(w, a, t))!.map((x) => [x.side, x.text])).toEqual([["they", "確認をお願いします"]]);
  });

  it("K882-API-009 入力：本文が空・空白だけ・全角空白だけ・数字・欄が無い・知らない欄（author_member_id・kind・guest_visible・mentions）はどれも 422・何も書かない。全角英数は NFKC の字で入る", async () => {
    const w = await world();
    const g = await gg(w, "Ｇ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    const bad: unknown[] = [
      { body: "" },
      { body: "   " },
      { body: "　　" },
      { body: 123 },
      {},
      { body: "x", author_member_id: w.boss.id },
      { body: "x", kind: "system" },
      { body: "x", guest_visible: false },
      { body: "x", mentions: [w.boss.id] },
    ];
    for (const b of bad) {
      const r = await post(t, b, a);
      expect(r.status, JSON.stringify(b)).toBe(422);
    }
    expect(await rows(t)).toBe(0);
    const ok = await post(t, { body: "ＡＢＣ　１２３" }, a);
    expect(ok.status).toBe(201);
    expect((await readMsgs(w, a, t))!.map((x) => x.text)).toEqual(["ABC 123"]);
  });

  it("K882-API-010 失敗：見せていない・別のグループ・外した・グループを消した・チケットを消した・無い id はどれも 404・E-GST-060・正本の文・欄・details なし・何も書かない", async () => {
    const w = await world();
    const [g, g2] = [await gg(w, "Ｈ社"), await gg(w, "Ｉ社")];
    const [a, b] = [await guest(w, "山田", g), await guest(w, "別の佐藤", g2)];
    const notShared = await ticket(w);
    const ofOther = await ticket(w);
    await share(w, ofOther, g2);
    const removed = await ticket(w);
    await share(w, removed, g);
    await unshare(removed, g);
    const deletedGroup = await ticket(w);
    const g3 = await gg(w, "消す社", { deleted: true });
    await guest(w, "消えた社の人", await gg(w, "別の社"));
    await share(w, deletedGroup, g3);
    const gone = await ticket(w, { deleted: true });
    await share(w, gone, g);
    for (const t of [notShared, ofOther, removed, deletedGroup, gone, NO_SUCH]) {
      const r = await post(t, { body: "書けない" }, a);
      expect(r.status, t).toBe(404);
      const j = await asJson(r);
      expect(j["code"]).toBe("E-GST-060");
      expect(j["message"]).toBe(msg("E-GST-060"));
      bare(j);
    }
    for (const t of [notShared, ofOther, removed, deletedGroup, gone]) expect(await rows(t), t).toBe(0);
    expect((await post(ofOther, { body: "見える" }, b)).status).toBe(201);
  });

  it("K882-API-011 守り（役）：社内の人（管理者）は 403・ログインしていない人は 401・ゲストが社内の口（チケットのやり取りに書く道）を叩くと 403・何も書かない", async () => {
    const w = await world();
    const g = await gg(w, "Ｊ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    expect((await post(t, { body: "社内から" }, w.boss, "member")).status).toBe(403);
    expect((await post(t, { body: "社内から" }, w.boss, "client")).status, "ゲストの文脈でない人").toBe(403);
    expect((await post(t, { body: "誰か" }, null)).status).toBe(401);
    const inside = await f.req("POST", `/tickets/${t}/messages`, {
      body: { body: "ゲストから社内の口" },
      headers: f.as(a, "client"),
    });
    expect(inside.status).toBe(403);
    expect(await rows(t)).toBe(0);
  });

  it("K882-API-012 お知らせ：担当者の受け箱に 1 件（inapp・ticket.message・payload は ticket_id・number・title・message_id・url だけで本文は無い）。ゲスト本人・担当者が空・止めた・抜けた担当者には入らない", async () => {
    const w = await world();
    const g = await gg(w, "Ｋ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    const r = await post(t, { body: "秘密の本文は載せない" }, a);
    const id = ((await asJson(r)).data as { id: string }).id;
    expect(await inbox(w.assignee.id, t)).toBe(1);
    expect(await inbox(a.id, t)).toBe(0);
    const row = (
      await f.admin.query<{ payload: Json; dedupe_key: string; sent_at: Date | null }>(
        "select payload, dedupe_key, sent_at from notifications where member_id = $1 and event_kind_id = 'ticket.message' and payload->>'ticket_id' = $2",
        [w.assignee.id, t],
      )
    ).rows[0]!;
    expect(Object.keys(row.payload).sort()).toEqual(["message_id", "number", "ticket_id", "title", "url"]);
    expect(row.payload["message_id"]).toBe(id);
    expect(row.payload["url"]).toBe(`/tickets/${t}`);
    expect(JSON.stringify(row.payload)).not.toContain("秘密の本文");
    expect(row.dedupe_key).toBe(`ticket.message:${id}:${w.assignee.id}`);
    expect(row.sent_at).not.toBeNull();
    const none = await ticket(w, { assignee: null });
    await share(w, none, g);
    expect((await post(none, { body: "担当者がいない" }, a)).status).toBe(201);
    const susp = await ticket(w);
    await share(w, susp, g);
    await f.admin.query("update tenant_memberships set status = 'suspended' where member_id = $1", [w.assignee.id]);
    expect((await post(susp, { body: "止めた担当者" }, a)).status).toBe(201);
    expect(await inbox(w.assignee.id, susp)).toBe(0);
    await f.admin.query("update tenant_memberships set status = 'active' where member_id = $1", [w.assignee.id]);
    await f.admin.query("update members set deleted_at = now() where id = $1", [w.assignee.id]);
    expect((await post(susp, { body: "抜けた担当者" }, a)).status).toBe(201);
    expect(await inbox(w.assignee.id, susp)).toBe(0);
    expect(await n("select count(*) as n from notifications where payload->>'ticket_id' = $1", [none])).toBe(0);
  });

  it("K882-API-013 外に出す物：書いても、メールは 1 通も送らない", async () => {
    const w = await world();
    const g = await gg(w, "Ｌ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    const before = mails.length;
    expect((await post(t, { body: "メールは送らない" }, a)).status).toBe(201);
    expect(mails.length).toBe(before);
  });

  it("K882-API-014 守り（証跡）：書いた 1 件ごとに ticket.guest_message_posted を 1 行・payload は ticket_id と message_id だけ（本文は無い）。断られた書き込みは書かない", async () => {
    const w = await world();
    const g = await gg(w, "Ｍ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    const id = ((await asJson(await post(t, { body: "証跡の本文" }, a))).data as { id: string }).id;
    await post(t, { body: "" }, a);
    await post(NO_SUCH, { body: "断られる" }, a);
    const ev = await f.admin.query<{ payload: Json }>(
      "select payload from audit_events where tenant_id = $1 and action = 'ticket.guest_message_posted'",
      [w.tenantId],
    );
    expect(ev.rows.length).toBe(1);
    expect(ev.rows[0]!.payload).toEqual({ ticket_id: t, message_id: id });
    expect(JSON.stringify(ev.rows[0]!.payload)).not.toContain("証跡の本文");
  });

  it("K882-API-015 操作の揺れ：同じ冪等キーで 2 回は書き込み 1 つ・同じ答え。キーが違う 2 本は 2 つ。同時の 2 本も 2 つ", async () => {
    const w = await world();
    const g = await gg(w, "Ｎ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    const key = { "idempotency-key": randomUUID() };
    const [r1, r2] = [
      await post(t, { body: "二度押し" }, a, "client", key),
      await post(t, { body: "二度押し" }, a, "client", key),
    ];
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(((await asJson(r1)).data as { id: string }).id).toBe(((await asJson(r2)).data as { id: string }).id);
    expect(await rows(t)).toBe(1);
    const [r3, r4] = await Promise.all([
      post(t, { body: "同時" }, a, "client", { "idempotency-key": randomUUID() }),
      post(t, { body: "同時" }, a, "client", { "idempotency-key": randomUUID() }),
    ]);
    expect([r3.status, r4.status]).toEqual([201, 201]);
    expect(await rows(t)).toBe(3);
  });

  it("K882-API-016 守り（G-14）：見せる相手を外すとすぐ 404・E-GST-060・足し直すとまた書ける。書く前に外した読みも null", async () => {
    const w = await world();
    const g = await gg(w, "Ｏ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    expect((await post(t, { body: "いまは書ける" }, a)).status).toBe(201);
    await unshare(t, g);
    const gone = await post(t, { body: "外した直後" }, a);
    expect(gone.status).toBe(404);
    expect((await asJson(gone))["code"]).toBe("E-GST-060");
    expect(await readMsgs(w, a, t)).toBeNull();
    await share(w, t, g);
    expect((await post(t, { body: "足し直した" }, a)).status).toBe(201);
    expect(await rows(t)).toBe(2);
  });

  it("K882-API-017 失敗（手順 1 の途中）：受け箱の行を書けなければ 503・E-PAGE-003・書き込みの行も残らない（1 つの取引）・本文は答えにも出ない", async () => {
    const w = await world();
    const g = await gg(w, "Ｐ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    await failOn("notifications", "new.event_kind_id = 'ticket.message'", async () => {
      const r = await post(t, { body: "落ちる本文" }, a);
      expect(r.status).toBe(503);
      const j = await asJson(r);
      expect(j["code"]).toBe("E-PAGE-003");
      expect(JSON.stringify(j)).not.toContain("落ちる本文");
    });
    expect(await rows(t)).toBe(0);
    expect(
      await n(
        "select count(*) as n from audit_events where tenant_id = $1 and action = 'ticket.guest_message_posted'",
        [w.tenantId],
      ),
    ).toBe(0);
    expect((await post(t, { body: "直った" }, a)).status).toBe(201);
  });

  it("K882-API-018 対象の状態：段が完了のチケットにも書ける。書き込みは増え、担当者に知らせる", async () => {
    const w = await world();
    const g = await gg(w, "Ｑ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w, { stage: "done" });
    await share(w, t, g);
    expect((await post(t, { body: "完了のあとの質問" }, a)).status).toBe(201);
    expect(await rows(t)).toBe(1);
    expect(await inbox(w.assignee.id, t)).toBe(1);
  });

  it("K882-API-019 守り：ゲストが書いた post を社内の人が段 7 の読む関数（app.ticket_timeline）で読むと 1 件で出る（kind post・書いた人はゲスト）。message の鍵は増えない。見せていない別のチケットのスレッドは 0 件", async () => {
    const w = await world();
    const g = await gg(w, "Ｒ社");
    const a = await guest(w, "山田", g);
    const [t, other] = [await ticket(w), await ticket(w)];
    await share(w, t, g);
    await post(t, { body: "社内の人にも見える" }, a);
    const items = await timeline(w, w.boss, t);
    const posts = items.filter((x) => x.kind === "post");
    expect(posts.map((x) => [x.actor?.id, x.message?.body])).toEqual([[a.id, "社内の人にも見える"]]);
    expect(Object.keys(posts[0]!.message!), "鍵は増えない").not.toContain("from_request");
    expect(Object.keys(posts[0]!.message!)).not.toContain("guest_visible");
    expect((await timeline(w, w.boss, other)).filter((x) => x.kind === "post")).toEqual([]);
  });

  it("K882-API-020 守り（上限）：同じ人が上限を超えたら 429・retry_after_sec は 1〜60 の整数・no-store", async () => {
    const w = await world();
    const g = await gg(w, "Ｓ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    f.limits["postPortalTicketMessage"] = 2;
    try {
      const rs = [];
      for (let i = 0; i < 3; i++) rs.push(await post(t, { body: `上限 ${i}` }, a));
      expect(rs.map((r) => r.status)).toEqual([201, 201, 429]);
      const j = await asJson(rs[2]!);
      expect(Number.isInteger(j["retry_after_sec"])).toBe(true);
      expect(j["retry_after_sec"] as number).toBeGreaterThanOrEqual(1);
      expect(j["retry_after_sec"] as number).toBeLessThanOrEqual(60);
      expect(rs[2]!.headers.get("cache-control") ?? "").toContain("no-store");
    } finally {
      delete f.limits["postPortalTicketMessage"];
    }
  });

  it("K882-API-021 守り（表を直に）：ゲストの文脈は ticket_messages を select しても 0 行・insert は断られる（口の関数だけが書ける）", async () => {
    const w = await world();
    const g = await gg(w, "Ｔ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    await chat(w, t, w.staff, "見せた後の社内の話");
    const direct = await withTenant(f.pool, asGuest(w, a), async (cl) => {
      const read = (await cl.query("select id from ticket_messages where ticket_id = $1", [t])).rowCount ?? 0;
      let wrote = "ok";
      try {
        await cl.query("savepoint s");
        await cl.query(
          "insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body) values ($1, $2, $3, 'post', 'こっそり')",
          [w.tenantId, t, a.id],
        );
      } catch (e) {
        wrote = (e as { code?: string }).code ?? "error";
        await cl.query("rollback to savepoint s");
      }
      return { read, wrote };
    });
    expect(direct.read).toBe(0);
    expect(direct.wrote).not.toBe("ok");
    expect(await rows(t)).toBe(1);
  });

  it("K882-API-022 守り（答えの no-store）：書く口の 201・断りの 404 の答えに Cache-Control の private か no-store が付く（認証の要る答え）", async () => {
    const w = await world();
    const g = await gg(w, "Ｕ社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    const denied = await post(t, { body: "見せていない" }, a);
    expect(denied.status).toBe(404);
    expect(denied.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
    await share(w, t, g);
    const ok = await post(t, { body: "見せたあと" }, a);
    expect(ok.status).toBe(201);
    expect(ok.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
  });
});
