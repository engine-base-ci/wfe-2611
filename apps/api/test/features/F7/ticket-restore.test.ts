// K-489「消したものを戻す（restoreTicket）」の単体の試験（口・本物の DB）。名前の頭の行 ID（K489-API-…）は 11_tickets/K-489.md の行の表と 1 対 1。
// 口：POST /api/v1/tickets/:id/restore（体は空）→ 201 { data: { id, restored_count } }
//   戻せる人は、消した本人と、そのグループのマネージャー・管理者（D-128.84）。戻せるのは deleted_at から 30 日以内（D-128.116・過ぎたら 409）。
//   cascade で一緒に消えた子・孫は一緒に戻る（親と同じ deleted_at・deleted_by の物）。子の付け替え（move・detach）・取り下げた承認・止めた AI の実行・取り消した渡しは戻さない。
//   完全に消す（30 日後）は作らない（時間で動く仕組みが無い・P7）。
// 土台は ticket-delete.harness.ts（口の振る舞いは apps/api/src/hooks/ticket-delete.ts・ticket-restore.ts を最初の要求のときに読む）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の行の時刻を動かす。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { data, json, setupDelete, withLimit, type DeleteWorld, type Person } from "./ticket-delete.harness.js";

let w: DeleteWorld;
beforeAll(async () => {
  w = await setupDelete(["ticket-delete", "ticket-restore"]);
}, 90_000);
afterAll(async () => {
  await w?.k.close();
});

const q = <R extends Record<string, unknown>>(sql: string, p: unknown[] = []) => w.k.q<R>(sql, p);
const code = async (r: Response) => (await json(r)).code;
const isDeleted = async (id: string) => (await w.row(id)).deleted_at !== null;
/** 管理の接続で、いまから前に消したことにする（deleted_at を interval だけ前に・消した人を選ぶ） */
const gone = (id: string, by: Person, ago = "0 seconds") =>
  w.k.f.admin.query("update tickets set deleted_at = now() - $3::interval, deleted_by = $2 where id = $1", [
    id,
    by.id,
    ago,
  ]);
const ok = async (p: Person, id: string): Promise<{ id: string; restored_count: number }> => {
  const r = await w.restore(p, id);
  expect(r.status, await r.clone().text()).toBe(201);
  return data(r);
};
const fresh = (name: string) => w.k.f.person(w.k.T.tenantId, w.k.T.rootScope, { name, ticketAbility: "edit" });
const notices = () => w.k.n("select count(*) as n from notifications where tenant_id = $1", [w.k.T.tenantId]);

