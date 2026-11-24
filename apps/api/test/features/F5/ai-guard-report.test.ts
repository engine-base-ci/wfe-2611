// K-738「AI が「守れていなかったので直した」と知らせる道具 guard_report」の単体の試験（DB の関数 app.ticket_tool_guard_report・道具の口の部品・本物の Postgres）。
//   行 ID は K738-API-NNN（チケット 11_tickets/K-738.md の表の行と 1 対 1）。名前の決めは K-736 の spec_check と段 10 の K-700（app.knowledge_record_breach）。
//   AI の道具は人の要求の文脈を持たない（鍵と PC の印で動く）ので、DB の関数は管理の接続で直に呼ぶ。口を通した全体（取る → 道具 → 数える）は中間 K-770・段 10 の K-714。
//   土台は段 10 の K-700 が運ぶ F9/knowledge.guard-kit.ts（会社・チケット・必ず守るの確認項目・数えた行・やり取りの行）と K-687 の knowledge.requests-kit.ts。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupKnowledge } from "../F9/knowledge.harness.js";
import { audits, breakWrites, num } from "../F9/knowledge.requests-kit.js";
import {
  aiCheck,
  breachLines,
  breachRows,
  guardSpec,
  mkTicket,
  pubPage,
  scene,
  type Scene,
} from "../F9/knowledge.guard-kit.js";
import {
  guardReportAnswer,
  parseGuardReportInput,
  runGuardReport,
} from "../../../src/features/F5/delegate/guard-report.js";
import { toolsFor } from "../../../src/features/F5/delegate/tools.js";

const h = setupKnowledge();
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const q = async <T>(sql: string, p: unknown[] = []): Promise<T[]> => (await h.admin.query(sql, p)).rows as T[];

interface Run {
  job: string;
  token: string;
  session: string;
}
/** チケットの仕事（kind=ticket・実行の記録つき・受け取った PC つき・道具の鍵つき）か会話の仕事を、走っている形で置く */
const mkRun = async (s: Scene, kind: "ticket" | "chat" = "ticket", ticket: string = s.ticket): Promise<Run> => {
  const token = randomUUID() + randomUUID();
  const session = (
    await q<{ id: string }>(
      "insert into sessions (tenant_id, member_id, kind_id, device_label) values ($1, $2, 'bridge', 'PC') returning id",
      [s.w.co.tenantId, s.w.mem1.id],
    )
  )[0]!.id;
  const job = (
    await q<{ id: string }>(
      `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, started_at, taken_session_id, tool_token_hash)
       values ($1, $2, $3, $4, 'running', '試験', now(), $5, $6) returning id`,
      [s.w.co.tenantId, s.w.g1, s.w.mem1.id, kind, session, sha(token)],
    )
  )[0]!.id;
  if (kind === "ticket")
    await h.admin.query(
      "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, started_at, created_by) values ($1, $2, $3, 'make', 'running', $4, now(), $5)",
      [s.w.co.tenantId, s.w.g1, ticket, job, s.w.mem1.id],
    );
  return { job, token, session };
};
type V = Record<string, unknown> | null;
const report = async (
  r: Run,
  spec: string,
  note: unknown = null,
  o: { token?: string; session?: string } = {},
): Promise<V> =>
  (
    await q<{ v: V }>("select app.ticket_tool_guard_report($1, $2, $3, $4, $5) as v", [
      r.job,
      sha(o.token ?? r.token),
      o.session ?? r.session,
      spec,
      note,
    ])
  )[0]!.v;
const toolAudits = async (s: Scene): Promise<number> =>
  num(h, "select count(*) as n from audit_events where tenant_id = $1 and action = 'tool.guard_report'", [
    s.w.co.tenantId,
  ]);
const nothing = async (s: Scene): Promise<void> => {
  expect(await breachRows(h, s.ticket)).toEqual([]);
  expect(await breachLines(h, s.ticket)).toEqual([]);
  expect(await audits(h, s.w, "knowledge.breach.record")).toEqual([]);
  expect(await toolAudits(s)).toBe(0);
};

