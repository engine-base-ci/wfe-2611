// K-776「作った後に会話をチケットへ移す口（adoptDraftConversation）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K776-API-…）は 11_tickets/K-776.md の表と 1 対 1。
//   口：POST /api/v1/ticket_draft_conversations/:id/adopt ← { ticket_id } → 201 { data: { conversation_id, ticket_id } }。作る画面の会話（draft）が、作ったチケットの会話（ticket）になる。
//   土台は delegate-kit.ts の makeKit（本物の Postgres・本物の口）。会話・チケットは DB に直に置く（作る口・会話の口の形に頼らない）。口の登録は葉の hooks のファイルを最初に叩くときに 1 回だけ読む。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Person } from "../fixture.js";
import { data, json, makeKit, type Device, type Kit } from "./delegate-kit.js";

const HOOKS_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "src", "hooks");
const NOT_CREATOR = "E-TALK-080"; // そのチケットを作った人でない（403）
const NOT_DRAFT = "E-TALK-081"; // 作る画面の会話でない（自分の AI との会話など・409）
const MOVED = "E-TALK-082"; // もう移した（409）
const HAS_TALK = "E-TALK-083"; // そのチケットの会話が自分にもうある（409）

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
const person = (name: string, tenant = k.T) =>
  k.f.person(tenant.tenantId, tenant.rootScope, { name, ticketAbility: "edit" });