describe("K-489 戻す：誰が・いつまで", () => {
  it("K489-API-001 消した本人が戻す：201・deleted_at と deleted_by が空に・番号と題名は同じ・updated_by は戻した人・証跡 tickets.restore 1 行。再取得で見える。答えの鍵は 2 個ちょうど・Cache-Control は private と no-store", async () => {
    const t = await w.make(w.creator, { title: "戻す題名" });
    const del = await w.del(w.creator, t);
    expect(del.status).toBe(200);
    const before = await w.row(t);
    const r = await w.restore(w.creator, t);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = (await json(r))["data"] as Record<string, unknown>;
    expect(Object.keys(v).sort()).toEqual(["id", "restored_count"]);
    expect(v).toMatchObject({ id: t, restored_count: 1 });
    const after = await w.row(t);
    expect(after.deleted_at).toBeNull();
    expect(after.deleted_by).toBeNull();
    expect([after.number, after.title]).toEqual([before.number, before.title]);
    expect((await q("select updated_by from tickets where id = $1", [t]))[0]!["updated_by"]).toBe(w.creator.id);
    const audits = await w.audit("tickets.restore", t);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actor_member_id).toBe(w.creator.id);
    expect((await w.k.f.req("GET", `/tickets/${t}`, { headers: w.creator.auth })).status).toBe(200);
    const list = await w.k.f.req("GET", "/tickets?view=all&limit=100", { headers: w.creator.auth });
    expect(((await json(list))["data"] as { id: string }[]).some((x) => x.id === t)).toBe(true);
  });

  it("K489-API-002 そのグループのマネージャー・会社の管理者が、別の人が消した物を戻せる（edit が無くてもよい）", async () => {
    const a = await w.make(w.creator);
    await gone(a, w.creator);
    expect((await ok(w.manager, a)).restored_count).toBe(1);
    const b = await w.make(w.creator);
    await gone(b, w.creator);
    expect((await ok(w.admin, b)).restored_count).toBe(1);
    expect((await w.row(b)).deleted_at).toBeNull();
  });

  it("K489-API-003 消した本人なら、いまの権限が見るだけでも戻せる（消した後に権限が変わっても本人は戻せる）", async () => {
    const t = await w.make(w.creator);
    await gone(t, w.assignee); // 消したのは edit の無い人（作った人でもあったことにする）
    expect((await ok(w.assignee, t)).restored_count).toBe(1);
  });

  it("K489-API-004 戻せない人（消した人でもマネージャー・管理者でもない：書ける別の人・見るだけの人）：403・E-DEL-040。戻らない", async () => {
    const t = await w.make(w.creator);
    await gone(t, w.creator);
    for (const p of [w.editor, w.viewer]) {
      const r = await w.restore(p, t);
      expect(r.status, p.id).toBe(403);
      expect(await code(r), p.id).toBe("E-DEL-040");
    }
    expect(await isDeleted(t)).toBe(true);
    expect(await w.audit("tickets.restore", t)).toHaveLength(0);
  });

  it("K489-API-005 見えない人・無い id：404（別の会社・見えないグループ・無い id）。戻らない（消した物が有ることも漏らさない）", async () => {
    const t = await w.make(w.creator);
    await gone(t, w.creator);
    expect((await w.restore(w.outsider, t)).status).toBe(404);
    expect((await w.restore(w.stranger, t)).status).toBe(404);
    expect((await w.restore(w.creator, randomUUID())).status).toBe(404);
    expect(await isDeleted(t)).toBe(true);
  });

  it("K489-API-006 消えていないチケット（もう戻っている）：マネージャーは 409・E-DEL-041。消した人でもマネージャーでもない人は 403・E-DEL-040", async () => {
    const t = await w.make(w.creator);
    const r = await w.restore(w.manager, t);
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("E-DEL-041");
    expect(((await json(r))["details"] ?? null) === null).toBe(true); // 409 には details を付けない
    const e = await w.restore(w.editor, t);
    expect(e.status).toBe(403);
    expect(await code(e)).toBe("E-DEL-040");
    expect(await w.audit("tickets.restore", t)).toHaveLength(0);
  });

  it("K489-API-007 30 日の境目：29 日 23 時間前に消した物は戻せる・30 日と 1 時間前に消した物は 409・E-DEL-042 で戻らない", async () => {
    const edge = await w.make(w.creator);
    await gone(edge, w.creator, "29 days 23 hours");
    expect((await ok(w.creator, edge)).restored_count).toBe(1);
    const late = await w.make(w.creator);
    await gone(late, w.creator, "30 days 1 hour");
    const r = await w.restore(w.creator, late);
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("E-DEL-042");
    expect(await isDeleted(late)).toBe(true);
    const m = await w.restore(w.manager, late); // マネージャーでも同じ
    expect(m.status).toBe(409);
  });
});