/** 試し打ちの phase にする（K-746 の migration が要る。無ければ check の違反の文を出さずに分かる文で落とす） */
const toDryRun = async (job: string): Promise<void> => {
  try {
    await h.admin.query("update action_runs set phase = 'dry_run' where bridge_job_id = $1", [job]);
  } catch {
    throw new Error("試し打ちの phase がまだ入っていない（K-746 の migration の前）");
  }
};

describe("K-738 守れていなかったと知らせる（DB の関数 app.ticket_tool_guard_report）", () => {
  it("K738-API-001 必ず守るから入った確認項目を指して知らせると、ai_self_reported が 1 つ数えられ、やり取りに「AI が直しました」の行・証跡 2 つ（道具の呼び出し・数えた）。答えは ok・id・counted", async () => {
    await h.ready();
    const s = await scene(h, "k738-001");
    const r = await mkRun(s);
    const v = await report(r, s.specs.co, "請求書を送る前に PDF の合計を見直した");
    expect(v).toEqual({ ok: true, id: s.specs.co, counted: true });
    const rows = await breachRows(h, s.ticket);
    expect(rows.map((x) => `${x.page_id}|${x.test_spec_id}|${x.kind}`)).toEqual([
      `${s.pages.co}|${s.specs.co}|ai_self_reported`,
    ]);
    const ls = await breachLines(h, s.ticket);
    expect(ls).toHaveLength(1);
    expect(ls[0]).toMatchObject({ kind: "change", author_member_id: null });
    expect(ls[0]!.changes[0]).toMatchObject({
      from: "ai_self_reported",
      to: "請求書の送り方",
      note: "請求書を送る前に PDF の合計を見直した",
      page_id: s.pages.co,
    });
    expect(ls[0]!.body).toContain("AI が直しました");
    expect(await toolAudits(s)).toBe(1);
    expect((await audits(h, s.w, "knowledge.breach.record")).length).toBe(1);
  });

  it("K738-API-002 理由は任意：無い・null・空白だけ（全角・タブ・改行も）は理由なしで数える。前後の空白は落として残す。ちょうど 200 字は通り、201 字は {error: note} で何も書かない", async () => {
    await h.ready();
    const s = await scene(h, "k738-002");
    const r = await mkRun(s);
    expect(await report(r, s.specs.co)).toMatchObject({ ok: true, counted: true });
    expect((await breachLines(h, s.ticket))[0]!.changes[0]!.note).toBeNull();
    const s2 = await scene(h, "k738-002b");
    const r2 = await mkRun(s2);
    expect(await report(r2, s2.specs.gp, " \n\t　")).toMatchObject({ counted: true });
    expect((await breachLines(h, s2.ticket))[0]!.changes[0]!.note).toBeNull();
    const s3 = await scene(h, "k738-002c");
    const r3 = await mkRun(s3);
    expect(await report(r3, s3.specs.me, "  直しました  ")).toMatchObject({ counted: true });
    expect((await breachLines(h, s3.ticket))[0]!.changes[0]!.note).toBe("直しました");
    const s4 = await scene(h, "k738-002d");
    const r4 = await mkRun(s4);
    expect(await report(r4, s4.specs.co, "あ".repeat(201))).toEqual({ error: "note" });
    await nothing(s4);
    expect(await report(r4, s4.specs.co, "あ".repeat(200))).toMatchObject({ counted: true });
  });

  it("K738-API-003 同じチケット・同じページを 2 度知らせても二重に数えない：2 度目は ok・counted false・行もやり取りも増えない（道具の呼び出しの証跡だけ増える）", async () => {
    await h.ready();
    const s = await scene(h, "k738-003");
    const r = await mkRun(s);
    expect(await report(r, s.specs.co, "1 回目")).toMatchObject({ counted: true });
    expect(await report(r, s.specs.co, "2 回目")).toEqual({ ok: true, id: s.specs.co, counted: false });
    expect(await breachRows(h, s.ticket)).toHaveLength(1);
    expect(await breachLines(h, s.ticket)).toHaveLength(1);
    expect((await audits(h, s.w, "knowledge.breach.record")).length).toBe(1);
    expect(await toolAudits(s)).toBe(2);
    // 別の仕事・別のページは別に数える
    const r2 = await mkRun(s);
    expect(await report(r2, s.specs.co)).toMatchObject({ counted: false });
    expect(await report(r2, s.specs.gp)).toMatchObject({ counted: true });
    expect(await breachRows(h, s.ticket)).toHaveLength(2);
  });

  it("K738-API-004 数えない確認項目：出どころが knowledge でない（人が足した）・別のチケットの項目・消した項目・別の会社の項目・無い id は {error: not_found}（何も書かない）", async () => {
    await h.ready();
    const s = await scene(h, "k738-004");
    const r = await mkRun(s);
    const manual = await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, {
      source: "manual",
      title: "人が足した確認",
    });
    const gone = await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, { deleted: true });
    const t2 = await mkTicket(h, s.w, s.w.g1, s.w.mem1);
    const other = await guardSpec(h, s.w, t2, s.pages.co, s.w.mem1);
    const o = await scene(h, "k738-004-other");
    for (const spec of [manual, gone, other, o.specs.co, randomUUID()])
      expect(await report(r, spec)).toEqual({ error: "not_found" });
    await nothing(s);
    await nothing(o);
  });

  it("K738-API-005 今は必ず守るで効かない行（必ず守るが外れた・ページが消えた・まだ公開していない・効く範囲の外）は、ok・counted false（数えない・やり取りも書かない）。道具の呼び出しの証跡は残る", async () => {
    await h.ready();
    const s = await scene(h, "k738-005");
    const r = await mkRun(s);
    await h.admin.query("update knowledge_pages set is_must = false where id = $1", [s.pages.co]);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [s.pages.gp]);
    const other = await pubPage(h, s.w.g2, s.w.mem2, "開発の型", { must: true });
    const outSpec = await guardSpec(h, s.w, s.ticket, other, s.w.mem1);
    for (const spec of [s.specs.co, s.specs.gp, outSpec])
      expect(await report(r, spec)).toEqual({ ok: true, id: spec, counted: false });
    expect(await breachRows(h, s.ticket)).toEqual([]);
    expect(await breachLines(h, s.ticket)).toEqual([]);
    expect(await toolAudits(s)).toBe(3);
  });

  it("K738-API-006 チェックには触らない：チェックの無い行・AI が付けた行・人が付けた行のどれを指しても、checked_at・checked_by_ai・版・根拠は前のまま（外す道も付ける道も無い）", async () => {
    await h.ready();
    const s = await scene(h, "k738-006");
    const r = await mkRun(s);
    await aiCheck(h, s.specs.gp);
    const human = await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, { by: "human" });
    const snap = async () =>
      q(
        "select id, checked_at, checked_by_ai, checked_by_member_id, version from test_specs where ticket_id = $1 order by id",
        [s.ticket],
      );
    const before = await snap();
    for (const spec of [s.specs.co, s.specs.gp, human]) await report(r, spec, "直した");
    expect(await snap()).toEqual(before);
    const def = (
      await q<{ args: string }>(
        "select pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'ticket_tool_guard_report'",
      )
    )[0]!;
    expect(def.args).toBe("p_job uuid, p_token_hash text, p_session uuid, p_spec uuid, p_note text");
  });

  it("K738-API-007 鍵と PC の印を DB でも見る：鍵のハッシュ違い・ほかの PC・終わった仕事・動いていない仕事・会話の仕事・試し打ち（phase dry_run）の仕事は null で何も書かない。正しい呼び方は通る", async () => {
    await h.ready();
    const s = await scene(h, "k738-007");
    const r = await mkRun(s);
    const otherSession = (
      await q<{ id: string }>(
        "insert into sessions (tenant_id, member_id, kind_id, device_label) values ($1, $2, 'bridge', 'ほかの PC') returning id",
        [s.w.co.tenantId, s.w.mem1.id],
      )
    )[0]!.id;
    expect(await report(r, s.specs.co, null, { token: "別の鍵" })).toBeNull();
    expect(await report(r, s.specs.co, null, { session: otherSession })).toBeNull();
    const chat = await mkRun(s, "chat");
    expect(await report(chat, s.specs.co)).toBeNull();
    await h.admin.query("update bridge_jobs set state_id = 'done', finished_at = now() where id = $1", [r.job]);
    expect(await report(r, s.specs.co)).toBeNull();
    await nothing(s);
    // 試し打ち（最新の実行が phase dry_run）の仕事は確認項目を変えない仕事：null で何も書かない
    const dry = await mkRun(s);
    await toDryRun(dry.job);
    expect(await report(dry, s.specs.co)).toBeNull();
    await nothing(s);
    const live = await mkRun(s);
    expect(await report(live, s.specs.co)).toMatchObject({ ok: true, counted: true });
  });

  it("K738-API-008 仕事の持ち主が止められた・チケットを直せなくなった・チケットが消された後は null で何も書かない（口座状態の波及・G-14）", async () => {
    await h.ready();
    const a = await scene(h, "k738-008a");
    const ra = await mkRun(a);
    await h.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [a.w.mem1.id]);
    expect(await report(ra, a.specs.co)).toBeNull();
    await nothing(a);
    const b = await scene(h, "k738-008b");
    const rb = await mkRun(b);
    await h.admin.query("update tickets set deleted_at = now() where id = $1", [b.ticket]);
    expect(await report(rb, b.specs.co)).toBeNull();
    await nothing(b);
  });

  it("K738-API-009 知らせた直後に仕事が終わっても数えは残り、終わりを知らせる時の数え（K-700 の引き金）と重ならない：先に知らせた行は、仕事の終わりで「チェックが無い」と数え直されても別の種類（ai_unchecked）として 1 つずつ", async () => {
    await h.ready();
    const s = await scene(h, "k738-009");
    const r = await mkRun(s);
    expect(await report(r, s.specs.co, "直した")).toMatchObject({ counted: true });
    await h.admin.query(
      "update bridge_jobs set state_id = 'done', result = '終わりました', finished_at = now() where id = $1",
      [r.job],
    );
    const kinds = (await breachRows(h, s.ticket)).map((x) => `${x.test_spec_id}|${x.kind}`).sort();
    expect(kinds).toEqual(
      [
        `${s.specs.co}|ai_self_reported`,
        `${s.specs.co}|ai_unchecked`,
        `${s.specs.gp}|ai_unchecked`,
        `${s.specs.me}|ai_unchecked`,
      ].sort(),
    );
  });

  it("K738-API-010 証跡：道具の呼び出し tool.guard_report は 1 回につき 1 行（actor は仕事の持ち主・payload は job_id だけ）。理由の字・題名は証跡にもやり取りの証跡にも入らない", async () => {
    await h.ready();
    const s = await scene(h, "k738-010");
    const r = await mkRun(s);
    await report(r, s.specs.co, "秘密めいた理由の字");
    const a = await q<{ actor_member_id: string; payload: Record<string, unknown>; target_type: string }>(
      "select actor_member_id, payload, target_type from audit_events where tenant_id = $1 and action = 'tool.guard_report'",
      [s.w.co.tenantId],
    );
    expect(a).toHaveLength(1);
    expect(a[0]!.actor_member_id).toBe(s.w.mem1.id);
    expect(a[0]!.payload).toEqual({ job_id: r.job });
    const all = await q<{ payload: unknown }>("select payload from audit_events where tenant_id = $1", [
      s.w.co.tenantId,
    ]);
    expect(JSON.stringify(all)).not.toContain("秘密めいた");
    expect(JSON.stringify(all)).not.toContain("請求書の送り方");
  });

  it("K738-API-011 S1 の失敗・数える所で落ちたら全部戻る（失敗）：数えた行・やり取り・証跡のどれも残らず、DB の例外になる。口は 503・E-PAGE-003（ログに理由・題名・id を出さない）", async () => {
    await h.ready();
    const s = await scene(h, "k738-011");
    const r = await mkRun(s);
    const restore = await breakWrites(h, "knowledge_breaches", s.w.co.tenantId);
    try {
      await expect(report(r, s.specs.co, "秘密めいた理由")).rejects.toThrow();
      const logs = await h.captureLogs(async () => {
        const reply = await runGuardReport(h.pool as never, {
          job: r.job,
          tokenHash: sha(r.token),
          session: r.session,
          spec: s.specs.co,
          note: "秘密めいた理由",
        });
        expect(reply.status).toBe(503);
        expect((reply.body as { code: string }).code).toBe("E-PAGE-003");
      });
      expect(logs).not.toContain("秘密めいた");
      expect(logs).not.toContain(s.specs.co);
    } finally {
      await restore();
    }
    await nothing(s);
  });
});

