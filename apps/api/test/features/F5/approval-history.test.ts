// K-750「決めた履歴を読む（listApprovalHistory：自分が決めた AI の成果物の承認・決めと期間で絞る・取り下げられるかの印）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K750-API-…）は 11_tickets/K-750.md の行の表と 1 対 1。土台は K-63 の F5/approve-complete.harness.ts と K-732 が持ち込む F5/approval-more.kit.ts（history）。
//   決めた承認は、口（承認する・差し戻す・止める）を通して作り、決めた時刻だけ DB の列をずらして置く（眠らない）。試験ごとに新しい承認する人を作り、人どうしで履歴を共有しない。
// 口：GET /api/v1/approvals/history?decision=approve|return|stop&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=&cursor=
//   → 200 { data: 行[]（決めた新しい順）, meta: { limit, cursor?, counts: { total, approve, return, stop } } }。
//   行：{ id, ticket_id, ticket_number, title, decision, decided_at, reason, next_actor, withdrawn_at, run_status, can_withdraw }（ちょうど 11 の鍵）。
//   期間の日付は日本時間。counts は決めの札で絞る前（期間では絞った後）の数。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
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
  approve,
  giveBack,
  take,
  finish,
  lastSeen,
  ticket,
  delegated,
  approved,
  b64url,
  type Ticket,
} from "./approve-complete.harness.js";
import { history, stopApproval, loadHook } from "./approval-more.kit.js";
import type { Person } from "../fixture.js";

setupApproveComplete();

type H = {
  id: string;
  ticket_id: string;
  ticket_number: string;
  title: string;
  decision: string;
  decided_at: string;
  reason: string | null;
  next_actor: string | null;
  withdrawn_at: string | null;
  run_status: string | null;
  can_withdraw: boolean;
};
const KEYS = [
  "can_withdraw",
  "decided_at",
  "decision",
  "id",
  "next_actor",
  "reason",
  "run_status",
  "ticket_id",
  "ticket_number",
  "title",
  "withdrawn_at",
];
const body = async (r: Response) =>
  (await json(r)) as { data: H[]; meta: { limit: number; cursor?: string; counts: Record<string, number> } };
const ids = (rows: H[]) => rows.map((x) => x.id);
const me = (name: string): Promise<Person> => f.person(T.tenantId, T.rootScope, { name, ticketAbility: "edit" });
/** 決めた時刻（UTC の字）を置く。決まった承認の決めの列だけを動かす（0063 の守りに触れない） */
const decidedAt = (id: string, iso: string) =>
  f.admin.query("update approvals set decided_at = $2 where id = $1", [id, iso]);
const mk = (who: Person, title: string): Promise<Ticket> => ticket({ assignee: who, title });

async function decideAs(who: Person, how: "approve" | "return" | "stop", title: string, iso?: string) {
  const t = await mk(who, title);
  const d = await delegated(t);
  const r =
    how === "approve"
      ? await approve(who, d.approvalId)
      : how === "return"
        ? await giveBack(who, d.approvalId, `${title} の直し`)
        : await stopApproval(who, d.approvalId);
  expect(r.status, `${how} ${await r.clone().text()}`).toBe(201);
  if (iso) await decidedAt(d.approvalId, iso);
  return { t, id: d.approvalId, d };
}

