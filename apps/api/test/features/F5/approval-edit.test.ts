// K-742「自分で直す（editApproval：承認する人が成果物の字を直すと新しい版・承認待ちのまま・やり取りに 1 行）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K742-API-…）は 11_tickets/K-742.md の行の表と 1 対 1。土台は K-63 の F5/approve-complete.harness.ts と K-732 が持ち込む F5/approval-more.kit.ts。
// 口：POST /api/v1/approvals/:id/edit ← { text, version } → 201 { data: { id, ticket_id, version, edited_at } }。version は直す前に読んだ成果物の版（先に変わっていたら 409）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  setupApproveComplete,
  CONF_DONE,
  ARTIFACT,
  f,
  T,
  boss,
  writer,
  manager,
  outsider,
  json,
  one,
  num,
  req,
  auth,
  approve,
  giveBack,
  stageKeyOf,
  ticket,
  delegated,
  approvalRow,
  messagesOf,
  snapshot,
  breakWritable,
  jobOf,
  runsOf,
} from "./approve-complete.harness.js";
import { loadHook, editApproval, stopApproval } from "./approval-more.kit.js";

setupApproveComplete();

const STALE = "E-APR-020";
const SAME = "E-APR-021";
const NEW_TEXT = "株式会社サンプル 御中\n11 月分の請求書を、金額を直してお送りします。";

const section = async (t: string) =>
  one<{ id: string; version: number; text: string }>(
    "select id, version, body->>'text' as text from ticket_sections where ticket_id = $1 and section_key = 'artifacts'",
    [t],
  );
const versionRows = (sectionId: string) =>
  f.admin
    .query<{ version: number; text: string; edited_by: string; edited_by_clone: boolean }>(
      "select version, body->>'text' as text, edited_by, edited_by_clone from ticket_section_versions where section_id = $1 order by version",
      [sectionId],
    )
    .then((r) => r.rows);
const lines = async (t: string) => (await messagesOf(t)).filter((m) => m.body.includes("が成果物を直しました"));
const audits = (id: string) =>
  num("select count(*) as n from audit_events where action = 'approval.self_edit' and target_id = $1", [id]);
const code = async (r: Response) => (await json(r))["code"];
const edit = (p: typeof boss, id: string, text: unknown, version: unknown) => editApproval(p, id, { text, version });

