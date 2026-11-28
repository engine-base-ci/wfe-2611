// K-731 の試験のうち、承認の後の実行（phase execute）を止める 3 行（K731-API-007・008・013）。承認の土台（F5/approve-complete.harness.ts）が要るので別のファイル。
//   名前の頭の行 ID は 11_tickets/K-731.md の行の表と 1 対 1。口の振る舞い（apps/api/src/hooks/run-stop.ts の register）は最初の要求の前に 1 回だけ読む
//   （準備で読まないのは、実装の前の切る段の smoke で、まだ無いファイルを準備で読んで準備ごと落とさないため・answer=8f745003d023）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
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
  json,
  req,
  auth,
  one,
  num,
  take,
  finish,
  lastSeen,
  stageKeyOf,
  ticket,
  approved,
  approvalRow,
  jobOf,
  messagesOf,
} from "./approve-complete.harness.js";

setupApproveComplete();

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

const IGNORED = "止めたので、届いた結果は使いませんでした";
const stop = async (runId: string) => {
  await loadHook();
  return req("POST", `/action_runs/${runId}/stop`, { body: {}, headers: auth(boss) });
};
const runStatus = async (id: string) =>
  await one<{ status_id: string; error_summary: string | null }>(
    "select status_id, error_summary from action_runs where id = $1",
    [id],
  );
const flag = async (t: string) =>
  (await one<{ d: boolean }>("select delegated_to_clone as d from tickets where id = $1", [t])).d;

describe("K-731 止める：承認の後の実行（phase execute）", () => {
  it("K731-API-007 動いている承認の後の実行 × 止める × 担当者：201。実行はすぐ止まり、仕事に止める合図が立ち、段は作業中・旗は下り、承認の行は承認のまま。やり取りに止めた行が 1 つだけ", async () => {
    const t = await ticket();
    const a = await approved(t);
    await lastSeen(a.pc.sid, 1);
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    const r = await stop(a.execRunId);
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await json(r)).data).toMatchObject({ id: a.execRunId, phase: "execute", status: "stopped" });
    expect(await runStatus(a.execRunId)).toMatchObject({ status_id: "stopped" });
    const j = await one<{ state_id: string; stop_requested_at: string | null }>(
      "select state_id, stop_requested_at from bridge_jobs where id = $1",
      [a.execJobId],
    );
    expect(j.state_id).toBe("running");
    expect(j.stop_requested_at).not.toBeNull();
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(await flag(t.id)).toBe(false);
    expect(await approvalRow(a.approvalId)).toMatchObject({ decision: "approve", withdrawn_at: null });
    const lines = (await messagesOf(t.id)).filter((m) => m.body.includes("AI を止めました"));
    expect(lines).toHaveLength(1);
  });

  it("K731-API-008 待っている承認の後の実行（PC がまだ取っていない）× 止める：201。仕事はその場で止まり、仕事を閉じた引き金の「実行が止まりました」の行は重ねて出ない（止めた行の 1 つだけ）", async () => {
    const t = await ticket();
    const a = await approved(t);
    const r = await stop(a.execRunId);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await runStatus(a.execRunId)).toMatchObject({ status_id: "stopped" });
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "stopped" });
    expect(await stageKeyOf(t.id)).toBe("doing");
    const lines = await messagesOf(t.id);
    expect(lines.filter((m) => m.body.includes("AI を止めました"))).toHaveLength(1);
    expect(lines.filter((m) => m.body.includes("の実行が止まりました"))).toHaveLength(0);
    expect(await approvalRow(a.approvalId)).toMatchObject({ decision: "approve" });
    expect(await num("select count(*) as n from approvals where ticket_id = $1", [t.id])).toBe(1);
  });

  it("K731-API-013 止めた後に承認の後の実行の「終わった」が届く：201 で受けるが、実行は止まったまま・「実行しました」の行は出ず、「使いませんでした」の行が 1 つ。段は作業中のまま", async () => {
    const t = await ticket();
    const a = await approved(t);
    await lastSeen(a.pc.sid, 1);
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    expect((await stop(a.execRunId)).status).toBe(201);
    await finish(a.pc, a.execJobId, {
      state: "done",
      result: "送りました（宛先：先方の経理）",
      agent_session_id: a.agentSession,
    });
    expect(await runStatus(a.execRunId)).toMatchObject({ status_id: "stopped" });
    const lines = await messagesOf(t.id);
    expect(lines.filter((m) => m.body.includes("のAI が実行しました"))).toHaveLength(0);
    expect(lines.filter((m) => m.body.includes(IGNORED))).toHaveLength(1);
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(await flag(t.id)).toBe(false);
  });
});