describe("K-738 道具の口の部品（TS）", () => {
  it("K738-API-012 道具 guard_report はチケットの仕事にだけ出る（ticket_read・spec_check と並ぶ）。会話の仕事・ログインの試しには出ない", () => {
    const t = toolsFor({ kind: "ticket", conversation_id: null });
    expect(t).toContain("guard_report");
    expect(t).toContain("ticket_read");
    expect(toolsFor({ kind: "chat", conversation_id: "c1" })).not.toContain("guard_report");
    expect(toolsFor({ kind: "login_check", conversation_id: null })).toEqual([]);
  });

  it("K738-API-013 入力は spec_id（uuid）と note（文字・任意）だけを読む。spec_id が無い・文字でない・uuid でないは 422（欄 spec_id）・note が文字でないは 422（欄 note）。知らない欄は捨て、大文字の uuid は小文字にして通す", () => {
    const id = randomUUID();
    expect(parseGuardReportInput({ spec_id: id })).toEqual({ ok: true, spec_id: id, note: null });
    expect(parseGuardReportInput({ spec_id: id.toUpperCase(), note: "直した", extra: 1 })).toEqual({
      ok: true,
      spec_id: id,
      note: "直した",
    });
    for (const bad of [{}, { spec_id: 1 }, { spec_id: "abc" }, { spec_id: null }, null]) {
      const r = parseGuardReportInput(bad as never);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reply).toMatchObject({ status: 422, body: { details: [{ field: "spec_id" }] } });
    }
    for (const bad of [1, true, {}, ["a"]]) {
      const r = parseGuardReportInput({ spec_id: id, note: bad } as never);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reply).toMatchObject({ status: 422, body: { details: [{ field: "note" }] } });
    }
  });

  it("K738-API-014 答えの形：数えた・もう数えていた 201 の data.result（ok・id・counted の 3 鍵）／鍵・PC・仕事の状態が合わない null は 403／{error: not_found} は 404（欄も details も付けない）／{error: note} は 422（欄 note）", () => {
    const ok = guardReportAnswer({ ok: true, id: "s", counted: false });
    expect(ok.status).toBe(201);
    const result = (ok.body as { data: { result: Record<string, unknown> } }).data.result;
    expect(Object.keys(result).sort()).toEqual(["counted", "id", "ok"]);
    expect(guardReportAnswer(null)).toMatchObject({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
    expect(guardReportAnswer({ error: "not_found" })).toEqual({
      status: 404,
      body: { error: "not_found", code: "NOT_FOUND" },
    });
    expect(guardReportAnswer({ error: "note" })).toMatchObject({
      status: 422,
      body: { details: [{ field: "note", message: "200 字までです" }] },
    }); // AI が短く書き直して呼び直せる字（K-737 が欄名つきで AI に返す）
  });

  it("K738-API-015 DB が落ちたら 503（E-PAGE-003）。理由・題名・id をログに出さず、何も残さない", async () => {
    await h.ready();
    const pool = {
      query: async () => {
        throw new Error("接続できません 秘密めいた題名");
      },
    };
    const logs = await h.captureLogs(async () => {
      const r = await runGuardReport(pool as never, {
        job: randomUUID(),
        tokenHash: sha("t"),
        session: randomUUID(),
        spec: randomUUID(),
        note: "秘密めいた理由",
      });
      expect(r.status).toBe(503);
      expect((r.body as { code: string }).code).toBe("E-PAGE-003");
    });
    expect(logs).not.toContain("秘密めいた");
  });

  it("K738-DB-001 DB の形：app.ticket_tool_guard_report は kaname_app だけが実行できる。数える関数 app.knowledge_record_breach は前のまま誰にも渡さない（人の口からは数えられない）", async () => {
    const acl = await q<{ name: string; app: boolean; pub: boolean }>(
      `select p.proname as name, has_function_privilege('kaname_app', p.oid, 'execute') as app, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('ticket_tool_guard_report', 'knowledge_record_breach') order by 1`,
    );
    expect(acl).toEqual([
      { name: "knowledge_record_breach", app: false, pub: false },
      { name: "ticket_tool_guard_report", app: true, pub: false },
    ]);
  });
});
