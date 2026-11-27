// K-766「完了の口の残り：答えの knowledge_candidates・skipped_reason を外す（ナレッジを自動で作らない）／開き直して 2 回目に完了にしても完了のお知らせが届く」の単体の試験（口・本物の DB）。
//   名前の頭の行 ID（K766-API-…）は 11_tickets/K-766.md の行の表と 1 対 1。土台は K-63 の F5/approve-complete.harness.ts（変えない）。
// 口：POST /api/v1/tickets/:id/complete ← { conditions_confirmed: true（実施事項の番号と版は段 5 の K-566 の後は任意） }
//   → 201 { data: { ticket: { id, number, stage_key, completed_at, completed_by }, unchecked } }（ナレッジの候補・理由は出さない・D-153.15）。
// 完了のお知らせ（受け箱 ticket.completed）は、担当者と作った人のうち完了にした人でない人へ 1 人に 1 つ（完了ごと・D-128.92）。開き直し（段 7 の K-388）は完了の時刻と押した人を空に戻すだけで、
//   知らせの行は残る。2 回目の完了は新しい知らせを書く（前の完了より後の知らせが無い宛先だけ）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の列をずらして置く。
import { describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import {
  setupApproveComplete,
  boss,
  writer,
  f,
  json,
  one,
  num,
  complete,
  executed,
  stageKeyOf,
  stageOf,
  ticket,
  messagesOf,
  type Ticket,
} from "./approve-complete.harness.js";
import type { Person } from "../fixture.js";

setupApproveComplete();

const BODY = { conditions_confirmed: true };
const done = async (t: Ticket, by = boss) => {
  const r = await complete(by, t.id, BODY);
  expect(r.status, await r.clone().text()).toBe(201);
  return r;
};
/** 開き直す（段 7 の K-388 と同じ結果：段は作業中・完了の時刻と押した人は空） */
const reopen = async (t: Ticket) =>
  f.admin.query("update tickets set stage_id = $2, completed_at = null, completed_by = null where id = $1", [
    t.id,
    await stageOf(t.tenant, "doing"),
  ]);
const notes = (t: Ticket, member: string) =>
  f.admin
    .query<{
      sent_at: string | null;
      failed_at: string | null;
      retry_count: number | null;
      created_at: string;
      dedupe_key: string;
    }>(
      "select sent_at, failed_at, retry_count, created_at, dedupe_key from notifications where event_kind_id = 'ticket.completed' and member_id = $1 and dedupe_key like $2 order by created_at, id",
      [member, `%ticket.completed:${t.id}`],
    )
    .then((r) => r.rows);
/** 完了の知らせの関数を、完了にした人（既定は担当者）として直に呼ぶ（要求の文脈の中でだけ書く関数。答えは書いた行の数） */
const notice = async (t: Ticket, failed?: boolean, by: Person = boss): Promise<{ rows: { n: number }[] }> => {
  const ctx: TenantContext = { tenantId: t.tenant, userId: by.id, role: "member", stepUpAt: null };
  return withTenant(f.pool, ctx, (cl) =>
    cl.query<{ n: number }>(
      failed === undefined
        ? "select app.ticket_completed_notice($1) as n"
        : "select app.ticket_completed_notice($1, $2) as n",
      failed === undefined ? [t.id] : [t.id, failed],
    ),
  );
};

describe("K-766 完了の答え：ナレッジの候補を出さない", () => {
  it("K766-API-001 完了にすると 201 の data は ticket と unchecked だけ（knowledge_candidates・skipped_reason の鍵は無い）。ticket は id・番号・段 done・完了の時刻と押した人。やり取りと証跡は前のまま 1 つずつ", async () => {
    const t = await ticket();
    await executed(t);
    const r = await done(t);
    const data = (await json(r)).data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(["ticket", "unchecked"]);
    expect(data["knowledge_candidates"]).toBeUndefined();
    expect(data["skipped_reason"]).toBeUndefined();
    expect(data["ticket"]).toMatchObject({ id: t.id, number: t.number, stage_key: "done", completed_by: boss.id });
    expect(typeof (data["ticket"] as Record<string, unknown>)["completed_at"]).toBe("string");
    expect(await stageKeyOf(t.id)).toBe("done");
    expect((await messagesOf(t.id)).filter((m) => m.body.includes("高本が完了にしました"))).toHaveLength(1);
    expect(
      await num("select count(*) as n from audit_events where action = 'ticket.complete' and target_id = $1", [t.id]),
    ).toBe(1);
  });

  it("K766-API-002 完了の関数 app.ticket_complete は直さない：4 つの引数のまま・kaname_app に渡されたまま。完了の証跡の payload は前のまま番号を持つ（中の古い鍵 knowledge_candidates の 0 は読む所が無く、残る）", async () => {
    const t = await ticket();
    await executed(t);
    await done(t);
    const p = await one<{ p: Record<string, unknown> }>(
      "select payload as p from audit_events where action = 'ticket.complete' and target_id = $1",
      [t.id],
    );
    expect(p.p["number"]).toBe(t.number);
    const fn = await one<{ args: string; app: boolean; pub: boolean }>(
      `select pg_get_function_identity_arguments(p.oid) as args, has_function_privilege('kaname_app', p.oid, 'execute') as app,
              has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'ticket_complete'`,
    );
    expect(fn).toEqual({
      args: "p_ticket uuid, p_todo_checked integer[], p_todo_version integer, p_confirmed boolean",
      app: true,
      pub: false,
    });
  });
});

describe("K-766 開き直して 2 回目に完了にしたときの完了のお知らせ", () => {
  it("K766-API-003 1 回目の完了：作った人（完了にした人でない担当者でも作った人でも）に完了のお知らせが 1 つ届く（前のまま）。完了にした人本人には出ない", async () => {
    const t = await ticket();
    await executed(t);
    await done(t, boss);
    expect(await notes(t, writer.id)).toHaveLength(1);
    expect((await notes(t, writer.id))[0]!.sent_at).not.toBeNull();
    expect(await notes(t, boss.id)).toEqual([]);
  });

  it("K766-API-004 開き直して 2 回目に完了にすると、1 回目に知らせを受けた人にも新しいお知らせが届く（1 人に 1 つ・完了ごと）。1 回目のお知らせは残る（2 つ・古い順・どちらも sent_at つき）", async () => {
    const t = await ticket();
    await executed(t);
    await done(t, boss);
    const first = await notes(t, writer.id);
    await reopen(t);
    expect(await stageKeyOf(t.id)).toBe("doing");
    await done(t, boss);
    const all = await notes(t, writer.id);
    expect(all).toHaveLength(2);
    expect(all.every((x) => x.sent_at !== null)).toBe(true);
    expect(all[0]).toEqual(first[0]);
    expect(new Date(all[1]!.created_at).getTime()).toBeGreaterThan(new Date(first[0]!.created_at).getTime());
    expect(all[1]!.dedupe_key).toBe(first[0]!.dedupe_key); // 鍵は前と同じ（形を変えない）
    // 3 回目も同じ
    await reopen(t);
    await done(t, boss);
    expect(await notes(t, writer.id)).toHaveLength(3);
  });

  it("K766-API-005 同じ完了の中では 1 人に 1 つだけ（二重に書かない）：1 回目の完了で、完了の知らせの関数を 1 引数・2 引数（送れた印・送れなかった印）で何度呼んでも増えない。2 回目の完了の後も同じ", async () => {
    const t = await ticket();
    await executed(t);
    await done(t, boss);
    for (const args of [undefined, false, true] as const) await notice(t, args);
    expect(await notes(t, writer.id)).toHaveLength(1);
    await reopen(t);
    await done(t, boss);
    for (const args of [undefined, false, true] as const) await notice(t, args);
    expect(await notes(t, writer.id)).toHaveLength(2);
  });

  it("K766-API-006 S1 の失敗・1 回目の知らせが書けなかった（送れなかった印 failed_at・retry_count）ままでも、2 回目の完了で新しいお知らせが書かれる（失敗の行は残り、新しい行は送れた印）。同じ完了の送り直しは増やさない", async () => {
    const t = await ticket();
    await executed(t);
    await done(t, boss);
    await f.admin.query(
      "update notifications set sent_at = null, failed_at = now(), retry_count = 1 where event_kind_id = 'ticket.completed' and member_id = $1 and dedupe_key like $2",
      [writer.id, `%ticket.completed:${t.id}`],
    );
    await notice(t, true); // 同じ完了の送り直し：増えない
    expect(await notes(t, writer.id)).toHaveLength(1);
    await reopen(t);
    await done(t, boss);
    const all = await notes(t, writer.id);
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ sent_at: null });
    expect(all[0]!.failed_at).not.toBeNull();
    expect(all[1]).toMatchObject({ failed_at: null, retry_count: null });
    expect(all[1]!.sent_at).not.toBeNull();
  });

  it("K766-API-007 完了にした人が変わると宛先も変わる：1 回目は担当者が完了（作った人へ）・開き直して 2 回目は作った人が完了（担当者へ）。それぞれ 1 つずつ届き、完了にした人本人には出ない", async () => {
    const t = await ticket();
    await executed(t);
    await done(t, boss);
    await reopen(t);
    await done(t, writer);
    expect(await notes(t, writer.id)).toHaveLength(1);
    expect(await notes(t, boss.id)).toHaveLength(1);
  });

  it("K766-API-008 抜けた・止められた宛先には 2 回目も出さない（K-166 のまま）：作った人が止められた後の 2 回目の完了は、誰にも新しいお知らせを書かない。完了そのものは通る", async () => {
    const t = await ticket();
    await executed(t);
    await done(t, boss);
    await reopen(t);
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [writer.id]);
    try {
      await done(t, boss);
      expect(await notes(t, writer.id)).toHaveLength(1);
      expect(await stageKeyOf(t.id)).toBe("done");
    } finally {
      await f.admin.query("update members set suspended_at = null, suspended_by = null where id = $1", [writer.id]);
    }
  });

  it("K766-API-009 完了の後に開き直す前の知らせ（1 回目）は消えず、開き直しの間（完了していない間）に完了の知らせの関数を呼んでも何も書かない（完了にした人が空なので 0）", async () => {
    const t = await ticket();
    await executed(t);
    await done(t, boss);
    await reopen(t);
    const r = await notice(t);
    expect(r.rows[0]!.n).toBe(0);
    expect(await notes(t, writer.id)).toHaveLength(1);
  });

  it("K766-API-010 知らせの書き手は 1 人に 1 つの前の決めを保つ：完了ごとの 1 つは、その完了より後に書いた行が無い宛先だけ（同じ完了を同時に 2 つの口が書いても 1 つ）", async () => {
    const t = await ticket();
    await executed(t);
    await done(t, boss);
    await reopen(t);
    await done(t, boss);
    await Promise.all([notice(t), notice(t, false), notice(t, true), notice(t)]);
    expect(await notes(t, writer.id)).toHaveLength(2);
  });

  it("K766-DB-001 DB の形：app.ticket_completed_notice は 1 引数と 2 引数（送れた印）の両方が前のまま kaname_app だけに渡されている（作り直しても形を変えない）", async () => {
    const r = await f.admin.query<{ args: string; app: boolean; pub: boolean }>(
      `select pg_get_function_identity_arguments(p.oid) as args, has_function_privilege('kaname_app', p.oid, 'execute') as app,
              has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'ticket_completed_notice' order by 1`,
    );
    expect(r.rows).toEqual([
      { args: "p_ticket uuid", app: true, pub: false },
      { args: "p_ticket uuid, p_failed boolean", app: true, pub: false },
    ]);
  });
});
