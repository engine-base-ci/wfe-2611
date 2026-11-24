// K-463「承認待ちになったとき、承認する人に知らせ（受け箱の行）を書く」の単体の試験（DB と、本物の「AI に任せる」の道・本物の Postgres）。
// テストの名前の頭の行 ID（K463-DB-…）は 11_tickets/K-463.md の表の行に 1 対 1 で結ぶ。土台は K-461 の notify.harness.ts（F5 の承認と完了の土台の上）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める DB の形（migration 20261123086300_notify_approval_requested.sql）:
//   app.notify_approval_requested()  trigger 関数（security definer・search_path 固定）。表 approvals への「足す」だけで動く引き金 approvals_notify_requested（after insert・行ごと）が呼ぶ。
//     引き金の条件：kind が artifact・decision が空・withdrawn_at が空。承認待ちを作る所（app.bridge_finish_job の作る段・承認の後の 24 時間の聞き直し・今後の入口）は 1 つも作り直さない
//     書く知らせ：宛先は approvals.approver_member_id（今のメンバーで、止められていない・抜けていない人）。tenant_id は承認の会社・channel_id inapp・event_kind_id approval.requested・
//       payload はちょうど { ticket_id, number, title, approval_id }（成果物の本文・理由は入れない）・dedupe_key は approval.requested:<承認の id>・created_by は requested_by・
//       sent_at・failed_at は空（メールは出さない・D-151.6）・read_at は空
//     宛先が今のメンバーでない・チケットが無い／消えている・同じ dedupe_key の行が既にある ときは書かず、承認待ちの作成は成功のまま
//     知らせを書くのに失敗しても（DB が断っても）、承認待ちの作成は止めない（警告だけ・承認待ちを失う方が重い）
import { describe, expect, it } from "vitest";
import {
  ARTIFACT,
  approved,
  auth,
  boss,
  delegated,
  f,
  finish,
  json,
  lastSeen,
  member,
  one,
  outsider,
  ready,
  req,
  setupNotify,
  stageKeyOf,
  take,
  team,
  ticket,
  writer,
} from "./notify.harness.js";

setupNotify();

const KIND = "approval.requested";
const rowsOf = async (memberId: string, kind = KIND) =>
  (
    await f.admin.query<Record<string, unknown>>(
      "select * from notifications where member_id = $1 and event_kind_id = $2 order by created_at",
      [memberId, kind],
    )
  ).rows;
const approvalsOf = async (ticketId: string) =>
  (
    await f.admin.query<{ id: string; requested_by: string | null; approver_member_id: string | null }>(
      "select id, requested_by, approver_member_id from approvals where ticket_id = $1 order by created_at",
      [ticketId],
    )
  ).rows;

/** 本物の「AI に任せる」→ PC が作る段を中身のある結果で終える（承認待ちを作る本物の道）。返すのは作る段の仕事の id */
async function aiFinishes(
  t: { id: string },
  tm: Awaited<ReturnType<typeof team>>,
  result: string = ARTIFACT,
): Promise<string> {
  const r = await req("POST", `/tickets/${t.id}/delegate`, { body: {}, headers: auth(tm.by) });
  expect(r.status, await r.clone().text()).toBe(201);
  const jobId = String(((await json(r)).data as Record<string, unknown>)["job_id"]);
  expect((await take(tm.pc))?.id).toBe(jobId);
  await finish(tm.pc, jobId, { state: "done", result });
  return jobId;
}

/** 承認の行を管理の接続で直に足す（本物の道を通さない入口。引き金は表への足しで動く） */
async function addApproval(
  t: { id: string; tenant: string; scope: string },
  approver: string,
  o: { requestedBy?: string; decision?: string | null; withdrawn?: boolean } = {},
): Promise<string> {
  const r = await one<{ id: string }>(
    `insert into approvals (tenant_id, scope_id, kind, ticket_id, approver_member_id, requested_by, status_id, irreversible, decision, decided_at, withdrawn_at, created_by)
     values ($1, $2, 'artifact', $3, $4, $5, 'pending', true, $6, $7, $8, $5) returning id`,
    [
      t.tenant,
      t.scope,
      t.id,
      approver,
      o.requestedBy ?? writer.id,
      o.decision ?? null,
      // approvals_decided_ck：決まっている承認は decision と decided_at を一緒に入れる
      o.decision ? new Date() : null,
      o.withdrawn ? new Date() : null,
    ],
  );
  return r.id;
}

