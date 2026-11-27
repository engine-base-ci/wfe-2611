// K-1191「片付けに失敗した承認の後の実行を、決めた時間（1 時間）で自動で止める・担当者が止めたときの理由の文・実行の形に印を出す」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K1191-API-…）は 11_tickets/K-1191.md の表の行に 1 対 1 で結ぶ。決める人の答え answer=e45134b8f83b・449e47c15ace・ed20fcc1483d（2026-11-24）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台・道具・決めた文は ./approve-complete.harness.ts。
// 印（K-1190 の bridge_jobs.sweep_failed_at）は試験の中で直に置く。判定 app.ticket_execute_stop_reason(uuid) は、決めた仕事の id のときだけ例外に作り替える（K-1190 の試験と同じ形）。
// 止める口（stopActionRun・K-731 の apps/api/src/hooks/run-stop.ts の register）は最初の要求の前に 1 回だけ読む（準備で読まない：切る段の smoke で、まだ無いファイルで準備ごと落とさないため・answer=8f745003d023）。
import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import {
  setupApproveComplete,
  f,
  hooks,
  limits,
  boss,
  writer,
  json,
  req,
  auth,
  one,
  queue,
  take,
  stageKeyOf,
  team,
  ticket,
  runsOf,
  jobOf,
  messagesOf,
  openApprovals,
  approved,
  type Team,
  NO_SPEC,
} from "./approve-complete.harness.js";

setupApproveComplete();

