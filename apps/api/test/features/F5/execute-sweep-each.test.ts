// K-1190「承認の後の実行の片付けを 1 件ずつ受け、1 件の例外で残りを止めない」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K1190-API-…）は 11_tickets/K-1190.md の表の行に 1 対 1 で結ぶ。決める人の答え answer=6cc3d368a591（2026-11-24）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台・道具・決めた文は ./approve-complete.harness.ts。
// 1 件だけの例外は、片付けが中で呼ぶ判定 app.ticket_execute_stop_reason(uuid) を、この試験の中だけ「決めた仕事の id のときだけ例外・ほかは元の判定」に
//   作り替えて起こす（元の定義は別の名前に写して呼び、終わったら元に戻して写しを消す。K-189 の K189-API-009 の作り替えを 1 件に絞った形）。
import { describe, expect, it } from "vitest";
import {
  setupApproveComplete,
  STOP_24H,
  f,
  T,
  boss,
  one,
  num,
  queue,
  take,
  stageKeyOf,
  team,
  ticket,
  runsOf,
  jobOf,
  openApprovals,
  approved,
  type Team,
} from "./approve-complete.harness.js";

setupApproveComplete();

const STOP_REASON = "app.ticket_execute_stop_reason(uuid)";
const ORIG = "app.k1190_stop_reason_orig";
/** body の間だけ、判定を ids の仕事のときだけ例外にする（errcode は例外の SQLSTATE。既定は raise の P0001）。終わったら元の定義に戻す */
const brokenFor = async <R>(ids: string[], body: () => Promise<R>, errcode = "P0001"): Promise<R> => {
  const d = await one<{ def: string | null }>("select pg_get_functiondef(to_regprocedure($1)) as def", [STOP_REASON]);
  expect(d.def, `${STOP_REASON} が無い（K-164 の migration で作る）`).toBeTruthy();
  const def = d.def!;
  await f.admin.query(def.replace(/FUNCTION app\.ticket_execute_stop_reason\(/, `FUNCTION ${ORIG}(`));
  const list = ids.map((x) => `'${x}'`).join(",");
  await f.admin.query(
    `create or replace function app.ticket_execute_stop_reason(p_job uuid) returns text
     language plpgsql stable security definer set search_path = public, app, pg_temp as $k1190$
     begin
       if p_job = any(array[${list}]::uuid[]) then raise exception 'K1190 の試験で 1 件を壊した' using errcode = '${errcode}'; end if;
       return ${ORIG}(p_job);
     end $k1190$`,
  );
  try {
    return await body();
  } finally {
    await f.admin.query(def);
    await f.admin.query(`drop function if exists ${ORIG}(uuid)`);
  }
};
/** 会話の仕事を 1 件、その人に積む（K-189 の試験と同じ形） */
const chatJob = async (tm: Team) => {
  const conv = (
    await one<{ id: string }>(
      "insert into conversations (tenant_id, scope_id, owner_member_id, title) values ($1, $2, $3, 'K1190 の会話') returning id",
      [T.tenantId, T.rootScope, tm.by.id],
    )
  ).id;
  return (
    await one<{ id: string }>(
      "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, permission_mode) values ($1, $2, $3, $4, 'queued', '今月の売上は？', 'chat', 'manual') returning id",
      [T.tenantId, T.rootScope, tm.by.id, conv],
    )
  ).id;
};
/** その PC に渡る仕事を、無くなるまで全部取る */
const takeAll = async (tm: Team) => {
  const got: string[] = [];
  for (let job = await take(tm.pc); job; job = await take(tm.pc)) got.push(job.id);
  return got;
};
const over24h = (approvalId: string) =>
  f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [approvalId]);
const execStatus = async (ticketId: string) => (await runsOf(ticketId, "execute"))[0]!.status_id;
/** 片付けに失敗した印（最初に失敗した時刻と例外の SQLSTATE） */
const markOf = (jobId: string) =>
  one<{ at: Date | null; code: string | null }>(
    "select sweep_failed_at as at, sweep_error_code as code from bridge_jobs where id = $1",
    [jobId],
  );
const queueOk = async () => {
  const r = await queue(boss);
  expect(r.status, await r.clone().text()).toBe(200);
};

