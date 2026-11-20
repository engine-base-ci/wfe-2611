// K-462「既読にする・全部既読にする（readNotification・readAllNotifications）」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K462-API-…）は 11_tickets/K-462.md の表の行に 1 対 1 で結ぶ。土台は K-461 の notify.harness.ts。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py の INPUTS・RESPONSES と 05_flow/screen_api.d/K-462.py で直す）:
//   readNotification     PATCH /api/v1/notifications/:id  体 { read: boolean }（必須・strict・ほかの欄は 422）
//     read true＝読んだ印を付ける（すでに読んでいれば最初の時刻のまま）／read false＝未読に戻す。
//     200 { data: Item }（K-461 の一覧の 1 件と同じ形・鍵 12 個）。自分宛てで、一覧に出る行（種類が表にあり・チケットが見える・inapp・消していない）だけ。
//     それ以外（別の人宛て・別の会社・無い id・メールの印の行・消した行・知らない種類・見えないチケット）は 404 E-NTF-010（有ることも漏らさない）
//   readAllNotifications POST /api/v1/notifications/read-all  体 {}（strict・ほかの欄は 422）
//     201 { data: { read: <この呼び出しで読んだことにした行の数> } }（POST の成功は契約で 201・作り手 build_api.py が固定）。対象は「一覧に出る未読」だけ（自分宛て）。何度呼んでも同じ（2 回目は read 0）
//   どちらも本人・Cache-Control: private, no-store・書くのは read_at だけ（sent_at・failed_at・updated_by 以外の列は変えない）
// 守りは 2 層：行の守り（notifications_self_read・notifications_self_only_write）と、口の文の条件（member_id が自分）。
import { describe, expect, it } from "vitest";
import {
  auth,
  boss,
  f,
  json,
  limits,
  member,
  notice,
  one,
  outsider,
  pageOf,
  ready,
  req,
  rowOf,
  setupNotify,
  T,
  ticket,
  ticketPayload,
  type Item,
  type Person,
} from "./notify.harness.js";

setupNotify();

const KEYS = [
  "actor",
  "created_at",
  "href",
  "id",
  "kind",
  "number",
  "params",
  "read",
  "read_at",
  "tag",
  "ticket_id",
  "title",
];
const bridge = (label = "仕事用の PC") => ({ device_id: "dev-1", device_label: label });
const GONE = "E-NTF-010";

const markRead = (p: Person, id: string, read: unknown = true) =>
  req("PATCH", `/notifications/${id}`, { body: { read }, headers: auth(p) });
const readAll = (p: Person, body: unknown = {}) => req("POST", "/notifications/read-all", { body, headers: auth(p) });
const readAt = async (id: string) => (await rowOf(id))!["read_at"] as Date | null;

/**
 * この試験の中だけ、notifications の行の守り（読む・書く）を「同じ会社なら誰でも」に緩め、終わったら元に戻す（上流を故意に壊して口の文の条件を見る・G-02）。
 * K-461 の gen_rls が作る守りは操作ごとに 4 本：notifications_self_read（select）と
 * notifications_self_only_write_insert・_update・_delete。insert は with check だけ・delete は using だけ・update は両方を持つので、操作ごとに緩める。
 */
async function loosened<R>(body: () => Promise<R>): Promise<R> {
  const rows = (
    await f.admin.query<{ policyname: string; cmd: string; qual: string | null; with_check: string | null }>(
      "select policyname, cmd, qual, with_check from pg_policies where tablename = 'notifications' and (policyname = 'notifications_self_read' or policyname like 'notifications\\_self\\_only\\_write\\_%') order by policyname",
    )
  ).rows;
  expect(rows.map((r) => r.policyname)).toEqual([
    "notifications_self_only_write_delete",
    "notifications_self_only_write_insert",
    "notifications_self_only_write_update",
    "notifications_self_read",
  ]);
  const clause = (r: (typeof rows)[number], open: boolean): string => {
    const using = open ? "true" : r.qual;
    const check = open ? "true" : (r.with_check ?? r.qual);
    if (r.cmd === "INSERT") return `with check (${check})`;
    if (r.cmd === "UPDATE") return `using (${using}) with check (${check})`;
    return `using (${using})`;
  };
  try {
    for (const r of rows) await f.admin.query(`alter policy ${r.policyname} on notifications ${clause(r, true)}`);
    return await body();
  } finally {
    for (const r of rows) await f.admin.query(`alter policy ${r.policyname} on notifications ${clause(r, false)}`);
  }
}

