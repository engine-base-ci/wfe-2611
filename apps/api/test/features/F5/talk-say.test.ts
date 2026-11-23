// K-758「言う・止める口（sendConversationMessage・stopConversation）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K758-API-…）は 11_tickets/K-758.md の行の表と 1 対 1。土台は K-757 が持ち込む F5/talk.harness.ts。
// 口：POST /api/v1/conversations/:id/messages ← { text } → 201 { data: { id, conversation_id, job_id } }
//     POST /api/v1/conversations/:id/stop（体なし）→ 201 { data: { state: "cancelled"|"stopping"|"none" } }
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupTalk, type Person, type World } from "./talk.harness.js";

const h = setupTalk(["talk-say", "talk-read"], ["sendConversationMessage", "stopConversation", "getConversation"]);

type Row = Record<string, unknown>;
const PC_NONE = "E-TALK-010";
const NOT_CLONE = "E-TALK-011";
const TOO_MANY = "E-TALK-012";
const q = async <T extends Row>(sql: string, p: unknown[] = []): Promise<T[]> =>
  (await h.f.admin.query<T>(sql, p)).rows;
const code = async (r: Response) => (await h.json(r))["code"];
const say = (who: Person | null, conv: string, body: unknown) =>
  h.call(who, "POST", `/conversations/${conv}/messages`, { body });
const stop = (who: Person | null, conv: string) => h.call(who, "POST", `/conversations/${conv}/stop`);
const sent = async (who: Person, conv: string, text: string) => {
  const r = await say(who, conv, { text });
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await h.json(r)).data ?? {}) as { id: string; conversation_id: string; job_id: string };
};
const jobsOf = (conv: string) =>
  q<{ id: string; prompt: string; state_id: string; kind: string; stop_requested_at: string | null }>(
    "select id, prompt, state_id, kind, stop_requested_at from bridge_jobs where conversation_id = $1 and deleted_at is null order by created_at, id",
    [conv],
  );
const msgsOf = (conv: string) =>
  q<{ id: string; body: string; kind: string; job_id: string | null }>(
    "select id, body, kind, job_id from messages where conversation_id = $1 and deleted_at is null order by created_at, id",
    [conv],
  );
const audits = (w: World, like: string) =>
  h.count("select count(*) as n from audit_events where tenant_id = $1 and action like $2", [w.tenantId, like]);
const shot = async (w: World) => ({
  convs: await h.count("select count(*) as n from conversations where tenant_id = $1", [w.tenantId]),
  msgs: await h.count("select count(*) as n from messages where tenant_id = $1", [w.tenantId]),
  jobs: await h.count("select count(*) as n from bridge_jobs where tenant_id = $1", [w.tenantId]),
  events: await h.count("select count(*) as n from bridge_job_events where tenant_id = $1", [w.tenantId]),
  audits: await h.count("select count(*) as n from audit_events where tenant_id = $1 and action like '%talk.%'", [
    w.tenantId,
  ]),
  notices: await h.count("select count(*) as n from notifications where tenant_id = $1", [w.tenantId]),
});
const ready = async (label: string, o: { pc?: boolean } = {}) => {
  const w = await h.world(label);
  if (o.pc !== false) await h.pc(w.me);
  return w;
};