/** チケットを DB に直に置く（作った人と担当者を選べる）。返すのは id */
async function raw(creator: Person, o: { assignee?: Person; tenant?: typeof k.T; title?: string } = {}) {
  const tenant = o.tenant ?? k.T;
  const kind =
    tenant === k.T
      ? k.taskKind
      : (
          await k.q<{ id: string }>(
            "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
            [tenant.tenantId],
          )
        )[0]!.id;
  const r = await k.q<{ id: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, due_on)
     values ($1, $2, '', $3, (select id from ticket_stages where tenant_id = $1 and key = 'todo'), $4, $5, $6, $7) returning id`,
    [tenant.tenantId, tenant.rootScope, kind, o.title ?? "見積を作る", (o.assignee ?? creator).id, creator.id, jst(3)],
  );
  return r[0]!.id;
}
const numberOf = async (t: string) =>
  (await k.q<{ number: string }>("select number from tickets where id = $1", [t]))[0]!.number;
/** 作る画面の会話などを DB に直に置き、人の言葉と AI の返事を 1 つずつ入れる */
async function conv(p: Person, kind: "draft" | "ticket" | "clone" = "draft", ticketId: string | null = null) {
  const c = (
    await k.q<{ id: string }>(
      "insert into conversations (tenant_id, scope_id, owner_member_id, title, talk_kind, ticket_id) values ($1, $2, $3, 'K776 の会話', $4, $5) returning id",
      [k.T.tenantId, k.T.rootScope, p.id, kind, ticketId],
    )
  )[0]!.id;
  await k.q(
    "insert into messages (tenant_id, conversation_id, sender_member_id, body, kind) values ($1, $2, $3, '見積の題を考えたい', 'human')",
    [k.T.tenantId, c, p.id],
  );
  await k.q("insert into messages (tenant_id, conversation_id, body, kind) values ($1, $2, '題の案を出します', 'ai')", [
    k.T.tenantId,
    c,
  ]);
  return c;
}
const adopt = (p: Person | null, c: string, body: unknown = {}) =>
  k.f.req("POST", `/ticket_draft_conversations/${c}/adopt`, { body, headers: p ? p.auth : {} });
const row = async (c: string) =>
  (
    await k.q<{ talk_kind: string; ticket_id: string | null; owner_member_id: string; deleted_at: string | null }>(
      "select talk_kind, ticket_id, owner_member_id, deleted_at from conversations where id = $1",
      [c],
    )
  )[0]!;
const bodies = (c: string) =>
  k.q<{ kind: string; body: string | null }>(
    "select kind, body from messages where conversation_id = $1 and deleted_at is null order by created_at, id",
    [c],
  );
const notesOf = async (c: string) => (await bodies(c)).filter((m) => m.kind === "note");
const auditOf = (c: string) =>
  k.q<{ actor_member_id: string; choke_point_id: string; payload: unknown }>(
    "select actor_member_id, choke_point_id, payload from audit_events where action = 'conversation.adopt' and target_id = $1",
    [c],
  );
const code = async (r: Response) => (await json(r))["code"];
const stillDraft = async (c: string) => {
  expect(await row(c)).toMatchObject({ talk_kind: "draft", ticket_id: null });
  expect(await notesOf(c)).toHaveLength(0);
  expect(await auditOf(c)).toHaveLength(0);
};
const plain404 = async (r: Response) => {
  expect(r.status, await r.clone().text()).toBe(404);
  expect(await json(r)).toEqual({ error: "not_found", code: "NOT_FOUND" });
};

describe("K-776 作った後に会話をチケットへ移す", () => {
  it("K776-API-001 作る画面の会話を、作ったチケットの会話に移す：201・答えの鍵はちょうど 2 つ（conversation_id・ticket_id）。会話の種類が ticket・チケットの id が入り・会話の id と持ち主は同じ・人の言葉と返事の行は残る。そのチケットの自分の会話として 1 つだけ見つかり、作る画面の会話の数は 1 つ減る。証跡 1 行（字は入らない）・Cache-Control に private と no-store", async () => {
    const p = await person("移す人");
    const t = await raw(p);
    const c = await conv(p);
    const draftsBefore = await k.n(
      "select count(*) as n from conversations where owner_member_id = $1 and talk_kind = 'draft' and deleted_at is null",
      [p.id],
    );
    const r = await adopt(p, c, { ticket_id: t });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = await data<Record<string, unknown>>(r);
    expect(Object.keys(v).sort()).toEqual(["conversation_id", "ticket_id"]);
    expect(v).toMatchObject({ conversation_id: c, ticket_id: t });
    expect(await row(c)).toMatchObject({ talk_kind: "ticket", ticket_id: t, owner_member_id: p.id, deleted_at: null });
    const mine = await k.q<{ id: string }>(
      "select id from conversations where owner_member_id = $1 and ticket_id = $2 and talk_kind = 'ticket' and deleted_at is null",
      [p.id, t],
    );
    expect(mine.map((x) => x.id)).toEqual([c]);
    expect(
      await k.n(
        "select count(*) as n from conversations where owner_member_id = $1 and talk_kind = 'draft' and deleted_at is null",
        [p.id],
      ),
    ).toBe(draftsBefore - 1);
    expect((await bodies(c)).filter((m) => m.kind !== "note").map((m) => m.kind)).toEqual(["human", "ai"]);
    expect(await auditOf(c)).toEqual([{ actor_member_id: p.id, choke_point_id: "C2", payload: { ticket_id: t } }]);
  });

  it("K776-API-002 会話に 1 行の知らせが付く：who が note になる行が最後に 1 つ（「このチケットを作りました（番号）。作る時の会話はここに続きます」）。前の行は順も中身も変わらず、書いた人は空", async () => {
    const p = await person("知らせの人");
    const t = await raw(p);
    const c = await conv(p);
    const before = await bodies(c);
    expect((await adopt(p, c, { ticket_id: t })).status).toBe(201);
    const after = await bodies(c);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after).toHaveLength(before.length + 1);
    expect(after.at(-1)).toEqual({
      kind: "note",
      body: `このチケットを作りました（${await numberOf(t)}）。作る時の会話はここに続きます`,
    });
    const sender = await k.q<{ sender_member_id: string | null }>(
      "select sender_member_id from messages where conversation_id = $1 and kind = 'note'",
      [c],
    );
    expect(sender[0]!.sender_member_id).toBeNull();
  });

  it("K776-API-003 移せるのは、そのチケットを作った人：担当者が別の人でも作った人は移せる。作っていない担当者は 403・E-TALK-080 で何も変わらない。担当者を替えた直後も作った人は移せる", async () => {
    const maker = await person("作った人");
    const worker = await person("担当者");
    const t = await raw(maker, { assignee: worker });
    const mine = await conv(maker);
    expect((await adopt(maker, mine, { ticket_id: t })).status).toBe(201);
    const theirs = await conv(worker);
    const r = await adopt(worker, theirs, { ticket_id: t });
    expect(r.status, await r.clone().text()).toBe(403);
    expect(await code(r)).toBe(NOT_CREATOR);
    await stillDraft(theirs);
    // 担当者を替えた直後：作った人は、担当者でなくなっても移せる
    const t2 = await raw(maker, { assignee: maker });
    const c2 = await conv(maker);
    await k.q("update tickets set assignee_member_id = $2 where id = $1", [t2, worker.id]);
    expect((await adopt(maker, c2, { ticket_id: t2 })).status).toBe(201);
  });

  it("K776-API-004 ほかの人が作った見えるチケット：自分の会話でも 403・E-TALK-080・会話は作る画面の会話のまま（知らせも証跡も増えない）", async () => {
    const maker = await person("ほかの人が作る");
    const me = await person("見えるだけの人");
    const t = await raw(maker, { assignee: me });
    const c = await conv(me);
    const r = await adopt(me, c, { ticket_id: t });
    expect(r.status).toBe(403);
    expect(await code(r)).toBe(NOT_CREATOR);
    await stillDraft(c);
  });

  it("K776-API-005 会話が見つからない：ほかの人の会話・無い id・消した会話は 404（鍵は error と code だけ）・何も変わらない。作った本人でも、ほかの人の会話は移せない", async () => {
    const p = await person("会話の持ち主");
    const other = await person("ほかの人");
    const t = await raw(p);
    const theirs = await conv(other);
    const gone = await conv(p);
    await k.q("update conversations set deleted_at = now() where id = $1", [gone]);
    for (const c of [theirs, randomUUID(), gone]) await plain404(await adopt(p, c, { ticket_id: t }));
    await stillDraft(theirs);
    expect(await k.n("select count(*) as n from conversations where ticket_id = $1", [t])).toBe(0);
    expect((await row(gone)).talk_kind).toBe("draft");
  });

  it("K776-API-006 チケットが見つからない：無い id・消したチケット・別の会社のチケットは 404（鍵は error と code だけ）・会話は作る画面の会話のまま", async () => {
    const p = await person("チケットを探す人");
    const stranger = await person("別の会社の人", k.O);
    const gone = await raw(p);
    await k.q("update tickets set deleted_at = now() where id = $1", [gone]);
    const theirs = await raw(stranger, { tenant: k.O });
    const c = await conv(p);
    for (const t of [randomUUID(), gone, theirs]) await plain404(await adopt(p, c, { ticket_id: t }));
    await stillDraft(c);
  });

  it("K776-API-007 作る画面の会話でない会話（自分の AI との会話 clone）は 409・E-TALK-081・何も変わらない", async () => {
    const p = await person("clone の人");
    const t = await raw(p);
    const c = await conv(p, "clone");
    const r = await adopt(p, c, { ticket_id: t });
    expect(r.status, await r.clone().text()).toBe(409);
    expect(await code(r)).toBe(NOT_DRAFT);
    expect(await row(c)).toMatchObject({ talk_kind: "clone", ticket_id: null });
    expect(await notesOf(c)).toHaveLength(0);
  });

  it("K776-API-008 1 回だけ：もう移した会話をもう 1 度（同じチケット・別のチケット）は 409・E-TALK-082。最初の移しが残り、知らせは 1 つのまま", async () => {
    const p = await person("二度押す人");
    const t = await raw(p);
    const t2 = await raw(p, { title: "別のチケット" });
    const c = await conv(p);
    expect((await adopt(p, c, { ticket_id: t })).status).toBe(201);
    for (const again of [t, t2]) {
      const r = await adopt(p, c, { ticket_id: again });
      expect(r.status, await r.clone().text()).toBe(409);
      expect(await code(r)).toBe(MOVED);
    }
    expect(await row(c)).toMatchObject({ talk_kind: "ticket", ticket_id: t });
    expect(await notesOf(c)).toHaveLength(1);
    expect(await auditOf(c)).toHaveLength(1);
  });

  it("K776-API-009 そのチケットの自分の会話がもう在る（右のパネルで先に話した）：409・E-TALK-083・作る画面の会話は作る画面の会話のまま・もう在る会話は変わらない。ほかの人のそのチケットの会話は邪魔しない（201）", async () => {
    const p = await person("先に話した人");
    const other = await person("ほかの人が話した");
    const t = await raw(p);
    const talk = await conv(p, "ticket", t);
    const c = await conv(p);
    const r = await adopt(p, c, { ticket_id: t });
    expect(r.status, await r.clone().text()).toBe(409);
    expect(await code(r)).toBe(HAS_TALK);
    await stillDraft(c);
    expect(await row(talk)).toMatchObject({ talk_kind: "ticket", ticket_id: t });
    // ほかの人の会話は、人ごとに 1 つの決まりの外
    const t2 = await raw(p, { title: "別のチケット" });
    await conv(other, "ticket", t2);
    const c2 = await conv(p);
    expect((await adopt(p, c2, { ticket_id: t2 })).status).toBe(201);
  });

  it("K776-API-010 動いている仕事があっても会話ごと移る：201。その仕事が終わると、返事は同じ会話に入る（会話の種類は ticket のまま）", async () => {
    const p = await person("動いている人");
    const pc: Device = await k.device(p);
    const t = await raw(p);
    const c = await conv(p);
    await k.q(
      "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, permission_mode) values ($1, $2, $3, $4, 'queued', '題を考えて', 'chat', 'manual')",
      [k.T.tenantId, k.T.rootScope, p.id, c],
    );
    const job = await k.takeJob(pc);
    expect(job.conversation_id).toBe(c);
    const r = await adopt(p, c, { ticket_id: t });
    expect(r.status, await r.clone().text()).toBe(201);
    const fin = await k.finish(pc, job.job_id, { state: "done", result: "題は「見積を作る」です" });
    expect(fin.status, await fin.clone().text()).toBe(201);
    const after = await bodies(c);
    expect(after.filter((m) => m.kind === "ai").map((m) => m.body)).toContain("題は「見積を作る」です");
    expect(await row(c)).toMatchObject({ talk_kind: "ticket", ticket_id: t });
  });

  it("K776-API-011 形の誤り：ticket_id が無い・null・数・空・uuid でない・知らない項目があるは 422（欄 ticket_id）で何も変わらない。大文字の uuid は通る", async () => {
    const p = await person("形の人");
    const t = await raw(p);
    const c = await conv(p);
    const bad: unknown[] = [{}, { ticket_id: null }, { ticket_id: 5 }, { ticket_id: "" }, { ticket_id: "abc" }];
    for (const body of bad) {
      const r = await adopt(p, c, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      expect(JSON.stringify(await json(r))).toContain("ticket_id");
    }
    const extra = await adopt(p, c, { ticket_id: t, note: "知らない項目" });
    expect(extra.status).toBe(422);
    await stillDraft(c);
    const up = await adopt(p, c, { ticket_id: t.toUpperCase() });
    expect(up.status, await up.clone().text()).toBe(201);
  });

  it("K776-API-012 NUL（U+0000）を含む入力は入口が 422・何も変わらない", async () => {
    const p = await person("NUL の人");
    const t = await raw(p);
    const c = await conv(p);
    const r = await adopt(p, c, { ticket_id: `${t}\u0000` });
    expect(r.status).toBe(422);
    await stillDraft(c);
  });

  it("K776-API-013 同じ会話を 2 つのチケットへ同時に移す：1 つだけ通り（201 と 409・E-TALK-082）、会話は通った方のチケットのもの・知らせは 1 つ", async () => {
    const p = await person("同時の人 A");
    const a = await raw(p, { title: "A" });
    const b = await raw(p, { title: "B" });
    const c = await conv(p);
    const rs = await Promise.all([adopt(p, c, { ticket_id: a }), adopt(p, c, { ticket_id: b })]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    const lost = rs.find((r) => r.status === 409)!;
    expect(await code(lost)).toBe(MOVED);
    const won = (await row(c)).ticket_id;
    expect([a, b]).toContain(won);
    expect(await notesOf(c)).toHaveLength(1);
    expect(await auditOf(c)).toHaveLength(1);
  });

  it("K776-API-014 2 つの作る画面の会話を同じチケットへ同時に移す：1 つだけ通り（201 と 409・E-TALK-083）、人ごと・チケットごとに 1 つの決まりが守られる（500 にならない）", async () => {
    const p = await person("同時の人 B");
    const t = await raw(p);
    const c1 = await conv(p);
    const c2 = await conv(p);
    const rs = await Promise.all([adopt(p, c1, { ticket_id: t }), adopt(p, c2, { ticket_id: t })]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await code(rs.find((r) => r.status === 409)!)).toBe(HAS_TALK);
    expect(
      await k.n(
        "select count(*) as n from conversations where owner_member_id = $1 and ticket_id = $2 and talk_kind = 'ticket' and deleted_at is null",
        [p.id, t],
      ),
    ).toBe(1);
    const lostId = rs[0]!.status === 409 ? c1 : c2;
    expect(await row(lostId)).toMatchObject({ talk_kind: "draft", ticket_id: null });
  });

  it("K776-API-015 ログインしていないは 401・1 分に 61 回目は 429（retry_after_sec は 1〜60 の整数）。上限で止めた呼び出しは何も変えない", async () => {
    const p = await person("急ぐ人");
    const c = await conv(p);
    const none = await adopt(null, c, { ticket_id: randomUUID() });
    expect(none.status).toBe(401);
    const saved = { ...k.f.limits };
    delete k.f.limits["adoptDraftConversation"];
    try {
      for (let i = 0; i < 60; i++) await adopt(p, randomUUID(), { ticket_id: randomUUID() });
      const over = await adopt(p, c, { ticket_id: randomUUID() });
      expect(over.status).toBe(429);
      const wait = Number((await json(over))["retry_after_sec"]);
      expect(Number.isInteger(wait) && wait >= 1 && wait <= 60).toBe(true);
    } finally {
      Object.assign(k.f.limits, saved);
    }
    await stillDraft(c);
  });

  it("K776-API-016 S1 の失敗：証跡を書くところで DB が落ちると 503（E-PAGE-003）で、会話の種類も知らせも何も変わらない（作る画面の会話のまま）。[残る] の手順は無いので後片付けの行は要らない", async () => {
    const p = await person("失敗の人");
    const t = await raw(p);
    const c = await conv(p);
    await k.f.admin.query(
      "create or replace function public.k776_break() returns trigger language plpgsql as $$ begin raise exception 'k776 試験が起こした失敗'; end $$",
    );
    await k.f.admin.query(
      `create trigger k776_break_audit before insert on audit_events for each row when (new.action = 'conversation.adopt' and new.tenant_id = '${k.T.tenantId}'::uuid) execute function public.k776_break()`,
    );
    try {
      const r = await adopt(p, c, { ticket_id: t });
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("drop trigger if exists k776_break_audit on audit_events");
    }
    await stillDraft(c);
    expect((await adopt(p, c, { ticket_id: t })).status).toBe(201);
  });

  it("K776-API-017 DB の関数（2 層目）を直に呼ぶ：呼んだ人が無い文脈は { error: not_member }・作っていない人は { error: forbidden }・ほかの人の会話は { error: not_found }。security definer・search_path に pg_temp・public から外し kaname_app に渡す。引数は会話とチケットの 2 つだけ", async () => {
    const p = await person("直に呼ぶ人");
    const other = await person("作っていない人");
    const t = await raw(p);
    const c = await conv(p);
    const call = async (as: Person | null, conversation: string, ticket: string) => {
      const cn = await k.f.pool.connect();
      try {
        await cn.query("begin");
        await cn.query(
          "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
          [k.T.tenantId, as?.id ?? ""],
        );
        return (
          await cn.query<{ v: { error?: string } }>("select app.draft_adopt($1, $2) as v", [conversation, ticket])
        ).rows[0]!.v;
      } finally {
        await cn.query("rollback");
        cn.release();
      }
    };
    expect(await call(null, c, t)).toEqual({ error: "not_member" });
    expect(await call(other, c, t)).toEqual({ error: "not_found" });
    const otherDraft = await conv(other);
    expect(await call(other, otherDraft, t)).toEqual({ error: "forbidden" });
    await stillDraft(c);
    const fn = await k.q<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean; args: string }>(
      `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', p.oid, 'execute') as app, pg_get_function_identity_arguments(p.oid) as args
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'draft_adopt'`,
    );
    expect(fn).toHaveLength(1);
    expect(fn[0]!.definer).toBe(true);
    expect(fn[0]!.cfg?.join(",") ?? "").toMatch(/search_path=.*pg_temp/);
    expect(fn[0]).toMatchObject({ pub: false, app: true });
    expect(fn[0]!.args).toBe("p_conv uuid, p_ticket uuid");
  });
});
