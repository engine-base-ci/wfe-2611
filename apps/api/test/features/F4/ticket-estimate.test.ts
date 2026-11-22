// K-583「updateTicket の組『予定時間』」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K583-API-…）は 11_tickets/K-583.md の行の表に 1 対 1 で結ぶ。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（口と欄ごとの処理の表は段 7 の K-387・段 5 の K-440・K-564 が作る。この葉が組 ticketEstimate を足す）:
//   updateTicket  PATCH /api/v1/tickets/:id   body：estimate_minutes = 整数 0〜100000（分）か null（空にする）
//     200 { data: { ticket: { id, number, updated_at, estimate_minutes }, changed, message_id } }（送った組の列だけ ticket に載る）
//     422（契約に書ける形の誤り・欄 estimate_minutes）：整数でない（1.5・"60"・true・並び）・0 未満・100000 より大きい
//     403 FORBIDDEN（書けない人）／404 E-PAGE-001（無い・見えない・消した・別の会社のチケット）／500 E-PAGE-003（書く所の DB の失敗）
//     完了したチケットでも・仕組みの段（承認待ち）の間でも変えられる（K-387 の実績と同じ。段を変えるのだけが断られる）
//     同じ値は何も書かず changed false。1 回の要求は全部通るか全部戻る（ほかの組が断られたら予定時間も書かない）
//   やり取りの変更の 1 行（ticket_messages の kind change・1 回の要求に 1 行）：
//     「〈名前〉が予定時間を〈前〉 → 〈後〉に変えました」。値の見せ方：0〜59 は「N 分」・60 の倍数は「H 時間」・それ以外は「H 時間 M 分」・空は「（空）」
//     changes は [{ field: "estimate_minutes", from: 見せ方の字か null, to: 見せ方の字か null, raw_from: 分の整数か null, raw_to: 分の整数か null }]
//     （raw_from・raw_to は版の戻し K-576 が戻すのに使う生の値）
//   証跡 audit_events の action は ticket.estimate（payload は { fields: ["estimate_minutes"] }）
//   担当者への知らせ（D-150.32 と同じ形）：担当者でない人が変えたとき担当者の受け箱に ticket.sort_changed を 1 つ（payload は fields = ["estimate_minutes"]）
// DB の関数（packages/db/migrations/20261122101300_ticket_estimate_set.sql）:
//   app.ticket_estimate_set(p_ticket uuid, p jsonb) returns jsonb … p は { "estimate_minutes": 整数か null }。
//     答え { changed, message_id, estimate_minutes } か { error: not_member | not_found | not_writable | bad_minutes }
//
// 口の振る舞い（K-387 の apps/api/src/hooks/ticket-update.ts の register）は、試験の本体（it の中）の ready() で 1 回だけ読む。
//   まだ無いファイルを準備で読んで準備ごと落とさないため（準備の赤と本体の赤を分ける・answer=8f745003d023）。
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
let loaded = false;
async function ready(): Promise<void> {
  if (loaded) return;
  const m = (await import(join(HERE, "..", "..", "..", "src", "hooks", "ticket-update.ts"))) as {
    register: HookModule;
  };
  Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
  loaded = true;
}
beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
}, 60_000);
afterAll(async () => {
  await f?.close();
});

type Json = Record<string, unknown>;
const asJson = async (r: Response): Promise<Json> => (await r.json()) as Json;
const sorted = (o: object): string[] => Object.keys(o).sort();
const bare = (j: Json): void => {
  for (const k of ["field", "details", "detail"]) expect(Object.keys(j), `${k} を付けない`).not.toContain(k);
};
const jst = (days = 0): string => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
/** 予定時間の見せ方（分 → 字） */
const show = (m: number | null): string =>
  m === null
    ? "（空）"
    : m < 60
      ? `${m} 分`
      : m % 60 === 0
        ? `${m / 60} 時間`
        : `${Math.floor(m / 60)} 時間 ${m % 60} 分`;