describe("K-742 自分で直す：状態 × 入口 × 利用者の状態", () => {
  it("K742-API-001 承認待ち × 自分で直す × 承認する人：201。成果物の新しい版（版 2・直した字）ができ、承認待ちのまま（一覧に残り・段は承認待ち）、やり取りと証跡に 1 つずつ（証跡に字は入れない）。再取得でも新しい字", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const s0 = await section(t.id);
    const r = await edit(boss, d.approvalId, NEW_TEXT, s0.version);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = (await json(r)).data as Record<string, unknown>;
    expect(Object.keys(v).sort()).toEqual(["edited_at", "id", "ticket_id", "version"]);
    expect(v).toMatchObject({ id: d.approvalId, ticket_id: t.id, version: s0.version + 1 });
    const s1 = await section(t.id);
    expect(s1).toMatchObject({ version: s0.version + 1, text: NEW_TEXT });
    const vr = await versionRows(s1.id);
    expect(vr.at(-1)).toMatchObject({
      version: s0.version + 1,
      text: NEW_TEXT,
      edited_by: boss.id,
      edited_by_clone: false,
    });
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null, status_id: "pending" });
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    const l = await lines(t.id);
    expect(l).toHaveLength(1);
    expect(l[0]!.body).toContain(`高本が成果物を直しました（版 ${s0.version + 1}）`);
    expect(await audits(d.approvalId)).toBe(1);
    const aud = await one<{ payload: unknown }>(
      "select payload from audit_events where action = 'approval.self_edit' and target_id = $1",
      [d.approvalId],
    );
    expect(JSON.stringify(aud.payload)).not.toContain("請求書");
    const q = (await json(await req("GET", "/approvals/queue", { headers: auth(boss) }))).data as { id: string }[];
    expect(q.map((x) => x.id)).toContain(d.approvalId);
    const got = (await json(await req("GET", `/approvals/${d.approvalId}`, { headers: auth(boss) }))).data as {
      artifact_version: { version: number; text: string };
    };
    expect(got.artifact_version).toMatchObject({ version: s0.version + 1, text: NEW_TEXT });
  });

  it("K742-API-002 字は書いたとおりに残る：前後の空白・全角・改行・HTML・長い絵文字の文もそのまま（正規化も切りもしない）。NUL を含む字は 422 で何も変わらない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const odd = "　全角の空白 ＡＢＣ\n<script>alert(1)</script> 😀 \n 末尾の空白 ";
    const r = await edit(boss, d.approvalId, odd, (await section(t.id)).version);
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await section(t.id)).text).toBe(odd);
    const before = await snapshot(t);
    const nul = await edit(boss, d.approvalId, "直した\u0000字", (await section(t.id)).version);
    expect(nul.status).toBe(422);
    expect(await snapshot(t)).toEqual(before);
    expect((await section(t.id)).text).toBe(odd);
  });

  it("K742-API-003 先にほかの人が直していた（直す前に読んだ版が古い）：409・E-APR-020（今の版を答えに載せる）。何も変わらない。同じ版で同時に 2 つ：1 つだけ通る [201, 409]・版は 1 つだけ増える", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const v1 = (await section(t.id)).version;
    expect((await edit(boss, d.approvalId, "1 回目の直し", v1)).status).toBe(201);
    const stale = await edit(boss, d.approvalId, "古い版のまま直す", v1);
    expect(stale.status).toBe(409);
    expect(await code(stale)).toBe(STALE);
    expect((await json(stale))["current_version"]).toBe(v1 + 1);
    expect((await section(t.id)).text).toBe("1 回目の直し");
    const now = (await section(t.id)).version;
    const rs = await Promise.all([
      edit(boss, d.approvalId, "同時の A", now),
      edit(boss, d.approvalId, "同時の B", now),
    ]);
    expect(rs.map((x) => x.status).sort()).toEqual([201, 409]);
    expect((await section(t.id)).version).toBe(now + 1);
    expect(await lines(t.id)).toHaveLength(2);
    expect(await audits(d.approvalId)).toBe(2);
  });

  it("K742-API-004 字が空・空白だけ（全角の空白も）：契約の形の誤りとして 422（欄 text・何も変わらない）。長さの上限は置かない（D-130.3）：25 万字の字も 201 で書いたとおりに残る", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const v = (await section(t.id)).version;
    for (const empty of ["", "   ", "\n\t　 "]) {
      const r = await edit(boss, d.approvalId, empty, v);
      expect(r.status, JSON.stringify(empty)).toBe(422);
      expect(((await json(r))["details"] as { field: string }[] | undefined)?.some((x) => x.field === "text")).toBe(
        true,
      );
    }
    expect((await section(t.id)).version).toBe(v);
    const long = "a".repeat(250_000);
    const ok = await edit(boss, d.approvalId, long, v);
    expect(ok.status, await ok.clone().text()).toBe(201);
    expect((await section(t.id)).text).toBe(long);
  });

  it("K742-API-005 今の字と同じ字を送る（何も変えていない）：409・E-APR-021（今の成果物の状態で決まるので 409）。版は増えず、やり取りも証跡も増えない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const s = await section(t.id);
    const r = await edit(boss, d.approvalId, ARTIFACT, s.version);
    expect(r.status).toBe(409);
    expect(await code(r)).toBe(SAME);
    expect((await section(t.id)).version).toBe(s.version);
    expect(await lines(t.id)).toHaveLength(0);
    expect(await audits(d.approvalId)).toBe(0);
  });

  it("K742-API-006 承認する人でない人（書ける人・任せた人・マネージャー）：403。別の会社の人・無い id・消したチケットの承認：404。どれも何も変わらない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const v = (await section(t.id)).version;
    const before = await snapshot(t);
    for (const p of [writer, d.by, manager]) expect((await edit(p, d.approvalId, "他の人の直し", v)).status).toBe(403);
    expect((await edit(outsider, d.approvalId, "別の会社の直し", v)).status).toBe(404);
    expect((await edit(boss, randomUUID(), "無い承認", v)).status).toBe(404);
    expect(await snapshot(t)).toEqual(before);
    expect((await section(t.id)).version).toBe(v);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [t.id]);
    expect((await edit(boss, d.approvalId, "消えたチケット", v)).status).toBe(404);
    expect((await section(t.id)).version).toBe(v);
  });

  it("K742-API-007 もう決まった・取り下げた承認（承認済み・差し戻し済み・止め済み・取り下げ済み）：409・E-CONF-003。成果物の版は増えない", async () => {
    for (const how of ["approve", "return", "stop", "withdrawn"] as const) {
      const t = await ticket();
      const d = await delegated(t);
      if (how === "approve") expect((await approve(boss, d.approvalId)).status).toBe(201);
      if (how === "return") expect((await giveBack(boss, d.approvalId, "直してください")).status).toBe(201);
      if (how === "stop") expect((await stopApproval(boss, d.approvalId)).status).toBe(201);
      if (how === "withdrawn")
        await f.admin.query("update approvals set withdrawn_at = now() where id = $1", [d.approvalId]);
      const v = (await section(t.id)).version;
      const r = await edit(boss, d.approvalId, "遅れた直し", v);
      expect(r.status, how).toBe(409);
      expect(await code(r), how).toBe(CONF_DONE);
      expect((await section(t.id)).version, how).toBe(v);
    }
  });

  it("K742-API-008 担当者が替わった直後に前の担当者が押す：403。新しい担当者はすぐ直せる（やり取りに新しい担当者の名前）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const v = (await section(t.id)).version;
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t.id, writer.id]);
    expect((await edit(boss, d.approvalId, "前の担当者の直し", v)).status).toBe(403);
    expect((await section(t.id)).version).toBe(v);
    const now = await edit(writer, d.approvalId, "新しい担当者の直し", v);
    expect(now.status, await now.clone().text()).toBe(201);
    expect((await lines(t.id))[0]!.body).toContain("佐藤が成果物を直しました");
  });

  it("K742-API-009 入力の形：text か version が無い・知らない項目・version が 0・負・小数・文字・text が文字でない：422。何も変わらない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const v = (await section(t.id)).version;
    for (const body of [
      {},
      { text: "字だけ" },
      { version: v },
      { text: "余計な欄", version: v, note: "x" },
      { text: "版が 0", version: 0 },
      { text: "版が負", version: -1 },
      { text: "版が小数", version: 1.5 },
      { text: "版が文字", version: "1" },
      { text: 123, version: v },
    ]) {
      const r = await editApproval(boss, d.approvalId, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
    expect((await section(t.id)).version).toBe(v);
  });

  it("K742-API-010 ログインしていない：401。上限（1 分に 61 回）：429 と待つ秒数", async () => {
    await loadHook("approval-edit", "editApproval");
    const t = await ticket();
    const d = await delegated(t);
    const v = (await section(t.id)).version;
    expect((await req("POST", `/approvals/${d.approvalId}/edit`, { body: { text: "x", version: v } })).status).toBe(
      401,
    );
    const { limits } = await import("./approve-complete.harness.js");
    const saved = limits["editApproval"];
    delete limits["editApproval"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await edit(boss, d.approvalId, ARTIFACT, v);
      expect(last!.status).toBe(429);
      const sec = Number((await json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) limits["editApproval"] = saved;
    }
  });

  it("K742-API-011 手順 S1「DB に書く」が失敗（関数が使えない）：503・E-PAGE-003。成果物の版・やり取り・証跡のどれも変わらない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const s = await section(t.id);
    const before = await snapshot(t);
    await f.admin.query("revoke execute on function app.approval_self_edit(uuid, text, integer) from kaname_app");
    try {
      const r = await edit(boss, d.approvalId, NEW_TEXT, s.version);
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("grant execute on function app.approval_self_edit(uuid, text, integer) to kaname_app");
    }
    expect(await snapshot(t)).toEqual(before);
    expect(await section(t.id)).toMatchObject({ version: s.version, text: ARTIFACT });
  });

  it("K742-API-012 手順 S2「証跡」が失敗（証跡の書き込みが例外）：503・E-PAGE-003。同じ取引なので新しい版もやり取りも残らない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const s = await section(t.id);
    await f.admin.query(
      `create or replace function public.k742_fail_audit() returns trigger language plpgsql as $$
       begin if new.action = 'approval.self_edit' then raise exception 'K-742 試験：証跡が書けない'; end if; return new; end $$`,
    );
    await f.admin.query(
      "create trigger k742_fail_audit before insert on audit_events for each row execute function public.k742_fail_audit()",
    );
    try {
      const r = await edit(boss, d.approvalId, NEW_TEXT, s.version);
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("drop trigger if exists k742_fail_audit on audit_events");
      await f.admin.query("drop function if exists public.k742_fail_audit()");
    }
    expect(await section(t.id)).toMatchObject({ version: s.version, text: ARTIFACT });
    expect((await versionRows(s.id)).at(-1)!.version).toBe(s.version);
    expect(await lines(t.id)).toHaveLength(0);
  });

  it("K742-API-013 守りの判定で例外（書けるかの判定が壊れた）：503・E-PAGE-003・何も書かない。DB の関数の守り（2 層目）：security definer・search_path に pg_temp・public から外し kaname_app だけ。承認する人でない文脈で直に呼ぶと { error: not_approver }", async () => {
    const t = await ticket({ title: "K742 の守りを壊す" });
    const d = await delegated(t);
    const s = await section(t.id);
    await breakWritable("K742 の守りを壊す", async () => {
      const r = await edit(boss, d.approvalId, NEW_TEXT, s.version);
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    });
    expect((await section(t.id)).version).toBe(s.version);
    const fn = await one<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
      `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'approval_self_edit'`,
    );
    expect(fn.definer).toBe(true);
    expect(fn.cfg?.join(",") ?? "").toMatch(/search_path=.*pg_temp/);
    expect(fn).toMatchObject({ pub: false, app: true });
    const c = await f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [T.tenantId, writer.id],
      );
      const v = (
        await c.query<{ v: Record<string, unknown> }>("select app.approval_self_edit($1, $2, $3) as v", [
          d.approvalId,
          NEW_TEXT,
          s.version,
        ])
      ).rows[0]!.v;
      expect(v).toMatchObject({ error: "not_approver" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    expect((await section(t.id)).version).toBe(s.version);
  });

  it("K742-API-014 直した後に承認する：201・実行の仕事ができる。成果物は直した版のまま（承認で版は増えない）。直した後にもう一度直せば版 3・やり取りに 2 行", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const v1 = (await section(t.id)).version;
    expect((await edit(boss, d.approvalId, "1 回目の直し", v1)).status).toBe(201);
    expect((await edit(boss, d.approvalId, "2 回目の直し", v1 + 1)).status).toBe(201);
    expect(await lines(t.id)).toHaveLength(2);
    expect((await section(t.id)).version).toBe(v1 + 2);
    const r = await approve(boss, d.approvalId);
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await section(t.id)).text).toBe("2 回目の直し");
    const run = (await runsOf(t.id, "execute")).at(-1)!;
    expect(run.status_id).toBe("queued");
    expect(await jobOf(run.bridge_job_id!)).toMatchObject({ kind: "ticket" });
  });
});
