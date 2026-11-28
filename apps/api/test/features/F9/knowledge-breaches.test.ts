// K-700「破られた数を数える（置き場 knowledge_breaches と数える出来事・やり取りの 1 行）」の単体の試験（DB の関数と引き金・本物の Postgres）。
//   行 ID は K700-API-NNN（チケット 11_tickets/K-700.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md の 6 章と K-700 の md。
//   数える出来事は 3 つ：①AI が終わりを知らせたとき必ず守るの行にチェックが無い（仕事の行が done になったときの引き金）
//   ②AI が付けたチェックを人が外した（確認項目の行の引き金）③AI 自身が「守れていなかったので直した」と知らせた（関数 app.knowledge_record_breach を直に呼ぶ）。
//   AI の道具は人の要求の文脈を持たないので、DB の関数は管理の接続で直に呼ぶ（段 6 の道具の口は段 6 が作る）。口を通した全体は K-714（中間）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して確かめない（D-128.143）。
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { setupKnowledge } from "./knowledge.harness.js";
import { audits, breakWrites, num, type World } from "./knowledge.requests-kit.js";
import {
  aiCheck,
  breachLines,
  breachRows,
  finishJob,
  guardSpec,
  humanUncheck,
  mkJob,
  mkTicket,
  pubPage,
  scene,
  type Scene,
} from "./knowledge.guard-kit.js";

const h = setupKnowledge();

const record = async (ticket: string, spec: string, kind: string, note: string | null = null): Promise<string | null> =>
  (
    await h.admin.query<{ v: string | null }>("select app.knowledge_record_breach($1, $2, $3, $4) as v", [
      ticket,
      spec,
      kind,
      note,
    ])
  ).rows[0]!.v;
const sortedPairs = (rs: { page_id: string; test_spec_id: string | null; kind: string }[]): string[] =>
  rs.map((r) => `${r.page_id}|${r.test_spec_id}|${r.kind}`).sort();
const lineCount = (t: string): Promise<number> =>
  num(
    h,
    "select count(*) as n from ticket_messages where ticket_id = $1 and changes->0->>'field' = 'knowledge_breach'",
    [t],
  );
const noneWritten = async (s: Scene): Promise<void> => {
  expect(await breachRows(h, s.ticket)).toEqual([]);
  expect(await lineCount(s.ticket)).toBe(0);
  expect(await audits(h, s.w, "knowledge.breach.record")).toEqual([]);
};
const jobState = async (job: string): Promise<string> =>
  (await h.admin.query<{ s: string }>("select state_id as s from bridge_jobs where id = $1", [job])).rows[0]!.s;