interface World {
  tenantId: string;
  root: string;
  kindId: string;
  boss: Person;
  mate: Person;
  viewer: Person;
  stranger: Person;
}
async function world(): Promise<World> {
  await ready();
  const c = await f.company(`K583 の会社 ${Math.random().toString(36).slice(2, 7)}`, "ES");
  const kindId = (
    await f.admin.query<{ id: string }>(
      "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
      [c.tenantId],
    )
  ).rows[0]!.id;
  const boss = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
  const mate = await f.person(c.tenantId, c.rootScope, { name: "営業の人", ticketAbility: "edit" });
  const viewer = await f.person(c.tenantId, c.rootScope, { name: "読むだけの人", ticketAbility: "view" });
  // 見えない人は、根の下の別のグループの席に置く（根の席の人は権限が無くても根のチケットが見える＝visible_scopes は席のグループとその下を見せる。2026-11-22 K-434・K-563 の作る段で出た誤り）
  const otherScope = (
    await f.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, '別のグループ', 'OT', $2) returning id",
      [c.tenantId, c.rootScope],
    )
  ).rows[0]!.id;
  const stranger = await f.person(c.tenantId, otherScope, { name: "見えない人", ticketAbility: null });
  return { tenantId: c.tenantId, root: c.rootScope, kindId, boss, mate, viewer, stranger };
}
async function mk(
  w: World,
  o: { assignee?: string | null; estimate?: number | null } = {},
): Promise<{ id: string; number: string }> {
  return (
    await f.admin.query<{ id: string; number: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, due_on, assignee_member_id, estimate_minutes)
       select $1, $2, 'pending', $3, (select id from ticket_stages where tenant_id = $1 and key = 'todo'), '予定時間を入れるチケット', $4::date, $5, $6
       returning id, number`,
      [w.tenantId, w.root, w.kindId, jst(3), o.assignee ?? null, o.estimate ?? null],
    )
  ).rows[0]!;
}
const row = async (id: string) =>
  (
    await f.admin.query<{
      estimate_minutes: number | null;
      actual_minutes: number | null;
      priority: string;
      updated_at: Date;
    }>("select estimate_minutes, actual_minutes, priority, updated_at from tickets where id = $1", [id])
  ).rows[0]!;
const lines = async (id: string) =>
  (
    await f.admin.query<{
      body: string;
      changes: { field: string; from: unknown; to: unknown; raw_from: unknown; raw_to: unknown }[];
      author_member_id: string | null;
    }>(
      "select body, changes, author_member_id from ticket_messages where ticket_id = $1 and kind = 'change' order by created_at, id",
      [id],
    )
  ).rows;
const audits = async (tenantId: string): Promise<Json[]> =>
  (
    await f.admin.query(
      "select * from audit_events where tenant_id = $1 and action = 'ticket.estimate' order by occurred_at",
      [tenantId],
    )
  ).rows as Json[];
const notesOf = async (ticketId: string): Promise<Json[]> =>
  (
    await f.admin.query(
      "select * from notifications where event_kind_id = 'ticket.sort_changed' and payload->>'ticket_id' = $1 order by created_at, id",
      [ticketId],
    )
  ).rows as Json[];
const patch = (who: Person | null, id: string, body: unknown) =>
  f.req("PATCH", `/tickets/${id}`, { headers: who ? who.auth : {}, body });
async function patchOk(who: Person, id: string, body: unknown): Promise<Json> {
  const r = await patch(who, id, body);
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await asJson(r))["data"] ?? {}) as Json;
}
const estSet = (who: { id: string; tenantId: string }, ticket: string, p: object): Promise<Json> =>
  withTenant(
    f.pool,
    { tenantId: who.tenantId, userId: who.id, role: "member", stepUpAt: null },
    async (cl) =>
      (
        await cl.query<{ v: Json }>("select app.ticket_estimate_set($1::uuid, $2::jsonb) as v", [
          ticket,
          JSON.stringify(p),
        ])
      ).rows[0]!.v,
  );

/** 指定した表への insert だけを、その条件のときに落とす引き金（ほかの会社・ほかの試験に当たらない） */
async function failingInsert(table: string, cond: string, body: () => Promise<void>): Promise<void> {
  const name = `k583_fail_${Math.random().toString(36).slice(2, 8)}`;
  await f.admin.query(
    `create function public.${name}() returns trigger language plpgsql as $$ begin raise exception 'K-583 の試験でわざと落とした'; end $$`,
  );
  await f.admin.query(
    `create trigger ${name} before insert on ${table} for each row when (${cond}) execute function public.${name}()`,
  );
  try {
    await body();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on ${table}`);
    await f.admin.query(`drop function if exists public.${name}()`);
  }
}

