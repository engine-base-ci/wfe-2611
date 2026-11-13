// K-189「PC が仕事を受け取る口：前の片付けが失敗した回は、会話などの仕事は渡し、承認の後の実行は 1 つも渡さない」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K189-API-…）は 11_tickets/K-189.md の表の行に 1 対 1 で結ぶ。決める人の答え answer=b01eda354e6c（2026-11-13）③。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台・道具・決めた文は ./approve-complete.harness.ts。
// 片付けの失敗は、K-164 の関数を、この試験の中だけ例外に作り替えて起こす（形は元のまま・中身だけ。終わったら元の定義に戻す。K-164 の K-63 の API-085 と同じやり方）：
//   片付けそのもの app.ticket_execute_expire(uuid) と、片付けが中で呼ぶ判定 app.ticket_execute_stop_reason(uuid)（1 件のおかしい仕事で判定が例外になる形）。
//   片付けが失敗した回は、渡す側（app.bridge_take_job の第 2 引数 p_hold_execute = true）が承認の後の実行を止める理由の有無を見ずに 1 つも選ばない（判定の関数を呼ばない）ことを見る。
import { describe, expect, it } from "vitest";
import {
  setupApproveComplete,
  STOP_GONE,
  STOP_24H,
  f,
  T,
  boss,
  json,
  one,
  auth,
  req,
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
} from "./approve-complete.harness.js";

setupApproveComplete();

const EXPIRE = "app.ticket_execute_expire(uuid)";
const STOP_REASON = "app.ticket_execute_stop_reason(uuid)";
/** body の間だけ、K-164 の関数 sig を例外にする。終わったら元の定義に戻す */
const broken = async <R>(sig: string, body: () => Promise<R>): Promise<R> => {
  const d = await one<{ def: string | null }>("select pg_get_functiondef(to_regprocedure($1)) as def", [sig]);
  expect(d.def, `${sig} が無い（K-164 の migration で作る）`).toBeTruthy();
  const raising = d
    .def!.replace(/\n LANGUAGE \w+/, "\n LANGUAGE plpgsql")
    .replace(
      /AS \$(\w*)\$[\s\S]*\$\1\$\s*$/,
      () => "AS $k189$ begin raise exception 'K189 の試験で片付けを壊した'; end $k189$",
    );
  await f.admin.query(raising);
  try {
    return await body();
  } finally {
    await f.admin.query(d.def!);
  }
};
/** PC が取りに来る前の片付け（K-164 の ②）を丸ごと例外にする */
const expireBroken = <R>(body: () => Promise<R>): Promise<R> => broken(EXPIRE, body);
/** 会話の仕事を 1 件、その人に積む（K-62 の試験 delegate-bridge.test.ts の chatTaken と同じ形） */
const chatJob = async (tm: Team, prompt = "今月の売上は？") => {
  const conv = (
    await one<{ id: string }>(
      "insert into conversations (tenant_id, scope_id, owner_member_id, title) values ($1, $2, $3, 'K189 の会話') returning id",
      [T.tenantId, T.rootScope, tm.by.id],
    )
  ).id;
  return (
    await one<{ id: string }>(
      "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, permission_mode) values ($1, $2, $3, $4, 'queued', $5, 'chat', 'manual') returning id",
      [T.tenantId, T.rootScope, tm.by.id, conv, prompt],
    )
  ).id;
};
/** その PC に渡る仕事を、無くなるまで全部取る（動いている仕事の片付け idle はしない） */
const takeAll = async (tm: Team) => {
  const got: string[] = [];
  for (let job = await take(tm.pc); job; job = await take(tm.pc)) got.push(job.id);
  return got;
};
const toView = (memberId: string) =>
  f.admin.query("update permissions set ability_id = 'view' where grantee_member_id = $1", [memberId]);
const over24h = (approvalId: string) =>
  f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [approvalId]);
const execStatus = async (ticketId: string) => (await runsOf(ticketId, "execute"))[0]!.status_id;

