// K-737「PC の側：AI に見せる道具を足す」の API の側の試験：PC が仕事を取ったときの答えに、会話の種類 talk_kind を足す（Bridge が作る画面の会話の仕事にだけ draft_propose を見せるため）。
//   行 ID は K737-API-NNN（11_tickets/K-737.md の表の行と 1 対 1）。土台は段 1 の F5/delegate-kit.ts（本物の Postgres・本物の PC の印）。
//   会話の行は DB に直に置く（会話の種類の列 talk_kind は K-757・作る画面の会話を始める口は K-774）。道具の鍵は取るときに付く（前から）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Person } from "../fixture.js";
import { data, delegateOk, makeKit, type Kit } from "./delegate-kit.js";

let k: Kit;
beforeAll(async () => {
  k = await makeKit();
}, 90_000);
afterAll(async () => {
  await k?.close();
});

const fresh = async (name: string) => {
  const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name, ticketAbility: "edit" });
  return { p, pc: await k.device(p, `${name} の PC`) };
};
/** 会話（種類を選べる）と、その会話の待っている仕事（kind chat）を置く */
const chatJob = async (p: Person, talkKind: string | null) => {
  const conv = (
    await k.q<{ id: string }>(
      talkKind === null
        ? "insert into conversations (tenant_id, scope_id, owner_member_id, title) values ($1, $2, $3, 'K737 の会話') returning id"
        : "insert into conversations (tenant_id, scope_id, owner_member_id, title, talk_kind) values ($1, $2, $3, 'K737 の会話', $4) returning id",
      talkKind === null ? [k.T.tenantId, k.T.rootScope, p.id] : [k.T.tenantId, k.T.rootScope, p.id, talkKind],
    )
  )[0]!.id;
  const job = (
    await k.q<{ id: string }>(
      "insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, conversation_id, created_by) values ($1, $2, $3, 'chat', 'queued', 'こんにちは', $4, $3) returning id",
      [k.T.tenantId, k.T.rootScope, p.id, conv],
    )
  )[0]!.id;
  return { conv, job };
};

describe("K-737 取る口の答えに会話の種類を足す", () => {
  it("K737-API-001 会話の仕事を取ると、仕事に talk_kind（draft・clone・ticket）が付く。作る画面の会話は draft・種類を決めない前からの会話は clone・チケットの会話は ticket。道具の鍵は前のまま付く", async () => {
    for (const kind of ["draft", "clone"] as const) {
      const { p, pc } = await fresh(`${kind} を取る人`);
      const { job } = await chatJob(p, kind);
      const got = await k.takeJob(pc);
      expect(got["job_id"]).toBe(job);
      expect(got["kind"]).toBe("chat");
      expect(got["talk_kind"]).toBe(kind);
      expect(typeof got.tool_token).toBe("string");
    }
    const { p, pc } = await fresh("前からの会話の人");
    await chatJob(p, null); // 列の既定値＝clone
    expect((await k.takeJob(pc))["talk_kind"]).toBe("clone");
    const { p: q, pc: qpc } = await fresh("チケットの会話の人");
    const t = await k.ticket(q);
    const conv = (
      await k.q<{ id: string }>(
        "insert into conversations (tenant_id, scope_id, owner_member_id, title, talk_kind, ticket_id) values ($1, $2, $3, 'K737 の会話', 'ticket', $4) returning id",
        [k.T.tenantId, k.T.rootScope, q.id, t],
      )
    )[0]!.id;
    await k.q(
      "insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, conversation_id, created_by) values ($1, $2, $3, 'chat', 'queued', 'こんにちは', $4, $3)",
      [k.T.tenantId, k.T.rootScope, q.id, conv],
    );
    expect((await k.takeJob(qpc))["talk_kind"]).toBe("ticket");
  });

  it("K737-API-002 会話でない仕事（チケットの仕事）の talk_kind は null。取った仕事の前からの鍵（job_id・prompt・kind・phase・ticket_id・tool_token・conventions・browser）は変わらない", async () => {
    const { p, pc } = await fresh("チケットの仕事の人");
    const t = await k.ticket(p);
    await delegateOk(k, p, t);
    const got = await k.takeJob(pc);
    expect(got["kind"]).toBe("ticket");
    expect(got["talk_kind"]).toBeNull();
    for (const key of ["job_id", "prompt", "kind", "phase", "ticket_id", "tool_token", "conventions", "browser"])
      expect(Object.keys(got)).toContain(key);
    expect(got["phase"]).toBe("make");
    const r = await k.take(pc); // 取り終わった後は仕事が無い（答えの形は前のまま）
    expect(((await data(r))["job"] as unknown) ?? null).toBeNull();
  });
});
