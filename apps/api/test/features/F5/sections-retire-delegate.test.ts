// K-578「口と契約から区画を外す」のうち AI に任せる側の単体の試験（口・本物の DB）。名前の頭の行 ID（K578-API-…）は 11_tickets/K-578.md の表と 1 対 1。
//   本文の行が無いチケット（K-575 が移せなかった・空だった物）は、前の区画（目的・完了の条件・実施事項）を読まずに空の本文として扱う。
//   確認項目が 0 件で止まる決め（K-565・E-CONF-020）は、本文の行の有る無しに関わらず全部のチケットに効く。
//   土台は delegate-kit.ts の makeKit（本物の Postgres・本物の口・本物の PC の印）。チケットは DB に直に置く。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Person } from "../fixture.js";
import { approveHooks } from "../../../src/features/F5/approve-complete/index.js";
import { data, delegateOk, json, makeKit, type Kit } from "./delegate-kit.js";

const NO_SPEC = "E-CONF-020";
const LEGACY = ["前の目的の字", "前の完了の条件の字", "前の実施事項の字"];
let k: Kit;

beforeAll(async () => {
  k = await makeKit();
  Object.assign(k.f.hooks, approveHooks(k.f.pool));
  for (const op of ["listApprovalQueue", "getApproval"]) k.f.limits[op] = 100_000;
}, 90_000);
afterAll(async () => {
  await k?.close();
});

const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const fresh = async (name: string) => {
  const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name, ticketAbility: "edit" });
  return { p, pc: await k.device(p) };
};
/** チケットを DB に直に置く（区画も本文の行も確認項目も無い・未着手） */
async function raw(p: Person): Promise<string> {
  return (
    await k.q<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, due_on, priority)
       values ($1, $2, '', $3, (select id from ticket_stages where tenant_id = $1 and key = 'todo'), '見積を作る', $4, $4, $5, 'mid') returning id`,
      [k.T.tenantId, k.T.rootScope, k.taskKind, p.id, jst(3)],
    )
  )[0]!.id;
}
const putSection = (t: string, key: string, position: number, text: string) =>
  k.q(
    "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version) values ($1, $2, $3, $4, $5::jsonb, 1)",
    [k.T.tenantId, t, key, position, JSON.stringify({ text })],
  );
const putLegacy = async (t: string) => {
  await putSection(t, "purpose", 10, "前の目的の字");
  await putSection(t, "done", 20, "前の完了の条件の字");
  await putSection(t, "todo", 50, "- 前の実施事項の字");
};
const addSpec = (t: string, title: string) =>
  k.q("insert into test_specs (tenant_id, ticket_id, check_kind, title) values ($1, $2, 'human', $3)", [
    k.T.tenantId,
    t,
    title,
  ]);
const promptOfJob = async (jobId: string) =>
  String((await k.q<{ prompt: string }>("select prompt from bridge_jobs where id = $1", [jobId]))[0]!.prompt);
const heads = (prompt: string) =>
  prompt
    .split("\n\n## ")
    .slice(1)
    .map((x) => x.split("\n")[0]!);
const rowOf = async (t: string) =>
  (await k.q<{ no_spec_reason: string | null }>("select no_spec_reason from tickets where id = $1", [t]))[0]!;
const written = async (t: string) => ({
  runs: await k.n("select count(*) as n from action_runs where ticket_id = $1", [t]),
  lines: await k.n("select count(*) as n from ticket_messages where ticket_id = $1", [t]),
  stage: await k.stageOf(t),
  ...(await rowOf(t)),
});

describe("K-578 AI に任せる：前の区画を読まない", () => {
  it("K578-API-011 本文の行が無く確認項目が 0 件・理由なし（前の区画だけが残るチケット）× 任せる：409・E-CONF-020・欄なし。前の道の「0 件でも通る」は無い。仕事・実行の記録・やり取りが増えず、段は未着手のまま", async () => {
    const { p } = await fresh("区画だけの人");
    const t = await raw(p);
    await putLegacy(t);
    const r = await k.delegate(p, t);
    expect(r.status, await r.clone().text()).toBe(409);
    const j = await json(r);
    expect(j.code).toBe(NO_SPEC);
    for (const key of ["field", "details", "detail"]) expect(j, `409 に ${key} を付けない`).not.toHaveProperty(key);
    expect(await written(t)).toEqual({ runs: 0, lines: 0, stage: "todo", no_spec_reason: null });
    expect(await k.n("select count(*) as n from bridge_jobs where member_id = $1", [p.id])).toBe(0);
  });

  it("K578-API-012 本文の行が無く確認項目が 0 件でも、使わない理由を送れば 201：理由は tickets.no_spec_reason に残り、prompt に本文の見出しは無く、前の区画の字も入らない。確認項目の欄は「- なし（使わない理由：…）」", async () => {
    const { p } = await fresh("理由を書く人");
    const t = await raw(p);
    await putLegacy(t);
    const r = await k.delegate(p, t, { no_spec_reason: "下書きなので確かめる物がまだ無い" });
    expect(r.status, await r.clone().text()).toBe(201);
    const d = await data<{ job_id: string }>(r);
    expect((await rowOf(t)).no_spec_reason).toBe("下書きなので確かめる物がまだ無い");
    const prompt = await promptOfJob(d.job_id);
    expect(heads(prompt)).toEqual(["項目", "確認項目"]);
    expect(prompt).toContain("- なし（使わない理由：下書きなので確かめる物がまだ無い）");
    for (const legacy of LEGACY) expect(prompt, legacy).not.toContain(legacy);
  });

  it("K578-API-013 承認の後の実行が使う内側の関数 app.ticket_job_context を直に呼ぶ（2 層目）：本文の行が無いチケットは前の区画の字も「## 目的」などの見出しも含まず、本文の行が在れば本文の字が入る", async () => {
    const { p } = await fresh("内側の関数の人");
    const t = await raw(p);
    await putLegacy(t);
    await addSpec(t, "確かめること");
    // 管理の接続（k.q）で呼ぶ：内側の関数は kaname_app に渡さない（D-128.171・K62-API-046）。K565-API-023 と同じ形
    const prompt = async () =>
      String((await k.q<{ v: { prompt: string } }>("select app.ticket_job_context($1) as v", [t]))[0]!.v.prompt);
    const before = await prompt();
    for (const legacy of LEGACY) expect(before, legacy).not.toContain(legacy);
    for (const old of ["## 目的", "## 完了の条件", "## 実施事項"]) expect(before).not.toContain(old);
    await k.q(
      "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version) values ($1, $2, 'body', 0, $3::jsonb, 1)",
      [
        k.T.tenantId,
        t,
        JSON.stringify({
          doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "本文の字" }] }] },
          text: "本文の字",
        }),
      ],
    );
    const after = await prompt();
    expect(after).toContain("本文の字");
    for (const legacy of LEGACY) expect(after, legacy).not.toContain(legacy);
    expect(await delegateOk(k, p, t)).toBeTruthy();
  });
});
