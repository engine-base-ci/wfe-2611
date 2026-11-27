// K-464「AI が止まったとき、担当者に知らせ（受け箱の行）を書く」の単体の試験（DB と、本物の「AI に任せる」「PC が返す」の道・本物の Postgres）。
// テストの名前の頭の行 ID（K464-DB-…）は 11_tickets/K-464.md の表の行に 1 対 1 で結ぶ。土台は K-461 の notify.harness.ts（F5 の承認と完了の土台の上）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める DB の形（migration 20261123086400_notify_ai_stopped.sql）:
//   止まる所は 10 か所ほどの migration に散っている（作る段の終わり・承認の後の実行の終わり・PC のつながり直し・人を止めた／外した・PC を外した・24 時間の片付け）が、
//   どれも実行の記録（action_runs）の status_id を 'stopped'・error_summary を止まった理由にして書く。その 1 か所を引き金で拾う（止まる所は 1 つも作り直さない）。
//   app.notify_ai_stopped()  trigger 関数（security definer・search_path 固定）。引き金 action_runs_ticket_stopped_notice（after update of status_id・行ごと）が呼ぶ。
//     引き金の条件：新しい status_id が stopped・前の status_id と違う・ticket_id がある。cancelled（人が PC でやめた）・done は書かない
//     宛先は今のチケットの担当者（今のメンバーで、止められていない・抜けていない人）。チケットが無い／消えている・担当者がいないときは書かない
//     書く知らせ：tenant_id はチケットの会社・channel_id inapp・event_kind_id ticket.stopped・payload はちょうど { ticket_id, number, title, reason, job_id }
//       （reason は止まった理由を 200 字で切った物・全文は実行の記録に残る・job_id は action_runs.bridge_job_id）・dedupe_key は ticket.stopped:<実行の記録の id>・
//       created_by は空（仕組みが起こした知らせ）・sent_at・failed_at・read_at は空（メールは出さない・D-151.6）
//     知らせを書くのに失敗しても、止まった扱い（実行の記録・仕事・チケットの段）は止めない（警告だけ）
import { describe, expect, it } from "vitest";
import {
  approved,
  auth,
  boss,
  f,
  finish,
  json,
  lastSeen,
  member,
  one,
  pageOf,
  ready,
  req,
  setupNotify,
  stageKeyOf,
  take,
  team,
  ticket,
} from "./notify.harness.js";

setupNotify();

const KIND = "ticket.stopped";
const NO_RESULT = "自分のAI が結果を返さずに終わりました。完了とは見なしていません";
const rowsOf = async (memberId: string) =>
  (
    await f.admin.query<Record<string, unknown>>(
      "select * from notifications where member_id = $1 and event_kind_id = $2 order by created_at",
      [memberId, KIND],
    )
  ).rows;
const runsOf = async (ticketId: string, phase: string) =>
  (
    await f.admin.query<{ id: string; status_id: string; bridge_job_id: string | null; error_summary: string | null }>(
      "select id, status_id, bridge_job_id, error_summary from action_runs where ticket_id = $1 and phase = $2 order by created_at",
      [ticketId, phase],
    )
  ).rows;

type End = { state: "stopped" | "done" | "cancelled"; reason?: string; result?: string };
const body = (e: End, session?: string) => ({
  state: e.state,
  ...(e.reason === undefined ? {} : { reason: e.reason }),
  ...(e.result === undefined ? {} : { result: e.result }),
  ...(session ? { agent_session_id: session } : {}),
});

/** 本物の「AI に任せる」→ PC が作る段をこの終わり方で返す。返すのは作る段の仕事の id */
async function makeEnds(t: { id: string }, tm: Awaited<ReturnType<typeof team>>, e: End): Promise<string> {
  const r = await req("POST", `/tickets/${t.id}/delegate`, { body: {}, headers: auth(tm.by) });
  expect(r.status, await r.clone().text()).toBe(201);
  const jobId = String(((await json(r)).data as Record<string, unknown>)["job_id"]);
  expect((await take(tm.pc))?.id).toBe(jobId);
  await finish(tm.pc, jobId, body(e));
  return jobId;
}
/** 本物の「AI に任せる」→ PC が作る段の仕事を取る（まだ返さない＝動いている）。返すのは作る段の仕事の id */
async function startMake(t: { id: string }, tm: Awaited<ReturnType<typeof team>>): Promise<string> {
  const r = await req("POST", `/tickets/${t.id}/delegate`, { body: {}, headers: auth(tm.by) });
  expect(r.status, await r.clone().text()).toBe(201);
  const jobId = String(((await json(r)).data as Record<string, unknown>)["job_id"]);
  expect((await take(tm.pc))?.id).toBe(jobId);
  return jobId;
}
/** 承認して実行の仕事を積み、PC が取って、この終わり方で返す（承認の後の実行） */
async function execEnds(t: Awaited<ReturnType<typeof ticket>>, e: End) {
  const a = await approved(t);
  await lastSeen(a.pc.sid, 1);
  expect((await take(a.pc))?.id).toBe(a.execJobId);
  await finish(a.pc, a.execJobId, body(e, a.agentSession));
  return a;
}