describe("K-758 言う（sendConversationMessage）", () => {
  it("K758-API-001 自分の AI との会話に言う：201・答えの鍵は id・conversation_id・job_id の 3 つ。人の言葉の行が 1 つ（本文は言ったとおり・仕事に結ぶ）と待っている仕事が 1 つ（種類 chat）。題の無い会話は最初の言葉の先頭 40 字が題になる。証跡 1（字は入れない）・お知らせ 0", async () => {
    const w = await ready("k758-001");
    const c = await h.conversation(w, w.me, { title: null });
    const text = "セイコー様の 12 月分の見積を確かめて、合計を教えて。";
    const r = await say(w.me, c, { text });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const d = (await h.json(r)).data as Record<string, string>;
    expect(Object.keys(d).sort()).toEqual(["conversation_id", "id", "job_id"]);
    expect(d["conversation_id"]).toBe(c);
    const ms = await msgsOf(c);
    expect(ms).toEqual([{ id: d["id"], body: text, kind: "human", job_id: d["job_id"] }]);
    const js = await jobsOf(c);
    expect(js).toMatchObject([{ id: d["job_id"], kind: "chat", state_id: "queued", prompt: text }]);
    const title = await q<{ title: string }>("select title from conversations where id = $1", [c]);
    expect(title[0]!.title).toBe(text.slice(0, 40));
    expect(await audits(w, "clone_talk.say")).toBe(1);
    const aud = await q<{ payload: unknown }>(
      "select payload from audit_events where tenant_id = $1 and action = 'clone_talk.say'",
      [w.tenantId],
    );
    expect(JSON.stringify(aud[0]!.payload)).not.toContain("セイコー");
    expect((await shot(w)).notices).toBe(0);
  });

  it("K758-API-002 字は書いたとおりに残る：前後の空白・全角・改行・HTML・絵文字・5 万字の文もそのまま（切らない・正規化しない）。NUL を含む字は 422 で何も変わらない", async () => {
    const w = await ready("k758-002");
    const c = await h.conversation(w, w.me);
    const odd = `　全角の空白 ＡＢＣ\n<script>alert(1)</script> 😀 \n 末尾の空白 ${"長".repeat(50_000)} `;
    const s = await sent(w.me, c, odd);
    expect((await msgsOf(c))[0]!.body).toBe(odd);
    expect((await jobsOf(c))[0]!.prompt).toBe(odd);
    expect(s.job_id).toBeTruthy();
    const before = await shot(w);
    const nul = await say(w.me, c, { text: "言う\u0000字" });
    expect(nul.status).toBe(422);
    expect(await shot(w)).toEqual(before);
  });

  it("K758-API-003 形の誤り：text が無い・空・空白だけ（全角も）・文字でない、知らない項目（quote・attachment_ids・permission_mode・context・branch_from）は 422（欄名つき）。何も変わらない", async () => {
    const w = await ready("k758-003");
    const c = await h.conversation(w, w.me);
    const before = await shot(w);
    const bad: [unknown, string][] = [
      [{}, "text"],
      [{ text: "" }, "text"],
      [{ text: "  \n　" }, "text"],
      [{ text: 12 }, "text"],
      [{ text: "言う", quote: { text: "前の返事" } }, "quote"],
      [{ text: "言う", attachment_ids: [randomUUID()] }, "attachment_ids"],
      [{ text: "言う", permission_mode: "auto" }, "permission_mode"],
      [{ text: "言う", context: { screen: "room" } }, "context"],
      [{ text: "言う", branch_from: randomUUID() }, "branch_from"],
    ];
    for (const [body, field] of bad) {
      const r = await say(w.me, c, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      const details = ((await h.json(r))["details"] ?? []) as { field?: string }[];
      expect(
        details.map((d) => d.field),
        JSON.stringify(body),
      ).toContain(field);
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K758-API-004 PC がまだ（つながっている PC が無い）：409・E-TALK-010。行も仕事も証跡も増えない。自分の PC を外した後も同じ（別の人の PC はつながっていても数えない）", async () => {
    const w = await ready("k758-004", { pc: false });
    const c = await h.conversation(w, w.me);
    await h.pc(w.other);
    const before = await shot(w);
    const r = await say(w.me, c, { text: "言う" });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe(PC_NONE);
    expect(await shot(w)).toEqual(before);
    await h.pc(w.me, { revoked: true });
    const again = await say(w.me, c, { text: "言う" });
    expect(again.status).toBe(409);
    expect(await code(again)).toBe(PC_NONE);
    expect(await shot(w)).toEqual(before);
  });

  it("K758-API-005 チケットの会話・作る画面の会話にここから言う（言うのは種類ごとの口で右のパネルと作る画面）：409・E-TALK-011。何も変わらない", async () => {
    const w = await ready("k758-005");
    const t = await h.ticket(w);
    const tc = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    const dc = await h.conversation(w, w.me, { kind: "draft" });
    const before = await shot(w);
    for (const c of [tc, dc]) {
      const r = await say(w.me, c, { text: "言う" });
      expect(r.status, c).toBe(409);
      expect(await code(r), c).toBe(NOT_CLONE);
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K758-API-006 自分の会話でない・無い・消した・別の会社：どれも 404 で同じ体（code と error だけ）。同じグループの別の人の会話も 403 でなく 404。何も変わらない", async () => {
    const w = await ready("k758-006");
    const theirs = await h.conversation(w, w.other);
    const gone = await h.conversation(w, w.me, { deleted: true });
    const foreign = await h.world("k758-006-別の会社");
    const fc = await h.conversation(foreign, foreign.me);
    const before = await shot(w);
    const bodies: string[] = [];
    for (const id of [theirs, gone, fc, randomUUID()]) {
      for (const r of [await say(w.me, id, { text: "言う" }), await stop(w.me, id)]) {
        expect(r.status, id).toBe(404);
        const b = await h.json(r);
        expect(Object.keys(b).sort(), id).toEqual(["code", "error"]);
        expect(b["code"], id).toBe("NOT_FOUND");
        bodies.push(JSON.stringify(b));
      }
    }
    expect(new Set(bodies).size).toBe(1);
    expect(await shot(w)).toEqual(before);
  });

  it("K758-API-007 続けて言う・同時に言う：動いている仕事があっても 201 で次の仕事は待ちに並ぶ（順番に取られる）。同時に 2 つ言うと両方 201・行も仕事も 2 つずつ", async () => {
    const w = await ready("k758-007");
    const c = await h.conversation(w, w.me);
    const running = await h.job(w, w.me, c, { state: "running" });
    const s = await sent(w.me, c, "続けて言う");
    const js = await jobsOf(c);
    expect(js.map((j) => [j.id, j.state_id])).toEqual([
      [running, "running"],
      [s.job_id, "queued"],
    ]);
    const c2 = await h.conversation(w, w.me);
    const rs = await Promise.all([say(w.me, c2, { text: "同時 1" }), say(w.me, c2, { text: "同時 2" })]);
    expect(rs.map((r) => r.status)).toEqual([201, 201]);
    expect((await msgsOf(c2)).map((m) => m.body).sort()).toEqual(["同時 1", "同時 2"]);
    expect(await jobsOf(c2)).toHaveLength(2);
  });

  it("K758-API-008 待っている仕事が 1 つの会話に 20 を超えて並ぶ（終わった・取りやめた仕事は数えない）：21 個目は 409・E-TALK-012 で何も変わらない。空きができれば 201", async () => {
    const w = await ready("k758-008");
    const c = await h.conversation(w, w.me);
    for (let i = 0; i < 5; i++) await h.job(w, w.me, c, { state: "done" });
    for (let i = 0; i < 20; i++) await h.job(w, w.me, c, { state: "queued" });
    const before = await shot(w);
    const r = await say(w.me, c, { text: "21 番目" });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe(TOO_MANY);
    expect(await shot(w)).toEqual(before);
    await h.f.admin.query(
      "update bridge_jobs set state_id = 'cancelled' where id = (select id from bridge_jobs where conversation_id = $1 and state_id = 'queued' limit 1)",
      [c],
    );
    expect((await say(w.me, c, { text: "空きができた" })).status).toBe(201);
  });

  it("K758-API-009 止まった後に続きを言う：201・会話を読むと stopped が消え新しい仕事が待ちに出る。止める前に言った言葉は残る", async () => {
    const w = await ready("k758-009");
    const c = await h.conversation(w, w.me);
    const j = await h.job(w, w.me, c, { state: "stopped", stoppedReason: "あなたが止めました" });
    await h.message(c, { who: "me", text: "前の言葉", jobId: j, minAgo: 5 });
    const before = (await (await h.call(w.me, "GET", `/conversations/${c}`)).json()) as { data: { stopped: unknown } };
    expect(before.data.stopped).toEqual({ job_id: j, reason: "あなたが止めました" });
    const s = await sent(w.me, c, "続きをお願い");
    const after = (await (await h.call(w.me, "GET", `/conversations/${c}`)).json()) as {
      data: { stopped: unknown; running_job_id: string; messages: { text: string }[] };
    };
    expect(after.data.stopped).toBeNull();
    expect(after.data.running_job_id).toBe(s.job_id);
    expect(after.data.messages.map((m) => m.text)).toEqual(["前の言葉", "続きをお願い"]);
  });
});

describe("K-758 止める（stopConversation）", () => {
  it("K758-API-010 動いている仕事を止める：201・state は stopping。止める合図（stop_requested_at）と止めた出来事 1 つ・証跡 1。待っている仕事だけなら cancelled（その場で取りやめ）。動いている物と待っている物が両方あれば、両方止まる（待っている物は取りやめ）", async () => {
    const w = await ready("k758-010");
    const c = await h.conversation(w, w.me);
    const run = await h.job(w, w.me, c, { state: "running" });
    const wait = await h.job(w, w.me, c, { state: "queued" });
    const r = await stop(w.me, c);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    expect(((await h.json(r)).data as Row)["state"]).toBe("stopping");
    const js = await jobsOf(c);
    expect(js.find((j) => j.id === run)).toMatchObject({ state_id: "running" });
    expect(js.find((j) => j.id === run)!.stop_requested_at).not.toBeNull();
    expect(js.find((j) => j.id === wait)).toMatchObject({ state_id: "cancelled" });
    expect(
      await h.count("select count(*) as n from bridge_job_events where job_id = $1 and kind = 'stop'", [run]),
    ).toBe(1);
    expect(await audits(w, "talk.stop")).toBe(1);
    const c2 = await h.conversation(w, w.me);
    const only = await h.job(w, w.me, c2, { state: "queued" });
    expect(((await h.json(await stop(w.me, c2))).data as Row)["state"]).toBe("cancelled");
    expect((await jobsOf(c2))[0]).toMatchObject({ id: only, state_id: "cancelled" });
  });

  it("K758-API-011 止める物が無い（何も動いていない・終わった・止まった仕事だけ）：201・state は none。何も書かない（証跡も出来事も増えない）", async () => {
    const w = await ready("k758-011");
    const c = await h.conversation(w, w.me);
    await h.job(w, w.me, c, { state: "done" });
    await h.job(w, w.me, c, { state: "stopped" });
    const before = await shot(w);
    const r = await stop(w.me, c);
    expect(r.status).toBe(201);
    expect(((await h.json(r)).data as Row)["state"]).toBe("none");
    expect(await shot(w)).toEqual(before);
  });

  it("K758-API-012 二度押し・同時に押す：どちらも 201 で stopping。止めた出来事と証跡は 1 つだけ（2 回目は何も足さない）", async () => {
    const w = await ready("k758-012");
    const c = await h.conversation(w, w.me);
    const run = await h.job(w, w.me, c, { state: "running" });
    const rs = await Promise.all([stop(w.me, c), stop(w.me, c)]);
    expect(rs.map((r) => r.status)).toEqual([201, 201]);
    expect(await stop(w.me, c)).toHaveProperty("status", 201);
    expect(
      await h.count("select count(*) as n from bridge_job_events where job_id = $1 and kind = 'stop'", [run]),
    ).toBe(1);
    expect(await audits(w, "talk.stop")).toBe(1);
  });

  it("K758-API-013 チケットの会話・作る画面の会話を止める：どちらも止まる（stopping／cancelled）。ほかの人の会話の仕事は止まらない", async () => {
    const w = await ready("k758-013");
    const t = await h.ticket(w);
    const tc = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    const dc = await h.conversation(w, w.me, { kind: "draft" });
    const theirs = await h.conversation(w, w.other);
    const tj = await h.job(w, w.me, tc, { state: "running" });
    const dj = await h.job(w, w.me, dc, { state: "queued" });
    const oj = await h.job(w, w.other, theirs, { state: "running" });
    expect(((await h.json(await stop(w.me, tc))).data as Row)["state"]).toBe("stopping");
    expect(((await h.json(await stop(w.me, dc))).data as Row)["state"]).toBe("cancelled");
    const rows = await q<{ id: string; state_id: string; stop_requested_at: string | null }>(
      "select id, state_id, stop_requested_at from bridge_jobs where id = any($1)",
      [[tj, dj, oj]],
    );
    const by = Object.fromEntries(rows.map((x) => [x.id, x]));
    expect(by[tj]!.stop_requested_at).not.toBeNull();
    expect(by[dj]!.state_id).toBe("cancelled");
    expect(by[oj]).toMatchObject({ state_id: "running", stop_requested_at: null });
  });

  it("K758-API-014 PC がつながっていない・印を外した後に止める：201・stopping（止める合図は DB に立つだけ）", async () => {
    const w = await ready("k758-014", { pc: false });
    const c = await h.conversation(w, w.me);
    const run = await h.job(w, w.me, c, { state: "running" });
    const r = await stop(w.me, c);
    expect(r.status).toBe(201);
    expect(((await h.json(r)).data as Row)["state"]).toBe("stopping");
    expect((await jobsOf(c))[0]!.id).toBe(run);
  });
});

describe("K-758 失敗・守り", () => {
  it("K758-API-015 S1・S3 の失敗：DB の関数が使えない（言う・止める）：503・E-PAGE-003。行・仕事・出来事・証跡は何も変わらない", async () => {
    const w = await ready("k758-015");
    const c = await h.conversation(w, w.me);
    await h.job(w, w.me, c, { state: "running" });
    const before = await shot(w);
    for (const [fn, run] of [
      ["app.clone_talk_say(uuid, uuid, text)", () => say(w.me, c, { text: "言う" })],
      ["app.talk_stop(uuid, uuid)", () => stop(w.me, c)],
    ] as const) {
      await h.f.admin.query(`revoke execute on function ${fn} from kaname_app`);
      try {
        const r = await run();
        expect(r.status, fn).toBe(503);
        expect(await code(r), fn).toBe("E-PAGE-003");
      } finally {
        await h.f.admin.query(`grant execute on function ${fn} to kaname_app`);
      }
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K758-API-016 S2・S4 の失敗：証跡の書き込みが失敗：503・E-PAGE-003。同じ取引なので人の言葉の行も仕事も残らない。言った字はログに出ない", async () => {
    const w = await ready("k758-016");
    const c = await h.conversation(w, w.me);
    const before = await shot(w);
    await h.f.admin.query(
      `create or replace function public.k758_fail_audit() returns trigger language plpgsql as $$
       begin if new.action like 'clone_talk.%' or new.action = 'talk.stop' then raise exception 'K-758 試験：証跡が書けない'; end if; return new; end $$`,
    );
    await h.f.admin.query(
      "create trigger k758_fail_audit before insert on audit_events for each row execute function public.k758_fail_audit()",
    );
    try {
      const logs = await h.captureLogs(async () => {
        const r = await say(w.me, c, { text: "ひみつの言葉 SECRET-758" });
        expect(r.status).toBe(503);
        expect(await code(r)).toBe("E-PAGE-003");
      });
      expect(logs).not.toContain("SECRET-758");
      const run = await h.job(w, w.me, c, { state: "running" });
      const st = await stop(w.me, c);
      expect(st.status).toBe(503);
      expect(await code(st)).toBe("E-PAGE-003");
      const flag = await q<{ stop_requested_at: string | null }>(
        "select stop_requested_at from bridge_jobs where id = $1",
        [run],
      );
      expect(flag[0]!.stop_requested_at).toBeNull();
    } finally {
      await h.f.admin.query("drop trigger if exists k758_fail_audit on audit_events");
      await h.f.admin.query("drop function if exists public.k758_fail_audit()");
    }
    expect(await shot(w)).toEqual({ ...before, jobs: before.jobs + 1 });
  });

  it("K758-API-017 DB の関数の守り（2 層目）：app.talk_enqueue は他人の会話に呼ぶと { error: not_found }・種類違いは kind_mismatch・PC が無いと no_pc。security definer で public から外し kaname_app だけ。成功すると { conversation_id, job_id, message_id }", async () => {
    const w = await ready("k758-017");
    const c = await h.conversation(w, w.me);
    const t = await h.ticket(w);
    const tc = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    const call = async (member: string, conv: string, kind: string) =>
      (
        await q<{ v: Row }>("select app.talk_enqueue($1, $2, $3, '直に', null, $4::jsonb) as v", [
          member,
          conv,
          kind,
          JSON.stringify({ passed: ["title"] }),
        ])
      )[0]!.v;
    expect(await call(w.other.id, c, "clone")).toEqual({ error: "not_found" });
    expect(await call(w.me.id, randomUUID(), "clone")).toEqual({ error: "not_found" });
    expect(await call(w.me.id, tc, "clone")).toEqual({ error: "kind_mismatch" });
    const ok = await call(w.me.id, c, "clone");
    expect(Object.keys(ok).sort()).toEqual(["conversation_id", "job_id", "message_id"]);
    const opt = await q<{ options: Row }>("select options from messages where id = $1", [ok["message_id"]]);
    expect(opt[0]!.options).toEqual({ passed: ["title"] });
    const w2 = await ready("k758-017-pc無し", { pc: false });
    const c2 = await h.conversation(w2, w2.me);
    expect(await call(w2.me.id, c2, "clone")).toEqual({ error: "no_pc" });
    const meta = await q<{ secdef: boolean; pub: boolean }>(
      `select p.prosecdef as secdef, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('talk_enqueue', 'clone_talk_say', 'talk_stop')`,
    );
    expect(meta).toHaveLength(3);
    for (const x of meta) expect(x).toEqual({ secdef: true, pub: false });
  });

  it("K758-API-018 ログインしていない：401。上限（1 分に 61 回）：429 と待つ秒数", async () => {
    const w = await ready("k758-018");
    const c = await h.conversation(w, w.me);
    expect((await say(null, c, { text: "言う" })).status).toBe(401);
    expect((await stop(null, c)).status).toBe(401);
    const saved = h.f.limits["stopConversation"];
    delete h.f.limits["stopConversation"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await stop(w.me, c);
      expect(last!.status).toBe(429);
      const sec = Number((await h.json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) h.f.limits["stopConversation"] = saved;
    }
  });
});