describe("K-1190 承認の後の実行の片付けを 1 件ずつ受ける（口・本物の DB）", () => {
  it("K1190-API-001 失敗 × 読むときの片付け（承認待ちの一覧）の中で 1 件の判定が例外 × ほかの 2 件は承認から 24 時間を過ぎている：一覧は 200。ほかの 2 件は止まって聞き直しの承認待ちが 1 つずつでき、チケットは承認待ち。例外の 1 件は待ったまま（queued・聞き直しの行 0・実行中の段のまま）で、印（最初に失敗した時刻と SQLSTATE P0001）が付く", async () => {
    const ts = [await ticket(), await ticket(), await ticket()];
    const as = [];
    for (const t of ts) as.push(await approved(t));
    for (const a of as) await over24h(a.approvalId);
    // 例外にするのは id がいちばん小さい仕事（片付けは id の順に見るので、ほかの 2 件はどちらも例外の後に見る）
    const order = as.map((a, i) => ({ id: a.execJobId, i })).sort((x, y) => (x.id < y.id ? -1 : 1));
    const bad = order[0]!.i;
    const good = [0, 1, 2].filter((i) => i !== bad);
    await brokenFor([as[bad]!.execJobId], queueOk);
    for (const i of good) {
      const j = await jobOf(as[i]!.execJobId);
      expect(j["state_id"]).toBe("stopped");
      expect(j["stopped_reason"]).toBe(STOP_24H);
      expect(await openApprovals(ts[i]!.id)).toBe(1);
      expect(await stageKeyOf(ts[i]!.id)).toBe("awaiting_approval");
    }
    expect((await jobOf(as[bad]!.execJobId))["state_id"]).toBe("queued");
    expect(await execStatus(ts[bad]!.id)).toBe("queued");
    expect(await openApprovals(ts[bad]!.id)).toBe(0);
    expect(await stageKeyOf(ts[bad]!.id)).toBe("running");
    const m = await markOf(as[bad]!.execJobId);
    expect(m.at).not.toBeNull();
    expect(m.code).toBe("P0001");
    for (const i of good) expect((await markOf(as[i]!.execJobId)).at).toBeNull();
  });

  it("K1190-API-002 失敗 × 取る前の片付け（PC が取りに来る）の中で 1 件の判定が例外 × 同じ人に止める理由の無い別の承認の後の実行と会話の仕事が待っている：取る口は 2xx。会話と別の実行は渡る（回全体を止める K-189 の形にしない）。例外の 1 件は渡らず queued のまま・印が付く", async () => {
    const tm = await team("K1190-002 の人");
    const tBad = await ticket();
    const aBad = await approved(tBad, { by: tm });
    const tGood = await ticket();
    const aGood = await approved(tGood, { by: tm });
    const chat = await chatJob(tm);
    const got = await brokenFor([aBad.execJobId], () => takeAll(tm));
    expect([...got].sort()).toEqual([chat, aGood.execJobId].sort());
    expect(await execStatus(tGood.id)).toBe("running");
    expect((await jobOf(aBad.execJobId))["state_id"]).toBe("queued");
    expect(await execStatus(tBad.id)).toBe("queued");
    expect((await markOf(aBad.execJobId)).at).not.toBeNull();
  });

  it("K1190-API-003 守り × 渡す関数を直に呼ぶ（app.bridge_take_job・第 2 引数なし＝片付けが通った回の呼び方）× 印の付いた、止める理由の無い承認の後の実行：返さない（0 行）。印を消すと返す", async () => {
    const tm = await team("K1190-003 の人");
    const t = await ticket();
    const a = await approved(t, { by: tm });
    await f.admin.query("update bridge_jobs set sweep_failed_at = now(), sweep_error_code = 'P0001' where id = $1", [
      a.execJobId,
    ]);
    // 直に呼んだ分は後に残さない（1 つのトランザクションで呼んで戻す）
    const cl = await f.pool.connect();
    try {
      await cl.query("begin");
      const held = await cl.query<{ job_id: string | null }>("select job_id from app.bridge_take_job($1)", [tm.pc.sid]);
      expect(held.rows.map((x) => x.job_id)).toEqual([]);
      await cl.query("update bridge_jobs set sweep_failed_at = null, sweep_error_code = null where id = $1", [
        a.execJobId,
      ]);
      const plain = await cl.query<{ job_id: string | null }>("select job_id from app.bridge_take_job($1)", [
        tm.pc.sid,
      ]);
      expect(plain.rows.map((x) => x.job_id)).toEqual([a.execJobId]);
    } finally {
      await cl.query("rollback");
      cl.release();
    }
    expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
  });

  it("K1190-API-004 時間の流れ × 判定が直った直後の取り：前の回で印が付いた止める理由の無い実行は、次の片付けで印が消え、その回に PC に渡る（running）", async () => {
    const tm = await team("K1190-004 の人");
    const t = await ticket();
    const a = await approved(t, { by: tm });
    expect(await brokenFor([a.execJobId], () => takeAll(tm))).toEqual([]);
    expect((await markOf(a.execJobId)).at).not.toBeNull();
    expect(await takeAll(tm)).toEqual([a.execJobId]);
    expect(await execStatus(t.id)).toBe("running");
    const m = await markOf(a.execJobId);
    expect(m.at).toBeNull();
    expect(m.code).toBeNull();
  });

  it("K1190-API-005 時間の流れ × 同じ仕事が続けて例外になる：印の時刻は最初に失敗した時刻のまま（2 回目で書き換えない）", async () => {
    const t = await ticket();
    const a = await approved(t);
    await brokenFor([a.execJobId], async () => {
      await queueOk();
      await f.admin.query("update bridge_jobs set sweep_failed_at = now() - interval '10 minutes' where id = $1", [
        a.execJobId,
      ]);
      const first = (await markOf(a.execJobId)).at!;
      await queueOk();
      expect((await markOf(a.execJobId)).at!.getTime()).toBe(first.getTime());
    });
    expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
  });

  it("K1190-API-006 失敗 × [残る] 印を書くこと自体が失敗する（1 件の判定が例外・その仕事の印の書き込みも例外）× 同じ人に止める理由の無い別の実行と会話の仕事：その回の片付けは全部失敗に戻り（K-189 の形）、取る口は 2xx で会話だけを渡す。どちらの実行も渡らず queued・印は付かない", async () => {
    const tm = await team("K1190-006 の人");
    const tBad = await ticket();
    const aBad = await approved(tBad, { by: tm });
    const tGood = await ticket();
    const aGood = await approved(tGood, { by: tm });
    const chat = await chatJob(tm);
    await f.admin.query(
      `create or replace function app.k1190_block_mark() returns trigger language plpgsql as $k1190$
       begin
         if new.id = '${aBad.execJobId}'::uuid and new.sweep_failed_at is distinct from old.sweep_failed_at then
           raise exception 'K1190 の試験で印の書き込みを壊した';
         end if;
         return new;
       end $k1190$`,
    );
    await f.admin.query(
      "create trigger k1190_block_mark before update on bridge_jobs for each row execute function app.k1190_block_mark()",
    );
    try {
      const got = await brokenFor([aBad.execJobId], () => takeAll(tm));
      expect(got).toEqual([chat]);
    } finally {
      await f.admin.query("drop trigger if exists k1190_block_mark on bridge_jobs");
      await f.admin.query("drop function if exists app.k1190_block_mark()");
    }
    expect((await jobOf(aBad.execJobId))["state_id"]).toBe("queued");
    expect((await jobOf(aGood.execJobId))["state_id"]).toBe("queued");
    expect((await markOf(aBad.execJobId)).at).toBeNull();
  });

  it("K1190-API-007 失敗 × 1 件の判定が時間切れ・取り消し（SQLSTATE 57014）で落ちる × ほかの 1 件は承認から 24 時間を過ぎている：1 件ずつは受けない（回の片付け全体が戻る）。一覧は 200 のまま。ほかの 1 件も止めず聞き直しの行も作らない。印は付かない", async () => {
    const ts = [await ticket(), await ticket()];
    const as = [];
    for (const t of ts) as.push(await approved(t));
    for (const a of as) await over24h(a.approvalId);
    const bad = as[0]!.execJobId < as[1]!.execJobId ? 0 : 1;
    const good = 1 - bad;
    await brokenFor([as[bad]!.execJobId], queueOk, "57014");
    expect((await jobOf(as[good]!.execJobId))["state_id"]).toBe("queued");
    expect(await openApprovals(ts[good]!.id)).toBe(0);
    expect((await jobOf(as[bad]!.execJobId))["state_id"]).toBe("queued");
    expect((await markOf(as[bad]!.execJobId)).at).toBeNull();
    expect(
      await num("select count(*) as n from bridge_jobs where sweep_failed_at is not null and id = any($1)", [
        as.map((a) => a.execJobId),
      ]),
    ).toBe(0);
  });
});
