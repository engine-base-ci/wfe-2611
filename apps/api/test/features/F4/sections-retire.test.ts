// K-578「口と契約から区画を外す」の単体の試験（口・本物の DB）。名前の頭の行 ID（K578-API-…）は 11_tickets/K-578.md の表と 1 対 1。
//   段 5 で本文は 1 枚（ticket_sections の鍵 body）になり、K-575 が今ある区画の中身を本文に移した。この葉は区画を読む・受ける道を全部外す：
//     ① app.ticket_create は区画の入力 sections を読まない（body が無ければ空の本文・必須の区画で止めない）
//     ② getTicket・listTicketKinds の答えから sections を外す（成果物 results.artifacts と本文 body は前のまま出る）
//     ③ 完了の入力 todo_checked・todo_version と関数の引数を外す・E-CONF-017・E-VAL-022 を正本から外す（完了の口の行は F5 の前からの試験を替えた版）
//     ④ kind_sections を凍結（読まない・書かない・消さない。口のコードが表の名前を持たない）
//   AI に任せる側は sections-retire-delegate.test.ts。チケットは DB に直に置く（作る口に頼らない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
let f: Fixture;

type Row = Record<string, unknown>;
interface World {
  tenantId: string;
  root: string;
  me: Person;
  taskKind: string;
}
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const asJson = async (r: Response) => (await r.json()) as Row & { data?: unknown };
const EMPTY = { doc: { type: "doc", content: [] }, text: "" };
const docOf = (...texts: string[]) => ({
  type: "doc",
  content: texts.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
});

