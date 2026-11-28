// K-748「承認待ちを種類で絞る・並べ替える（listApprovalQueue の kind・sort・札の横の種類ごとの数）」の単体の試験（口・本物の DB）。
//   名前の頭の行 ID（K748-API-…）は 11_tickets/K-748.md の行の表と 1 対 1。土台は K-63 の F5/approve-complete.harness.ts と K-732 が持ち込む F5/approval-more.kit.ts（queueMore）。
//   承認待ちの行は、AI の成果物（K-161 の作る段が終わった形 delegated）と、渡しの行（ticket_handovers）を DB に直に置いて作る（渡す口 K-402 は通さない・K-405 の試験と同じ）。
//   試験ごとに新しい人（承認する人）を作り、人どうしで承認待ちを共有しない。
// 口：GET /api/v1/approvals/queue?kind=artifact|handover&sort=due|waiting|title&limit=&cursor=
//   → 200 { data: 行[], meta: { limit, cursor?, counts: { total, artifact, handover } } }。kind か sort を付けたときの続きの鍵は「何件目から」の鍵（付けないときの鍵は今のまま）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の列をずらして置く。
import { describe, expect, it } from "vitest";
import {
  setupApproveComplete,
  f,
  T,
  O,
  writer,
  json,
  one,
  req,
  auth,
  queue,
  ticket,
  delegated,
  jstDate,
  b64url,
  type Ticket,
} from "./approve-complete.harness.js";
import { queueMore } from "./approval-more.kit.js";
import type { Person } from "../fixture.js";

setupApproveComplete();

type Row = {
  id: string;
  kind: string;
  title: string;
  due_on: string | null;
  created_at: string;
  handover_kind?: string | null;
};
const at18 = (day: string) => `${day}T09:00:00.000Z`;
const me = (name: string): Promise<Person> => f.person(T.tenantId, T.rootScope, { name, ticketAbility: "edit" });
const body = async (r: Response) =>
  (await json(r)) as { data: Row[]; meta: { limit: number; cursor?: string; counts: Record<string, number> } };
const ids = (rows: Row[]) => rows.map((x) => x.id);

/** AI の成果物の承認待ちを who の前に 1 つ置く（承認する人＝who・期限は今日から dueDays 日後・承認待ちになったのは agoMin 分前） */
async function ai(who: Person, title: string, dueDays: number | null, agoMin = 5): Promise<{ id: string; t: Ticket }> {
  const t = await ticket({ assignee: who, title, due: dueDays === null ? null : jstDate(dueDays) });
  const d = await delegated(t);
  await f.admin.query("update approvals set created_at = now() - make_interval(mins => $2) where id = $1", [
    d.approvalId,
    agoMin,
  ]);
  return { id: d.approvalId, t };
}
/** 「渡された」の行を who の前に 1 つ置く（渡す口は通さず ticket_handovers に直に置く・返事の期限は replyDays 日後の 18:00） */
async function hand(who: Person, title: string, replyDays: number, agoMin = 5): Promise<string> {
  const t = await ticket({ assignee: writer, title, due: jstDate(20) });
  const r = await one<{ id: string }>(
    `insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id, reason, reply_due, switch, state, created_at, created_by)
     values ($1, $2, 'pass', $3, $4, '来週から別の仕事に入るため', $5, '{}'::jsonb, 'waiting', now() - make_interval(mins => $6), $3) returning id`,
    [t.tenant, t.id, writer.id, who.id, at18(jstDate(replyDays)), agoMin],
  );
  return r.id;
}

