// K-578「口と契約から区画を外す」のうち、完了の口の行（K578-API-015〜017）。名前の頭の行 ID は 11_tickets/K-578.md の行の表と 1 対 1。
//   完了の入力から todo_checked・todo_version を外した後の姿（送ると 422・本文の行が無ければ未チェックは 0・関数は 2 引数）を見る。
//   区画の道が在る間の姿は、K-566 の complete-unchecked-legacy-sections.test.ts（K566-API-006・007・009・014）が見る（K-578 がそのファイルを消す）。
//   土台は approve-complete.harness.ts（K-578 が completeBody を conditions_confirmed だけに替えた版）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import {
  setupApproveComplete,
  f,
  T,
  boss,
  json,
  one,
  complete,
  stageKeyOf,
  ticket,
  executed,
  completeBody,
  type Ticket,
} from "./approve-complete.harness.js";

setupApproveComplete();

type Node = Record<string, unknown>;
const para = (t: string): Node => ({ type: "paragraph", content: [{ type: "text", text: t }] });
const task = (t: string, checked?: unknown, extra: Node[] = []): Node => ({
  type: "taskItem",
  ...(checked === undefined ? {} : { attrs: { checked } }),
  content: [para(t), ...extra],
});
const taskList = (...items: Node[]): Node => ({ type: "taskList", content: items });
const docOf = (...content: Node[]) => ({ type: "doc", content });

/** 本文の行（鍵 body）を置く。区画の行は消さない（前の形の todo も残る） */
async function putBody(t: Ticket, doc: Node): Promise<void> {
  const body = { doc, text: "本文" };
  const s = await one<{ id: string }>(
    "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version) values ($1, $2, 'body', 0, $3, 1) returning id",
    [t.tenant, t.id, JSON.stringify(body)],
  );
  await f.admin.query(
    "insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body) values ($1, $2, $3, 1, $4)",
    [t.tenant, t.id, s.id, JSON.stringify(body)],
  );
}
let tick = 0;
async function addSpec(t: Ticket, title: string, o: { checked?: boolean; deleted?: boolean } = {}): Promise<void> {
  tick += 1;
  await f.admin.query(
    `insert into test_specs (tenant_id, ticket_id, check_kind, title, checked_at, deleted_at, created_at)
     values ($1, $2, 'human', $3, case when $4 then now() end, case when $5 then now() end, now() + make_interval(secs => $6))`,
    [t.tenant, t.id, title, o.checked === true, o.deleted === true, tick],
  );
}
/** 完了にして、答えの unchecked を返す */
async function completeAndCount(t: Ticket, extra: Record<string, unknown> = {}) {
  const r = await complete(boss, t.id, await completeBody(t, extra));
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await json(r)).data as { unchecked: { body: number; specs: number } }).unchecked;
}

describe("K-578 完了の口：区画の道が無い姿（本物の DB）", () => {
  it("K578-API-015 入力：完了に todo_checked・todo_version を送ると、どんな値でも（空・範囲の外の番号・形の誤り・版）契約に無い欄なので 422・E-VAL-022 は出ない・段は変わらない。conditions_confirmed だけなら 201", async () => {
    const u = await ticket();
    await executed(u);
    for (const bad of [
      { todo_checked: [] },
      { todo_checked: [0, 1, 5, -1] },
      { todo_checked: ["a"] },
      { todo_checked: "0,1" },
      { todo_version: 1 },
      { todo_version: "1" },
    ]) {
      const r = await complete(boss, u.id, { conditions_confirmed: true, ...bad });
      expect(r.status, JSON.stringify(bad)).toBe(422);
      expect(JSON.stringify(await json(r)), JSON.stringify(bad)).not.toContain("E-VAL-022");
    }
    expect(await stageKeyOf(u.id)).toBe("doing");
    const ok = await complete(boss, u.id, { conditions_confirmed: true });
    expect(ok.status, await ok.clone().text()).toBe(201);
    expect(await stageKeyOf(u.id)).toBe("done");
  });

  it("K578-API-016 本文の行が無い（前の形・K-575 の移しで本文にならなかった物）：実施事項の区画は読まず、unchecked の body は 0。区画の版と字は書き換えない", async () => {
    const t = await ticket({ todo: "- 請求書を作る\n- [x] 先方に送る\n- [X] 控える\n説明の行" });
    await executed(t);
    const before = await one<{ version: number; text: string }>(
      "select version, body->>'text' as text from ticket_sections where ticket_id = $1 and section_key = 'todo'",
      [t.id],
    );
    expect(await completeAndCount(t)).toEqual({ body: 0, specs: 0 });
    expect(
      await one(
        "select version, body->>'text' as text from ticket_sections where ticket_id = $1 and section_key = 'todo'",
        [t.id],
      ),
    ).toEqual(before);
    const withBody = await ticket({ todo: "- 区画の未 1\n- 区画の未 2" });
    await executed(withBody);
    await putBody(withBody, docOf(taskList(task("未", false)), taskList(task("済", true))));
    await addSpec(withBody, "未の確認項目");
    expect(await completeAndCount(withBody)).toEqual({ body: 1, specs: 1 });
  });

  it("K578-API-017 DB の関数を直に呼ぶ（2 層目）：app.ticket_complete は (uuid, boolean) の 2 引数だけで、答えに unchecked を持つ。app.ticket_body_unchecked は null・空の jsonb・文字を 0 と数え、入れ子を数える", async () => {
    const t = await ticket();
    await executed(t);
    await putBody(t, docOf(taskList(task("未", false))));
    const ctx: TenantContext = { tenantId: T.tenantId, userId: boss.id, role: "member", stepUpAt: null };
    const out = await withTenant(f.pool, ctx, (cl) =>
      cl.query<{ v: { unchecked?: { body: number; specs: number } } }>("select app.ticket_complete($1, true) as v", [
        t.id,
      ]),
    );
    expect(out.rows[0]!.v.unchecked).toEqual({ body: 1, specs: 0 });
    const sig = await f.admin.query<{ args: string }>(
      "select pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'ticket_complete'",
    );
    expect(sig.rows.map((x) => x.args)).toEqual(["p_ticket uuid, p_confirmed boolean"]);
    const cnt = async (j: unknown) =>
      Number(
        (await f.admin.query<{ n: number }>("select app.ticket_body_unchecked($1::jsonb) as n", [JSON.stringify(j)]))
          .rows[0]!.n,
      );
    expect(await cnt(null)).toBe(0);
    expect(await cnt({})).toBe(0);
    expect(await cnt("文字")).toBe(0);
    expect(await cnt(docOf(taskList(task("a", false, [taskList(task("b", false))]))))).toBe(2);
  });
});