/** この試験の中だけ、その会社の「承認待ちの知らせ」の書き込みを DB が断るようにし、終わったら外す（書く手順の失敗） */
async function breakNotify<R>(tenantId: string, body: () => Promise<R>): Promise<R> {
  const name = `k463_fail_${tenantId.replace(/-/g, "")}`;
  await f.admin.query(
    "create or replace function app.k463_test_raise() returns trigger language plpgsql as $$ begin raise exception 'K463 の試験で知らせの書き込みを壊した'; end $$",
  );
  await f.admin.query(
    `create trigger ${name} before insert on notifications for each row when (new.event_kind_id = 'approval.requested' and new.tenant_id = '${tenantId}') execute function app.k463_test_raise()`,
  );
  try {
    return await body();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on notifications`);
  }
}

describe("K-463 承認待ちになったとき承認する人に知らせを書く", () => {
  it("K463-DB-001 本物の道：AI が作る段を終えて承認待ちになると、承認する人（担当者）に受け箱の行が 1 つ。種類・会社・channel・payload の鍵・dedupe_key・起こした人が決めたとおりで、メールの印と読んだ印は空", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "11 月分の請求書を送る" });
    await aiFinishes(t, tm);
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    const [a] = await approvalsOf(t.id);
    const rows = await rowsOf(tm.by.id);
    expect(rows).toHaveLength(1);
    const n = rows[0]!;
    expect(n).toMatchObject({
      tenant_id: t.tenant,
      member_id: tm.by.id,
      channel_id: "inapp",
      event_kind_id: KIND,
      dedupe_key: `approval.requested:${a!.id}`,
      created_by: tm.by.id,
      sent_at: null,
      failed_at: null,
      read_at: null,
    });
    expect(n["payload"]).toEqual({
      ticket_id: t.id,
      number: t.number,
      title: "11 月分の請求書を送る",
      approval_id: a!.id,
    });
    expect(JSON.stringify(n["payload"])).not.toContain("御中");
    const mails = await one<{ n: string }>(
      "select count(*) as n from notifications where member_id = $1 and channel_id = 'email'",
      [tm.by.id],
    );
    expect(Number(mails.n)).toBe(0);
  });

  it("K463-DB-002 宛先は承認する人だけ：担当者と AI を動かした人が別なら、担当者にだけ出る。動かした人・同じグループの人・別の会社の人には出ない", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: boss, title: "担当者が別のチケット" });
    await aiFinishes(t, tm);
    expect(await rowsOf(boss.id)).toHaveLength(1);
    for (const p of [tm.by, writer, outsider]) expect(await rowsOf(p.id), p.id).toHaveLength(0);
    const [a] = await approvalsOf(t.id);
    expect(a!.approver_member_id).toBe(boss.id);
    expect(a!.requested_by).toBe(tm.by.id);
    expect((await rowsOf(boss.id))[0]!["created_by"]).toBe(tm.by.id);
  });

  it("K463-DB-003 ほかの入口でも書かれる：承認の行を直に足しても（本物の道を通さなくても）出る。同じチケットに 2 つ目の承認待ちができたら、承認の id ごとに 1 つずつ", async () => {
    await ready();
    const t = await ticket({ assignee: boss, title: "2 回承認待ちになるチケット" });
    const first = await addApproval(t, boss.id);
    const second = await addApproval(t, boss.id);
    const rows = await rowsOf(boss.id);
    const mine = rows.filter((r) => (r["payload"] as { ticket_id?: string }).ticket_id === t.id);
    expect(mine.map((r) => r["dedupe_key"]).sort()).toEqual(
      [`approval.requested:${first}`, `approval.requested:${second}`].sort(),
    );
  });

  it("K463-DB-004 決めても増えない：承認する・差し戻すで承認の行を更新しても、知らせは増えず、前の知らせはそのまま（引き金は足すときだけ）", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "承認して使うチケット" });
    const d = await delegated(t, { by: tm });
    const before = await rowsOf(tm.by.id);
    expect(before.filter((r) => (r["payload"] as { approval_id?: string }).approval_id === d.approvalId)).toHaveLength(
      1,
    );
    const ok = await req("POST", `/approvals/${d.approvalId}/approve`, { body: {}, headers: auth(tm.by) });
    expect(ok.status, await ok.clone().text()).toBe(201);
    const after = await rowsOf(tm.by.id);
    expect(after.map((r) => r["id"])).toEqual(before.map((r) => r["id"]));
    for (const r of after) expect(r["read_at"]).toBeNull();
  });

  it("K463-DB-005 書かない場合：もう決まっている承認・取り下げた承認を足したときは知らせを書かない", async () => {
    await ready();
    const t = await ticket({ assignee: boss, title: "最初から決まっているチケット" });
    await addApproval(t, boss.id, { decision: "approve" });
    await addApproval(t, boss.id, { withdrawn: true });
    const mine = (await rowsOf(boss.id)).filter((r) => (r["payload"] as { ticket_id?: string }).ticket_id === t.id);
    expect(mine).toEqual([]);
  });

  it("K463-DB-006 宛先が今のメンバーでない：止められた人・会社から抜けた人宛ての承認は、知らせを書かない。承認の行は作られる", async () => {
    await ready();
    const stopped = await member("止められた人");
    const gone = await member("抜けた人");
    const t = await ticket({ assignee: boss, title: "宛先が使えなくなるチケット" });
    // members_suspended_ck：止めた時刻と止めた人は一緒に入れる（F5 の止めた人の作り方と同じ）
    await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      stopped.id,
      boss.id,
    ]);
    await f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    const a = await addApproval(t, stopped.id);
    const b = await addApproval(t, gone.id);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(await rowsOf(stopped.id)).toEqual([]);
    expect(await rowsOf(gone.id)).toEqual([]);
  });

  it("K463-DB-007 消されたチケットの承認は書かない：チケットが消えているときは知らせを書かず、承認の行は作られる。チケットが無い承認（ticket_id が空）でも落ちない", async () => {
    await ready();
    const t = await ticket({ assignee: boss, title: "消されたチケット" });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [t.id]);
    const a = await addApproval(t, boss.id);
    expect(a).toBeTruthy();
    const mine = (await rowsOf(boss.id)).filter((r) => (r["payload"] as { ticket_id?: string }).ticket_id === t.id);
    expect(mine).toEqual([]);
    const noTicket = await one<{ id: string }>(
      `insert into approvals (tenant_id, scope_id, kind, ticket_id, approver_member_id, status_id, created_by)
       values ($1, $2, 'artifact', null, $3, 'pending', $3) returning id`,
      [t.tenant, t.scope, boss.id],
    );
    expect(noTicket.id).toBeTruthy();
    expect((await rowsOf(boss.id)).filter((r) => String(r["dedupe_key"]).endsWith(noTicket.id))).toEqual([]);
  });

  it("K463-DB-008 失敗（DB に書く）：知らせの書き込みを DB が断っても、承認待ちの作成は成功する（作る段の終わりは 2xx・承認の行ができ・段は承認待ち）。知らせの行は 1 つも残らない", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "知らせが書けないチケット" });
    await breakNotify(t.tenant, async () => {
      await aiFinishes(t, tm);
    });
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await approvalsOf(t.id)).toHaveLength(1);
    expect(await rowsOf(tm.by.id)).toEqual([]);
  });

  it("K463-DB-009 失敗（知らせ）：知らせが書けなかった承認も、承認待ちの一覧と数には出る。別のチケットの次の承認待ちは知らせも書かれる（失敗が残らない）", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const broken = await ticket({ assignee: tm.by, title: "書けなかったチケット" });
    await breakNotify(broken.tenant, async () => {
      await aiFinishes(broken, tm);
    });
    const q = await req("GET", "/approvals/queue", { headers: auth(tm.by) });
    expect(q.status).toBe(200);
    const queue = (await json(q)).data as { ticket_id: string }[];
    expect(queue.map((x) => x.ticket_id)).toContain(broken.id);
    const next = await ticket({ assignee: tm.by, title: "次のチケット" });
    await aiFinishes(next, tm);
    const mine = (await rowsOf(tm.by.id)).filter((r) => (r["payload"] as { ticket_id?: string }).ticket_id === next.id);
    expect(mine).toHaveLength(1);
  });

  it("K463-DB-010 失敗（証跡）：知らせの書き込みは証跡（audit_events）を増やさない。本文の字（成果物）は知らせにも証跡にも入らない", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "証跡を見るチケット" });
    const n = async () =>
      Number(
        (await one<{ n: string }>("select count(*) as n from audit_events where payload::text like $1", ["%御中%"])).n,
      );
    const before = await n();
    await aiFinishes(t, tm);
    expect(await n()).toBe(before);
    const rows = await rowsOf(tm.by.id);
    expect(JSON.stringify(rows)).not.toContain("御中");
  });

  it("K463-DB-011 引き金の形：approvals への足し（行ごと）だけで動く・security definer・search_path 固定。作る段の終わりの関数（app.bridge_finish_job）は作り直していない", async () => {
    await ready();
    const trg = await one<{ def: string; enabled: string }>(
      "select pg_get_triggerdef(t.oid) as def, t.tgenabled as enabled from pg_trigger t where t.tgname = 'approvals_notify_requested' and t.tgrelid = 'approvals'::regclass and not t.tgisinternal",
    );
    expect(trg.enabled).toBe("O");
    expect(trg.def).toMatch(/AFTER INSERT/);
    expect(trg.def).toMatch(/FOR EACH ROW/);
    expect(trg.def).not.toMatch(/UPDATE|DELETE/);
    const fn = await one<{ secdef: boolean; cfg: string[] | null }>(
      "select p.prosecdef as secdef, p.proconfig as cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'notify_approval_requested'",
    );
    expect(fn.secdef).toBe(true);
    expect((fn.cfg ?? []).join(" ")).toMatch(/search_path=.*pg_temp/);
    const finishDef = await one<{ def: string }>(
      "select pg_get_functiondef('app.bridge_finish_job(uuid,uuid,text,text,text,text)'::regprocedure) as def",
    );
    expect(finishDef.def).not.toContain("approval.requested");
  });

  it("K463-DB-012 24 時間の聞き直しで承認待ちに戻る（切り替わりの瞬間）：承認から 24 時間を過ぎた実行の仕事を PC が取りに来る前の片付けで止めると、新しい承認の行が足されて、承認待ちの知らせが承認の id ごとに 1 つずつ（最初と聞き直しで計 2 つ）になる", async () => {
    await ready();
    const t = await ticket({ title: "24 時間を過ぎるチケット" });
    const a = await approved(t);
    await f.admin.query(
      "update approvals set decided_at = now() - interval '24 hours 1 minute' where ticket_id = $1 and decision is not null",
      [t.id],
    );
    await lastSeen(a.pc.sid, 1);
    await take(a.pc);
    const asks = await rowsOf(boss.id);
    const mine = asks.filter((r) => (r["payload"] as { ticket_id?: string }).ticket_id === t.id);
    expect(mine, "最初の承認待ちと聞き直しの承認待ちで 1 つずつ").toHaveLength(2);
    const ids = (await approvalsOf(t.id)).map((x) => x.id).sort();
    expect(ids, "承認の行も 2 つ").toHaveLength(2);
    expect(mine.map((r) => String(r["dedupe_key"])).sort(), "dedupe_key は承認の id ごと").toEqual(
      ids.map((id) => `${KIND}:${id}`).sort(),
    );
  });
});
