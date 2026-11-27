// K-783「作った直後に右のパネルで先に話していたら、2 つの会話を時間の順に 1 つにまとめる（D-153.36）」の単体の試験（口・本物の DB）。
//   名前の頭の行 ID（K783-API-…）は 11_tickets/K-783.md の表と 1 対 1。K-776 の行 K776-API-009・014（409・E-TALK-083）はこの葉の行に替わった。
//   口：POST /api/v1/ticket_draft_conversations/:id/adopt ← { ticket_id } → 201 { data: { conversation_id, ticket_id } }（K-776 の口・形は変えない）。
//   まとめるとき：conversation_id は先に在ったチケットの会話の id。作る画面の会話の行（人の言葉・AI の返事・案）と仕事はその会話へ移り、作る画面の会話は消えた印になる。
//   土台は delegate-kit.ts の makeKit（K-776 と同じ）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Person } from "../fixture.js";
import { data, json, makeKit, type Kit } from "./delegate-kit.js";

const HOOKS_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "src", "hooks");
const MERGED_NOTE = "作る時の会話を、ここに時間の順にまとめました";

let k: Kit;
beforeAll(async () => {
  k = await makeKit();
  const m = (await import(join(HOOKS_DIR, "draft-adopt.ts"))) as { register: HookModule };
  Object.assign(k.f.hooks, m.register.make({ appPool: k.f.pool } as unknown as HookDeps));
  k.f.limits["adoptDraftConversation"] = 100_000;
}, 90_000);
afterAll(async () => {
  await k?.close();
});