describe("K-748 承認待ちを絞る・並べ替える：状態 × 入口 × 利用者の状態", () => {
  it("K748-API-001 絞らず並べ替えもしない（既定）：今までどおり期限の近い順（期限なしは最後）。答えの counts は total・artifact・handover の 3 つで、artifact + handover = total。続きの鍵は今の形のまま", async () => {
    const who = await me("既定の人");
    const a = await ai(who, "A 期限 3 日", 3);
    const b = await ai(who, "B 期限なし", null);
    const c = await hand(who, "C 渡された 返事 1 日", 1, 40);
    const d = await ai(who, "D 期限 1 日", 1, 20);
    const r = await queue(who);
    expect(r.status, await r.clone().text()).toBe(200);
    const j = await body(r);
    expect(ids(j.data)).toEqual([c, d.id, a.id, b.id]);
    expect(j.meta.counts).toEqual({ total: 4, artifact: 3, handover: 1 });
    expect(j.meta.counts["artifact"]! + j.meta.counts["handover"]!).toBe(j.meta.counts["total"]);
    const two = await body(await queue(who, "?limit=2"));
    expect(two.data).toHaveLength(2);
    expect(Buffer.from(two.meta.cursor!, "base64url").toString("utf8").split("|")).toHaveLength(3); // 期限・作った時刻・id の今の鍵
    const rest = await body(await queue(who, `?limit=2&cursor=${two.meta.cursor}`));
    expect(ids([...two.data, ...rest.data])).toEqual(ids(j.data));
  });

  it("K748-API-002 kind=artifact：AI の成果物の行だけ（kind artifact）。期限の近い順のまま。札の横の数（counts）は絞っても全体の数のまま", async () => {
    const who = await me("AI の成果物だけの人");
    const a = await ai(who, "A 期限 3 日", 3);
    const c = await hand(who, "C 渡された", 1);
    const d = await ai(who, "D 期限 1 日", 1);
    const j = await body(await queueMore(who, "?kind=artifact"));
    expect(ids(j.data)).toEqual([d.id, a.id]);
    expect(j.data.every((x) => x.kind === "artifact")).toBe(true);
    expect(j.meta.counts).toEqual({ total: 3, artifact: 2, handover: 1 });
    expect(ids(j.data)).not.toContain(c);
  });

  it("K748-API-003 kind=handover：渡された行だけ（kind handover・handover_kind が付く）。AI の成果物は出ない", async () => {
    const who = await me("渡されただけの人");
    await ai(who, "A 成果物", 2);
    const c = await hand(who, "C 渡された 返事 2 日", 2);
    const e = await hand(who, "E 渡された 返事 1 日", 1);
    const j = await body(await queueMore(who, "?kind=handover"));
    expect(ids(j.data)).toEqual([e, c]);
    expect(j.data.every((x) => x.kind === "handover" && x.handover_kind === "pass")).toBe(true);
    expect(j.meta.counts).toEqual({ total: 3, artifact: 1, handover: 2 });
  });

  it("K748-API-004 sort=due（期限の近い順）：絞らない既定と同じ並び。期限が同じなら承認待ちになった順、それも同じなら id の順。期限なしは最後", async () => {
    const who = await me("期限順の人");
    const a = await ai(who, "A 期限 2 日（新しい）", 2, 1);
    const b = await ai(who, "B 期限 2 日（古い）", 2, 30);
    const c = await ai(who, "C 期限なし", null, 99);
    const d = await ai(who, "D 期限 1 日", 1, 5);
    const byDue = await body(await queueMore(who, "?sort=due"));
    expect(ids(byDue.data)).toEqual([d.id, b.id, a.id, c.id]);
    expect(ids((await body(await queue(who))).data)).toEqual(ids(byDue.data));
  });

  it("K748-API-005 sort=waiting（承認待ちになった順＝新しく承認待ちになった物が先）：承認待ちになった時刻の新しい順・同じなら id の順。期限は並びに効かない", async () => {
    const who = await me("待ち順の人");
    const a = await ai(who, "A 3 分前", 1, 3);
    const b = await ai(who, "B 60 分前", 9, 60);
    const c = await hand(who, "C 渡された 30 分前", 5, 30);
    const j = await body(await queueMore(who, "?sort=waiting"));
    expect(ids(j.data)).toEqual([a.id, c, b.id]);
    const created = j.data.map((x) => Date.parse(x.created_at));
    expect([...created].sort((x, y) => y - x)).toEqual(created);
  });

  it("K748-API-006 sort=title（題名の順）：題名の文字の順・同じ題名なら id の順（試験の題名は英数字の頭で決まる並びにしてある）", async () => {
    const who = await me("題名順の人");
    const c = await ai(who, "C 見積", 1);
    const a = await ai(who, "A 提案書", 9);
    const h = await hand(who, "B 渡された", 5);
    const j = await body(await queueMore(who, "?sort=title"));
    expect(j.data.map((x) => x.title)).toEqual(["A 提案書", "B 渡された", "C 見積"]);
    expect(ids(j.data)).toEqual([a.id, h, c.id]);
  });

  it("K748-API-007 kind と sort の組み合わせ（URL を開き直しても同じ）：kind=artifact&sort=title と kind=handover&sort=waiting。同じ要求を 2 回送ると同じ並び", async () => {
    const who = await me("組み合わせの人");
    await ai(who, "B 成果物 2", 1, 10);
    await ai(who, "A 成果物 1", 2, 20);
    const h1 = await hand(who, "Z 渡された 古い", 5, 50);
    const h2 = await hand(who, "Y 渡された 新しい", 1, 5);
    const x = await body(await queueMore(who, "?kind=artifact&sort=title"));
    expect(x.data.map((r) => r.title)).toEqual(["A 成果物 1", "B 成果物 2"]);
    const y1 = await body(await queueMore(who, "?kind=handover&sort=waiting"));
    const y2 = await body(await queueMore(who, "?sort=waiting&kind=handover"));
    expect(ids(y1.data)).toEqual([h2, h1]);
    expect(ids(y2.data)).toEqual(ids(y1.data));
  });

  it("K748-API-008 ページの境目（絞った・並べ替えたとき）：limit=2 で 5 件を [2, 2, 1] に分け、重複も飛びも無い。最後の頁には続きの鍵が無い。ちょうど limit 件ぴったりのときも最後の頁に鍵が無い", async () => {
    const who = await me("頁の境目の人");
    for (let i = 1; i <= 5; i++) await ai(who, `P${i} 成果物`, i, 10 * i);
    const seen: string[] = [];
    let cursor: string | undefined;
    const sizes: number[] = [];
    for (let page = 0; page < 5; page++) {
      const r = await body(
        await queueMore(who, `?kind=artifact&sort=waiting&limit=2${cursor ? `&cursor=${cursor}` : ""}`),
      );
      sizes.push(r.data.length);
      seen.push(...ids(r.data));
      cursor = r.meta.cursor;
      if (!cursor) break;
    }
    expect(sizes).toEqual([2, 2, 1]);
    expect(new Set(seen).size).toBe(5);
    const all = await body(await queueMore(who, "?kind=artifact&sort=waiting"));
    expect(seen).toEqual(ids(all.data));
    const exact = await body(await queueMore(who, "?kind=artifact&sort=waiting&limit=5"));
    expect(exact.data).toHaveLength(5);
    expect(exact.meta.cursor).toBeUndefined();
  });

  it("K748-API-009 0 件・1 件：絞った種類に 1 件も無い（kind=handover で渡された物が無い）：200・data 空・続きの鍵なし・counts は全体のまま。1 件だけならその 1 件", async () => {
    const who = await me("0 件の人");
    const a = await ai(who, "A 成果物だけ", 2);
    const none = await body(await queueMore(who, "?kind=handover"));
    expect(none.data).toEqual([]);
    expect(none.meta.cursor).toBeUndefined();
    expect(none.meta.counts).toEqual({ total: 1, artifact: 1, handover: 0 });
    const one1 = await body(await queueMore(who, "?kind=artifact&sort=title"));
    expect(ids(one1.data)).toEqual([a.id]);
    const nobody = await me("何も無い人");
    expect((await body(await queueMore(nobody, "?kind=artifact"))).meta.counts).toEqual({
      total: 0,
      artifact: 0,
      handover: 0,
    });
  });

  it("K748-API-010 並びの値が同じものが多いとき：同じ題名・同じ承認待ちの時刻・同じ期限が並んでも、id の順で並びが安定し、頁をまたいでも重複・飛びが無い（どの sort でも）", async () => {
    const who = await me("同じ値の人");
    const rows = [
      await ai(who, "S 同じ題名", 3, 7),
      await ai(who, "S 同じ題名", 3, 7),
      await ai(who, "S 同じ題名", 3, 7),
    ];
    await f.admin.query(
      "update approvals set created_at = (select min(created_at) from approvals where id = any($1)) where id = any($1)",
      [rows.map((x) => x.id)],
    );
    for (const sort of ["due", "waiting", "title"]) {
      const full = await body(await queueMore(who, `?sort=${sort}`));
      expect(ids(full.data), sort).toEqual([...rows.map((x) => x.id)].sort());
      const p1 = await body(await queueMore(who, `?sort=${sort}&limit=2`));
      const p2 = await body(await queueMore(who, `?sort=${sort}&limit=2&cursor=${p1.meta.cursor}`));
      expect(ids([...p1.data, ...p2.data]), sort).toEqual(ids(full.data));
    }
  });

  it("K748-API-011 入力の形：kind・sort が決まった値以外（Artifact・all・空・知らない値）・limit が 200 を超える・知らない問い合わせの欄：422。何も壊れない。決まった値は通る", async () => {
    const who = await me("入力の人");
    await ai(who, "A 成果物", 1);
    for (const q of [
      "?kind=Artifact",
      "?kind=all",
      "?kind=",
      "?kind=escalate",
      "?sort=newest",
      "?sort=",
      "?sort=TITLE",
      "?limit=201&kind=artifact",
      "?kind=artifact&foo=1",
    ])
      expect((await queueMore(who, q)).status, q).toBe(422);
    for (const q of ["?kind=artifact", "?kind=handover", "?sort=due", "?sort=waiting", "?sort=title"])
      expect((await queueMore(who, q)).status, q).toBe(200);
  });

  it("K748-API-012 続きの鍵：kind・sort を付けた要求の鍵を、付けない要求や別の絞りに使う・付けない要求の鍵を絞った要求に使う・壊れた鍵：422（続きの印が不正です）", async () => {
    const who = await me("鍵を取り違える人");
    for (let i = 1; i <= 3; i++) await ai(who, `P${i}`, i, 10 * i);
    const plain = await body(await queue(who, "?limit=1"));
    const filtered = await body(await queueMore(who, "?kind=artifact&limit=1"));
    expect(plain.meta.cursor).toBeTruthy();
    expect(filtered.meta.cursor).toBeTruthy();
    expect((await queueMore(who, `?kind=artifact&cursor=${plain.meta.cursor}`)).status).toBe(422);
    expect((await queue(who, `?cursor=${filtered.meta.cursor}`)).status).toBe(422);
    expect((await queueMore(who, `?kind=artifact&cursor=${b64url("o|-1")}`)).status).toBe(422);
    expect((await queueMore(who, `?kind=artifact&cursor=${b64url("o|x")}`)).status).toBe(422);
    expect((await queueMore(who, "?kind=artifact&cursor=%%%")).status).toBe(422);
  });

  it("K748-API-013 見える範囲と数：自分が決める物だけ（ほかの人の承認待ちは入らない）。別の会社の人は 0 件。担当者が替わった直後は、前の担当者の絞った一覧と数から消え、新しい担当者に出る", async () => {
    const who = await me("見える範囲の人");
    const other = await me("ほかの人");
    const a = await ai(who, "A 成果物", 2);
    const hid = await hand(who, "C 渡された", 3);
    await ai(other, "別の人の成果物", 1);
    const mine = await body(await queueMore(who, "?kind=artifact"));
    expect(ids(mine.data)).toEqual([a.id]);
    expect(mine.meta.counts).toEqual({ total: 2, artifact: 1, handover: 1 });
    expect(ids((await body(await queueMore(who, "?kind=handover"))).data)).toEqual([hid]);
    const outsider = await f.person(O.tenantId, O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    expect((await body(await queueMore(outsider, "?kind=artifact"))).meta.counts).toEqual({
      total: 0,
      artifact: 0,
      handover: 0,
    });
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [a.t.id, other.id]);
    expect((await body(await queueMore(who, "?kind=artifact"))).data).toEqual([]);
    expect((await body(await queueMore(who, "?kind=artifact"))).meta.counts).toEqual({
      total: 1,
      artifact: 0,
      handover: 1,
    });
    expect(ids((await body(await queueMore(other, "?kind=artifact"))).data)).toContain(a.id);
  });

  it("K748-API-014 DB の関数の守り：app.approval_queue_page・app.approval_queue_counts は security definer・search_path に pg_temp・public から外し kaname_app だけ。中だけで使う app.approval_queue_all は誰にも渡さない。メンバーでない文脈で直に呼ぶと空・0。知らない kind・sort を直に渡すと { error: bad_query }。数の total は app.approval_queue_count と同じ", async () => {
    const acl = await f.admin.query<{
      name: string;
      definer: boolean;
      cfg: string[] | null;
      pub: boolean;
      app: boolean;
    }>(
      `select p.proname as name, p.prosecdef as definer, p.proconfig as cfg,
              has_function_privilege('public', p.oid, 'execute') as pub, has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('approval_queue_page', 'approval_queue_counts', 'approval_queue_all')`,
    );
    const by = Object.fromEntries(acl.rows.map((x) => [x.name, x]));
    for (const n of ["approval_queue_page", "approval_queue_counts"]) {
      expect(by[n], n).toMatchObject({ definer: true, pub: false, app: true });
      expect(by[n]!.cfg?.join(",") ?? "", n).toMatch(/search_path=.*pg_temp/);
    }
    expect(by["approval_queue_all"]).toMatchObject({ definer: true, pub: false, app: false });
    const who = await me("関数を直に呼ぶ人");
    await ai(who, "A 成果物", 1);
    await hand(who, "C 渡された", 2);
    const c = await f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [T.tenantId, who.id],
      );
      const counts = (await c.query<{ v: Record<string, number> }>("select app.approval_queue_counts() as v")).rows[0]!
        .v;
      const total = Number((await c.query<{ n: number }>("select app.approval_queue_count() as n")).rows[0]!.n);
      expect(counts).toEqual({ total: 2, artifact: 1, handover: 1 });
      expect(counts["total"]).toBe(total);
      const bad = (
        await c.query<{ v: Record<string, unknown> }>("select app.approval_queue_page('escalate', 'due', 20, 0) as v")
      ).rows[0]!.v;
      expect(bad).toMatchObject({ error: "bad_query" });
      const badSort = (
        await c.query<{ v: Record<string, unknown> }>("select app.approval_queue_page(null, 'newest', 20, 0) as v")
      ).rows[0]!.v;
      expect(badSort).toMatchObject({ error: "bad_query" });
      await c.query("rollback");
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [T.tenantId, "00000000-0000-0000-0000-000000000000"],
      );
      const none = (
        await c.query<{ v: Record<string, unknown> }>("select app.approval_queue_page(null, 'due', 20, 0) as v")
      ).rows[0]!.v;
      expect(none).toMatchObject({ rows: [], more: false });
      await c.query("rollback");
    } finally {
      c.release();
    }
    expect((await req("GET", "/approvals/queue", { headers: auth(who) })).status).toBe(200);
  });
});
