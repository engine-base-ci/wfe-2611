// K-474「一覧の上の数の札（meta.counts）」の単体の試験（口・本物の DB）。名前の頭の行 ID（K474-API-…）は 11_tickets/K-474.md の行の表と 1 対 1。
// 口：GET /api/v1/tickets（listTickets）。答えの meta に counts を足す（数だけの口は作らない・D-128.111・D-144.3）。
//   counts は「自分に関わるもの」（view=mine）の 1 回目（cursor なし）の答えだけに付く。鍵はちょうど 5 つ（数はどれも 0 以上の整数・完了のチケットは数えない）：
//     overdue＝期限が日本時間の今日より前／today＝期限が日本時間の今日／assigned＝担当が自分（AI に任せているものも）／ai＝担当が自分で AI に任せている／
//     approve＝自分が承認する（まだ決めていない）。「渡されたもの」は数えず、鍵も作らない（D-148.13）。
//   数は自分に関わるものの全体で、q・scope_id・K-472 と K-473 の絞り込み・並び・limit では変わらない。見える範囲（行の守り）の中だけを数える。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withDbCount } from "@kaname/db/pool";
import {
  addApproval,
  list,
  listOk,
  make as makeT,
  makeWorld,
  outsideGroup,
  setCols,
  setStage,
  setupList,
  type Counts,
  type Fixture,
  type Person,
  type World,
} from "./list.harness.js";

let f: Fixture;
const world = (prefix = "EG") => makeWorld(f, prefix);
const make = (w: World, o: Parameters<typeof makeT>[2] = {}) => makeT(f, w, o);
const NOW = "2026-11-20T03:00:00Z"; // 日本時間 2026-11-20 12:00
const KEYS = ["ai", "approve", "assigned", "overdue", "today"];

beforeAll(async () => {
  f = await setupList();
}, 60_000);
afterEach(() => {
  vi.useRealTimers();
});
afterAll(async () => {
  await f?.close();
});

const at = (iso = NOW) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};
const counts = async (who: Person, q = "view=mine"): Promise<Counts> => {
  const p = await listOk(f, who, q);
  expect(p.meta.counts, q).toBeDefined();
  return p.meta.counts!;
};
async function ticketWith(
  w: World,
  due: string | null,
  o: { assignee?: Person; ai?: boolean; done?: boolean; scope?: string; by?: Person } = {},
) {
  const t = await make(w, { assignee: o.assignee, scope: o.scope, by: o.by });
  await setCols(f, t.id, { due_on: due, ...(o.ai ? { delegated_to_clone: true } : {}) });
  if (o.done) await setStage(f, t.id, "done");
  return t.id;
}
/** 数えるものが 1 つずつ入った会社：overdue 2（A・F）・today 1（B）・assigned 4（A・B・C・E）・ai 1（C）・approve 1（F） */
async function scenario() {
  const w = await world();
  const a = await ticketWith(w, "2026-11-19");
  const b = await ticketWith(w, "2026-11-20");
  const c = await ticketWith(w, "2026-11-25", { ai: true });
  const d = await ticketWith(w, "2026-11-10", { done: true });
  const e = await ticketWith(w, null);
  const grp = await outsideGroup(f, w);
  const writer = await f.person(w.tenantId, grp, { name: "経理の人", ticketAbility: "edit" });
  const fApprove = await ticketWith({ ...w, me: writer }, "2026-11-18", { assignee: writer, scope: grp, by: writer });
  await addApproval(f, w, fApprove, w.me, grp, writer);
  const g = await ticketWith(w, "2026-11-10", { assignee: w.mate });
  return { w, a, b, c, d, e, f: fApprove, g, grp, writer };
}