async function world(): Promise<World> {
  const c = await f.company(`K578 の会社 ${Math.random().toString(36).slice(2, 7)}`, "EG");
  const me = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
  const kinds = (await asJson(await f.req("GET", "/ticket_kinds", { headers: me.auth }))).data as Row[];
  return {
    tenantId: c.tenantId,
    root: c.rootScope,
    me,
    taskKind: String(kinds.find((k) => k["name"] === "タスク")!["id"]),
  };
}
/** チケットを DB に直に置く（区画も本文の行も無い・未着手）。数字の番号は DB が付ける */
async function raw(w: World, title = "請求書を送る"): Promise<string> {
  return (
    await f.admin.query<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, due_on, priority)
       values ($1, $2, '', $3, (select id from ticket_stages where tenant_id = $1 and key = 'todo'), $4, $5, $5, $6, 'mid') returning id`,
      [w.tenantId, w.root, w.taskKind, title, w.me.id, jst(3)],
    )
  ).rows[0]!.id;
}
/** 区画の行（鍵・文）を DB に直に置く。前の形・K-575 が移せなかった物の再現 */
const putSection = (w: World, ticketId: string, key: string, body: unknown, version = 1, position = 10) =>
  f.admin.query(
    "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $7)",
    [w.tenantId, ticketId, key, position, JSON.stringify(body), version, w.me.id],
  );
const putLegacy = async (w: World, t: string) => {
  await putSection(w, t, "purpose", { text: "前の目的の字" }, 1, 10);
  await putSection(w, t, "done", { text: "前の完了の条件の字" }, 1, 20);
  await putSection(w, t, "todo", { text: "- 前の実施事項の字" }, 1, 50);
};
const detail = (who: Person, id: string) => f.req("GET", `/tickets/${id}`, { headers: who.auth });
async function detailOk(who: Person, id: string): Promise<Row> {
  const r = await detail(who, id);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await asJson(r)).data as Row;
}
const kindsOf = async (who: Person): Promise<Row[]> => {
  const r = await f.req("GET", "/ticket_kinds", { headers: who.auth });
  expect(r.status, await r.clone().text()).toBe(200);
  return (await asJson(r)).data as Row[];
};
type Made = { ok: boolean; id?: string; code?: string; status?: number };
/** DB の作る関数を、その人の文脈で直に呼ぶ（口を通さない・2 層目） */
const createFn = (w: World, p: Record<string, unknown>) =>
  withTenant(f.pool, { tenantId: w.tenantId, userId: w.me.id, role: "member" as const, stepUpAt: null }, async (c) => {
    const base = {
      scope_id: w.root,
      kind_id: w.taskKind,
      title: "直に作る",
      assignee_member_id: w.me.id,
      due_on: jst(3),
    };
    return (await c.query<{ v: Made }>("select app.ticket_create($1::jsonb) as v", [JSON.stringify({ ...base, ...p })]))
      .rows[0]!.v;
  });
const sectionsOf = async (ticket: string) =>
  (
    await f.admin.query<{ section_key: string; version: number; body: unknown }>(
      "select section_key, version, body from ticket_sections where ticket_id = $1 order by section_key",
      [ticket],
    )
  ).rows;
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((x) =>
    statSync(join(d, x)).isDirectory() ? walk(join(d, x)) : /\.tsx?$/.test(x) ? [join(d, x)] : [],
  );
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");
const LEGACY = ["前の目的の字", "前の完了の条件の字", "前の実施事項の字"];

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  for (const op of ["createTicket", "getTicket", "listTicketKinds"]) f.limits[op] = 10_000;
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-578 作る関数は区画を読まない", () => {
  it("K578-API-001 DB の作る関数（app.ticket_create）：body だけ・何も渡さない・sections だけ・両方 のどれも作れて、書かれるのは鍵 body の 1 行だけ（区画の行は 0・版 1）。sections の字はどこにも残らず、必須の区画の断り SECTION_REQUIRED は返らない", async () => {
    const w = await world();
    const withBody = await createFn(w, { body: { doc: docOf("本文だけ"), text: "本文だけ" } });
    expect(withBody.ok, JSON.stringify(withBody)).toBe(true);
    expect(await sectionsOf(withBody.id!)).toEqual([
      { section_key: "body", version: 1, body: { doc: docOf("本文だけ"), text: "本文だけ" } },
    ]);
    for (const [name, extra] of [
      ["何も渡さない", {}],
      [
        "sections だけ",
        { sections: { purpose: "区画の目的の字", done: "区画の完了の字", todo: "区画の実施事項の字" } },
      ],
    ] as const) {
      const r = await createFn(w, extra);
      expect(r.ok, `${name} ${JSON.stringify(r)}`).toBe(true);
      expect(r.code, name).toBeUndefined();
      expect(await sectionsOf(r.id!), name).toEqual([{ section_key: "body", version: 1, body: EMPTY }]);
    }
    const both = await createFn(w, {
      body: { doc: docOf("本文を優先"), text: "本文を優先" },
      sections: { purpose: "捨てる区画の字" },
    });
    expect(both.ok, JSON.stringify(both)).toBe(true);
    const rows = await sectionsOf(both.id!);
    expect(rows.map((x) => x.section_key)).toEqual(["body"]);
    expect(JSON.stringify(rows)).not.toContain("捨てる区画の字");
    expect(
      Number(
        (
          await f.admin.query<{ n: string }>("select count(*) as n from ticket_section_versions where ticket_id = $1", [
            both.id,
          ])
        ).rows[0]!.n,
      ),
    ).toBe(1);
  });
});

describe("K-578 読む口の答えに区画は無い", () => {
  it("K578-API-002 getTicket：答えに sections が無い。前の区画の行（目的・完了の条件・実施事項）が DB に残っていても、答えのどこにも字が出ない（K-575 が移せなかった物・空だった物も同じ）。前からの鍵は残る", async () => {
    const w = await world();
    const t = await raw(w);
    await putLegacy(w, t);
    const d = await detailOk(w.me, t);
    expect(d).not.toHaveProperty("sections");
    for (const k of [
      "ticket",
      "kind",
      "stage",
      "assignee",
      "can",
      "approval",
      "completed",
      "body",
      "fields",
      "results",
      "parent",
      "child_count",
      "spec_count",
      "spec_unchecked",
      "no_spec_reason",
      "link_count",
    ])
      expect(Object.keys(d), k).toContain(k);
    expect(d["body"]).toMatchObject({ doc: EMPTY.doc, text: "", version: 0 });
    const text = JSON.stringify(d);
    for (const legacy of LEGACY) expect(text, legacy).not.toContain(legacy);
  });

  it("K578-API-003 getTicket：成果物（鍵 artifacts の行）は results.artifacts に・本文（鍵 body の行）は body に前のまま出る。sections を外しても結果の場所は消えず、前の区画の字は混ざらない", async () => {
    const w = await world();
    const t = await raw(w);
    await putLegacy(w, t);
    await putSection(w, t, "body", { doc: docOf("本文の字"), text: "本文の字" }, 3, 0);
    await putSection(w, t, "artifacts", { text: "成果物の字" }, 2, 70);
    const d = await detailOk(w.me, t);
    expect(d["body"]).toEqual({ doc: docOf("本文の字"), text: "本文の字", version: 3 });
    expect((d["results"] as Row)["artifacts"]).toMatchObject({ text: "成果物の字", version: 2 });
    expect(d).not.toHaveProperty("sections");
    for (const legacy of LEGACY) expect(JSON.stringify(d), legacy).not.toContain(legacy);
  });

  it("K578-API-004 listTicketKinds：各種別の答えに sections が無く、id・name・color・position・is_builtin・body_template は前のまま。消した種別・別の会社の種別は出ない・並びは position の順", async () => {
    const w = await world();
    const other = await world();
    await f.admin.query(
      "update ticket_kinds set name = 'K578 別の会社だけの種別' where id = (select id from ticket_kinds where tenant_id = $1 and name = '課題')",
      [other.tenantId],
    );
    const mine = await kindsOf(w.me);
    expect(mine.length).toBeGreaterThanOrEqual(2);
    for (const k of mine) {
      expect(k, String(k["name"])).not.toHaveProperty("sections");
      for (const key of ["id", "name", "color", "position", "is_builtin", "body_template"])
        expect(Object.keys(k), `${k["name"]} の ${key}`).toContain(key);
    }
    expect(JSON.stringify(mine)).not.toContain("K578 別の会社だけの種別");
    const positions = mine.map((k) => Number(k["position"]));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("K578-API-005 守り：別の会社の人は getTicket が 404（区画の字も本文も返さない）・ログインなしは getTicket・listTicketKinds とも 401。権限の決まりは前のまま", async () => {
    const w = await world();
    const other = await world();
    const t = await raw(w);
    await putLegacy(w, t);
    const r = await detail(other.me, t);
    expect(r.status).toBe(404);
    const text = await r.clone().text();
    for (const legacy of LEGACY) expect(text, legacy).not.toContain(legacy);
    expect(text).not.toContain("sections");
    expect((await f.req("GET", `/tickets/${t}`)).status).toBe(401);
    expect((await f.req("GET", "/ticket_kinds")).status).toBe(401);
  });
});

describe("K-578 kind_sections を凍結する（読まない・書かない・消さない）", () => {
  it("K578-API-006 kind_sections の行が 1 つも無い会社でも、作る口（body なし）が 201・getTicket が 200・listTicketKinds が 200 で通る（口が表を読んでいない）。口を通しても kind_sections の行は増えも減りもしない", async () => {
    const w = await world();
    await f.admin.query("delete from kind_sections where tenant_id = $1", [w.tenantId]);
    const count = async () =>
      Number(
        (
          await f.admin.query<{ n: string }>("select count(*) as n from kind_sections where tenant_id = $1", [
            w.tenantId,
          ])
        ).rows[0]!.n,
      );
    expect(await count()).toBe(0);
    const made = await f.req("POST", "/tickets", {
      body: {
        scope_id: w.root,
        kind_id: w.taskKind,
        title: "区画の表が空でも作れる",
        assignee_member_id: w.me.id,
        due_on: jst(3),
      },
      headers: w.me.auth,
    });
    expect(made.status, await made.clone().text()).toBe(201);
    const id = ((await asJson(made)).data as Row)["id"] as string;
    const d = await detailOk(w.me, id);
    expect(d["body"]).toMatchObject({ text: "" });
    expect((await kindsOf(w.me)).length).toBeGreaterThanOrEqual(2);
    expect(await count()).toBe(0);
  });

  it("K578-API-007 目録（03_architecture/db-catalog.json）で kind_sections が frozen・理由つき。口のコード（apps/api/src）に kind_sections の字が無い。表と行は消えていない（新しい会社のタスクに区画の行が残る）", async () => {
    const cat = JSON.parse(read("03_architecture/db-catalog.json")) as {
      tables: Record<string, { class: string; why: string }>;
    };
    expect(cat.tables["kind_sections"]?.class).toBe("frozen");
    expect(cat.tables["kind_sections"]?.why.length ?? 0).toBeGreaterThan(10);
    for (const file of walk(join(ROOT, "apps", "api", "src")))
      expect(readFileSync(file, "utf-8"), file).not.toMatch(/kind_sections/);
    const w = await world();
    const n = Number(
      (
        await f.admin.query<{ n: string }>(
          "select count(*) as n from kind_sections where tenant_id = $1 and deleted_at is null",
          [w.tenantId],
        )
      ).rows[0]!.n,
    );
    expect(n).toBeGreaterThan(0);
  });
});

describe("K-578 契約・正本・関数の形", () => {
  it("K578-API-008 契約と正本：getTicket と listTicketKinds の答えの形に sections が無い・completeTicket の入力は conditions_confirmed だけ（todo_checked・todo_version が無い）・errors.json と目録（packages/errors）に E-CONF-017・E-VAL-022 が無く、E-VAL-023・E-VAL-024 は在る", async () => {
    const yaml = read("08_api/openapi.yaml");
    const block = (name: string) => new RegExp(`${name}:[\\s\\S]*?(?=\\n    [A-Z][A-Za-z]*:)`).exec(yaml)?.[0] ?? "";
    expect(block("TicketDetail")).not.toContain("sections:");
    expect(block("TicketKindChoice")).not.toContain("sections:");
    const input = block("TicketCompleteInput");
    expect(input).toContain("conditions_confirmed:");
    expect(input).not.toContain("todo_checked");
    expect(input).not.toContain("todo_version");
    const types = read("packages/contracts/src/types.ts");
    expect(/export type TicketCompleteInput = \{([^}]*)\}/.exec(types)?.[1] ?? "").not.toMatch(
      /todo_checked|todo_version/,
    );
    const errors = read("07_qa/test-specs/errors.json");
    const catalog = read("packages/errors/src/catalog.ts");
    expect(block("TicketCreateInput")).not.toContain("sections:");
    for (const code of ["E-CONF-017", "E-VAL-022", "E-VAL-013"]) {
      expect(errors, code).not.toContain(`"${code}"`);
      expect(catalog, code).not.toContain(`"${code}"`);
    }
    for (const code of ["E-VAL-023", "E-VAL-024"]) expect(errors, code).toContain(`"${code}"`);
  });

  it("K578-API-014 作る口に sections を送ると 422（契約から外れた知らない欄）・欄 sections・何も作られない。body も一緒に送っても同じ（K-437 が body があれば捨てていた道は無い）。body だけなら 201", async () => {
    const w = await world();
    const base = { scope_id: w.root, kind_id: w.taskKind, assignee_member_id: w.me.id, due_on: jst(3) };
    const tickets = async () =>
      Number(
        (await f.admin.query<{ n: string }>("select count(*) as n from tickets where tenant_id = $1", [w.tenantId]))
          .rows[0]!.n,
      );
    const before = await tickets();
    for (const [name, extra] of [
      ["sections だけ", { sections: { purpose: "区画の字" } }],
      ["body と sections", { body: { doc: docOf("本文") }, sections: { purpose: "区画の字" } }],
    ] as const) {
      const r = await f.req("POST", "/tickets", { body: { ...base, title: name, ...extra }, headers: w.me.auth });
      const j = await asJson(r);
      expect(r.status, `${name} ${JSON.stringify(j)}`).toBe(422);
      expect(JSON.stringify(j["details"] ?? [])).toContain("sections");
    }
    expect(await tickets()).toBe(before);
    const ok = await f.req("POST", "/tickets", {
      body: { ...base, title: "body だけ", body: { doc: docOf("本文") } },
      headers: w.me.auth,
    });
    expect(ok.status, await ok.clone().text()).toBe(201);
  });

  it("K578-API-009 コード：口のコード（apps/api/src）に todo_checked・todo_version・SECTION_REQUIRED・E-VAL-013 が無い。この葉の migration の関数の本体（コメントを除く）は前の区画の鍵（purpose・constraints・counterpart）・kind_sections・実施事項の引数を持たず、完了の関数は 2 引数", async () => {
    for (const file of walk(join(ROOT, "apps", "api", "src")))
      expect(readFileSync(file, "utf-8"), file).not.toMatch(/todo_checked|todo_version|SECTION_REQUIRED|E-VAL-013/);
    const sql = read("packages/db/migrations/20261122101600_ticket_sections_retire.sql")
      .split("\n")
      .filter((l) => !/^\s*--/.test(l))
      .join("\n");
    expect(sql).not.toMatch(
      /kind_sections|p_todo_checked|p_todo_version|SECTION_REQUIRED|'purpose'|'constraints'|'counterpart'/,
    );
    expect(sql).toMatch(/ticket_complete\s*\(\s*p_ticket uuid\s*,\s*p_confirmed boolean\s*\)/);
  });

  it("K578-API-010 migration の順と関数の置き方：区画を外す migration は K-575 の移し・K-565・K-566・K-437 の後に並ぶ。app.ticket_complete は (uuid, boolean) の 1 つだけ（前の 4 引数は無い）・app.ticket_create (jsonb)・app.ticket_delegate (uuid, text) もそれぞれ 1 つで、どれもアプリの役が実行できる", async () => {
    const names = [...read("packages/db/src/migrations.generated.ts").matchAll(/"([0-9]{14}_[a-z0-9_]+\.sql)"/g)].map(
      (m) => m[1]!,
    );
    const at = (part: string) => names.findIndex((n) => n.endsWith(`_${part}.sql`));
    const retire = at("ticket_sections_retire");
    expect(retire, "一覧に在る").toBeGreaterThan(-1);
    for (const earlier of [
      "ticket_body_move",
      "ticket_delegate_body",
      "ticket_complete_unchecked",
      "ticket_create_fields",
    ]) {
      expect(at(earlier), `${earlier} が一覧に在る`).toBeGreaterThan(-1);
      expect(retire, `${earlier} より後`).toBeGreaterThan(at(earlier));
    }
    const fns = (
      await f.admin.query<{ sig: string; ok: boolean }>(
        `select p.oid::regprocedure::text as sig, has_function_privilege('kaname_app', p.oid, 'execute') as ok
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'app' and p.proname in ('ticket_complete', 'ticket_create', 'ticket_delegate') order by 1`,
      )
    ).rows;
    expect(fns).toEqual([
      { sig: "app.ticket_complete(uuid,boolean)", ok: true },
      { sig: "app.ticket_create(jsonb)", ok: true },
      { sig: "app.ticket_delegate(uuid,text)", ok: true },
    ]);
  });
});