const AUTO = "片付けに失敗したまま 1 時間たったので止めました。もう一度「AI に任せる」を押せます";
const STOP_REASON = "app.ticket_execute_stop_reason(uuid)";
const ORIG = "app.k1191_stop_reason_orig";
const HOOK_FILE = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "src", "hooks", "run-stop.ts");
let ready: Promise<void> | null = null;
const loadHook = (): Promise<void> =>
  (ready ??= (async () => {
    const m = (await import(HOOK_FILE)) as { register: HookModule };
    Object.assign(hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
    limits["stopActionRun"] = 100_000;
  })());
beforeAll(() => {
  ready = null;
});
const stop = async (runId: string, who = boss) => {
  await loadHook();
  return req("POST", `/action_runs/${runId}/stop`, { body: {}, headers: auth(who) });
};
/** body の間だけ、判定を ids の仕事のときだけ例外にする。終わったら元の定義に戻す */
const brokenFor = async <R>(ids: string[], body: () => Promise<R>): Promise<R> => {
  const d = await one<{ def: string | null }>("select pg_get_functiondef(to_regprocedure($1)) as def", [STOP_REASON]);
  expect(d.def, `${STOP_REASON} が無い（K-164 の migration で作る）`).toBeTruthy();
  const def = d.def!;
  await f.admin.query(def.replace(/FUNCTION app\.ticket_execute_stop_reason\(/, `FUNCTION ${ORIG}(`));
  const list = ids.map((x) => `'${x}'`).join(",");
  await f.admin.query(
    `create or replace function app.ticket_execute_stop_reason(p_job uuid) returns text
     language plpgsql stable security definer set search_path = public, app, pg_temp as $k1191$
     begin
       if p_job = any(array[${list}]::uuid[]) then raise exception 'K1191 の試験で 1 件を壊した'; end if;
       return ${ORIG}(p_job);
     end $k1191$`,
  );
  try {
    return await body();
  } finally {
    await f.admin.query(def);
    await f.admin.query(`drop function if exists ${ORIG}(uuid)`);
  }
};
/** 印を「min 分前に最初に失敗した」にする */
const markAgo = (jobId: string, min: number) =>
  f.admin.query(
    "update bridge_jobs set sweep_failed_at = now() - make_interval(mins => $2), sweep_error_code = 'P0001' where id = $1",
    [jobId, min],
  );
const markOf = (jobId: string) =>
  one<{ at: Date | null }>("select sweep_failed_at as at from bridge_jobs where id = $1", [jobId]);
const takeAll = async (tm: Team) => {
  const got: string[] = [];
  for (let job = await take(tm.pc); job; job = await take(tm.pc)) got.push(job.id);
  return got;
};
const queueOk = async () => {
  const r = await queue(boss);
  expect(r.status, await r.clone().text()).toBe(200);
};
const nameOf = async (memberId: string) => (await one<{ n: string }>("select app.member_name($1) as n", [memberId])).n;

describe("K-1191 片付けに失敗した承認の後の実行を止める（口・本物の DB）", () => {
  it("K1191-API-001 時間の流れ × 印が 1 時間 1 分前・判定はまだ例外 × 承認待ちの一覧を読む：判定を呼ばずに止める。仕事と実行は stopped・理由は自動の文・チケットは作業中・やり取りに止まった 1 行（理由つき）・聞き直しの承認待ちは作らない・印は消える", async () => {
    const t = await ticket();
    const a = await approved(t);
    await markAgo(a.execJobId, 61);
    await brokenFor([a.execJobId], queueOk);
    const j = await jobOf(a.execJobId);
    expect(j["state_id"]).toBe("stopped");
    expect(j["stopped_reason"]).toBe(AUTO);
    const run = (await runsOf(t.id, "execute"))[0]!;
    expect(run.status_id).toBe("stopped");
    expect(run.error_summary).toBe(AUTO);
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect((await messagesOf(t.id)).filter((m) => m.body.includes(AUTO))).toHaveLength(1);
    expect(await openApprovals(t.id)).toBe(0);
    expect((await markOf(a.execJobId)).at).toBeNull();
  });

  it("K1191-API-002 時間の流れ × 境目の手前（印が 59 分前・判定はまだ例外）× 承認待ちの一覧を読む：止めない。仕事は queued・チケットは実行中の段のまま・印の時刻は変わらない", async () => {
    const t = await ticket();
    const a = await approved(t);
    await markAgo(a.execJobId, 59);
    const before = (await markOf(a.execJobId)).at!;
    await brokenFor([a.execJobId], queueOk);
    expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
    expect(await stageKeyOf(t.id)).toBe("running");
    expect((await markOf(a.execJobId)).at!.getTime()).toBe(before.getTime());
  });

  it("K1191-API-003 入口 × PC が取りに来る（取る前の片付け）× 印が 1 時間 1 分前・判定はまだ例外：渡さずに止める（stopped・自動の文）。同じ人の会話の仕事は渡る", async () => {
    const tm = await team("K1191-003 の人");
    const t = await ticket();
    const a = await approved(t, { by: tm });
    const conv = (
      await one<{ id: string }>(
        "insert into conversations (tenant_id, scope_id, owner_member_id, title) values ($1, $2, $3, 'K1191 の会話') returning id",
        [t.tenant, t.scope, tm.by.id],
      )
    ).id;
    const chat = (
      await one<{ id: string }>(
        "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, permission_mode) values ($1, $2, $3, $4, 'queued', '今月の売上は？', 'chat', 'manual') returning id",
        [t.tenant, t.scope, tm.by.id, conv],
      )
    ).id;
    await markAgo(a.execJobId, 61);
    expect(await brokenFor([a.execJobId], () => takeAll(tm))).toEqual([chat]);
    const j = await jobOf(a.execJobId);
    expect(j["state_id"]).toBe("stopped");
    expect(j["stopped_reason"]).toBe(AUTO);
    expect(await stageKeyOf(t.id)).toBe("doing");
  });

  it("K1191-API-004 失敗 × [残る] 自動で止めること自体が例外（その仕事を stopped にする update が落ちる）× 同じ一覧にほかの 24 時間超の実行：一覧は 200。止められない 1 件は queued のまま・印の時刻はそのまま（次の回にまた止める）。ほかの 1 件は今までどおり聞き直しになる", async () => {
    const tBad = await ticket();
    const aBad = await approved(tBad);
    const tGood = await ticket();
    const aGood = await approved(tGood);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      aGood.approvalId,
    ]);
    await markAgo(aBad.execJobId, 61);
    const before = (await markOf(aBad.execJobId)).at!;
    await f.admin.query(
      `create or replace function app.k1191_block_stop() returns trigger language plpgsql as $k1191$
       begin
         if new.id = '${aBad.execJobId}'::uuid and new.state_id = 'stopped' then raise exception 'K1191 の試験で止めるのを壊した'; end if;
         return new;
       end $k1191$`,
    );
    await f.admin.query(
      "create trigger k1191_block_stop before update on bridge_jobs for each row execute function app.k1191_block_stop()",
    );
    try {
      await queueOk();
    } finally {
      await f.admin.query("drop trigger if exists k1191_block_stop on bridge_jobs");
      await f.admin.query("drop function if exists app.k1191_block_stop()");
    }
    expect((await jobOf(aBad.execJobId))["state_id"]).toBe("queued");
    expect((await markOf(aBad.execJobId)).at!.getTime()).toBe(before.getTime());
    expect((await jobOf(aGood.execJobId))["state_id"]).toBe("stopped");
    expect(await openApprovals(tGood.id)).toBe(1);
  });

  it("K1191-API-005 実行の形（getActionRun）× 印のある待っている実行・印の無い待っている実行・止まった実行（印が残っている）：sweep_failed_at は印のある待っている実行だけ印の時刻（ISO の時刻）、ほかは null", async () => {
    const t1 = await ticket();
    const a1 = await approved(t1);
    await markAgo(a1.execJobId, 5);
    const mark = (await markOf(a1.execJobId)).at!;
    const t2 = await ticket();
    const a2 = await approved(t2);
    const t3 = await ticket();
    const a3 = await approved(t3);
    await markAgo(a3.execJobId, 5); // 止まった実行に印が残っていても、形には出さない
    await f.admin.query(
      "update bridge_jobs set state_id = 'stopped', stopped_reason = 'K1191 の試験で止めた' where id = $1",
      [a3.execJobId],
    );
    const view = async (runId: string) => {
      const r = await req("GET", `/action_runs/${runId}`, { headers: auth(boss) });
      expect(r.status, await r.clone().text()).toBe(200);
      return (await json(r)).data as Record<string, unknown>;
    };
    const v1 = await view(a1.execRunId);
    expect(new Date(String(v1["sweep_failed_at"])).getTime()).toBe(mark.getTime());
    expect((await view(a2.execRunId))["sweep_failed_at"]).toBeNull();
    expect((await view(a3.execRunId))["sweep_failed_at"]).toBeNull();
  });

  it("K1191-API-006 操作 × 担当者が［この実行を止める］（stopActionRun）× 印のある待っている実行：201。実行と仕事は stopped・理由は「片付けに失敗していたので、〈担当者〉が止めました」・チケットは作業中・やり取りに「〈担当者〉が AI を止めました」が 1 行・印は消える", async () => {
    const t = await ticket();
    const a = await approved(t);
    await markAgo(a.execJobId, 10);
    const r = await stop(a.execRunId);
    expect(r.status, await r.clone().text()).toBe(201);
    const why = `片付けに失敗していたので、${await nameOf(boss.id)}が止めました`;
    expect((await json(r)).data).toMatchObject({ id: a.execRunId, status: "stopped", stopped_reason: why });
    const j = await jobOf(a.execJobId);
    expect(j["state_id"]).toBe("stopped");
    expect(j["stopped_reason"]).toBe(why);
    expect((await runsOf(t.id, "execute"))[0]!.error_summary).toBe(why);
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect((await messagesOf(t.id)).filter((m) => m.body.includes("AI を止めました"))).toHaveLength(1);
    expect((await markOf(a.execJobId)).at).toBeNull();
  });

  it("K1191-API-007 守り × 担当者でない書ける人が印のある実行を止めようとする：403・E-RUN-001。仕事は queued・印はそのまま（止められるのは担当者だけ）", async () => {
    const t = await ticket();
    const a = await approved(t);
    await markAgo(a.execJobId, 10);
    const r = await stop(a.execRunId, writer);
    expect(r.status, await r.clone().text()).toBe(403);
    expect((await json(r))["code"]).toBe("E-RUN-001");
    expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
    expect((await markOf(a.execJobId)).at).not.toBeNull();
  });

  it("K1191-API-008 時間の流れ × 自動で止まった後に担当者がもう一度「AI に任せる」：201（新しい作る段の実行が積まれる）", async () => {
    const t = await ticket();
    const a = await approved(t);
    await markAgo(a.execJobId, 61);
    await brokenFor([a.execJobId], queueOk);
    expect((await jobOf(a.execJobId))["state_id"]).toBe("stopped");
    const d = await req("POST", `/tickets/${t.id}/delegate`, { body: { no_spec_reason: NO_SPEC }, headers: auth(a.by) });
    expect(d.status, await d.clone().text()).toBe(201);
    expect((await runsOf(t.id, "make")).at(-1)!.status_id).toBe("queued");
  });
});