describe("K-583 予定時間の組（updateTicket・本物の DB）", () => {
  it("K583-API-001 予定時間を入れる：200・列が入る・答えの ticket の鍵は id・number・updated_at・estimate_minutes・やり取りに 1 行・証跡が 1 行", async () => {
    const w = await world();
    const t = await mk(w);
    const d = await patchOk(w.boss, t.id, { estimate_minutes: 90 });
    expect(d["changed"]).toBe(true);
    expect(typeof d["message_id"]).toBe("string");
    const tk = d["ticket"] as Json;
    expect(sorted(tk)).toEqual(["estimate_minutes", "id", "number", "updated_at"]);
    expect(tk["estimate_minutes"]).toBe(90);
    expect((await row(t.id)).estimate_minutes).toBe(90);
    const ls = await lines(t.id);
    expect(ls.length).toBe(1);
    expect(ls[0]).toMatchObject({
      author_member_id: w.boss.id,
      body: "高本が予定時間を（空） → 1 時間 30 分に変えました",
    });
    expect(ls[0]!.changes).toEqual([
      { field: "estimate_minutes", from: null, to: "1 時間 30 分", raw_from: null, raw_to: 90 },
    ]);
    const au = await audits(w.tenantId);
    expect(au.length).toBe(1);
    expect(au[0]).toMatchObject({ target_type: "tickets", target_id: t.id });
    expect(au[0]!["payload"]).toEqual({ fields: ["estimate_minutes"] });
  });

  it("K583-API-002 値の見せ方：0 → 「0 分」・45 → 「45 分」・60 → 「1 時間」・90 → 「1 時間 30 分」・3000 → 「50 時間」・100000 → 「1666 時間 40 分」。changes の raw は分の整数", async () => {
    const w = await world();
    const t = await mk(w);
    let prev: number | null = null;
    for (const m of [0, 45, 60, 90, 3000, 100000]) {
      await patchOk(w.boss, t.id, { estimate_minutes: m });
      const last = (await lines(t.id)).at(-1)!;
      expect(last.body, String(m)).toBe(`高本が予定時間を${show(prev)} → ${show(m)}に変えました`);
      expect(last.changes, String(m)).toEqual([
        { field: "estimate_minutes", from: prev === null ? null : show(prev), to: show(m), raw_from: prev, raw_to: m },
      ]);
      expect((await row(t.id)).estimate_minutes, String(m)).toBe(m);
      prev = m;
    }
  });

  it("K583-API-003 空にする：null で列が null・やり取りの行は「予定時間を1 時間 30 分 → （空）に」で changes の to と raw_to が null（raw_from は前の値）。入れ直せる", async () => {
    const w = await world();
    const t = await mk(w, { estimate: 90 });
    const d = await patchOk(w.boss, t.id, { estimate_minutes: null });
    expect(d["changed"]).toBe(true);
    expect((d["ticket"] as Json)["estimate_minutes"]).toBeNull();
    expect((await row(t.id)).estimate_minutes).toBeNull();
    const ls = await lines(t.id);
    expect(ls[0]!.body).toBe("高本が予定時間を1 時間 30 分 → （空）に変えました");
    expect(ls[0]!.changes).toEqual([
      { field: "estimate_minutes", from: "1 時間 30 分", to: null, raw_from: 90, raw_to: null },
    ]);
    await patchOk(w.boss, t.id, { estimate_minutes: 30 });
    expect((await row(t.id)).estimate_minutes).toBe(30);
    expect((await lines(t.id)).length).toBe(2);
  });

  it("K583-API-004 変わらない（同じ値・もともと空を空にする）：200・changed false・message_id null・更新時刻・やり取り・証跡・知らせが動かない", async () => {
    const w = await world();
    const same = await mk(w, { assignee: w.mate.id, estimate: 120 });
    const empty = await mk(w, { assignee: w.mate.id });
    const before = (await row(same.id)).updated_at.getTime();
    for (const [t, v] of [
      [same, 120],
      [empty, null],
    ] as const) {
      const d = await patchOk(w.boss, t.id, { estimate_minutes: v });
      expect(d["changed"], t.number).toBe(false);
      expect(d["message_id"], t.number).toBeNull();
      expect((await lines(t.id)).length, t.number).toBe(0);
      expect((await notesOf(t.id)).length, t.number).toBe(0);
    }
    expect((await row(same.id)).updated_at.getTime()).toBe(before);
    expect((await audits(w.tenantId)).length).toBe(0);
  });

  it('K583-API-005 形の誤り：-1・100001・1.5・"60"・true・[60]・{} は 422・欄 estimate_minutes・値もやり取りも変わらない。0 と 100000 は 200', async () => {
    const w = await world();
    const t = await mk(w, { estimate: 60 });
    for (const bad of [-1, 100001, 1.5, "60", true, [60], {}]) {
      const r = await patch(w.boss, t.id, { estimate_minutes: bad });
      expect(r.status, JSON.stringify(bad)).toBe(422);
      const j = await asJson(r);
      expect(
        ((j["details"] as { field: string }[]) ?? []).map((d) => d.field),
        JSON.stringify(bad),
      ).toContain("estimate_minutes");
    }
    expect((await row(t.id)).estimate_minutes).toBe(60);
    expect((await lines(t.id)).length).toBe(0);
    await patchOk(w.boss, t.id, { estimate_minutes: 0 });
    await patchOk(w.boss, t.id, { estimate_minutes: 100000 });
    expect((await row(t.id)).estimate_minutes).toBe(100000);
  });

  it("K583-API-006 完了したチケットでも変えられる（K-387 の実績と同じ）：200・値と変更の 1 行が書かれる・段は完了のまま", async () => {
    const w = await world();
    const t = await mk(w, { estimate: 30 });
    await f.admin.query(
      `update tickets t set stage_id = s.id, completed_at = now(), completed_by = $2
         from ticket_stages s where t.id = $1 and s.tenant_id = t.tenant_id and s.key = 'done'`,
      [t.id, w.boss.id],
    );
    const d = await patchOk(w.boss, t.id, { estimate_minutes: 240 });
    expect(d["changed"]).toBe(true);
    expect((await row(t.id)).estimate_minutes).toBe(240);
    expect((await lines(t.id)).length).toBe(1);
    const st = (
      await f.admin.query<{ completed_at: Date | null; key: string }>(
        "select t.completed_at, s.key from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1",
        [t.id],
      )
    ).rows[0]!;
    expect(st.key).toBe("done");
    expect(st.completed_at).not.toBeNull();
  });

  it("K583-API-007 仕組みの段（承認待ち）の間も変えられる（人の見込みは AI の動きと別・K-387 の実績と同じ）：200・値が入る", async () => {
    const w = await world();
    const t = await mk(w);
    await f.admin.query(
      `update tickets t set stage_id = s.id from ticket_stages s where t.id = $1 and s.tenant_id = t.tenant_id and s.key = 'awaiting_approval'`,
      [t.id],
    );
    await patchOk(w.boss, t.id, { estimate_minutes: 45 });
    expect((await row(t.id)).estimate_minutes).toBe(45);
  });

  it("K583-API-008 ほかの組と一緒：優先度・実績と一緒なら全部通り、変更の行は組ごとに 1 行ずつ。ほかの組が断られたら（自分を親にする 409）予定時間も書かない", async () => {
    const w = await world();
    const t = await mk(w);
    await patchOk(w.boss, t.id, {
      estimate_minutes: 60,
      priority: "high",
      priority_reason: "先方が急ぐ",
      actual_minutes: 15,
    });
    expect(await row(t.id)).toMatchObject({ estimate_minutes: 60, priority: "high", actual_minutes: 15 });
    const ls = await lines(t.id);
    expect(ls.length, "組ごとに 1 行").toBe(3);
    expect(ls.filter((l) => l.changes.some((c) => c.field === "estimate_minutes")).length).toBe(1);
    const u = await mk(w);
    const r = await patch(w.boss, u.id, { estimate_minutes: 30, parent_ticket_id: u.id });
    expect(r.status).toBe(409);
    const j = await asJson(r);
    expect(j["code"]).toBe("E-TKT-001");
    bare(j);
    expect((await row(u.id)).estimate_minutes, "予定時間も書かない").toBeNull();
    expect((await lines(u.id)).length).toBe(0);
    const x = await patch(w.boss, u.id, { estimate_minutes: 30, title: "題名" });
    expect(x.status, "組に無い欄").toBe(422);
    expect((await row(u.id)).estimate_minutes).toBeNull();
  });

  it("K583-API-009 変えられない人：読むだけ 403・見えない・別の会社・無い・消されたチケットは 404（体は error と code だけ）・ログインなし 401。値は書かれない", async () => {
    const w = await world();
    const other = await world();
    const t = await mk(w);
    const gone = await mk(w);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.id]);
    const body = { estimate_minutes: 10 };
    expect((await patch(w.viewer, t.id, body)).status).toBe(403);
    for (const [r, label] of [
      [await patch(w.stranger, t.id, body), "見えない人"],
      [await patch(other.boss, t.id, body), "別の会社の人"],
      [await patch(w.boss, randomUUID(), body), "無いチケット"],
      [await patch(w.boss, gone.id, body), "消されたチケット"],
    ] as const) {
      expect(r.status, label).toBe(404);
      const j = await asJson(r);
      expect(["NOT_FOUND", "E-PAGE-001"], label).toContain(j["code"]);
      bare(j);
    }
    expect((await patch(null, t.id, body)).status).toBe(401);
    expect((await row(t.id)).estimate_minutes).toBeNull();
    expect((await row(gone.id)).estimate_minutes).toBeNull();
    expect((await lines(t.id)).length).toBe(0);
  });

  it("K583-API-010 担当者への知らせ：担当者でない人が変えると担当者の受け箱に 1 通（fields = [estimate_minutes]・値と題名の字なし・メールなし）。本人・担当者なし・止められた担当者・変わらなかったときは増えない", async () => {
    const w = await world();
    const t = await mk(w, { assignee: w.mate.id });
    await patchOk(w.boss, t.id, { estimate_minutes: 77 });
    const one = await notesOf(t.id);
    expect(one.length).toBe(1);
    expect(one[0]).toMatchObject({ member_id: w.mate.id, channel_id: "inapp", event_kind_id: "ticket.sort_changed" });
    const payload = one[0]!["payload"] as { fields: string[]; message_id: string } & Json;
    expect(sorted(payload)).toEqual(["fields", "message_id", "number", "ticket_id", "url"]);
    expect(payload.fields).toEqual(["estimate_minutes"]);
    expect(one[0]!["dedupe_key"]).toBe(`ticket.sort_changed:${payload.message_id}`);
    expect(JSON.stringify(payload)).not.toContain("77");
    expect(JSON.stringify(payload)).not.toContain("予定時間を入れるチケット");
    expect(
      (
        await f.admin.query(
          "select count(*)::int as n from notifications where tenant_id = $1 and channel_id <> 'inapp'",
          [w.tenantId],
        )
      ).rows[0].n,
    ).toBe(0);
    const stopped = await f.person(w.tenantId, w.root, { name: "止められた人", ticketAbility: "edit" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [stopped.id]);
    const own = await mk(w, { assignee: w.boss.id });
    const nobody = await mk(w);
    const gone = await mk(w, { assignee: stopped.id });
    for (const x of [own, nobody, gone]) await patchOk(w.boss, x.id, { estimate_minutes: 5 });
    for (const x of [own, nobody, gone]) expect((await notesOf(x.id)).length, x.number).toBe(0);
    await patchOk(w.boss, t.id, { estimate_minutes: 77 });
    expect((await notesOf(t.id)).length, "同じ値は知らせない").toBe(1);
  });

  it("K583-API-011 失敗（手順 S1・書く所）：証跡を書く所で DB が落ちる → 500・E-PAGE-003・予定時間と変更の 1 行が前のまま・答えに値の字が出ない", async () => {
    const w = await world();
    const t = await mk(w, { estimate: 30 });
    await failingInsert(
      "audit_events",
      `new.tenant_id = '${w.tenantId}' and new.action = 'ticket.estimate'`,
      async () => {
        const r = await patch(w.boss, t.id, { estimate_minutes: 999 });
        const text = await r.text();
        expect(r.status).toBe(500);
        expect(JSON.parse(text).code).toBe("E-PAGE-003");
        expect(text).not.toContain("わざと落とした");
      },
    );
    expect((await row(t.id)).estimate_minutes).toBe(30);
    expect((await lines(t.id)).length).toBe(0);
    expect((await audits(w.tenantId)).length).toBe(0);
  });

  it("K583-API-012 失敗（手順 S2・知らせ）：担当者の受け箱の行を書く所で DB が落ちる → 500・E-PAGE-003・取引ごと戻る（予定時間・変更の 1 行・証跡・知らせが前のまま）", async () => {
    const w = await world();
    const t = await mk(w, { assignee: w.mate.id, estimate: 30 });
    await failingInsert(
      "notifications",
      `new.tenant_id = '${w.tenantId}' and new.event_kind_id = 'ticket.sort_changed'`,
      async () => {
        const r = await patch(w.boss, t.id, { estimate_minutes: 999 });
        const text = await r.text();
        expect(r.status).toBe(500);
        expect(JSON.parse(text).code).toBe("E-PAGE-003");
        expect(text).not.toContain("わざと落とした");
      },
    );
    expect((await row(t.id)).estimate_minutes).toBe(30);
    expect((await lines(t.id)).length).toBe(0);
    expect((await audits(w.tenantId)).length).toBe(0);
    expect((await notesOf(t.id)).length).toBe(0);
  });

  it("K583-API-013 関数を直に叩く：読むだけの人 not_writable・止められた人 not_member・別の会社の人 not_found・範囲外（-1・100001・1.5・文字）bad_minutes。何も変わらない。範囲内は changed と message_id", async () => {
    const w = await world();
    const other = await world();
    const t = await mk(w, { estimate: 20 });
    const stopped = await f.person(w.tenantId, w.root, { name: "止められた人", ticketAbility: "edit" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [stopped.id]);
    expect(await estSet(w.viewer, t.id, { estimate_minutes: 5 })).toMatchObject({ error: "not_writable" });
    expect(await estSet(stopped, t.id, { estimate_minutes: 5 })).toMatchObject({ error: "not_member" });
    expect(await estSet(other.boss, t.id, { estimate_minutes: 5 })).toMatchObject({ error: "not_found" });
    for (const bad of [-1, 100001, 1.5, "60"])
      expect(await estSet(w.boss, t.id, { estimate_minutes: bad }), JSON.stringify(bad)).toMatchObject({
        error: "bad_minutes",
      });
    expect((await row(t.id)).estimate_minutes).toBe(20);
    expect((await lines(t.id)).length).toBe(0);
    const ok = await estSet(w.boss, t.id, { estimate_minutes: 25 });
    expect(ok).toMatchObject({ changed: true, estimate_minutes: 25 });
    expect(typeof ok["message_id"]).toBe("string");
  });

  it("K583-API-014 同時に 2 本：どちらも 200・値はどちらかの値・やり取りの行は changed が true だった数と同じ", async () => {
    const w = await world();
    const t = await mk(w);
    const rs = await Promise.all([
      patch(w.boss, t.id, { estimate_minutes: 90 }),
      patch(w.mate, t.id, { estimate_minutes: 120 }),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    expect([90, 120]).toContain((await row(t.id)).estimate_minutes);
    const changedTrue = (await Promise.all(rs.map(async (r) => ((await asJson(r))["data"] as Json)["changed"]))).filter(
      Boolean,
    ).length;
    expect((await lines(t.id)).length).toBe(changedTrue);
  });

  it("K583-API-015 上限：1 分あたりの上限を超えた updateTicket は 429・retry_after_sec が付き、3 回目は書かれない", async () => {
    const w = await world();
    const t = await mk(w);
    const me = await f.person(w.tenantId, w.root, { name: "数える人", ticketAbility: "edit" });
    f.limits["updateTicket"] = 2;
    try {
      expect((await patch(me, t.id, { estimate_minutes: 1 })).status).toBe(200);
      expect((await patch(me, t.id, { estimate_minutes: 2 })).status).toBe(200);
      const r = await patch(me, t.id, { estimate_minutes: 3 });
      expect(r.status).toBe(429);
      expect(typeof (await asJson(r))["retry_after_sec"]).toBe("number");
    } finally {
      f.limits["updateTicket"] = 100_000;
    }
    expect((await row(t.id)).estimate_minutes).toBe(2);
  });

  it("K583-API-016 変えた後に詳細（GET /tickets/:id）を開き直す・作るときの値（K-60 の見込み）と同じ列：作った予定時間を直せ、実績は動かない", async () => {
    const w = await world();
    const t = await mk(w, { estimate: 60 });
    await f.admin.query("update tickets set actual_minutes = 15 where id = $1", [t.id]);
    await patchOk(w.boss, t.id, { estimate_minutes: 180 });
    const r = await f.req("GET", `/tickets/${t.id}`, { headers: w.boss.auth });
    expect(r.status).toBe(200);
    expect((await row(t.id)).actual_minutes, "実績は別の列").toBe(15);
    expect((await row(t.id)).estimate_minutes).toBe(180);
  });

  it("K583-API-017 契約：updateTicket の入力に estimate_minutes（0〜100000 の整数か null）があり、openapi・registry の入力の形が一致する。断りの番号の置き場 errors.d/K-583.json は無い（422・403・404・500 だけ）", () => {
    const yaml = readFileSync(join(ROOT, "08_api", "openapi.yaml"), "utf-8");
    const at = yaml.indexOf("x-operation: updateTicket");
    expect(at, "openapi.yaml に updateTicket の入力の形が在る").toBeGreaterThan(0);
    const around = yaml.slice(Math.max(0, at - 3000), at + 3000);
    expect(around).toContain("estimate_minutes");
    const schemas = readFileSync(join(ROOT, "packages", "contracts", "src", "schemas.ts"), "utf-8");
    const inputAt = schemas.indexOf("export const TicketUpdateInput = ");
    expect(inputAt, "schemas.ts に TicketUpdateInput が在る").toBeGreaterThan(0);
    const input = schemas.slice(inputAt, schemas.indexOf("});", inputAt));
    expect(input).toMatch(/estimate_minutes/);
    expect(
      existsSync(join(ROOT, "07_qa", "test-specs", "errors.d", "K-583.json")),
      "この葉は断りの番号を足さない（置き場を作らない）",
    ).toBe(false);
  });
});
