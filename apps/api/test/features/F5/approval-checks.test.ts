// K-739「承認の一覧・詳細・実行の 1 件の「確認」を確認項目から出す」の単体の試験（口・本物の DB・本物の PC の印）。名前の頭の行 ID（K739-API-…）は 11_tickets/K-739.md の表と 1 対 1。
//   承認の一覧の列「確認」（check_summary の字）・承認の詳細の確認の行（checks）と要約・実行の 1 件の checks（数と行）を、チケットの確認項目（test_specs）から出す。
//   見せ方は数だけ（D-153.3）：「4 ／ 5 済み」（確認項目が無ければ「検査なし」）。行は id・文・済みかの 3 つだけで、だれが・いつ・根拠は答えに出さない（やり取りの記録に在る＝K-736 が書く）。
//   土台は K-63 の approve-complete.harness.ts（本物の Postgres・本物の口・本物の PC の印）。承認待ちの行・チケットは DB に直に置く。確認項目は直に入れる（K-434 の列だけを使う。K-736 の根拠の列は使わない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import {
  T,
  auth,
  boss,
  delegated,
  detail,
  f,
  json,
  num,
  outsider,
  queue,
  req,
  setupApproveComplete,
  ticket,
  writer,
  type Ticket,
} from "./approve-complete.harness.js";

setupApproveComplete();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const ROW_KEYS = ["checked", "id", "text"];
const RUN_CHECK_KEYS = ["counts", "rows", "state", "summary"];
let tick = 0;

/** 確認項目を直に入れる。checked：member＝人（by）・ai＝AI（どちらも「済み」。答えには区別を出さない） */
async function spec(
  t: Ticket,
  title: string,
  o: { checked?: "member" | "ai"; by?: { id: string }; deleted?: boolean; at?: string } = {},
): Promise<string> {
  tick += 1;
  const who = o.by?.id ?? boss.id;
  const r = await f.admin.query<{ id: string }>(
    `insert into test_specs (tenant_id, ticket_id, title, checked_at, checked_by_member_id, checked_by_ai, created_by, updated_by, deleted_at, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $7, $8, now() + make_interval(secs => $9)) returning id`,
    [
      t.tenant,
      t.id,
      title,
      o.checked ? (o.at ?? new Date().toISOString()) : null,
      o.checked === "member" ? who : null,
      o.checked === "ai",
      who,
      o.deleted ? new Date().toISOString() : null,
      tick,
    ],
  );
  return r.rows[0]!.id;
}
const ctxOf = (p: { id: string; tenantId: string }): TenantContext => ({
  tenantId: p.tenantId,
  userId: p.id,
  role: "member",
  stepUpAt: null,
});
const viaDb = async <R>(p: { id: string; tenantId: string }, sql: string, args: unknown[]): Promise<R> =>
  withTenant(f.pool, ctxOf(p), async (cl) => (await cl.query<{ v: R }>(sql, args)).rows[0]!.v);

interface CheckRow {
  id: string;
  text: string;
  checked: boolean;
}
const detailOf = async (id: string, who = boss): Promise<Record<string, unknown>> => {
  const r = await detail(who, id);
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await json(r)).data ?? {}) as Record<string, unknown>;
};
const itemOf = async (approvalId: string, who = boss): Promise<Record<string, unknown>> => {
  // 同じ試験のファイルの前の行が承認待ちを残すので、既定の 20 件でなく上限の 200 件で読む（確かめる中身は同じ）
  const r = await queue(who, "?limit=200");
  expect(r.status).toBe(200);
  const rows = (await json(r)).data as unknown as Record<string, unknown>[];
  return rows.find((x) => x["id"] === approvalId)!;
};
/** 5 つのうち 4 つが済み（AI 3・人 1）・1 つがまだ の確認項目を持つ承認待ち */
async function mixed(title: string) {
  const t = await ticket({ title });
  const d = await delegated(t);
  const ids = [
    await spec(t, "金額が見積の月額と一致している", { checked: "ai" }),
    await spec(t, "インボイスの必須記載事項を満たしている", { checked: "ai" }),
    await spec(t, "宛名と CC が取引先のルールどおり", { checked: "ai" }),
    await spec(t, "送る前に PDF を目で見る", { checked: "member", by: boss }),
    await spec(t, "山田様へのメールの文面を確かめる"),
  ];
  return { t, d, ids };
}