describe("K-189 PC が仕事を受け取る口：前の片付けが失敗したとき（口・本物の DB）", () => {
  it("K189-API-001 失敗 × 片付けが例外 × 会話の仕事と作る段のチケットの仕事が待っている：取る口は 2xx で両方を渡す（500 にしない・答えに失敗を出さない）", async () => {
    const tm = await team("K189-001 の人");
    const chat = await chatJob(tm);
    const t = await ticket();
    const d = await req("POST", `/tickets/${t.id}/delegate`, { body: {}, headers: auth(tm.by) });
    expect(d.status, await d.clone().text()).toBe(201);
    const make = String(((await json(d)).data as Record<string, unknown>)["job_id"]);
    await expireBroken(async () => {
      const r = await req("POST", "/bridge/jobs/take", {
        body: { protocol: 99, idle: false, wait_sec: 0 },
        headers: { "x-bridge-session": tm.pc.token },
      });
      expect(r.status, await r.clone().text()).toBeLessThan(300);
      const body = await json(r);
      expect(body["code"]).toBeUndefined();
      const first = (body.data as unknown as { job: Record<string, unknown> | null }).job;
      expect(String(first?.["job_id"] ?? first?.["id"])).toBe(chat); // 先に積んだ会話の仕事
      expect(await takeAll(tm)).toEqual([make]);
    });
    expect((await jobOf(chat))["state_id"]).toBe("running");
    expect((await jobOf(make))["state_id"]).toBe("running");
    expect((await runsOf(t.id, "make"))[0]!.status_id).toBe("running");
  });

  it("K189-API-002 失敗 × 片付けが例外 × 止める理由の無い承認の後の実行（承認から 24 時間以内・任せた人が使える・チケットがある）：片付けが失敗した回は渡さない。仕事と実行の記録は待ったまま・チケットは実行中の段のまま。片付けが直った次の取りで渡る", async () => {
    const t = await ticket();
    const a = await approved(t);
    await expireBroken(async () => {
      expect(await takeAll(a)).toEqual([]);
      expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
      expect(await execStatus(t.id)).toBe("queued");
      expect(await stageKeyOf(t.id)).toBe("running");
    });
    expect(await takeAll(a)).toEqual([a.execJobId]);
    expect((await jobOf(a.execJobId))["state_id"]).toBe("running");
    expect(await execStatus(t.id)).toBe("running");
  });

  it("K189-API-003 失敗 × 片付けが例外 × 任せた人がチケットを直せなくなった承認の後の実行：渡さない。仕事と実行の記録は待ったまま（止めもしない）・チケットは実行中の段のまま。片付けが直った次の取りで止まり、理由が残ってチケットは作業中", async () => {
    const tm = await team("K189-003 の人");
    const t = await ticket();
    const a = await approved(t, { by: tm });
    await toView(tm.by.id);
    const lines = (await messagesOf(t.id)).length;
    await expireBroken(async () => {
      expect(await takeAll(tm)).toEqual([]);
      expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
      expect(await execStatus(t.id)).toBe("queued");
      expect(await stageKeyOf(t.id)).toBe("running");
      expect((await messagesOf(t.id)).length).toBe(lines);
    });
    // 片付けが直った：次に取りに来たときに止める（渡さない）
    expect(await takeAll(tm)).toEqual([]);
    const job = await jobOf(a.execJobId);
    expect(job["state_id"]).toBe("stopped");
    expect(String(job["stopped_reason"])).toContain("直せなくなったので");
    expect(await execStatus(t.id)).toBe("stopped");
    expect(await stageKeyOf(t.id)).toBe("doing");
  });

  it("K189-API-004 失敗 × 片付けが失敗している間に承認から 24 時間を過ぎた承認の後の実行：渡さない。仕事は待ったまま・聞き直しの行は作らない（片付けが失敗し続ける間は待つ）。片付けが直った次の取りで止まり、聞き直しの承認待ちが 1 つできる", async () => {
    const t = await ticket();
    const a = await approved(t);
    await over24h(a.approvalId);
    await expireBroken(async () => {
      expect(await takeAll(a)).toEqual([]);
      expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
      expect(await openApprovals(t.id)).toBe(0);
    });
    expect(await takeAll(a)).toEqual([]);
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_24H });
    expect(await openApprovals(t.id)).toBe(1);
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
  });

  it("K189-API-005 失敗 × 片付けが例外 × チケットが消された承認の後の実行：渡さない。仕事は待ったまま。片付けが直った次の取りで「チケットが消されたので止めました」で止まる", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [t.id, boss.id]);
    await expireBroken(async () => {
      expect(await takeAll(a)).toEqual([]);
      expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
    });
    expect(await takeAll(a)).toEqual([]);
    const job = await jobOf(a.execJobId);
    expect(job["state_id"]).toBe("stopped");
    expect(String(job["stopped_reason"])).toContain(STOP_GONE);
  });

  it("K189-API-006 操作の揺れ × 片付けが失敗し続ける × 渡せない承認の後の実行（先に積んだ）と会話の仕事が同じ人に待っている × PC が 3 回続けて取りに来る：3 回とも 2xx。会話の仕事は 1 回だけ渡り、渡せない実行は待ったまま（1 件のおかしい仕事でその人の PC 全体を止めない）", async () => {
    const tm = await team("K189-006 の人");
    const t = await ticket();
    const a = await approved(t, { by: tm }); // 先に積む（古い仕事が前に詰まっても、後ろの会話は渡る）
    await toView(tm.by.id);
    const chat = await chatJob(tm, "議事録をまとめて");
    await expireBroken(async () => {
      const got: (string | null)[] = [];
      for (let i = 0; i < 3; i++) got.push((await take(tm.pc))?.id ?? null);
      expect(got).toEqual([chat, null, null]);
      expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
      expect(await execStatus(t.id)).toBe("queued");
    });
    expect((await jobOf(chat))["state_id"]).toBe("running");
  });

  it("K189-API-007 守り × 渡す関数を直に呼ぶ（app.bridge_take_job の第 2 引数 p_hold_execute = true・片付けに失敗した回の呼び方）× 止める理由の無い承認の後の実行（先に積んだ）と会話の仕事：会話の仕事を返し、実行は返さない・待ったまま。第 2 引数なしの呼び方は今までどおり残る", async () => {
    const tm = await team("K189-007 の人");
    const t = await ticket();
    const a = await approved(t, { by: tm });
    const chat = await chatJob(tm);
    // 直に呼んだ分は後に残さない（1 つのトランザクションで呼んで戻す）
    const cl = await f.pool.connect();
    try {
      await cl.query("begin");
      const held = await cl.query<{ job_id: string | null }>("select job_id from app.bridge_take_job($1, true)", [
        tm.pc.sid,
      ]);
      expect(held.rows.map((x) => x.job_id)).toEqual([chat]);
      const again = await cl.query<{ job_id: string | null }>("select job_id from app.bridge_take_job($1, true)", [
        tm.pc.sid,
      ]);
      expect(again.rows.map((x) => x.job_id)).toEqual([]);
      // 第 2 引数なし（片付けが通った回の呼び方）は、今までどおり止める理由の無い実行を返す
      const plain = await cl.query<{ job_id: string | null }>("select job_id from app.bridge_take_job($1)", [
        tm.pc.sid,
      ]);
      expect(plain.rows.map((x) => x.job_id)).toEqual([a.execJobId]);
    } finally {
      await cl.query("rollback");
      cl.release();
    }
    expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
    expect(await execStatus(t.id)).toBe("queued");
    expect((await jobOf(chat))["state_id"]).toBe("queued");
  });

  it("K189-API-008 組み合わせ × 片付けが通る（いつもの形）× 任せた人が直せなくなった承認の後の実行と会話の仕事 × PC が取りに来る：実行は渡さず止まった（理由・作業中・やり取りの止まった 1 行は 1 つだけ）。会話は渡る", async () => {
    const tm = await team("K189-008 の人");
    const t = await ticket();
    const a = await approved(t, { by: tm });
    await toView(tm.by.id);
    const chat = await chatJob(tm);
    const lines = (await messagesOf(t.id)).length;
    expect(await takeAll(tm)).toEqual([chat]);
    const job = await jobOf(a.execJobId);
    expect(job["state_id"]).toBe("stopped");
    expect(String(job["stopped_reason"])).toContain("直せなくなったので");
    expect(await execStatus(t.id)).toBe("stopped");
    expect(await stageKeyOf(t.id)).toBe("doing");
    const added = (await messagesOf(t.id)).slice(lines);
    expect(added).toHaveLength(1); // 片付けが通った回は今までどおり：止まった 1 行は 1 つ
    expect(added[0]!.body).toContain("直せなくなったので");
  });

  it("K189-API-009 失敗 × 片付けが中で呼ぶ判定（app.ticket_execute_stop_reason）が例外になる（1 件のおかしい仕事）× 承認の後の実行（先に積んだ）と会話の仕事が待っている：取る口は 2xx。会話は渡り、実行は渡らず待ったまま（渡す側は判定の関数に頼らない）。判定が直った次の取りで実行が渡る", async () => {
    const tm = await team("K189-009 の人");
    const t = await ticket();
    const a = await approved(t, { by: tm });
    const chat = await chatJob(tm);
    await broken(STOP_REASON, async () => {
      const got: (string | null)[] = [];
      for (let i = 0; i < 2; i++) got.push((await take(tm.pc))?.id ?? null);
      expect(got).toEqual([chat, null]);
      expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
      expect(await execStatus(t.id)).toBe("queued");
      expect(await stageKeyOf(t.id)).toBe("running");
    });
    expect(await takeAll(tm)).toEqual([a.execJobId]);
    expect(await execStatus(t.id)).toBe("running");
  });
});