describe("K-489 戻す：子・孫・付け替え・取り下げは戻さない／戻すもの", () => {
  it("K489-API-008 親が消えている子は戻せない（409・E-DEL-043）。親を先に戻せば戻せる", async () => {
    const p = await w.make(w.creator);
    const c = await w.make(w.creator, { parent: p });
    await gone(c, w.creator, "2 days"); // 子を先に消し
    await gone(p, w.creator, "1 day"); // 親を後で消した
    const r = await w.restore(w.creator, c);
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("E-DEL-043");
    expect(await isDeleted(c)).toBe(true);
    await ok(w.creator, p);
    expect((await ok(w.creator, c)).restored_count).toBe(1);
    expect((await w.row(c)).parent_ticket_id).toBe(p);
  });

  it("K489-API-009 cascade で一緒に消えた子・孫は一緒に戻る（restored_count 3）。別の時に消した子は戻らない", async () => {
    const p = await w.make(w.creator);
    const c = await w.make(w.creator, { parent: p });
    const g = await w.make(w.creator, { parent: c });
    const earlier = await w.make(w.creator, { parent: p });
    await w.del(w.creator, earlier); // 先に別に消した（別の時刻）
    const del = await w.del(w.creator, p, { children: "cascade" });
    expect(del.status, await del.clone().text()).toBe(200);
    const v = await ok(w.creator, p);
    expect(v.restored_count).toBe(3);
    expect([await isDeleted(p), await isDeleted(c), await isDeleted(g)]).toEqual([false, false, false]);
    expect(await isDeleted(earlier)).toBe(true);
    expect((await w.row(g)).parent_ticket_id).toBe(c);
    for (const id of [p, c, g]) expect(await w.audit("tickets.restore", id)).toHaveLength(1);
  });

  it("K489-API-010 子の付け替え（move・detach）は戻さない：親は戻るが、移した子は移し先の子のまま・外した子は単体のまま", async () => {
    const p = await w.make(w.creator);
    const moved = await w.make(w.creator, { parent: p });
    const dest = await w.make(w.creator);
    await w.del(w.creator, p, { children: "move", parent_id: dest });
    expect((await ok(w.creator, p)).restored_count).toBe(1);
    expect((await w.row(moved)).parent_ticket_id).toBe(dest);
    const p2 = await w.make(w.creator);
    const freed = await w.make(w.creator, { parent: p2 });
    await w.del(w.creator, p2, { children: "detach" });
    await ok(w.creator, p2);
    expect((await w.row(freed)).parent_ticket_id).toBeNull();
    expect(await q("select 1 from tickets where parent_ticket_id = $1", [p2])).toHaveLength(0);
  });

  it("K489-API-011 取り下げた承認・止めた AI の実行は戻さない：承認は取り下げのまま・実行は止まったまま。決まった承認も同じ", async () => {
    const p = await fresh("戻しても戻らない人");
    const pc = await w.pcOf(p);
    const t = await w.make(p);
    const open = await w.approval(t, p);
    const decided = await w.approval(t, p, { decided: true });
    const { runId } = await w.runningRun(p, pc, t);
    await w.del(p, t);
    await ok(p, t);
    const a = await q<{ id: string; withdrawn_at: Date | null }>(
      "select id, withdrawn_at from approvals where ticket_id = $1",
      [t],
    );
    expect(a.find((x) => x.id === open)!.withdrawn_at).not.toBeNull();
    expect(a.find((x) => x.id === decided)!.withdrawn_at).toBeNull();
    expect((await q("select status_id from action_runs where id = $1", [runId]))[0]!["status_id"]).toBe("stopped");
    expect((await q("select delegated_to_clone as d from tickets where id = $1", [t]))[0]!["d"]).toBe(false);
  });

  it("K489-API-012 戻した後の見え方：実行の 1 件・実行の一覧が読める（消している間は 404）・AI に任せ直せる", async () => {
    const p = await fresh("見え方を戻す人");
    const pc = await w.pcOf(p);
    const t = await w.make(p);
    const { runId } = await w.runningRun(p, pc, t);
    await w.del(p, t);
    expect((await w.k.f.req("GET", `/action_runs/${runId}`, { headers: p.auth })).status).toBe(404);
    await ok(p, t);
    expect((await w.k.f.req("GET", `/action_runs/${runId}`, { headers: p.auth })).status).toBe(200);
    const runs = await w.k.f.req("GET", `/tickets/${t}/runs`, { headers: p.auth });
    expect(runs.status).toBe(200);
    expect(((await json(runs))["data"] as unknown[]).length).toBe(1);
    const again = await w.k.f.req("POST", `/tickets/${t}/delegate`, { body: {}, headers: p.auth });
    expect(again.status, await again.clone().text()).toBe(201);
  });

  it("K489-API-013 戻した後にもう一度消せる・もう一度戻せる（deleted_at と restorable_until は新しい）", async () => {
    const t = await w.make(w.creator);
    await w.del(w.creator, t);
    await ok(w.creator, t);
    const second = await w.del(w.creator, t);
    expect(second.status, await second.clone().text()).toBe(200);
    const row = await w.row(t);
    const v = await data<{ restorable_until: string }>(second);
    expect(Date.parse(v.restorable_until) - row.deleted_at!.getTime()).toBe(30 * 86400_000);
    expect((await ok(w.creator, t)).restored_count).toBe(1);
    expect(await w.audit("tickets.restore", t)).toHaveLength(2);
  });
});