const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const person = (name: string) => k.f.person(k.T.tenantId, k.T.rootScope, { name, ticketAbility: "edit" });
async function ticket(creator: Person): Promise<string> {
  const r = await k.q<{ id: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, due_on)
     values ($1, $2, '', $3, (select id from ticket_stages where tenant_id = $1 and key = 'todo'), '見積を作る', $4, $4, $5) returning id`,
    [k.T.tenantId, k.T.rootScope, k.taskKind, creator.id, jst(3)],
  );
  return r[0]!.id;
}
/** 会話を置き、行を「何分前」の時刻で入れる（並びを決める） */
async function conv(p: Person, kind: "draft" | "ticket", ticketId: string | null, lines: [string, string, number][]) {
  const c = (
    await k.q<{ id: string }>(
      "insert into conversations (tenant_id, scope_id, owner_member_id, title, talk_kind, ticket_id) values ($1, $2, $3, 'K783 の会話', $4, $5) returning id",
      [k.T.tenantId, k.T.rootScope, p.id, kind, ticketId],
    )
  )[0]!.id;
  for (const [who, body, minAgo] of lines)
    await k.q(
      "insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, created_at) values ($1, $2, $3, $4, $5, now() - make_interval(mins => $6))",
      [k.T.tenantId, c, who === "human" ? p.id : null, body, who, minAgo],
    );
  return c;
}
const adopt = (p: Person, c: string, ticketId: string) =>
  k.f.req("POST", `/ticket_draft_conversations/${c}/adopt`, { body: { ticket_id: ticketId }, headers: p.auth });
const bodies = async (c: string) =>
  (
    await k.q<{ kind: string; body: string | null }>(
      "select kind, body from messages where conversation_id = $1 and deleted_at is null order by created_at, id",
      [c],
    )
  ).map((m) => `${m.kind}:${m.body ?? ""}`);
const convRow = async (c: string) =>
  (
    await k.q<{ talk_kind: string; ticket_id: string | null; deleted_at: string | null }>(
      "select talk_kind, ticket_id, deleted_at from conversations where id = $1",
      [c],
    )
  )[0]!;
const liveTicketTalks = (p: Person, t: string) =>
  k.n(
    "select count(*) as n from conversations where owner_member_id = $1 and ticket_id = $2 and talk_kind = 'ticket' and deleted_at is null",
    [p.id, t],
  );

describe("K-783 作った後に、先に話していた会話とまとめる", () => {
  it("K783-API-001 右のパネルで先に話した会話が在る：201・conversation_id は先に在った会話の id・ticket_id はそのチケット。行は 2 つの会話の行が時間の順に 1 つに並び、最後に知らせの 1 行「…作る時の会話を、ここに時間の順にまとめました」。作る画面の会話は消えた印・行は 0。そのチケットの自分の会話は 1 つ", async () => {
    const p = await person("まとめる人");
    const t = await ticket(p);
    const panel = await conv(p, "ticket", t, [
      ["human", "パネルで聞いた", 5],
      ["ai", "パネルの返事", 4],
    ]);
    const draft = await conv(p, "draft", null, [
      ["human", "作る画面で聞いた", 10],
      ["ai", "作る画面の返事", 3],
    ]);
    const r = await adopt(p, draft, t);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(data(await json(r))).toEqual({ conversation_id: panel, ticket_id: t });
    const lines = await bodies(panel);
    expect(lines.slice(0, 4)).toEqual([
      "human:作る画面で聞いた",
      "human:パネルで聞いた",
      "ai:パネルの返事",
      "ai:作る画面の返事",
    ]);
    expect(lines).toHaveLength(5);
    expect(lines[4]).toMatch(new RegExp(`^note:このチケットを作りました（.+）。${MERGED_NOTE}$`));
    expect(await convRow(draft)).toMatchObject({ talk_kind: "draft", ticket_id: null });
    expect((await convRow(draft)).deleted_at).not.toBeNull();
    expect(await bodies(draft)).toEqual([]);
    expect(await liveTicketTalks(p, t)).toBe(1);
  });

  it("K783-API-002 作る画面の会話の仕事（返事を待っている・動いている）もまとめた会話へ移る：仕事の conversation_id が先に在った会話になり、消えない（返事はまとめた会話に届く）", async () => {
    const p = await person("仕事の人");
    const t = await ticket(p);
    const panel = await conv(p, "ticket", t, [["human", "先に話した", 2]]);
    const draft = await conv(p, "draft", null, [["human", "返事を待っている", 1]]);
    await k.q(
      "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, kind, state_id, prompt, started_at) values ($1, $2, $3, $4, 'chat', 'running', '（試験）', now())",
      [k.T.tenantId, k.T.rootScope, p.id, draft],
    );
    const r = await adopt(p, draft, t);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await k.n("select count(*) as n from bridge_jobs where conversation_id = $1", [panel])).toBe(1);
    expect(await k.n("select count(*) as n from bridge_jobs where conversation_id = $1", [draft])).toBe(0);
  });

  it("K783-API-003 まとめたときの証跡：conversation.adopt が 1 行（作る画面の会話の id に・payload に ticket_id と merged_into＝先に在った会話の id・字は入らない）", async () => {
    const p = await person("証跡の人");
    const t = await ticket(p);
    const panel = await conv(p, "ticket", t, [["human", "a", 2]]);
    const draft = await conv(p, "draft", null, [["human", "b", 1]]);
    expect((await adopt(p, draft, t)).status).toBe(201);
    const a = await k.q<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where action = 'conversation.adopt' and target_id = $1",
      [draft],
    );
    expect(a).toHaveLength(1);
    expect(a[0]!.payload).toEqual({ ticket_id: t, merged_into: panel });
  });

  it("K783-API-004 2 つの作る画面の会話を同じチケットへ同時に移す：両方 201・どちらも同じ 1 つの会話の id を返し（500 にならない）、そのチケットの自分の会話は 1 つ・4 つの行が全部そこに在る", async () => {
    const p = await person("同時の人");
    const t = await ticket(p);
    const c1 = await conv(p, "draft", null, [
      ["human", "一つ目", 4],
      ["ai", "一つ目の返事", 3],
    ]);
    const c2 = await conv(p, "draft", null, [
      ["human", "二つ目", 2],
      ["ai", "二つ目の返事", 1],
    ]);
    const rs = await Promise.all([adopt(p, c1, t), adopt(p, c2, t)]);
    expect(rs.map((r) => r.status)).toEqual([201, 201]);
    const ids = await Promise.all(
      rs.map(async (r) => (data(await json(r)) as { conversation_id: string }).conversation_id),
    );
    expect(ids[0]).toBe(ids[1]);
    expect(await liveTicketTalks(p, t)).toBe(1);
    const lines = (await bodies(ids[0]!)).filter((l) => !l.startsWith("note:"));
    expect(lines).toEqual(["human:一つ目", "ai:一つ目の返事", "human:二つ目", "ai:二つ目の返事"]);
  });

  it("K783-API-005 ほかの人のそのチケットの会話はまとめない：自分の作る画面の会話がそのままチケットの会話になる（K-776 の道・conversation_id は作る画面の会話の id）。ほかの人の会話の行は変わらない", async () => {
    const p = await person("自分");
    const other = await person("ほかの人");
    const t = await ticket(p);
    const theirs = await conv(other, "ticket", t, [["human", "ほかの人の言葉", 2]]);
    const draft = await conv(p, "draft", null, [["human", "自分の言葉", 1]]);
    const r = await adopt(p, draft, t);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(data(await json(r))).toEqual({ conversation_id: draft, ticket_id: t });
    expect(await bodies(theirs)).toEqual(["human:ほかの人の言葉"]);
  });

  it("K783-API-006 まとめる途中で失敗（行を移す書き込みが例外）：503・E-PAGE-003。1 取引なので、作る画面の会話も先に在った会話も行も仕事も前のまま（消えた印も知らせも証跡も無い）", async () => {
    const p = await person("失敗の人");
    const t = await ticket(p);
    const panel = await conv(p, "ticket", t, [["human", "先", 2]]);
    const draft = await conv(p, "draft", null, [["human", "後", 1]]);
    await k.f.admin.query(`create or replace function app.k783_fail() returns trigger language plpgsql as $$
      begin raise exception 'k783 の試験の失敗'; end $$`);
    await k.f.admin.query(
      "create trigger k783_fail before update of conversation_id on messages for each row execute function app.k783_fail()",
    );
    try {
      const r = await adopt(p, draft, t);
      expect(r.status, await r.clone().text()).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("drop trigger if exists k783_fail on messages");
      await k.f.admin.query("drop function if exists app.k783_fail()");
    }
    expect(await bodies(panel)).toEqual(["human:先"]);
    expect(await bodies(draft)).toEqual(["human:後"]);
    expect((await convRow(draft)).deleted_at).toBeNull();
    expect(
      await k.n("select count(*) as n from audit_events where action = 'conversation.adopt' and target_id = $1", [
        draft,
      ]),
    ).toBe(0);
  });
  it("K783-API-007 錠を取らずに作られる右のパネルの会話と移すが重なる（一意の索引がぶつかる）：別の取引が右のパネルの会話を作って確定するまで移す側が待ち、ぶつかったら読み直してまとめる。201・conversation_id はその右のパネルの会話の id・作る時の行がそこへ移り・作る画面の会話は消えた印（503 にしない）", async () => {
    const p = await person("重なる人");
    const t = await ticket(p);
    const draft = await conv(p, "draft", null, [["human", "作る画面で聞いた", 3]]);
    const other = await k.f.admin.connect();
    let panel = "";
    let open = false;
    try {
      await other.query("begin");
      open = true;
      panel = (
        await other.query<{ id: string }>(
          "insert into conversations (tenant_id, scope_id, owner_member_id, title, talk_kind, ticket_id) values ($1, $2, $3, 'パネル', 'ticket', $4) returning id",
          [k.T.tenantId, k.T.rootScope, p.id, t],
        )
      ).rows[0]!.id;
      const holder = (await other.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!.pid;
      const pending = adopt(p, draft, t);
      // 移す側が一意の索引の確かめで、確定していない右のパネルの会話の取引を待つまで待つ（時間では待たない）。
      // 口の文は select app.draft_adopt(...) で conversations の字を含まないので、パネル側の接続に塞がれている接続の数で見る
      await expect
        .poll(
          async () => k.n("select count(*) as n from pg_stat_activity where $1 = any(pg_blocking_pids(pid))", [holder]),
          { timeout: 20_000 },
        )
        .toBeGreaterThan(0);
      await other.query("commit");
      open = false;
      const r = await pending;
      expect(r.status, await r.clone().text()).toBe(201);
      expect(data(await json(r))).toEqual({ conversation_id: panel, ticket_id: t });
    } finally {
      if (open) await other.query("rollback");
      other.release();
    }
    expect((await bodies(panel)).filter((l) => !l.startsWith("note:"))).toEqual(["human:作る画面で聞いた"]);
    expect((await convRow(draft)).deleted_at).not.toBeNull();
    expect(await liveTicketTalks(p, t)).toBe(1);
  });
});