describe("K-739 承認の「確認」を確認項目から出す", () => {
  it("K739-API-001 確認項目が 1 つも無い：一覧の check_summary も詳細の check_summary も「検査なし」・詳細の checks は空", async () => {
    const t = await ticket({ title: "確認項目なし" });
    const d = await delegated(t);
    expect((await itemOf(d.approvalId))["check_summary"]).toBe("検査なし");
    const v = await detailOf(d.approvalId);
    expect(v["check_summary"]).toBe("検査なし");
    expect(v["checks"]).toEqual([]);
  });

  it("K739-API-002 5 つのうち 4 つが済み（AI 3・人 1）・1 つがまだ：一覧と詳細の要約は「4 ／ 5 済み」。詳細の checks は作った順の 5 行", async () => {
    const m = await mixed("確認が混ざる");
    const summary = "4 ／ 5 済み";
    expect((await itemOf(m.d.approvalId))["check_summary"]).toBe(summary);
    const v = await detailOf(m.d.approvalId);
    expect(v["check_summary"]).toBe(summary);
    const rows = v["checks"] as CheckRow[];
    expect(rows.map((r) => r.id)).toEqual(m.ids);
    expect(rows.map((r) => r.text)[4]).toBe("山田様へのメールの文面を確かめる");
  });

  it("K739-API-003 1 行の形：鍵ちょうど 3（id・text・checked）。済みの行（AI が付けた・人が付けた）は checked true・まだの行は false。だれが・いつ・根拠の鍵は無い", async () => {
    const m = await mixed("行の形");
    const rows = (await detailOf(m.d.approvalId))["checks"] as CheckRow[];
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(ROW_KEYS);
    expect(rows.map((r) => r.checked)).toEqual([true, true, true, true, false]);
    expect(rows[4]).toEqual({ id: m.ids[4], text: "山田様へのメールの文面を確かめる", checked: false });
    expect(rows[3]).toEqual({ id: m.ids[3], text: "送る前に PDF を目で見る", checked: true });
  });

  it("K739-API-004 だれが・いつ・根拠は答えに出さない：AI が付けた行・人が外して付け直した行・外した行の、どれでも詳細の checks・一覧の check_summary・実行の 1 件の checks のどこにも だれが（who）・名前・時刻・根拠の字が出ない。済みかどうかだけが出る", async () => {
    const t = await ticket({ title: "だれがを出さない" });
    const d = await delegated(t);
    const a = await spec(t, "人が付け直した", { checked: "ai" });
    const b = await spec(t, "人が外した", { checked: "ai" });
    await spec(t, "AI が付けた", { checked: "ai" });
    await f.admin.query(
      "update test_specs set checked_by_ai = false, checked_by_member_id = $2, checked_at = now() where id = $1",
      [a, writer.id],
    );
    await f.admin.query("update test_specs set checked_by_ai = false, checked_at = null where id = $1", [b]);
    const v = await detailOf(d.approvalId);
    const rows = v["checks"] as CheckRow[];
    expect(rows.map((r) => r.checked)).toEqual([true, false, true]);
    expect(v["check_summary"]).toBe("2 ／ 3 済み");
    const run = await req("GET", `/action_runs/${d.makeRunId}`, { headers: auth(boss) });
    const runChecks = ((await json(run)).data as Record<string, unknown>)["checks"];
    const shown = JSON.stringify([rows, v["check_summary"], (await itemOf(d.approvalId))["check_summary"], runChecks]);
    for (const leak of ["佐藤", '"who"', "who_name", "basis", "checked_at", "checked_by"])
      expect(shown).not.toContain(leak);
  });

  it("K739-API-005 数える確認項目は、そのチケットの消していない行だけ。消した行・別のチケットの行は数にも行にも入らない", async () => {
    const m = await mixed("数え方");
    await spec(m.t, "消した行", { checked: "ai", deleted: true });
    const other = await ticket({ title: "別のチケット" });
    await spec(other, "別のチケットの行", { checked: "ai" });
    const v = await detailOf(m.d.approvalId);
    expect(v["check_summary"]).toBe("4 ／ 5 済み");
    expect((v["checks"] as CheckRow[]).map((r) => r.text)).not.toContain("消した行");
  });

  it("K739-API-006 すでにある鍵は増えない：一覧の 1 行・詳細の答えの鍵は、DB の関数 app.approval_queue・app.approval_detail が返す鍵と同じ（値だけが変わる）", async () => {
    const m = await mixed("鍵の数");
    const item = await itemOf(m.d.approvalId);
    const rawItems = await viaDb<Record<string, unknown>[]>(
      boss,
      "select app.approval_queue(50, null, null, null) as v",
      [],
    );
    const raw = rawItems.find((x) => x["id"] === m.d.approvalId)!;
    expect(Object.keys(item).sort()).toEqual(Object.keys(raw).sort());
    expect(raw["check_summary"]).not.toBe(item["check_summary"]);
    const rawDetail = await viaDb<Record<string, unknown>>(boss, "select app.approval_detail($1) as v", [
      m.d.approvalId,
    ]);
    expect(Object.keys(await detailOf(m.d.approvalId)).sort()).toEqual(Object.keys(rawDetail).sort());
  });

  it("K739-API-007 一覧の行ごと：2 つの承認待ちは、それぞれのチケットの確認項目で数える（並び・期限・ほかの鍵は前のまま）", async () => {
    const a = await mixed("一覧の A");
    const b = await ticket({ title: "一覧の B" });
    const db = await delegated(b);
    await spec(b, "一つだけ", { checked: "ai" });
    expect((await itemOf(a.d.approvalId))["check_summary"]).toBe("4 ／ 5 済み");
    expect((await itemOf(db.approvalId))["check_summary"]).toBe("1 ／ 1 済み");
    const rows = (await json(await queue(boss))).data as unknown as { id: string }[];
    const raw = await viaDb<{ id: string }[]>(boss, "select app.approval_queue(50, null, null, null) as v", []);
    expect(rows.map((x) => x.id)).toEqual(raw.map((x) => x.id));
  });

  it("K739-API-008 全部済み・ひとつも済んでいない：要約は「2 ／ 2 済み」「0 ／ 2 済み」。詳細の行の checked は全部 true／全部 false", async () => {
    const t1 = await ticket({ title: "全部済み" });
    const d1 = await delegated(t1);
    await spec(t1, "一", { checked: "ai" });
    await spec(t1, "二", { checked: "member" });
    const t2 = await ticket({ title: "全部まだ" });
    const d2 = await delegated(t2);
    await spec(t2, "一");
    await spec(t2, "二");
    expect((await detailOf(d1.approvalId))["check_summary"]).toBe("2 ／ 2 済み");
    expect(((await detailOf(d1.approvalId))["checks"] as CheckRow[]).map((r) => r.checked)).toEqual([true, true]);
    expect((await detailOf(d2.approvalId))["check_summary"]).toBe("0 ／ 2 済み");
    expect(((await detailOf(d2.approvalId))["checks"] as CheckRow[]).map((r) => r.checked)).toEqual([false, false]);
  });

  it("K739-API-009 読めない人（別の会社・見るだけでも見えない人）：詳細は前のとおり 404 で、確認項目の文も根拠も答えに出ない", async () => {
    const m = await mixed("読めない人");
    const r = await detail(outsider, m.d.approvalId);
    expect(r.status).toBe(404);
    const text = await r.text();
    expect(text).not.toContain("送る前に PDF を目で見る");
    const q = JSON.stringify((await json(await queue(outsider))).data);
    expect(q).not.toContain(m.d.approvalId);
  });

  it("K739-API-010 実行の 1 件（getActionRun）：checks は { state・counts・summary・rows }。rows は詳細と同じ 3 鍵の行。確認項目が無ければ { state none・counts 全部 0・summary 検査なし・rows 空 }", async () => {
    const m = await mixed("実行の 1 件");
    const r = await req("GET", `/action_runs/${m.d.makeRunId}`, { headers: auth(boss) });
    expect(r.status, await r.clone().text()).toBe(200);
    const c = ((await json(r)).data as Record<string, unknown>)["checks"] as Record<string, unknown>;
    expect(Object.keys(c).sort()).toEqual(RUN_CHECK_KEYS);
    expect(c).toMatchObject({
      state: "partial",
      counts: { done: 4, total: 5 },
      summary: "4 ／ 5 済み",
    });
    expect((c["rows"] as CheckRow[]).map((x) => x.id)).toEqual(m.ids);
    const t = await ticket({ title: "確認項目なし（実行）" });
    const d = await delegated(t);
    const e = (
      (await json(await req("GET", `/action_runs/${d.makeRunId}`, { headers: auth(boss) }))).data as Record<
        string,
        unknown
      >
    )["checks"];
    expect(e).toEqual({ state: "none", counts: { done: 0, total: 0 }, summary: "検査なし", rows: [] });
  });

  it("K739-API-011 実行の一覧（listTicketRuns）：checks は { state・counts・summary } だけ（rows は持たない）。state は none・partial・all", async () => {
    const m = await mixed("実行の一覧");
    const r = await req("GET", `/tickets/${m.t.id}/runs`, { headers: auth(boss) });
    expect(r.status, await r.clone().text()).toBe(200);
    const run = ((await json(r)).data as unknown as Record<string, unknown>[])[0]!;
    const c = run["checks"] as Record<string, unknown>;
    expect(Object.keys(c).sort()).toEqual(["counts", "state", "summary"]);
    expect(c["state"]).toBe("partial");
    await f.admin.query("update test_specs set checked_at = coalesce(checked_at, now()) where ticket_id = $1", [
      m.t.id,
    ]);
    const again = (
      (await json(await req("GET", `/tickets/${m.t.id}/runs`, { headers: auth(boss) }))).data as unknown as Record<
        string,
        unknown
      >[]
    )[0]!;
    expect((again["checks"] as Record<string, unknown>)["state"]).toBe("all");
  });

  it("K739-API-012 DB の関数 app.approval_check_summary(チケット, 行を付けるか)：行ありは rows を持ち、行なしは持たない。見えないチケット（別の会社の人）は null", async () => {
    const m = await mixed("関数を直に");
    const withRows = await viaDb<Record<string, unknown>>(boss, "select app.approval_check_summary($1, true) as v", [
      m.t.id,
    ]);
    expect(Object.keys(withRows).sort()).toEqual(RUN_CHECK_KEYS);
    const noRows = await viaDb<Record<string, unknown>>(boss, "select app.approval_check_summary($1, false) as v", [
      m.t.id,
    ]);
    expect(Object.keys(noRows).sort()).toEqual(["counts", "state", "summary"]);
    expect(withRows).toMatchObject({ state: "partial", counts: { done: 4, total: 5 }, summary: "4 ／ 5 済み" });
    expect(await viaDb(outsider, "select app.approval_check_summary($1, true) as v", [m.t.id])).toBeNull();
  });

  it("K739-API-013 一覧の差し込み app.approval_checks_overlay：種類が artifact の行だけ check_summary を差し替える。渡しの行（handover）・見えないチケットの行は元の字のまま", async () => {
    const m = await mixed("差し込み");
    const items = [
      { kind: "artifact", id: "a", ticket_id: m.t.id, check_summary: "元の字" },
      { kind: "handover", id: "h", ticket_id: m.t.id, check_summary: "" },
      { kind: "artifact", id: "x", ticket_id: "00000000-0000-4000-8000-000000000000", check_summary: "存在しない" },
    ];
    const out = await viaDb<Record<string, unknown>[]>(boss, "select app.approval_checks_overlay($1::jsonb) as v", [
      JSON.stringify(items),
    ]);
    expect(out.map((x) => x["check_summary"])).toEqual(["4 ／ 5 済み", "", "存在しない"]);
    expect(out.map((x) => x["id"])).toEqual(["a", "h", "x"]);
    expect(await viaDb(boss, "select app.approval_checks_overlay('[]'::jsonb) as v", [])).toEqual([]);
  });

  it("K739-API-014 読むだけ：何度読んでも確認項目・承認・やり取り・証跡・成果物の版が増えも変わりもしない", async () => {
    const m = await mixed("読むだけ");
    const snap = async () =>
      [
        await num("select count(*) as n from test_specs where ticket_id = $1", [m.t.id]),
        await num("select coalesce(sum(version), 0) as n from test_specs where ticket_id = $1", [m.t.id]),
        await num("select count(*) as n from ticket_messages where ticket_id = $1", [m.t.id]),
        await num("select count(*) as n from audit_events where tenant_id = $1", [T.tenantId]),
        await num("select count(*) as n from approvals where ticket_id = $1 and decision is not null", [m.t.id]),
      ].join(",");
    const before = await snap();
    await detailOf(m.d.approvalId);
    await itemOf(m.d.approvalId);
    await req("GET", `/action_runs/${m.d.makeRunId}`, { headers: auth(boss) });
    expect(await snap()).toBe(before);
  });

  it("K739-API-015 切り替わりの瞬間（G-12）：AI がチェックを付けた直後の読みに新しい数が出る。外した直後も同じ", async () => {
    const m = await mixed("直後");
    expect((await itemOf(m.d.approvalId))["check_summary"]).toBe("4 ／ 5 済み");
    await f.admin.query("update test_specs set checked_at = now(), checked_by_ai = true where id = $1", [m.ids[4]]);
    expect((await itemOf(m.d.approvalId))["check_summary"]).toBe("5 ／ 5 済み");
    await f.admin.query("update test_specs set checked_at = null, checked_by_ai = false where id = $1", [m.ids[0]]);
    expect((await detailOf(m.d.approvalId))["check_summary"]).toBe("4 ／ 5 済み");
  });

  it("K739-API-016 付けた人が会社を抜けた後も、その行は済みのまま数える（人が確かめた行）", async () => {
    const t = await ticket({ title: "抜けた人" });
    const d = await delegated(t);
    const gone = await f.person(T.tenantId, T.rootScope, { name: "抜けた人", ticketAbility: "edit" });
    await spec(t, "確かめた", { checked: "member", by: gone });
    await f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    const v = await detailOf(d.approvalId);
    expect((v["checks"] as CheckRow[])[0]).toMatchObject({ checked: true });
    expect(v["check_summary"]).toBe("1 ／ 1 済み");
  });

  it("K739-API-017 確認項目 500 件（G-16）：詳細の checks は 500 行・一覧の check_summary は数だけの 1 つの字（行を持たない）。一覧は 1 つの文で返る", async () => {
    const t = await ticket({ title: "たくさん" });
    const d = await delegated(t);
    await f.admin.query(
      `insert into test_specs (tenant_id, ticket_id, title, checked_at, checked_by_ai, created_by, updated_by, created_at)
       select $1, $2, '項目 ' || g, case when g % 2 = 0 then now() end, g % 2 = 0, $3, $3, now() + make_interval(secs => g + 1000)
         from generate_series(1, 500) g`,
      [t.tenant, t.id, boss.id],
    );
    expect(((await detailOf(d.approvalId))["checks"] as CheckRow[]).length).toBe(500);
    const item = await itemOf(d.approvalId);
    expect(item["check_summary"]).toBe("250 ／ 500 済み");
    expect(typeof item["check_summary"]).toBe("string");
  });

  it("K739-API-018 契約の形：承認の一覧の check_summary は string・詳細の checks は array・実行の checks は object のまま（型は変えず値の中身だけが変わる）", () => {
    const api = readFileSync(join(ROOT, "05_flow", "screen_api.py"), "utf8");
    expect(api).toMatch(/"listApprovalQueue": \("ApprovalQueueItem", \{[^}]*"check_summary": "string"/);
    expect(api).toMatch(/"getApproval": \("ApprovalDetail", \{[^}]*"checks": "array", "check_summary": "string"/);
    expect(api).toMatch(/"checks": "object"\}\)/);
    const q = readFileSync(join(ROOT, "apps", "api", "src", "features", "F5", "approve-complete", "queue.ts"), "utf8");
    expect(q).toContain("app.approval_checks_overlay");
    expect(q).toContain("app.approval_detail_checks");
  });

  it("K739-API-019 札（kind=artifact）と並べ替え（sort=title）を付けた一覧（K-748 の頁の道）でも check_summary は数の字。DB の関数 app.approval_page_checks は rows の artifact の行だけ差し替え、渡しの行・more・counts・rows の無い答えはそのまま", async () => {
    const m = await mixed("札を付ける");
    const plain = await itemOf(m.d.approvalId);
    const r = await queue(boss, "?kind=artifact&sort=title&limit=200");
    expect(r.status, await r.clone().text()).toBe(200);
    const rows = (await json(r)).data as unknown as Record<string, unknown>[];
    const hit = rows.find((x) => x["id"] === m.d.approvalId)!;
    expect(hit["check_summary"]).toBe("4 ／ 5 済み");
    expect(hit["check_summary"]).toBe(plain["check_summary"]);
    const page = {
      rows: [
        { kind: "artifact", id: "a", ticket_id: m.t.id, check_summary: "元の字" },
        { kind: "handover", id: "h", ticket_id: m.t.id, check_summary: "" },
      ],
      more: true,
      counts: { total: 2 },
    };
    const out = await viaDb<{ rows: Record<string, unknown>[]; more: boolean; counts: unknown }>(
      boss,
      "select app.approval_page_checks($1::jsonb) as v",
      [JSON.stringify(page)],
    );
    expect(out.rows.map((x) => x["check_summary"])).toEqual(["4 ／ 5 済み", ""]);
    expect(out.more).toBe(true);
    expect(out.counts).toEqual({ total: 2 });
    expect(await viaDb(boss, 'select app.approval_page_checks(\'{"error":"bad_query"}\'::jsonb) as v', [])).toEqual({
      error: "bad_query",
    });
  });
});