describe("K-474 一覧の上の数の札：何を数えるか", () => {
  it("K474-API-001 鍵はちょうど 5 つ（overdue・today・assigned・ai・approve）で、どれも 0 以上の整数。チケットが 1 件も無い会社では全部 0（null にしない）", async () => {
    const w = await world();
    const empty = await counts(w.me, "view=mine&limit=1"); // 1 件も返らない答えにも counts は付く（行が 0 件でも数える）
    expect(Object.keys(empty).sort()).toEqual(KEYS);
    expect(empty).toEqual({ overdue: 0, today: 0, assigned: 0, ai: 0, approve: 0 });
    const s = await scenario();
    at();
    const got = await counts(s.w.me);
    expect(Object.keys(got).sort()).toEqual(KEYS);
    for (const key of KEYS) expect(Number.isInteger((got as unknown as Record<string, number>)[key]), key).toBe(true);
  });

  it("K474-API-002 overdue：自分に関わるもので、期限が日本時間の今日より前の完了でないもの（担当でなく承認するだけのものも数える）。完了・今日の期限・期限なし・山田のものは数えない", async () => {
    const s = await scenario();
    at();
    expect((await counts(s.w.me)).overdue).toBe(2); // A（担当）と F（承認するだけ）
    at("2026-11-19T14:59:59Z"); // 日本時間 11/19 23:59:59：A は今日の期限になり、期限切れは F だけ
    expect((await counts(s.w.me)).overdue).toBe(1);
    at("2026-11-19T15:00:01Z"); // 日本時間 11/20 0:00:01：A が期限切れになる
    expect((await counts(s.w.me)).overdue).toBe(2);
  });

  it("K474-API-003 today：自分に関わるもので、期限が日本時間の今日の完了でないもの。昨日・明日・完了したものは数えない（境目は日本時間の 0 時）", async () => {
    const s = await scenario();
    at("2026-11-20T14:59:59Z"); // 日本時間 11/20 23:59:59
    expect((await counts(s.w.me)).today).toBe(1); // B
    at("2026-11-20T15:00:01Z"); // 日本時間 11/21 0:00:01：B は昨日の期限
    expect((await counts(s.w.me)).today).toBe(0);
    await setCols(f, s.b, { due_on: "2026-11-21" });
    expect((await counts(s.w.me)).today).toBe(1);
    await setStage(f, s.b, "done");
    expect((await counts(s.w.me)).today).toBe(0);
  });

  it("K474-API-004 assigned：担当が自分の完了でないもの（AI に任せているものも・期限なしも数える）。完了・山田の担当・承認するだけのものは数えない", async () => {
    const s = await scenario();
    at();
    expect((await counts(s.w.me)).assigned).toBe(4); // A・B・C・E
    expect((await counts(s.w.mate)).assigned).toBe(1); // G（期限切れでも担当は山田）
    await setStage(f, s.e, "done");
    expect((await counts(s.w.me)).assigned).toBe(3);
  });

  it("K474-API-005 ai：担当が自分で AI に任せている完了でないものだけ。ほかの人の AI・任せていないもの・完了は数えない", async () => {
    const s = await scenario();
    at();
    expect((await counts(s.w.me)).ai).toBe(1); // C
    await ticketWith(s.w, "2026-11-25", { assignee: s.w.mate, ai: true });
    expect((await counts(s.w.me)).ai).toBe(1);
    expect((await counts(s.w.mate)).ai).toBe(1);
    await setStage(f, s.c, "done");
    expect((await counts(s.w.me)).ai).toBe(0);
  });

  it("K474-API-006 approve：自分が承認する（まだ決めていない）ものだけ。決めた・取り下げた・承認の行を消した・チケットを消したものは数えない。グループの外のチケットでも数える", async () => {
    const s = await scenario();
    at();
    expect((await counts(s.w.me)).approve).toBe(1);
    const more: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const t = await ticketWith({ ...s.w, me: s.writer }, "2026-12-30", {
        assignee: s.writer,
        scope: s.grp,
        by: s.writer,
      });
      more.push(await addApproval(f, s.w, t, s.w.me, s.grp, s.writer));
    }
    expect((await counts(s.w.me)).approve).toBe(5);
    await f.admin.query("update approvals set decision = 'approve', decided_at = now() where id = $1", [more[0]]);
    await f.admin.query("update approvals set withdrawn_at = now() where id = $1", [more[1]]);
    await f.admin.query("update approvals set deleted_at = now() where id = $1", [more[2]]);
    const tId = (await f.admin.query<{ t: string }>("select ticket_id as t from approvals where id = $1", [more[3]]))
      .rows[0]!.t;
    await setCols(f, tId, { deleted_at: new Date().toISOString() });
    expect((await counts(s.w.me)).approve).toBe(1);
  });

  it("K474-API-007 渡されたもの（自分が答える渡し・待っている）は数えず、counts に「渡されたもの」の鍵も無い（D-148.13）", async () => {
    const s = await scenario();
    at();
    const before = await counts(s.w.me);
    const handed = await ticketWith(s.w, "2026-11-10", { assignee: s.w.mate, by: s.w.mate });
    await f.admin.query(
      "insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id, state) values ($1, $2, 'pass', $3, $4, 'waiting')",
      [s.w.tenantId, handed, s.w.mate.id, s.w.me.id],
    );
    const after = await counts(s.w.me);
    expect(after).toEqual(before);
    expect(Object.keys(after).sort()).toEqual(KEYS);
  });
});