describe("K-750 決めた履歴を読む：状態 × 入口 × 利用者の状態", () => {
  it("K750-API-001 自分が決めた AI の成果物の承認（承認・差し戻し・止める）だけを新しい順に読む：行の鍵はちょうど 11 個・決めと理由・counts は 4 つ。ほかの人が決めた物・まだ決まっていない承認待ちは入らない", async () => {
    const who = await me("履歴の人");
    const a = await decideAs(who, "approve", "A 承認した", "2026-11-03T01:00:00.000Z");
    const b = await decideAs(who, "return", "B 差し戻した", "2026-11-03T02:00:00.000Z");
    const c = await decideAs(who, "stop", "C 止めた", "2026-11-03T03:00:00.000Z");
    const other = await me("ほかの人");
    await decideAs(other, "approve", "D ほかの人が決めた");
    const open = await mk(who, "E まだ決まっていない");
    await delegated(open);
    const r = await history(who);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const j = await body(r);
    expect(ids(j.data)).toEqual([c.id, b.id, a.id]);
    for (const row of j.data) expect(Object.keys(row).sort()).toEqual(KEYS);
    expect(j.data[0]).toMatchObject({
      decision: "stop",
      title: "C 止めた",
      reason: null,
      ticket_id: c.t.id,
      ticket_number: c.t.number,
    });
    expect(j.data[1]).toMatchObject({ decision: "return", reason: "B 差し戻した の直し", next_actor: "clone" });
    expect(j.data[2]).toMatchObject({ decision: "approve", reason: null, withdrawn_at: null });
    expect(j.meta.counts).toEqual({ total: 3, approve: 1, return: 1, stop: 1 });
    expect(j.meta.limit).toBe(20);
  });

  it("K750-API-002 決めの札（decision=approve・return・stop）：その決めの行だけ。counts は札で絞る前の全体の数のまま（札の横の数）", async () => {
    const who = await me("札の人");
    const a1 = await decideAs(who, "approve", "A1", "2026-11-03T01:00:00.000Z");
    const a2 = await decideAs(who, "approve", "A2", "2026-11-03T02:00:00.000Z");
    const r1 = await decideAs(who, "return", "R1", "2026-11-03T03:00:00.000Z");
    const s1 = await decideAs(who, "stop", "S1", "2026-11-03T04:00:00.000Z");
    const counts = { total: 4, approve: 2, return: 1, stop: 1 };
    const ap = await body(await history(who, "?decision=approve"));
    expect(ids(ap.data)).toEqual([a2.id, a1.id]);
    expect(ap.meta.counts).toEqual(counts);
    expect(ids((await body(await history(who, "?decision=return"))).data)).toEqual([r1.id]);
    expect(ids((await body(await history(who, "?decision=stop"))).data)).toEqual([s1.id]);
    expect((await body(await history(who, "?decision=stop"))).meta.counts).toEqual(counts);
  });

  it("K750-API-003 期間（from・to・日本時間の日付・両端を含む）：日本時間の 23:59:59 は前の日・翌日 0:00:00 は次の日。from だけ・to だけも通る。counts は期間で絞った数", async () => {
    const who = await me("期間の人");
    const edgeA = await decideAs(who, "approve", "前の日の終わり", "2026-11-10T14:59:59.000Z"); // 日本時間 11/10 23:59:59
    const edgeB = await decideAs(who, "approve", "次の日の始まり", "2026-11-10T15:00:00.000Z"); // 日本時間 11/11 00:00:00
    const edgeC = await decideAs(who, "return", "その次の日の終わり", "2026-11-11T14:59:59.000Z"); // 日本時間 11/11 23:59:59
    const day11 = await body(await history(who, "?from=2026-11-11&to=2026-11-11"));
    expect(ids(day11.data)).toEqual([edgeC.id, edgeB.id]);
    expect(day11.meta.counts).toEqual({ total: 2, approve: 1, return: 1, stop: 0 });
    expect(ids((await body(await history(who, "?from=2026-11-10&to=2026-11-10"))).data)).toEqual([edgeA.id]);
    expect(ids((await body(await history(who, "?from=2026-11-11"))).data)).toEqual([edgeC.id, edgeB.id]);
    expect(ids((await body(await history(who, "?to=2026-11-10"))).data)).toEqual([edgeA.id]);
    expect(ids((await body(await history(who, "?from=2026-11-10&to=2026-11-11&decision=return"))).data)).toEqual([
      edgeC.id,
    ]);
  });

  it("K750-API-004 期間の外・逆さま（from が to より後）・決めた物が無い人：200・data 空・続きなし・counts は 0（エラーにしない）", async () => {
    const who = await me("空の期間の人");
    await decideAs(who, "approve", "A", "2026-11-03T01:00:00.000Z");
    const empty = await body(await history(who, "?from=2030-01-01&to=2030-01-31"));
    expect(empty.data).toEqual([]);
    expect(empty.meta.cursor).toBeUndefined();
    expect(empty.meta.counts).toEqual({ total: 0, approve: 0, return: 0, stop: 0 });
    const reversed = await history(who, "?from=2026-12-01&to=2026-11-01");
    expect(reversed.status).toBe(200);
    expect((await body(reversed)).data).toEqual([]);
    const nobody = await me("何も決めていない人");
    const none = await body(await history(nobody));
    expect(none.data).toEqual([]);
    expect(none.meta.counts).toEqual({ total: 0, approve: 0, return: 0, stop: 0 });
  });

  it("K750-API-005 ページの境目：limit=2 で 5 件を [2, 2, 1] に分け、重複も飛びも無い。最後の頁に鍵が無い。1 頁目を読んだ後に新しい決めが増えても、続きの頁に重複も飛びも出ない（鍵は決めた時刻と id）", async () => {
    const who = await me("頁の境目の人");
    const made: string[] = [];
    for (let i = 1; i <= 5; i++) made.push((await decideAs(who, "approve", `H${i}`, `2026-11-0${i}T01:00:00.000Z`)).id);
    const p1 = await body(await history(who, "?limit=2"));
    expect(ids(p1.data)).toEqual([made[4]!, made[3]!]);
    const newer = await decideAs(who, "return", "途中で増えた決め", "2026-11-09T01:00:00.000Z");
    const p2 = await body(await history(who, `?limit=2&cursor=${p1.meta.cursor}`));
    const p3 = await body(await history(who, `?limit=2&cursor=${p2.meta.cursor}`));
    expect([p2.data.length, p3.data.length]).toEqual([2, 1]);
    expect(p3.meta.cursor).toBeUndefined();
    expect(ids([...p1.data, ...p2.data, ...p3.data])).toEqual([made[4]!, made[3]!, made[2]!, made[1]!, made[0]!]);
    expect(ids((await body(await history(who, "?limit=20"))).data)).toEqual([newer.id, ...made.slice().reverse()]);
    expect((await body(await history(who, "?limit=6"))).meta.cursor).toBeUndefined();
  });

  it("K750-API-006 決めた時刻が同じものが多いとき：id の順で並びが安定し、頁をまたいでも重複・飛びが無い", async () => {
    const who = await me("同じ時刻の人");
    const rows = [];
    for (let i = 1; i <= 3; i++) rows.push((await decideAs(who, "approve", `T${i}`, "2026-11-05T01:00:00.000Z")).id);
    const full = await body(await history(who));
    expect(ids(full.data)).toEqual([...rows].sort().reverse());
    const p1 = await body(await history(who, "?limit=2"));
    const p2 = await body(await history(who, `?limit=2&cursor=${p1.meta.cursor}`));
    expect(ids([...p1.data, ...p2.data])).toEqual(ids(full.data));
  });

  it("K750-API-007 取り下げられるかの印（can_withdraw）：承認して PC がまだ受け取っていないときだけ true。PC が受け取った・終わった・取り下げた・差し戻し・止めたは false。run_status は承認の後の実行の様子（queued・running・done・cancelled・無ければ null）", async () => {
    const who = await me("取り下げの印の人");
    const q = await approved(await mk(who, "待っている"));
    const run = await approved(await mk(who, "動いている"));
    await lastSeen(run.pc.sid, 1);
    expect((await take(run.pc))?.id).toBe(run.execJobId);
    const done = await approved(await mk(who, "終わった"));
    await lastSeen(done.pc.sid, 1);
    expect((await take(done.pc))?.id).toBe(done.execJobId);
    await finish(done.pc, done.execJobId, { state: "done", result: "送りました", agent_session_id: done.agentSession });
    const wd = await approved(await mk(who, "取り下げた"));
    const { withdrawApproval } = await import("./approval-more.kit.js");
    expect((await withdrawApproval(who, wd.approvalId)).status).toBe(201);
    const ret = await decideAs(who, "return", "差し戻した");
    const stp = await decideAs(who, "stop", "止めた");
    const j = await body(await history(who, "?limit=50"));
    const by = Object.fromEntries(j.data.map((x) => [x.title, x]));
    expect(by["待っている"]).toMatchObject({
      decision: "approve",
      can_withdraw: true,
      run_status: "queued",
      withdrawn_at: null,
    });
    expect(by["動いている"]).toMatchObject({ can_withdraw: false, run_status: "running" });
    expect(by["終わった"]).toMatchObject({ can_withdraw: false, run_status: "done" });
    expect(by["取り下げた"]).toMatchObject({ decision: "approve", can_withdraw: false, run_status: "cancelled" });
    expect(by["取り下げた"]!.withdrawn_at).not.toBeNull();
    expect(by["差し戻した"]).toMatchObject({ can_withdraw: false, run_status: null });
    expect(by["止めた"]).toMatchObject({ can_withdraw: false, run_status: null });
    expect(q.approvalId).toBeTruthy();
    expect(ret.id && stp.id).toBeTruthy();
  });

  it("K750-API-008 取り下げた承認は decision approve のまま withdrawn_at つきで残り、取り下げて新しくできた承認待ち（まだ決まっていない）は出ない。次の承認が決まれば別の行として出る", async () => {
    const who = await me("取り下げて決め直す人");
    const a = await approved(await mk(who, "決め直す"));
    const { withdrawApproval } = await import("./approval-more.kit.js");
    const w = await withdrawApproval(who, a.approvalId);
    expect(w.status, await w.clone().text()).toBe(201);
    const fresh = ((await json(w)).data as { approval_id: string }).approval_id;
    const j1 = await body(await history(who));
    expect(ids(j1.data)).toEqual([a.approvalId]);
    expect(j1.data[0]).toMatchObject({ decision: "approve", can_withdraw: false });
    expect(j1.meta.counts["total"]).toBe(1);
    expect((await approve(who, fresh)).status).toBe(201);
    const j2 = await body(await history(who));
    expect(j2.data).toHaveLength(2);
    expect(ids(j2.data)).toContain(fresh);
  });

  it("K750-API-009 見える範囲：自分が決めた承認だけ。担当者が替わった後も自分が決めた物は出る・消したチケットの物は出ない・別の会社の人は 0 件・自分が答えた渡し（渡された）は履歴に出ない", async () => {
    const who = await me("見える範囲の人");
    const kept = await decideAs(who, "approve", "担当が替わる");
    const gone = await decideAs(who, "return", "消したチケット");
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [kept.t.id, writer.id]);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.t.id]);
    const ht = await ticket({ assignee: writer, title: "渡された" });
    await f.admin.query(
      `insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id, reason, switch, state, decided_at, created_by)
       values ($1, $2, 'pass', $3, $4, '来週から別の仕事', '{}'::jsonb, 'accepted', now(), $3)`,
      [ht.tenant, ht.id, writer.id, who.id],
    );
    const j = await body(await history(who));
    expect(ids(j.data)).toEqual([kept.id]);
    expect(j.meta.counts).toEqual({ total: 1, approve: 1, return: 0, stop: 0 });
    const outsider = await f.person(O.tenantId, O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    expect((await body(await history(outsider))).data).toEqual([]);
  });

  it("K750-API-010 入力の形：decision が決まった値以外（self_edit・all・Approve・空）・from・to が日付でない（2026/11/01・暦に無い日・空）・limit が 0・201・知らない欄・壊れた鍵：422。決まった値は 200", async () => {
    const who = await me("入力の人");
    await decideAs(who, "approve", "A");
    for (const q of [
      "?decision=self_edit",
      "?decision=all",
      "?decision=Approve",
      "?decision=",
      "?from=2026/11/01",
      "?from=2026-02-30",
      "?from=",
      "?to=11-01",
      "?to=2026-13-01",
      "?limit=0",
      "?limit=201",
      "?foo=1",
      "?cursor=%%%",
      `?cursor=${b64url("x")}`,
      `?cursor=${b64url("2026-11-01T00:00:00Z|not-a-uuid")}`,
    ])
      expect((await history(who, q)).status, q).toBe(422);
    for (const q of [
      "?decision=approve",
      "?decision=return",
      "?decision=stop",
      "?from=2026-11-01&to=2026-11-30",
      "?limit=200",
    ])
      expect((await history(who, q)).status, q).toBe(200);
  });

  it("K750-API-011 ログインしていない・PC の印・先方の人（権限）の画面：401（PC・先方の人は 403 か 401）。上限（1 分に 61 回）：429 と待つ秒数", async () => {
    await loadHook("approval-history", "listApprovalHistory");
    const who = await me("上限の人");
    expect((await req("GET", "/approvals/history")).status).toBe(401);
    const viaPc = await req("GET", "/approvals/history", { headers: { "x-bridge-session": "x".repeat(40) } });
    expect([401, 403]).toContain(viaPc.status);
    const viaClient = await req("GET", "/approvals/history", { headers: auth(who, { role: "client" }) });
    expect([401, 403]).toContain(viaClient.status);
    const { limits } = await import("./approve-complete.harness.js");
    const saved = limits["listApprovalHistory"];
    delete limits["listApprovalHistory"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await history(who);
      expect(last!.status).toBe(429);
      const sec = Number((await json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) limits["listApprovalHistory"] = saved;
    }
  });

  it("K750-API-012 DB の関数の守り（2 層目）：app.approval_history は security definer・search_path に pg_temp・public から外し kaname_app だけ。メンバーでない文脈で直に呼ぶと空・知らない decision を直に渡すと { error: bad_query }。呼んだ人が決めた物しか返さない", async () => {
    const fn = await one<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
      `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'approval_history'`,
    );
    expect(fn).toMatchObject({ definer: true, pub: false, app: true });
    expect(fn.cfg?.join(",") ?? "").toMatch(/search_path=.*pg_temp/);
    const who = await me("関数を直に呼ぶ人");
    const mine = await decideAs(who, "approve", "A");
    const other = await me("ほかの人");
    await decideAs(other, "approve", "B");
    const c = await f.pool.connect();
    try {
      for (const [user, expectIds] of [
        [who.id, [mine.id]],
        [randomUUID(), []],
      ] as const) {
        await c.query("begin");
        await c.query(
          "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
          [T.tenantId, user],
        );
        const v = (
          await c.query<{ v: { rows: { id: string }[] } }>(
            "select app.approval_history(null, null, null, 20, null, null) as v",
          )
        ).rows[0]!.v;
        expect(v.rows.map((x) => x.id)).toEqual(expectIds);
        const bad = (
          await c.query<{ v: Record<string, unknown> }>(
            "select app.approval_history('self_edit', null, null, 20, null, null) as v",
          )
        ).rows[0]!.v;
        expect(bad).toMatchObject({ error: "bad_query" });
        await c.query("rollback");
      }
    } finally {
      c.release();
    }
  });
});