describe("K-489 戻す：揺れ・失敗・守り", () => {
  it("K489-API-014 二度押し・別のタブ（同時に 2 回）：[201, 409]・409 は E-DEL-041。証跡は 1 行", async () => {
    const t = await w.make(w.creator);
    await gone(t, w.creator);
    const rs = await Promise.all([w.restore(w.creator, t), w.restore(w.creator, t)]);
    expect(rs.map((x) => x.status).sort()).toEqual([201, 409]);
    const loser = rs.find((x) => x.status === 409)!;
    expect(await code(loser)).toBe("E-DEL-041");
    expect(await w.audit("tickets.restore", t)).toHaveLength(1);
  });

  it("K489-API-015 ログインしていない：401。1 分に 61 回目は 429 と待つ秒数", async () => {
    const t = await w.make(w.creator);
    await gone(t, w.creator);
    const anon = await w.k.f.req("POST", `/tickets/${t}/restore`, { body: {} });
    expect(anon.status).toBe(401);
    expect(await isDeleted(t)).toBe(true);
    await withLimit(w.k, "restoreTicket", async () => {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await w.restore(w.viewer, t); // 403 でも回数には数える
      expect(last!.status).toBe(429);
      const sec = Number((await json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    });
  });

  it("K489-API-016 体に知らない項目：422（strict）で戻らない。空の体 {} は通る", async () => {
    const t = await w.make(w.creator);
    await gone(t, w.creator);
    const bad = await w.restore(w.creator, t, { with_children: true });
    expect(bad.status).toBe(422);
    expect(await isDeleted(t)).toBe(true);
    expect((await w.restore(w.creator, t, {})).status).toBe(201);
  });

  it("K489-API-017 手順 S1「DB に書く」が失敗（関数が使えない）：503・E-PAGE-003。消えたまま・証跡 0", async () => {
    const t = await w.make(w.creator);
    await gone(t, w.creator);
    await w.k.f.admin.query("revoke execute on function app.ticket_restore(uuid) from kaname_app");
    try {
      const r = await w.restore(w.creator, t);
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await w.k.f.admin.query("grant execute on function app.ticket_restore(uuid) to kaname_app");
    }
    expect(await isDeleted(t)).toBe(true);
    expect(await w.audit("tickets.restore", t)).toHaveLength(0);
  });

  it("K489-API-018 手順 S2「証跡」が失敗（証跡の書き込みが例外）：503・E-PAGE-003。同じ取引なので、親も子・孫も全部消えたまま", async () => {
    const p = await w.make(w.creator);
    const c = await w.make(w.creator, { parent: p });
    await w.del(w.creator, p, { children: "cascade" });
    await w.k.f.admin.query(
      `create or replace function public.k489_fail_audit() returns trigger language plpgsql as $$
       begin if new.action = 'tickets.restore' then raise exception 'K-489 試験：証跡が書けない'; end if; return new; end $$`,
    );
    await w.k.f.admin.query(
      "create trigger k489_fail_audit before insert on audit_events for each row execute function public.k489_fail_audit()",
    );
    try {
      const r = await w.restore(w.creator, p);
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await w.k.f.admin.query("drop trigger if exists k489_fail_audit on audit_events");
      await w.k.f.admin.query("drop function if exists public.k489_fail_audit()");
    }
    expect([await isDeleted(p), await isDeleted(c)]).toEqual([true, true]);
  });

  it("K489-API-019 手順「知らせ」は出さない：戻しても受け箱の行は 1 つも増えない", async () => {
    const t = await w.make(w.creator);
    await gone(t, w.creator);
    const before = await notices();
    await ok(w.creator, t);
    expect(await notices()).toBe(before);
  });

  it("K489-API-020 DB の関数の守り（2 層目）：security definer・search_path に pg_temp・public から外し kaname_app だけに渡す。戻せない人・別の会社の文脈で直に呼ぶと { ok: false }・戻らない", async () => {
    const fn = (
      await q<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
        `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
                has_function_privilege('kaname_app', p.oid, 'execute') as app
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'ticket_restore'`,
      )
    )[0]!;
    expect(fn.definer).toBe(true);
    expect(fn.cfg?.join(",") ?? "").toMatch(/search_path=.*pg_temp/);
    expect(fn.pub).toBe(false);
    expect(fn.app).toBe(true);
    const t = await w.make(w.creator);
    await gone(t, w.creator);
    const call = async (tenantId: string, userId: string) => {
      const c = await w.k.f.pool.connect();
      try {
        await c.query("begin");
        await c.query(
          "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
          [tenantId, userId],
        );
        const r = (await c.query<{ v: Record<string, unknown> }>("select app.ticket_restore($1) as v", [t])).rows[0]!.v;
        await c.query("rollback");
        return r;
      } finally {
        c.release();
      }
    };
    expect(await call(w.k.T.tenantId, w.editor.id)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await call(w.k.O.tenantId, w.outsider.id)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await isDeleted(t)).toBe(true);
  });
});