describe("K-474 一覧の上の数の札：いつ付くか・変わらないもの・見える範囲", () => {
  it("K474-API-008 counts が付くのは「自分に関わるもの」の 1 回目だけ：view=all・次の分（cursor 付き）には付かない（meta は next_cursor だけ）。view を付けない既定は mine なので付く", async () => {
    const s = await scenario();
    at();
    expect(Object.keys((await listOk(f, s.w.me, "view=all")).meta)).toEqual(["next_cursor"]);
    expect((await listOk(f, s.w.me, "")).meta.counts).toBeDefined();
    const first = await listOk(f, s.w.me, "view=mine&limit=1");
    expect(first.meta.counts).toBeDefined();
    expect(first.meta.next_cursor).toBeTruthy();
    const second = await listOk(f, s.w.me, `view=mine&limit=1&cursor=${encodeURIComponent(first.meta.next_cursor!)}`);
    expect(Object.keys(second.meta)).toEqual(["next_cursor"]);
  });

  it("K474-API-009 数は絞り込み・並び・limit で変わらない：q・scope_id・担当者・段・期限の範囲・期限切れ・親・sort・limit・fields を付けても同じ", async () => {
    const s = await scenario();
    at();
    const base = await counts(s.w.me);
    expect(base).toEqual({ overdue: 2, today: 1, assigned: 4, ai: 1, approve: 1 });
    const stage = (await f.admin.query<{ s: string }>("select stage_id as s from tickets where id = $1", [s.a]))
      .rows[0]!.s;
    for (const q of [
      `view=mine&q=${encodeURIComponent("見つからない言葉")}`,
      `view=mine&scope_id=${s.grp}`,
      `view=mine&assignee_id=${s.w.mate.id}`,
      `view=mine&stage_id=${stage}`,
      "view=mine&due_from=2099-01-01",
      "view=mine&overdue=true",
      "view=mine&parent=any",
      "view=mine&sort=updated_at&limit=1",
      "view=mine&fields=scope,priority&done=false",
    ])
      expect(await counts(s.w.me, q), q).toEqual(base);
  });

  it("K474-API-010 見える範囲の中だけを数える：消したチケット・他の人の下書き・他の会社のチケットは数えない", async () => {
    const s = await scenario();
    at();
    const o = await world("OT");
    await ticketWith(o, "2026-11-10");
    const gone = await ticketWith(s.w, "2026-11-10");
    await setCols(f, gone, { deleted_at: new Date().toISOString() });
    const draft = await ticketWith(s.w, "2026-11-10", { assignee: s.w.me, by: s.w.me });
    const imp = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'generic') returning id",
        [s.w.tenantId, s.w.mate.id, s.w.root],
      )
    ).rows[0]!.id;
    await setCols(f, draft, { draft_import_id: imp });
    expect(await counts(s.w.me)).toEqual({ overdue: 2, today: 1, assigned: 4, ai: 1, approve: 1 });
  });

  it("K474-API-011 権限が変わった後：担当のチケットは、担当者のグループの権限を外されても担当として数える。消したら数が減る（見えなくなったものは数えない）", async () => {
    const s = await scenario();
    at();
    const viewer = await f.person(s.w.tenantId, s.w.root, { name: "見る人" });
    const t = await ticketWith({ ...s.w, me: s.writer }, "2026-11-10", {
      assignee: viewer,
      scope: s.grp,
      by: s.writer,
    });
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'view')",
      [s.w.tenantId, viewer.id, s.grp],
    );
    expect((await counts(viewer)).assigned, "グループの見る権限がある間").toBe(1);
    await f.admin.query("delete from permissions where grantee_member_id = $1 and scope_id = $2", [viewer.id, s.grp]);
    expect((await counts(viewer)).assigned, "担当者は権限を外されても自分の担当として数える").toBe(1);
    await setCols(f, t, { deleted_at: new Date().toISOString() });
    expect((await counts(viewer)).assigned).toBe(0);
  });

  it("K474-API-012 一覧との整合：overdue の数は mine を overdue=true で絞った件数と同じ・assigned の数は mine を assignee_id=自分・done=false で絞った件数と同じ（絞り込みと数が同じ定義）", async () => {
    const s = await scenario();
    at();
    const c = await counts(s.w.me);
    const overdue = await listOk(f, s.w.me, "view=mine&overdue=true&limit=100");
    expect(overdue.data).toHaveLength(c.overdue);
    const assigned = await listOk(f, s.w.me, `view=mine&assignee_id=${s.w.me.id}&done=false&limit=100`);
    expect(assigned.data).toHaveLength(c.assigned);
  });

  it("K474-API-013 答えの形は変わらない：1 件の鍵は K-92 の 12 個のまま・counts を付けても data の並びと次の分は同じ・counts の鍵は 5 つだけ（総数を返さない）", async () => {
    const s = await scenario();
    at();
    const p = await listOk(f, s.w.me, "view=mine&limit=2");
    // K-92 の 12 個に、段5 の K-560 がいつも付ける scope を足した 13 個（K473-API-016 と同じ数え方）
    expect(Object.keys(p.data[0]!)).toHaveLength(13);
    expect(Object.keys(p.meta).sort()).toEqual(["counts", "next_cursor"]);
    expect(Object.keys(p.meta.counts!).sort()).toEqual(KEYS);
    const r = await list(f, s.w.me, "view=mine&limit=2");
    expect(r.status).toBe(200);
    expect(JSON.stringify(((await r.json()) as { data: unknown }).data)).toBe(JSON.stringify(p.data));
  });
  it("K474-API-014 文の数は増えない：counts の付く「自分に関わるもの」の 1 回目と、counts の付かない view=all・次の分で、1 要求が DB に流す文の数が同じ（counts は同じ 1 文の中で数える・速さの台帳の上限を緩めない）", async () => {
    const s = await scenario();
    at();
    // 入口の最初の middleware（serverTiming）が要求ごとに自分の数え器をかけるので、外側から withDbCount で包んでも口の文は数えられない。
    // 口の before を数え器で包み、口が流した文だけを数える（K468-API-019 が f.hooks を差し替えるのと同じ作法）
    const original = f.hooks["listTickets"]!;
    const statements = async (query: string) => {
      const count = { statements: 0, ms: 0 };
      f.hooks["listTickets"] = { ...original, before: (a) => withDbCount(count, () => original.before!(a)) };
      try {
        const r = await list(f, s.w.me, query);
        expect(r.status, query).toBe(200);
      } finally {
        f.hooks["listTickets"] = original;
      }
      return count.statements;
    };
    const mineFirst = await statements("view=mine&limit=2");
    const allFirst = await statements("view=all&limit=2");
    const first = await listOk(f, s.w.me, "view=mine&limit=2");
    const mineNext = await statements(`view=mine&limit=2&cursor=${encodeURIComponent(first.meta.next_cursor!)}`);
    expect(mineFirst).toBeGreaterThan(0);
    expect(mineFirst).toBe(allFirst);
    expect(mineFirst).toBe(mineNext);
  });

  it("K474-API-015 札の絞りと数が同じ集まり：ai の数は mine を delegated=true・done=false で絞った件数と同じ・approve の数は mine を approving=true・done=false で絞った件数と同じ・today の数は due_from・due_to を今日にして done=false で絞った件数と同じ（K-473 の欄と数が同じ定義）", async () => {
    const s = await scenario();
    at();
    await ticketWith(s.w, "2026-12-01", { assignee: s.w.mate, ai: true });
    const c = await counts(s.w.me);
    expect(c.ai).toBeGreaterThan(0);
    expect(c.approve).toBeGreaterThan(0);
    expect(c.today).toBeGreaterThan(0);
    const ai = await listOk(f, s.w.me, "view=mine&delegated=true&done=false&limit=100");
    expect(ai.data).toHaveLength(c.ai);
    const approve = await listOk(f, s.w.me, "view=mine&approving=true&done=false&limit=100");
    expect(approve.data).toHaveLength(c.approve);
    const today = await listOk(f, s.w.me, "view=mine&due_from=2026-11-20&due_to=2026-11-20&done=false&limit=100");
    expect(today.data).toHaveLength(c.today);
  });
});