/** この試験の中だけ、その会社の「止まった知らせ」の書き込みを DB が断るようにし、終わったら外す（書く手順の失敗） */
async function breakNotify<R>(tenantId: string, fn: () => Promise<R>): Promise<R> {
  const name = `k464_fail_${tenantId.replace(/-/g, "")}`;
  await f.admin.query(
    "create or replace function app.k464_test_raise() returns trigger language plpgsql as $$ begin raise exception 'K464 の試験で知らせの書き込みを壊した'; end $$",
  );
  await f.admin.query(
    `create trigger ${name} before insert on notifications for each row when (new.event_kind_id = 'ticket.stopped' and new.tenant_id = '${tenantId}') execute function app.k464_test_raise()`,
  );
  try {
    return await fn();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on notifications`);
  }
}

describe("K-464 AI が止まったとき担当者に知らせを書く", () => {
  it("K464-DB-001 本物の道：PC が「止まった」と返すと、担当者に受け箱の行が 1 つ。種類・会社・channel・payload の鍵・理由・dedupe_key が決めたとおりで、起こした人・メールの印・読んだ印は空", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "発注ナビに入れるチケット" });
    const jobId = await makeEnds(t, tm, { state: "stopped", reason: "発注ナビの画面が変わっていた" });
    expect(await stageKeyOf(t.id)).toBe("doing");
    const [run] = await runsOf(t.id, "make");
    expect(run!.status_id).toBe("stopped");
    const rows = await rowsOf(tm.by.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenant_id: t.tenant,
      member_id: tm.by.id,
      channel_id: "inapp",
      event_kind_id: KIND,
      dedupe_key: `ticket.stopped:${run!.id}`,
      created_by: null,
      sent_at: null,
      failed_at: null,
      read_at: null,
    });
    expect(rows[0]!["payload"]).toEqual({
      ticket_id: t.id,
      number: t.number,
      title: "発注ナビに入れるチケット",
      reason: "発注ナビの画面が変わっていた",
      job_id: jobId,
    });
    expect(run!.bridge_job_id).toBe(jobId);
  });

  it("K464-DB-002 宛先は担当者だけ：AI を動かした人と担当者が別なら、担当者にだけ出る。動かした人には出ない", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: boss, title: "担当者が別のチケット" });
    await makeEnds(t, tm, { state: "stopped", reason: "PC の上限に当たった" });
    const mine = (await rowsOf(boss.id)).filter((r) => (r["payload"] as { ticket_id: string }).ticket_id === t.id);
    expect(mine).toHaveLength(1);
    expect(await rowsOf(tm.by.id)).toHaveLength(0);
  });

  it("K464-DB-003 結果を返さずに終わった（作る段・結果が空白だけ）：止まった扱いになり、理由は「結果を返さずに終わりました」で知らせが出る", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "空の結果のチケット" });
    await makeEnds(t, tm, { state: "done", result: "   " });
    const rows = await rowsOf(tm.by.id);
    expect(rows).toHaveLength(1);
    expect((rows[0]!["payload"] as { reason: string }).reason).toBe(NO_RESULT);
  });

  it("K464-DB-004 承認の後の実行が止まった：「止まった」と返す場合も、仕事の状態が done のまま空の結果の場合も、担当者に知らせが 1 つずつ出る", async () => {
    await ready();
    const t1 = await ticket({ title: "実行が止まるチケット" });
    await execEnds(t1, { state: "stopped", reason: "ログインが切れていた" });
    const r1 = (await rowsOf(boss.id)).filter((r) => (r["payload"] as { ticket_id: string }).ticket_id === t1.id);
    expect(r1).toHaveLength(1);
    expect((r1[0]!["payload"] as { reason: string }).reason).toBe("ログインが切れていた");
    const t2 = await ticket({ title: "実行が空で終わるチケット" });
    await execEnds(t2, { state: "done", result: "  " });
    const r2 = (await rowsOf(boss.id)).filter((r) => (r["payload"] as { ticket_id: string }).ticket_id === t2.id);
    expect(r2).toHaveLength(1);
    expect((r2[0]!["payload"] as { reason: string }).reason).toBe(NO_RESULT);
  });

  it("K464-DB-005 書かない終わり方：PC でやめた（cancelled）・中身のある結果で終わった（done）では止まった知らせを書かない", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t1 = await ticket({ assignee: tm.by, title: "やめたチケット" });
    await makeEnds(t1, tm, { state: "cancelled" });
    const t2 = await ticket({ assignee: tm.by, title: "うまくいったチケット" });
    await makeEnds(t2, tm, { state: "done", result: "下書きができました" });
    expect(await rowsOf(tm.by.id)).toEqual([]);
    expect((await runsOf(t1.id, "make"))[0]!.status_id).toBe("cancelled");
  });

  it("K464-DB-006 消されたチケット：チケットが消えているときは知らせを書かず、止まった扱いは成功する（消す口 K-488 は deleted_at を先に立ててから実行を止めるので、同じ順で書かない）", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "消されるチケット" });
    const r = await req("POST", `/tickets/${t.id}/delegate`, { body: {}, headers: auth(tm.by) });
    expect(r.status).toBe(201);
    const jobId = String(((await json(r)).data as Record<string, unknown>)["job_id"]);
    expect((await take(tm.pc))?.id).toBe(jobId);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [t.id]);
    await finish(tm.pc, jobId, { state: "stopped", reason: "消えたあとに止まった" });
    expect((await runsOf(t.id, "make"))[0]!.status_id).toBe("stopped");
    expect(await rowsOf(tm.by.id)).toEqual([]);
  });

  it("K464-DB-007 宛先が今のメンバーでない：担当者が止められている・抜けているときは知らせを書かない。止まった扱いは成功する", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const stopped = await member("止められた担当者");
    const t = await ticket({ assignee: stopped, title: "担当者が止められたチケット" });
    const r = await req("POST", `/tickets/${t.id}/delegate`, { body: {}, headers: auth(tm.by) });
    expect(r.status, await r.clone().text()).toBe(201);
    const jobId = String(((await json(r)).data as Record<string, unknown>)["job_id"]);
    expect((await take(tm.pc))?.id).toBe(jobId);
    // members_suspended_ck：止めた時刻と止めた人は一緒に入れる（F5 の止めた人の作り方と同じ）
    await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      stopped.id,
      boss.id,
    ]);
    await finish(tm.pc, jobId, { state: "stopped", reason: "担当者が止められた後に止まった" });
    expect((await runsOf(t.id, "make"))[0]!.status_id).toBe("stopped");
    expect(await rowsOf(stopped.id)).toEqual([]);
  });

  it("K464-DB-008 失敗（DB に書く）：知らせの書き込みを DB が断っても、止まった扱い（実行の記録・仕事・チケットの段）は成功し、知らせの行は残らない。PC の返す口は 2xx", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "知らせが書けないチケット" });
    let jobId = "";
    await breakNotify(t.tenant, async () => {
      jobId = await makeEnds(t, tm, { state: "stopped", reason: "書けない回の理由" });
    });
    const [run] = await runsOf(t.id, "make");
    expect(run!.status_id).toBe("stopped");
    expect(run!.error_summary).toBe("書けない回の理由");
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect((await one<{ state_id: string }>("select state_id from bridge_jobs where id = $1", [jobId])).state_id).toBe(
      "stopped",
    );
    expect(await rowsOf(tm.by.id)).toEqual([]);
  });

  it("K464-DB-009 失敗（知らせ）：知らせが書けなかった回の次の止まりは、知らせが書かれる（失敗が残らない）", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const broken = await ticket({ assignee: tm.by, title: "書けなかったチケット" });
    await breakNotify(broken.tenant, async () => {
      await makeEnds(broken, tm, { state: "stopped", reason: "書けない回" });
    });
    const next = await ticket({ assignee: tm.by, title: "次のチケット" });
    await makeEnds(next, tm, { state: "stopped", reason: "書ける回" });
    const rows = await rowsOf(tm.by.id);
    expect(rows).toHaveLength(1);
    expect((rows[0]!["payload"] as { ticket_id: string }).ticket_id).toBe(next.id);
  });

  it("K464-DB-010 失敗（証跡）：止まった知らせの書き込みは証跡（audit_events）を増やさない", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "証跡を見るチケット" });
    const n = async () =>
      Number(
        (
          await one<{ n: string }>(
            "select count(*) as n from audit_events where action like 'notifications.%' or payload::text like '%ticket.stopped%'",
          )
        ).n,
      );
    const before = await n();
    await makeEnds(t, tm, { state: "stopped", reason: "証跡に出ない理由" });
    expect(await rowsOf(tm.by.id)).toHaveLength(1);
    expect(await n()).toBe(before);
  });

  it("K464-DB-011 二重に書かない：止まった実行の記録を直しても（理由を書き直す・もう一度 stopped にする）知らせは増えない。ticket_id の無い実行の記録が止まっても書かない", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "二重にならないチケット" });
    await makeEnds(t, tm, { state: "stopped", reason: "最初の理由" });
    const [run] = await runsOf(t.id, "make");
    await f.admin.query("update action_runs set error_summary = '書き直した理由' where id = $1", [run!.id]);
    await f.admin.query("update action_runs set status_id = 'stopped' where id = $1", [run!.id]);
    expect(await rowsOf(tm.by.id)).toHaveLength(1);
    const total = async () =>
      Number(
        (
          await one<{ n: string }>(
            "select count(*) as n from notifications where tenant_id = $1 and event_kind_id = $2",
            [t.tenant, KIND],
          )
        ).n,
      );
    const before = await total();
    const loose = await one<{ id: string }>(
      "insert into action_runs (tenant_id, scope_id, status_id) values ($1, $2, 'running') returning id",
      [t.tenant, t.scope],
    );
    await f.admin.query(
      "update action_runs set status_id = 'stopped', error_summary = 'チケットの無い実行' where id = $1",
      [loose.id],
    );
    expect(await total()).toBe(before);
  });

  it("K464-DB-012 理由は 200 字で切る：知らせの payload の reason は 200 字・実行の記録の理由は全文のまま", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "長い理由のチケット" });
    const long = "あ".repeat(300);
    await makeEnds(t, tm, { state: "stopped", reason: long });
    const [run] = await runsOf(t.id, "make");
    expect(run!.error_summary).toBe(long);
    const reason = (await rowsOf(tm.by.id))[0]!["payload"] as { reason: string };
    expect(reason.reason).toHaveLength(200);
    expect(long.startsWith(reason.reason)).toBe(true);
  });

  it("K464-DB-013 鈴に出る：書いた知らせは K-461 の一覧に札「stopped」・行き先 /tickets/<id>・理由つきで出る", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "鈴に出る止まりのチケット" });
    await makeEnds(t, tm, { state: "stopped", reason: "発注ナビの画面が変わっていた" });
    const item = (await pageOf(tm.by)).data.find((x) => x.kind === KIND)!;
    expect(item).toMatchObject({
      tag: "stopped",
      href: `/tickets/${t.id}`,
      ticket_id: t.id,
      title: "鈴に出る止まりのチケット",
      read: false,
    });
    expect(item.params["reason"]).toBe("発注ナビの画面が変わっていた");
  });

  it("K464-DB-014 24 時間の聞き直しで止めた仕事にも出る（切り替わりの瞬間）：承認から 24 時間を過ぎた実行の仕事を PC が取りに来る前の片付けで止めると、「止まった」知らせが 1 つ出る（承認待ちの知らせを数えるのは K-463 の K463-DB-012）", async () => {
    await ready();
    const t = await ticket({ title: "24 時間を過ぎるチケット" });
    const a = await approved(t);
    await f.admin.query(
      "update approvals set decided_at = now() - interval '24 hours 1 minute' where ticket_id = $1 and decision is not null",
      [t.id],
    );
    await lastSeen(a.pc.sid, 1);
    await take(a.pc);
    const stopped = (await rowsOf(boss.id)).filter((r) => (r["payload"] as { ticket_id: string }).ticket_id === t.id);
    expect(stopped).toHaveLength(1);
    expect((stopped[0]!["payload"] as { reason: string }).reason).toContain("24 時間");
  });

  it("K464-DB-016 人を止めた・外したとき（G-14）：AI を動かした人が止められたとき、担当者が別なら担当者に出る。担当者本人が止められたなら出ない（宛先が今のメンバーでない）", async () => {
    await ready();
    const pusher = await team("AI を動かす人");
    const t1 = await ticket({ assignee: boss, title: "押した人が止められるチケット" });
    await startMake(t1, pusher);
    // members_suspended_ck：止めた時刻と止めた人は一緒に入れる
    await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      pusher.by.id,
      boss.id,
    ]);
    expect((await runsOf(t1.id, "make"))[0]!.status_id).toBe("stopped");
    const mine = (await rowsOf(boss.id)).filter((r) => (r["payload"] as { ticket_id: string }).ticket_id === t1.id);
    expect(mine).toHaveLength(1);
    const reason = (mine[0]!["payload"] as { reason: unknown }).reason;
    expect(typeof reason === "string" && reason.length > 0).toBe(true);
    expect(await rowsOf(pusher.by.id)).toEqual([]);
    const self = await team("自分で動かす人");
    const t2 = await ticket({ assignee: self.by, title: "担当者本人が止められるチケット" });
    await startMake(t2, self);
    await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      self.by.id,
      boss.id,
    ]);
    expect((await runsOf(t2.id, "make"))[0]!.status_id).toBe("stopped");
    expect(await rowsOf(self.by.id)).toEqual([]);
  });

  it("K464-DB-017 PC を外したとき：動いている作る段が「PC を外したので止まりました」で止まり、担当者に知らせが 1 つ出る", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "PC を外されるチケット" });
    await startMake(t, tm);
    await f.admin.query("select app.device_revoke($1, $2)", [tm.by.id, tm.pc.sid]);
    expect((await runsOf(t.id, "make"))[0]!.status_id).toBe("stopped");
    const rows = await rowsOf(tm.by.id);
    expect(rows).toHaveLength(1);
    expect((rows[0]!["payload"] as { reason: string }).reason).toBe("PC を外したので止まりました");
  });

  it("K464-DB-018 PC がつながり直したときの後始末：途中で止まった作る段が止まった扱いになり、担当者に知らせが 1 つ出る。同じ後始末をもう一度呼んでも増えない", async () => {
    await ready();
    const tm = await team("AI を動かす人");
    const t = await ticket({ assignee: tm.by, title: "つながり直しで片付くチケット" });
    await startMake(t, tm);
    const sweep = async () =>
      Number((await f.admin.query<{ n: number }>("select app.bridge_sweep_orphans($1) as n", [tm.pc.sid])).rows[0]!.n);
    expect(await sweep()).toBeGreaterThanOrEqual(1);
    expect((await runsOf(t.id, "make"))[0]!.status_id).toBe("stopped");
    const rows = await rowsOf(tm.by.id);
    expect(rows).toHaveLength(1);
    expect((rows[0]!["payload"] as { reason: string }).reason).toContain("Bridge が途中で止まった");
    await sweep();
    expect(await rowsOf(tm.by.id)).toHaveLength(1);
  });

  it("K464-DB-015 引き金の形：action_runs の status_id を直すときだけ（行ごと）動く・security definer・search_path 固定。止まる所の関数（作る段の終わり・実行の終わり）は作り直していない", async () => {
    await ready();
    const trg = await one<{ def: string; enabled: string }>(
      "select pg_get_triggerdef(t.oid) as def, t.tgenabled as enabled from pg_trigger t where t.tgname = 'action_runs_ticket_stopped_notice' and t.tgrelid = 'action_runs'::regclass and not t.tgisinternal",
    );
    expect(trg.enabled).toBe("O");
    expect(trg.def).toMatch(/AFTER UPDATE OF status_id/);
    expect(trg.def).toMatch(/FOR EACH ROW/);
    const fn = await one<{ secdef: boolean; cfg: string[] | null }>(
      "select p.prosecdef as secdef, p.proconfig as cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'notify_ai_stopped'",
    );
    expect(fn.secdef).toBe(true);
    expect((fn.cfg ?? []).join(" ")).toMatch(/search_path=.*pg_temp/);
    for (const sig of [
      "app.bridge_finish_job(uuid,uuid,text,text,text,text)",
      "app.ticket_execute_job_end()",
      "app.on_member_stopped()",
    ]) {
      const def = await one<{ def: string }>("select pg_get_functiondef($1::regprocedure) as def", [sig]);
      expect(def.def, sig).not.toContain("ticket.stopped");
    }
  });
});