describe("K-700 破られた数を数える", () => {
  it("K700-API-001 ①AI が結果つきで終わりを知らせたとき、必ず守るの行でチェックの無い物だけが 1 つずつ数えられる（チェックの付いた行は数えない）", async () => {
    await h.ready();
    const s = await scene(h, "k700-001");
    await aiCheck(h, s.specs.gp);
    await finishJob(h, s.job);
    const rows = await breachRows(h, s.ticket);
    expect(sortedPairs(rows)).toEqual(
      [`${s.pages.co}|${s.specs.co}|ai_unchecked`, `${s.pages.me}|${s.specs.me}|ai_unchecked`].sort(),
    );
    expect(rows.every((r) => r.tenant_id === s.w.co.tenantId && r.ticket_id === s.ticket)).toBe(true);
  });

  it("K700-API-002 結果が空・空白だけで done になった仕事は「終わりを知らせた」と見なさず、数えない", async () => {
    await h.ready();
    const s = await scene(h, "k700-002");
    await finishJob(h, s.job, { result: " \n\t " });
    await noneWritten(s);
  });

  it("K700-API-003 止まった・やめた仕事は数えない（終わりを知らせていない）", async () => {
    await h.ready();
    for (const state of ["stopped", "cancelled"] as const) {
      const s = await scene(h, `k700-003-${state}`);
      await finishJob(h, s.job, { state, result: null });
      await noneWritten(s);
    }
  });

  it("K700-API-004 数えるのは出どころ knowledge の行だけ。人が足した確認項目（manual）にチェックが無くても数えない", async () => {
    await h.ready();
    const s = await scene(h, "k700-004");
    await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, { source: "manual", title: "人が足した確認" });
    await aiCheck(h, s.specs.co);
    await aiCheck(h, s.specs.gp);
    await aiCheck(h, s.specs.me);
    await finishJob(h, s.job);
    await noneWritten(s);
  });

  it("K700-API-005 今も必ず守るで効く範囲のページの行だけを数える（必ず守るが外れた・消えた・まだ公開していない・効く範囲の外のページの行は数えない）", async () => {
    await h.ready();
    const s = await scene(h, "k700-005");
    await h.admin.query("update knowledge_pages set is_must = false where id = $1", [s.pages.co]);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [s.pages.gp]);
    const other = await pubPage(h, s.w.g2, s.w.mem2, "開発の型", { must: true });
    const outSpec = await guardSpec(h, s.w, s.ticket, other, s.w.mem1);
    const draft = await h.page({ scope: s.w.g1, owner: s.w.mgr1, state: "draft", title: "書き直し中" });
    const draftSpec = await guardSpec(h, s.w, s.ticket, draft, s.w.mem1);
    await finishJob(h, s.job);
    const rows = await breachRows(h, s.ticket);
    expect(sortedPairs(rows)).toEqual([`${s.pages.me}|${s.specs.me}|ai_unchecked`]);
    expect(rows.some((r) => r.test_spec_id === outSpec || r.test_spec_id === draftSpec)).toBe(false);
  });

  it("K700-API-006 同じチケット・同じページ・同じ出来事は二重に数えない（同じチケットで AI がもう 1 度終わりを知らせても増えない）", async () => {
    await h.ready();
    const s = await scene(h, "k700-006");
    await finishJob(h, s.job);
    const first = await breachRows(h, s.ticket);
    const job2 = await mkJob(h, s.w, s.w.mem1, s.w.g1, s.ticket);
    await finishJob(h, job2);
    expect((await breachRows(h, s.ticket)).map((r) => r.id)).toEqual(first.map((r) => r.id));
    expect(await lineCount(s.ticket)).toBe(3);
  });

  it("K700-API-007 同じページでも別のチケットは別に数える（チケットごとに 1 つ）", async () => {
    await h.ready();
    const a = await scene(h, "k700-007");
    const t2 = await mkTicket(h, a.w, a.w.g1, a.w.mem1);
    await guardSpec(h, a.w, t2, a.pages.co, a.w.mem1);
    const job2 = await mkJob(h, a.w, a.w.mem1, a.w.g1, t2);
    await finishJob(h, a.job);
    await finishJob(h, job2);
    expect((await breachRows(h, a.ticket)).length).toBe(3);
    expect((await breachRows(h, t2)).map((r) => r.page_id)).toEqual([a.pages.co]);
  });

  it("K700-API-008 数えたらチケットのやり取りに 1 行：change・作者なし・field knowledge_breach・from が出来事の種類・to が題名・page_id・本文にページの題名", async () => {
    await h.ready();
    const s = await scene(h, "k700-008");
    await aiCheck(h, s.specs.gp);
    await aiCheck(h, s.specs.me);
    await finishJob(h, s.job);
    const lines = await breachLines(h, s.ticket);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    expect(l.kind).toBe("change");
    expect(l.author_member_id).toBeNull();
    expect(l.changes).toHaveLength(1);
    expect(l.changes[0]).toMatchObject({
      field: "knowledge_breach",
      from: "ai_unchecked",
      to: "請求書の送り方",
      note: null,
      page_id: s.pages.co,
    });
    expect(l.body).toContain("請求書の送り方");
  });

  it("K700-API-009 証跡：数えるたびに knowledge.breach.record が 1 行（対象はチケット・関門 C2・中身は出来事の種類だけ・題名を入れない）", async () => {
    await h.ready();
    const s = await scene(h, "k700-009");
    await aiCheck(h, s.specs.gp);
    await aiCheck(h, s.specs.me);
    await finishJob(h, s.job);
    const a = await audits(h, s.w, "knowledge.breach.record");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ target_type: "tickets", target_id: s.ticket, choke_point_id: "C2" });
    expect(a[0]!.payload).toEqual({ kind: "ai_unchecked" });
    expect(JSON.stringify(a[0]!.payload)).not.toContain("請求書");
  });

  it("K700-API-010 会話の仕事（チケットなし）の終わりでは何も数えず、仕事の終わりも止まらない", async () => {
    await h.ready();
    const s = await scene(h, "k700-010");
    const chat = await mkJob(h, s.w, s.w.mem1, s.w.g1, null);
    await finishJob(h, chat);
    expect(await jobState(chat)).toBe("done");
    await noneWritten(s);
  });

  it("K700-API-011 ②AI が付けたチェックを人が外すと、その行が 1 つ数えられる（出来事 human_unchecked・やり取りの行は from が human_unchecked）", async () => {
    await h.ready();
    const s = await scene(h, "k700-011");
    await aiCheck(h, s.specs.co);
    await humanUncheck(h, s.specs.co);
    const rows = await breachRows(h, s.ticket);
    expect(sortedPairs(rows)).toEqual([`${s.pages.co}|${s.specs.co}|human_unchecked`]);
    const lines = await breachLines(h, s.ticket);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.changes[0]).toMatchObject({
      field: "knowledge_breach",
      from: "human_unchecked",
      page_id: s.pages.co,
    });
    expect(lines[0]!.author_member_id).toBeNull();
  });

  it("K700-API-012 人が付けたチェックを人が外す・出どころ manual の行の AI のチェックを外すのは数えない", async () => {
    await h.ready();
    const s = await scene(h, "k700-012");
    const p4 = await pubPage(h, s.w.co.rootScope, s.w.boss, "経費の精算", { must: true });
    const human = await guardSpec(h, s.w, s.ticket, p4, s.w.mem1, { by: "human", title: "人が付けた" });
    const manual = await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, {
      by: "ai",
      source: "manual",
      title: "人が足した",
    });
    await humanUncheck(h, human);
    await humanUncheck(h, manual);
    await noneWritten(s);
  });

  it("K700-API-013 付け直して、また外しても二重に数えない（同じチケット・同じページ・同じ出来事）", async () => {
    await h.ready();
    const s = await scene(h, "k700-013");
    for (let i = 0; i < 2; i += 1) {
      await aiCheck(h, s.specs.co);
      await humanUncheck(h, s.specs.co);
    }
    expect(await breachRows(h, s.ticket)).toHaveLength(1);
    expect(await lineCount(s.ticket)).toBe(1);
  });

  it("K700-API-014 チェックを付けるだけ・文字だけが変わる更新・人が外していない行は数えない", async () => {
    await h.ready();
    const s = await scene(h, "k700-014");
    await aiCheck(h, s.specs.co);
    await h.admin.query("update test_specs set title = title || ' ' where id = $1", [s.specs.gp]);
    await h.admin.query("update test_specs set version = version + 1 where id = $1", [s.specs.co]);
    await noneWritten(s);
  });

  it("K700-API-015 ③AI 自身が「守れていなかったので直した」と知らせたとき（関数を直に呼ぶ）、その行が数えられ、やり取りに理由つきの行が残る", async () => {
    await h.ready();
    const s = await scene(h, "k700-015");
    const id = await record(s.ticket, s.specs.co, "ai_self_reported", "件名に【請求書】が無い");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sortedPairs(await breachRows(h, s.ticket))).toEqual([`${s.pages.co}|${s.specs.co}|ai_self_reported`]);
    const lines = await breachLines(h, s.ticket);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.changes[0]).toMatchObject({
      from: "ai_self_reported",
      to: "請求書の送り方",
      note: "件名に【請求書】が無い",
      page_id: s.pages.co,
    });
    expect(lines[0]!.body).toContain("請求書の送り方");
    expect(lines[0]!.body).toContain("件名に【請求書】が無い");
  });

  it("K700-API-016 ③の理由は空でもよく、200 字（コードポイント）で切る（切っても数える）", async () => {
    await h.ready();
    const s = await scene(h, "k700-016");
    expect(await record(s.ticket, s.specs.co, "ai_self_reported")).not.toBeNull();
    expect(await record(s.ticket, s.specs.gp, "ai_self_reported", "あ".repeat(300))).not.toBeNull();
    const notes = (await breachLines(h, s.ticket)).map((l) => l.changes[0]!.note);
    expect(notes).toContain(null);
    expect(notes.filter((n) => n !== null).map((n) => [...n!].length)).toEqual([200]);
  });

  it("K700-API-017 知らない出来事の種類は例外（22023）で、何も書かない", async () => {
    await h.ready();
    const s = await scene(h, "k700-017");
    await expect(record(s.ticket, s.specs.co, "ai_forgot")).rejects.toMatchObject({ code: "22023" });
    await noneWritten(s);
  });

  it("K700-API-018 数えられない指し方（ほかのチケットの行・外した行・出どころ manual の行・今は必ず守るでないページの行）は null を返して何も書かない", async () => {
    await h.ready();
    const s = await scene(h, "k700-018");
    const t2 = await mkTicket(h, s.w, s.w.g1, s.w.mem1);
    const otherTicketSpec = await guardSpec(h, s.w, t2, s.pages.co, s.w.mem1);
    const removed = await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, { deleted: true });
    const manual = await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, { source: "manual" });
    await h.admin.query("update knowledge_pages set is_must = false where id = $1", [s.pages.gp]);
    for (const spec of [otherTicketSpec, removed, manual, s.specs.gp])
      expect(await record(s.ticket, spec, "ai_self_reported")).toBeNull();
    await noneWritten(s);
  });

  it("K700-API-019 同じ決まりを AI が「直した」と知らせるのが同時に 2 回来ても、通るのは 1 回だけ（もう 1 つは null）。そのあとの 3 度目も null で、やり取りの行・証跡も 1 つのまま", async () => {
    await h.ready();
    const s = await scene(h, "k700-019");
    const both = await Promise.all([
      record(s.ticket, s.specs.co, "ai_self_reported", "1 つ目"),
      record(s.ticket, s.specs.co, "ai_self_reported", "2 つ目"),
    ]);
    expect(both.filter((x) => x !== null)).toHaveLength(1);
    expect(await record(s.ticket, s.specs.co, "ai_self_reported", "3 つ目")).toBeNull();
    expect(await breachRows(h, s.ticket)).toHaveLength(1);
    expect(await lineCount(s.ticket)).toBe(1);
    expect(await audits(h, s.w, "knowledge.breach.record")).toHaveLength(1);
  });

  it("K700-API-020 3 つの出来事は別々に数える（同じチケット・同じページで ①②③ が 3 行）", async () => {
    await h.ready();
    const s = await scene(h, "k700-020");
    expect(await record(s.ticket, s.specs.co, "ai_self_reported")).not.toBeNull();
    await aiCheck(h, s.specs.co);
    await humanUncheck(h, s.specs.co);
    await finishJob(h, s.job);
    const kinds = (await breachRows(h, s.ticket)).filter((r) => r.page_id === s.pages.co).map((r) => r.kind);
    expect(kinds.sort()).toEqual(["ai_self_reported", "ai_unchecked", "human_unchecked"]);
  });

  it("K700-API-021 守り：数える関数はアプリの接続に渡さず、表は更新・削除・書き込みを渡さない（追記だけ・書くのは関数の中だけ）。読めるのはそのページを書ける人だけ", async () => {
    await h.ready();
    const s = await scene(h, "k700-021");
    await finishJob(h, s.job);
    const can = async (sql: string): Promise<boolean> => (await h.admin.query<{ v: boolean }>(sql)).rows[0]!.v;
    for (const f of [
      "app.knowledge_record_breach(uuid, uuid, text, text)",
      "app.knowledge_breach_scan(uuid)",
      "app.knowledge_guard_specs(uuid)",
    ])
      expect(await can(`select has_function_privilege('kaname_app', '${f}', 'execute') as v`)).toBe(false);
    for (const op of ["insert", "update", "delete"])
      expect(await can(`select has_table_privilege('kaname_app', 'knowledge_breaches', '${op}') as v`)).toBe(false);
    const seen = async (p: World["mem1"]): Promise<string[]> =>
      withTenant(h.pool, p.ctx, async (cl) =>
        (
          await cl.query<{ page_id: string }>("select page_id from knowledge_breaches where ticket_id = $1", [s.ticket])
        ).rows
          .map((r) => r.page_id)
          .sort(),
      );
    expect(await seen(s.w.boss)).toEqual([s.pages.co]);
    expect(await seen(s.w.mgr1)).toEqual([s.pages.gp]);
    expect(await seen(s.w.mem1)).toEqual([s.pages.me]);
    expect(await seen(s.w.mem2)).toEqual([]);
  });

  it("K700-API-022 失敗（手順 1・DB に書く）：数える所で DB が落ちても、AI の仕事は終わりのまま。何も残らず、やり取りの行も証跡も無い", async () => {
    await h.ready();
    const s = await scene(h, "k700-022");
    const restore = await breakWrites(h, "knowledge_breaches", s.w.co.tenantId);
    try {
      await finishJob(h, s.job);
    } finally {
      await restore();
    }
    expect(await jobState(s.job)).toBe("done");
    await noneWritten(s);
  });

  it("K700-API-023 失敗（手順 2・やり取りの行）：やり取りの行を書く所で落ちると、数えた行も含めて全部戻る（仕事の終わりは止まらない）", async () => {
    await h.ready();
    const s = await scene(h, "k700-023");
    const restore = await breakWrites(h, "ticket_messages", s.w.co.tenantId);
    try {
      await finishJob(h, s.job);
    } finally {
      await restore();
    }
    expect(await jobState(s.job)).toBe("done");
    await noneWritten(s);
  });

  it("K700-API-024 失敗（手順 3・証跡）：証跡を書く所で落ちると、数えた行もやり取りの行も全部戻る（仕事の終わりは止まらない）", async () => {
    await h.ready();
    const s = await scene(h, "k700-024");
    const restore = await breakWrites(h, "audit_events", s.w.co.tenantId);
    try {
      await finishJob(h, s.job);
    } finally {
      await restore();
    }
    expect(await jobState(s.job)).toBe("done");
    expect(await breachRows(h, s.ticket)).toEqual([]);
    expect(await lineCount(s.ticket)).toBe(0);
  });

  it("K700-API-025 失敗（②）：数える所で落ちても、人がチェックを外す操作は通る（チェックは外れ、破られた数だけ残らない）", async () => {
    await h.ready();
    const s = await scene(h, "k700-025");
    await aiCheck(h, s.specs.co);
    const restore = await breakWrites(h, "knowledge_breaches", s.w.co.tenantId);
    try {
      await humanUncheck(h, s.specs.co);
    } finally {
      await restore();
    }
    const r = await h.admin.query<{ checked_at: Date | null }>("select checked_at from test_specs where id = $1", [
      s.specs.co,
    ]);
    expect(r.rows[0]!.checked_at).toBeNull();
    await noneWritten(s);
  });

  it("K700-API-026 失敗（③）：数える所で落ちたら、呼んだ側（段 6 の道具）に例外を返し、何も残さない（黙って数えそこなわない）", async () => {
    await h.ready();
    const s = await scene(h, "k700-026");
    const restore = await breakWrites(h, "knowledge_breaches", s.w.co.tenantId);
    try {
      await expect(record(s.ticket, s.specs.co, "ai_self_reported", "理由")).rejects.toMatchObject({ code: "XX000" });
    } finally {
      await restore();
    }
    await noneWritten(s);
  });

  it("K700-API-027 今も必ず守るで生きているページの行の一覧（app.knowledge_guard_specs・K-701 も使う）：チェックの有無は問わず、manual・外した行・必ず守るでない・消えた・範囲の外・任せた人がいなくなった行は入らない", async () => {
    await h.ready();
    const s = await scene(h, "k700-027");
    await aiCheck(h, s.specs.co);
    const manual = await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, { source: "manual" });
    const removed = await guardSpec(h, s.w, s.ticket, s.pages.gp, s.w.mem1, { deleted: true });
    const unmust = await pubPage(h, s.w.co.rootScope, s.w.boss, "必ず守るでなくなった", { must: true });
    const unmustSpec = await guardSpec(h, s.w, s.ticket, unmust, s.w.mem1);
    await h.admin.query("update knowledge_pages set is_must = false where id = $1", [unmust]);
    const other = await pubPage(h, s.w.g2, s.w.mem2, "開発の型", { must: true });
    const otherSpec = await guardSpec(h, s.w, s.ticket, other, s.w.mem1);
    const gone = await pubPage(h, s.w.co.rootScope, s.w.boss, "消えた決まり", { must: true });
    const goneSpec = await guardSpec(h, s.w, s.ticket, gone, s.w.mem1);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const left = await pubPage(h, s.w.co.rootScope, s.w.boss, "任せた人が抜けた", { must: true });
    const leftSpec = await guardSpec(h, s.w, s.ticket, left, s.w.mem2);
    await h.admin.query("update members set deleted_at = now() where id = $1", [s.w.mem2.id]);
    const ids = (
      await h.admin.query<{ id: string }>("select g as id from app.knowledge_guard_specs($1) g", [s.ticket])
    ).rows
      .map((r) => r.id)
      .sort();
    expect(ids).toEqual([s.specs.co, s.specs.gp, s.specs.me].sort());
    for (const out of [manual, removed, unmustSpec, otherSpec, goneSpec, leftSpec]) expect(ids).not.toContain(out);
  });

  it("K700-API-028 DB の守り：出来事の種類は 3 つだけ・同じチケットとページと種類は 1 行だけ・別の会社のページは指せない", async () => {
    await h.ready();
    const s = await scene(h, "k700-028");
    const ins = (kind: string, page = s.pages.co): Promise<unknown> =>
      h.admin.query(
        "insert into knowledge_breaches (tenant_id, ticket_id, page_id, test_spec_id, kind) values ($1, $2, $3, $4, $5)",
        [s.w.co.tenantId, s.ticket, page, s.specs.co, kind],
      );
    await expect(ins("ai_forgot")).rejects.toMatchObject({ code: "23514" });
    await ins("ai_unchecked");
    await expect(ins("ai_unchecked")).rejects.toMatchObject({ code: "23505" });
    const w2 = await scene(h, "k700-028-other");
    await expect(ins("human_unchecked", w2.pages.co)).rejects.toMatchObject({ code: "22023" });
    expect(await breachRows(h, s.ticket)).toHaveLength(1);
  });
});