/** この試験の中だけ、その 1 行の更新を DB が断るようにし、終わったら外す（書く手順の失敗） */
async function breakUpdate<R>(id: string, body: () => Promise<R>): Promise<R> {
  const name = `k462_fail_${id.replace(/-/g, "")}`;
  await f.admin.query(
    "create or replace function app.k462_test_raise() returns trigger language plpgsql as $$ begin raise exception 'K462 の試験で書き込みを壊した'; end $$",
  );
  await f.admin.query(
    `create trigger ${name} before update on notifications for each row when (new.id = '${id}') execute function app.k462_test_raise()`,
  );
  try {
    return await body();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on notifications`);
    await f.admin.query("drop function if exists app.k462_test_raise()");
  }
}

describe("K-462 既読にする・全部既読にする", () => {
  it("K462-API-001 既読にする：200 で一覧の 1 件と同じ形（鍵 12 個）・read true・read_at が入る。DB にも入り、ほかの列は変わらない", async () => {
    await ready();
    const p = await member("読む人");
    const t = await ticket({ assignee: p, title: "請求書を送る" });
    const id = await notice(p, {
      kind: "approval.requested",
      payload: ticketPayload(t, "請求書を送る"),
      actor: boss.id,
    });
    const before = await rowOf(id);
    const r = await markRead(p, id);
    expect(r.status, await r.clone().text()).toBe(200);
    const item = (await json(r))["data"] as Item;
    expect(Object.keys(item).sort()).toEqual(KEYS);
    expect(item).toMatchObject({
      id,
      kind: "approval.requested",
      tag: "approval",
      href: `/tickets/${t.id}`,
      read: true,
    });
    expect(Number.isNaN(Date.parse(String(item.read_at)))).toBe(false);
    const after = await rowOf(id);
    expect(after!["read_at"]).not.toBeNull();
    for (const col of [
      "tenant_id",
      "member_id",
      "channel_id",
      "event_kind_id",
      "payload",
      "dedupe_key",
      "sent_at",
      "failed_at",
      "created_at",
      "created_by",
    ])
      expect(after![col], col).toEqual(before![col]);
  });

  it("K462-API-002 すでに読んだ行：もう一度 read true で呼んでも 200・読んだ時刻は最初のまま", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    expect((await markRead(p, id)).status).toBe(200);
    const first = await readAt(id);
    expect(first).not.toBeNull();
    const r = await markRead(p, id);
    expect(r.status).toBe(200);
    expect(((await json(r))["data"] as Item).read).toBe(true);
    expect(await readAt(id)).toEqual(first);
  });

  it("K462-API-003 未読に戻す：read false で read_at が空になり、一覧の未読に出る。未読の行に false でも 200", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge(), readAgoDays: 1 });
    const r = await markRead(p, id, false);
    expect(r.status).toBe(200);
    expect((await json(r))["data"] as Item).toMatchObject({ read: false, read_at: null });
    expect(await readAt(id)).toBeNull();
    expect((await pageOf(p, "unread=true")).data.map((x) => x.id)).toEqual([id]);
    expect((await markRead(p, id, false)).status).toBe(200);
  });

  it("K462-API-004 別の人の行：404 E-NTF-010 で、行は変わらない（notifications の edit を持つ人でも）", async () => {
    await ready();
    const a = await member("押す人");
    const b = await member("宛先の人");
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'notifications', null, 'edit')",
      [T.tenantId, a.id],
    );
    const yours = await notice(b, { kind: "bridge.connected", payload: bridge() });
    const r = await markRead(a, yours);
    expect(r.status).toBe(404);
    expect((await json(r))["code"]).toBe(GONE);
    expect(await readAt(yours)).toBeNull();
  });

  it("K462-API-005 別の会社の人・無い id：404 E-NTF-010（有るかどうかを答えから分けられない）", async () => {
    await ready();
    const a = await member("宛先の人");
    const id = await notice(a, { kind: "bridge.connected", payload: bridge() });
    const other = await markRead(outsider, id);
    const none = await markRead(outsider, "00000000-0000-4000-8000-0000000000aa");
    expect(other.status).toBe(404);
    expect(none.status).toBe(404);
    expect(await json(other)).toEqual(await json(none));
    expect(await readAt(id)).toBeNull();
  });

  it("K462-API-006 一覧に出ない行は 404：メールの印の行・消した行・知らない種類・見えないチケットの行。行は変わらない", async () => {
    await ready();
    const p = await member("読む人");
    const other = await member("担当の人");
    const hiddenTicket = await ticket({ assignee: other, title: "読めないチケット" });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [hiddenTicket.id]);
    const rows = [
      await notice(p, { kind: "bridge.connected", channel: "email", payload: bridge() }),
      await notice(p, { kind: "bridge.connected", deleted: true, payload: bridge() }),
      await notice(p, { kind: "future.unknown_kind", payload: {} }),
      await notice(p, { kind: "approval.requested", payload: ticketPayload(hiddenTicket, "読めないチケット") }),
    ];
    for (const id of rows) {
      const r = await markRead(p, id);
      expect(r.status, id).toBe(404);
      expect(await readAt(id), id).toBeNull();
    }
  });

  it("K462-API-007 入力の形：read が無い・真偽でない・知らない欄（member_id・sent_at など）は 422。行は変わらない", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    const bad: unknown[] = [
      {},
      { read: "yes" },
      { read: 1 },
      { read: null },
      { read: true, member_id: p.id },
      { read: true, sent_at: "2026-11-20T00:00:00Z" },
    ];
    for (const body of bad) {
      const r = await req("PATCH", `/notifications/${id}`, { body, headers: auth(p) });
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
    expect(await readAt(id)).toBeNull();
    expect((await rowOf(id))!["member_id"]).toBe(p.id);
  });

  it("K462-API-008 全部既読：201 で { read: 件数 }。自分の未読が全部 read_at を持ち、別の人の行・別の会社の行・メールの印の行は変わらない", async () => {
    await ready();
    const p = await member("読む人");
    const b = await member("別の人");
    const mine = [
      await notice(p, { kind: "bridge.connected", payload: bridge("1"), ageMin: 3 }),
      await notice(p, { kind: "bridge.connected", payload: bridge("2"), ageMin: 2 }),
      await notice(p, { kind: "bridge.connected", payload: bridge("3"), ageMin: 1 }),
    ];
    const yours = await notice(b, { kind: "bridge.connected", payload: bridge() });
    const mail = await notice(p, { kind: "bridge.connected", channel: "email", payload: bridge() });
    const theirs = await notice(outsider, { kind: "bridge.connected", payload: bridge() });
    const r = await readAll(p);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(((await json(r))["data"] as { read: number }).read).toBe(3);
    for (const id of mine) expect(await readAt(id), id).not.toBeNull();
    for (const id of [yours, mail, theirs]) expect(await readAt(id), id).toBeNull();
    expect((await pageOf(p, "unread=true")).data).toEqual([]);
    expect((await pageOf(p)).data).toHaveLength(3);
  });

  it("K462-API-009 何度呼んでも同じ：2 回目は { read: 0 }・読んだ時刻は変わらない。最初から 1 件も無い人も 201 で { read: 0 }", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    expect(((await json(await readAll(p)))["data"] as { read: number }).read).toBe(1);
    const first = await readAt(id);
    const again = await readAll(p);
    expect(again.status).toBe(201);
    expect(((await json(again))["data"] as { read: number }).read).toBe(0);
    expect(await readAt(id)).toEqual(first);
    const empty = await member("何も無い人");
    const r = await readAll(empty);
    expect(r.status).toBe(201);
    expect(((await json(r))["data"] as { read: number }).read).toBe(0);
  });

  it("K462-API-010 全部既読の対象：読んだ行の時刻は変えない。一覧に出ない未読（見えないチケット・知らない種類）は読んだことにしない", async () => {
    await ready();
    const p = await member("読む人");
    const other = await member("担当の人");
    const hiddenTicket = await ticket({ assignee: other, title: "読めないチケット" });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [hiddenTicket.id]);
    const already = await notice(p, { kind: "bridge.connected", payload: bridge(), readAgoDays: 3 });
    const before = await readAt(already);
    const shown = await notice(p, { kind: "bridge.connected", payload: bridge(), ageMin: 1 });
    const hidden = await notice(p, {
      kind: "approval.requested",
      payload: ticketPayload(hiddenTicket, "読めないチケット"),
    });
    const unknown = await notice(p, { kind: "future.unknown_kind", payload: {} });
    const r = await readAll(p);
    expect(((await json(r))["data"] as { read: number }).read).toBe(1);
    expect(await readAt(already)).toEqual(before);
    expect(await readAt(shown)).not.toBeNull();
    expect(await readAt(hidden)).toBeNull();
    expect(await readAt(unknown)).toBeNull();
  });

  it("K462-API-011 全部既読の入力：知らない欄（unread・member_id など）は 422 で、行は変わらない", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    for (const body of [{ unread: true }, { member_id: p.id }, { read: true }]) {
      expect((await readAll(p, body)).status, JSON.stringify(body)).toBe(422);
    }
    expect(await readAt(id)).toBeNull();
  });

  it("K462-API-012 二度押し・同時：同じ行を同時に 2 回既読にしても両方 200・読んだ時刻は 1 つ。全部既読を同時に 2 回呼ぶと、読んだ数は合わせて行の数", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge(), ageMin: 5 });
    const [a, b] = await Promise.all([markRead(p, id), markRead(p, id)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await readAt(id)).not.toBeNull();
    const q = await member("読む人 2");
    for (let i = 1; i <= 4; i++) await notice(q, { kind: "bridge.connected", payload: bridge(`PC ${i}`), ageMin: i });
    const [x, y] = await Promise.all([readAll(q), readAll(q)]);
    expect([x.status, y.status]).toEqual([201, 201]);
    const sum = ((await json(x))["data"] as { read: number }).read + ((await json(y))["data"] as { read: number }).read;
    expect(sum).toBe(4);
  });

  it("K462-API-013 ログインしていない：どちらも 401 で、行は変わらない", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    expect((await req("PATCH", `/notifications/${id}`, { body: { read: true } })).status).toBe(401);
    expect((await req("POST", "/notifications/read-all", { body: {} })).status).toBe(401);
    expect(await readAt(id)).toBeNull();
  });

  it("K462-API-014 上限：同じ人が上限を超えたら、どちらの口も 429 と retry_after_sec（1〜60 の整数）", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    limits["readNotification"] = 1;
    limits["readAllNotifications"] = 1;
    try {
      expect((await markRead(p, id)).status).toBe(200);
      const r1 = await markRead(p, id);
      expect(r1.status).toBe(429);
      expect((await readAll(p)).status).toBe(201);
      const r2 = await readAll(p);
      expect(r2.status).toBe(429);
      for (const r of [r1, r2]) {
        const s = Number((await json(r))["retry_after_sec"]);
        expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
      }
    } finally {
      delete limits["readNotification"];
      delete limits["readAllNotifications"];
    }
  });

  it("K462-API-015 貯めない：どちらの答えも Cache-Control に private と no-store", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    for (const [r, want] of [
      [await markRead(p, id), 200],
      [await readAll(p), 201],
    ] as const) {
      expect(r.status).toBe(want);
      const cc = r.headers.get("cache-control") ?? "";
      expect(cc).toContain("private");
      expect(cc).toContain("no-store");
    }
  });

  it("K462-API-016 2 層目：行の守りをわざと緩めても、口の文の条件で別の人の行は 404・全部既読は別の人の行を触らない", async () => {
    await ready();
    const a = await member("押す人");
    const b = await member("宛先の人");
    const mine = await notice(a, { kind: "bridge.connected", payload: bridge() });
    const yours = await notice(b, { kind: "bridge.connected", payload: bridge() });
    await loosened(async () => {
      const r = await markRead(a, yours);
      expect(r.status).toBe(404);
      expect((await readAll(a)).status).toBe(201);
    });
    expect(await readAt(yours)).toBeNull();
    expect(await readAt(mine)).not.toBeNull();
  });

  it("K462-API-017 失敗（DB に書く）：既読にする書き込みが DB に断られたら 503 E-PAGE-003 で、行は未読のまま", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    await breakUpdate(id, async () => {
      const r = await markRead(p, id);
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    });
    expect(await readAt(id)).toBeNull();
    expect((await markRead(p, id)).status).toBe(200);
  });

  it("K462-API-018 失敗（DB に書く・全部既読）：1 行でも書き込みが断られたら 503 E-PAGE-003 で、1 行も読んだことにならない（1 つの取引）", async () => {
    await ready();
    const p = await member("読む人");
    const ids = [
      await notice(p, { kind: "bridge.connected", payload: bridge("1"), ageMin: 3 }),
      await notice(p, { kind: "bridge.connected", payload: bridge("2"), ageMin: 2 }),
      await notice(p, { kind: "bridge.connected", payload: bridge("3"), ageMin: 1 }),
    ];
    await breakUpdate(ids[1]!, async () => {
      const r = await readAll(p);
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    });
    for (const id of ids) expect(await readAt(id), id).toBeNull();
    expect(((await json(await readAll(p)))["data"] as { read: number }).read).toBe(3);
  });

  it("K462-API-019 失敗（証跡）：読んだ印は証跡（audit_events）に書かない。既読にしても全部既読にしても、証跡の行は増えない", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    const n = async () =>
      Number((await one<{ n: string }>("select count(*) as n from audit_events where tenant_id = $1", [p.tenantId])).n);
    const before = await n();
    expect((await markRead(p, id)).status).toBe(200);
    expect((await readAll(p)).status).toBe(201);
    expect(await n()).toBe(before);
  });
  it("K462-API-020 取引先の人・運営の人は 403：どちらの口も会社の人だけ。行は変わらない", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    for (const role of ["client", "ops"]) {
      const a = await req("PATCH", `/notifications/${id}`, { body: { read: true }, headers: auth(p, { role }) });
      const b = await req("POST", "/notifications/read-all", { body: {}, headers: auth(p, { role }) });
      expect([a.status, b.status], role).toEqual([403, 403]);
    }
    expect(await readAt(id)).toBeNull();
  });
});
