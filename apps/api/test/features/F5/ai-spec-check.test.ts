// K-736「AI が確認項目にチェックを付ける道具（spec_check）」の単体の試験（口・本物の DB・本物の PC の印）。名前の頭の行 ID（K736-API-…）は 11_tickets/K-736.md の表と 1 対 1。
//   道具の口は契約の callKanameTool（K-62）。AI が仕事の中で ticket_read で確認項目の id と文を読み、spec_check（確認項目の id と根拠の 1 行）でチェックを付けてから終わりを知らせる。
//   土台は delegate-kit.ts の makeKit（本物の Postgres・本物の口・本物の PC の印）。チケット・確認項目は DB に直に置く（作る口の形は段 5 で変わるので、この試験は作る口に頼らない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Person } from "../fixture.js";
import { data, delegateOk, json, makeKit, sha, type Device, type Kit } from "./delegate-kit.js";

/** AI に渡す頭の文に足す指示（K-736 が決めた字）。確認項目が 1 件以上のときだけ、頭の文の最後に付く */
const SENTENCE =
  "作り終えたら、確認項目を 1 つずつ確かめ、確かめられた物だけ道具 spec_check（確認項目の id と根拠の 1 行を渡す）でチェックを付けてから、最後の返事を返してください。目で見ないと分からない物にはチェックを付けず、そのまま残してください。";
const SPEC_DONE = "E-SPEC-001"; // 完了したチケットは確認項目を付け外しできない（409・K-435）
const SESS = "73673673-0000-4000-8000-00000000a001";

let k: Kit;
beforeAll(async () => {
  k = await makeKit();
}, 90_000);
afterAll(async () => {
  await k?.close();
});

const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
let tick = 0;

/** AI に任せる人と、その人の PC */
const fresh = async (name: string): Promise<{ p: Person; pc: Device }> => {
  const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name, ticketAbility: "edit" });
  return { p, pc: await k.device(p) };
};
/** チケットを DB に直に置く（未着手） */
async function raw(p: Person, title = "見積を作る", tenant = k.T, kind = k.taskKind): Promise<string> {
  const r = await k.q<{ id: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, due_on)
     values ($1, $2, '', $3, (select id from ticket_stages where tenant_id = $1 and key = 'todo'), $4, $5, $5, $6) returning id`,
    [tenant.tenantId, tenant.rootScope, kind, title, p.id, jst(3)],
  );
  return r[0]!.id;
}
/** 確認項目を足す（作った順を作った時刻で決める）。checked は付いている印（member＝人・ai＝AI） */
/** 任せる人の棚（自分だけ）に公開した必ず守るのページを 1 つ置き、確認項目の行（出どころ knowledge）をそのページに結ぶ（段10 の K-700 の種の決め） */
async function bindMustPage(p: Person, t: string, spec: string, title: string): Promise<void> {
  const mine = (await k.q<{ id: string }>("select scope_id as id from members where id = $1", [p.id]))[0]!.id;
  const page = (
    await k.q<{ id: string }>(
      "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, is_must, title, summary, position, current_version) values ($1, $2, true, $3, 'published', true, $4, $4, 0, 1) returning id",
      [p.tenantId, mine, p.id, title],
    )
  )[0]!.id;
  await k.q(
    "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) values ($1, $2, 1, 'published', $3::jsonb, $4, now(), $4)",
    [p.tenantId, page, JSON.stringify({ doc: { type: "doc", content: [] }, text: title }), p.id],
  );
  await k.q("update test_specs set source_ref_id = $2 where id = $1 and ticket_id = $3", [spec, page, t]);
}
async function addSpec(
  t: string,
  title: string,
  o: { checked?: "member" | "ai"; by?: Person; source?: string; deleted?: boolean } = {},
): Promise<string> {
  tick += 1;
  const row = (
    await k.q<{ tenant_id: string; assignee_member_id: string }>(
      "select tenant_id, assignee_member_id from tickets where id = $1",
      [t],
    )
  )[0]!;
  const who = o.by?.id ?? row.assignee_member_id;
  const r = await k.q<{ id: string }>(
    `insert into test_specs (tenant_id, ticket_id, title, source, checked_at, checked_by_member_id, checked_by_ai, created_by, updated_by, deleted_at, created_at)
     values ($1, $2, $3, coalesce($4, 'manual'), $5, $6, $7, $8, $8, $9, now() + make_interval(secs => $10)) returning id`,
    [
      row.tenant_id,
      t,
      title,
      o.source ?? null,
      o.checked ? new Date().toISOString() : null,
      o.checked === "member" ? who : null,
      o.checked === "ai",
      who,
      o.deleted ? new Date().toISOString() : null,
      tick,
    ],
  );
  return r[0]!.id;
}
const specRow = async (id: string) =>
  (
    await k.q<{
      version: number;
      checked_at: string | null;
      checked_by_member_id: string | null;
      checked_by_ai: boolean;
      checked_basis: string | null;
    }>("select version, checked_at, checked_by_member_id, checked_by_ai, checked_basis from test_specs where id = $1", [
      id,
    ])
  )[0]!;
/** 任せて、PC で取るところまで（確認項目が 1 件以上無いと任せられないので、先に足しておく） */
async function started(p: Person, pc: Device, titles: string[] = ["金額が合っている"]) {
  const t = await raw(p);
  const ids: string[] = [];
  for (const title of titles) ids.push(await addSpec(t, title));
  const d = await delegateOk(k, p, t);
  const job = await k.takeJob(pc);
  expect(job.job_id).toBe(d.job_id);
  return { t, ids, d, job };
}
type Res = {
  ok?: boolean;
  id?: string;
  checked?: boolean;
  unchanged?: boolean;
  specs?: { id: string; text: string; checked: boolean; source: string }[];
};
const result = async (r: Response): Promise<Res> => ((await data<{ result: Res }>(r)).result ?? {}) as Res;
const check = (pc: Device, jobId: string, token: string | null, input: unknown) =>
  k.tool(pc, jobId, "spec_check", token, input);
/** 根拠の行（代表の答え 3・D-153.4）：ticket_system_line が書く system の行（作者なし） */
const basisLinesOf = (t: string) =>
  k.q<{ author_member_id: string | null; body: string }>(
    "select author_member_id, body from ticket_messages where ticket_id = $1 and kind = 'system' and body like '根拠：%' order by created_at, id",
    [t],
  );
const messagesOf = (t: string) =>
  k.q<{ author_member_id: string | null; body: string; kind: string }>(
    "select author_member_id, body, kind from ticket_messages where ticket_id = $1 and kind = 'change' order by created_at, id",
    [t],
  );
const auditOf = (spec: string) =>
  k.q<{ action: string; actor_member_id: string; choke_point_id: string; payload: unknown }>(
    "select action, actor_member_id, choke_point_id, payload from audit_events where target_id = $1 and action = 'tool.spec_check'",
    [spec],
  );

describe("K-736 AI が確認項目にチェックを付ける", () => {
  it("K736-API-001 道具 ticket_read の答えに specs：消していない確認項目を作った順に { id・text・checked・source }（鍵ちょうど 4）。別のチケットの項目は入らない", async () => {
    const { p, pc } = await fresh("読む人");
    const { t, ids, d, job } = await started(p, pc, ["一つ目", "二つ目", "三つ目"]);
    await addSpec(t, "消した項目", { deleted: true });
    await k.q("update test_specs set checked_at = now(), checked_by_ai = true where id = $1", [ids[1]]);
    const other = await raw(p, "別のチケット");
    await addSpec(other, "別のチケットの項目");
    const r = await k.tool(pc, d.job_id, "ticket_read", job.tool_token);
    expect(r.status, await r.clone().text()).toBe(201);
    const specs = (await result(r)).specs!;
    expect(specs.map((s) => s.text)).toEqual(["一つ目", "二つ目", "三つ目"]);
    expect(specs.map((s) => s.id)).toEqual(ids);
    expect(specs.map((s) => s.checked)).toEqual([false, true, false]);
    expect(Object.keys(specs[0]!).sort()).toEqual(["checked", "id", "source", "text"]);
    expect(specs[0]!.source).toBe("manual");
    expect(t).toBeTruthy();
  });

  it("K736-API-002 spec_check：確認項目に AI のチェックが付く（付けた人は空・AI の印・版が 1 つ上がる・根拠は前後の空白を落として残る）。やり取りに AI の 1 行と、根拠の 1 行（system の行）・証跡に 1 行（根拠の字は証跡に入れない）", async () => {
    const { p, pc } = await fresh("付ける人");
    const { t, ids, d, job } = await started(p, pc);
    const before = await specRow(ids[0]!);
    const r = await check(pc, d.job_id, job.tool_token, {
      spec_id: ids[0],
      basis: "  PDF の合計 1,716,000 円＝見積の月額と同じ  ",
    });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await result(r)).toEqual({ ok: true, id: ids[0], checked: true, unchanged: false });
    const after = await specRow(ids[0]!);
    expect(after).toMatchObject({
      checked_by_member_id: null,
      checked_by_ai: true,
      checked_basis: "PDF の合計 1,716,000 円＝見積の月額と同じ",
    });
    expect(after.checked_at).not.toBeNull();
    expect(after.version).toBe(before.version + 1);
    const lines = await messagesOf(t);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.author_member_id).toBeNull();
    expect(lines[0]!.body).toContain("AI が");
    expect(lines[0]!.body).toContain("金額が合っている");
    // 根拠は代表の答え 3（D-153.4）：やり取りの記録に 1 行（前後の空白を落とした字・作者なし）
    const basis = await basisLinesOf(t);
    expect(basis).toHaveLength(1);
    expect(basis[0]!.author_member_id).toBeNull();
    expect(basis[0]!.body).toBe("根拠：PDF の合計 1,716,000 円＝見積の月額と同じ");
    const audit = await auditOf(ids[0]!);
    expect(audit).toEqual([
      { action: "tool.spec_check", actor_member_id: p.id, choke_point_id: "C2", payload: { job_id: d.job_id } },
    ]);
    expect(JSON.stringify(audit)).not.toContain("1,716,000");
  });

  it("K736-API-003 必ず守るから入った行（出どころ knowledge）にも付けられる。人が足した行と同じ答え", async () => {
    const { p, pc } = await fresh("守る人");
    const t = await raw(p);
    const manual = await addSpec(t, "人が足した行");
    const know = await addSpec(t, "『請求書は月末までに送る』を守った", { source: "knowledge" });
    // 段10 の K-700 から、任せるときに knowledge の行は今の必ず守るのページと突き合わせ、裏の無い行（source_ref_id が空・外れたページ）は消す。
    //   本物と同じく、任せる人の棚に公開した必ず守るのページを置いて行に結ぶ（題名も種の決め「『題名』を守った」に合わせる）。
    //   会社の頂点に置くと、同じ会社のほかの試験のチケットにも行が入るので、この試験の人の棚だけに置く
    await bindMustPage(p, t, know, "請求書は月末までに送る");
    const d = await delegateOk(k, p, t);
    const job = await k.takeJob(pc);
    for (const id of [manual, know]) {
      const r = await check(pc, d.job_id, job.tool_token, { spec_id: id, basis: "送付履歴で確かめた" });
      expect(r.status, await r.clone().text()).toBe(201);
      expect((await result(r)).checked).toBe(true);
    }
    expect(await specRow(know)).toMatchObject({ checked_by_ai: true, checked_basis: "送付履歴で確かめた" });
  });

  it("K736-API-004 もう AI がチェックを付けた行にもう一度付ける：unchanged が真・版・根拠・やり取りの行は増えない（最初の根拠の行 1 つが残る）", async () => {
    const { p, pc } = await fresh("二度付ける人");
    const { t, ids, d, job } = await started(p, pc);
    await check(pc, d.job_id, job.tool_token, { spec_id: ids[0], basis: "最初の根拠" });
    const mid = await specRow(ids[0]!);
    const r = await check(pc, d.job_id, job.tool_token, { spec_id: ids[0], basis: "二度目の根拠" });
    expect(r.status).toBe(201);
    expect(await result(r)).toEqual({ ok: true, id: ids[0], checked: true, unchanged: true });
    expect(await specRow(ids[0]!)).toEqual(mid);
    expect(await messagesOf(t)).toHaveLength(1);
    const basis = await basisLinesOf(t);
    expect(basis.map((x) => x.body)).toEqual(["根拠：最初の根拠"]);
  });

  it("K736-API-005 人がチェックを付けた行には付けない：unchanged が真・人のチェックのまま・根拠は残さない", async () => {
    const { p, pc } = await fresh("人が先の人");
    const t = await raw(p);
    const spec = await addSpec(t, "PDF を目で見る", { checked: "member" });
    await addSpec(t, "ほかの項目");
    const d = await delegateOk(k, p, t);
    const job = await k.takeJob(pc);
    const before = await specRow(spec);
    const r = await check(pc, d.job_id, job.tool_token, { spec_id: spec, basis: "AI の根拠" });
    expect(await result(r)).toMatchObject({ ok: true, checked: true, unchanged: true });
    expect(await specRow(spec)).toEqual(before);
    expect(before.checked_basis).toBeNull();
  });

  it("K736-API-006 根拠の形：無い・文字でない・空白だけ・201 字は 422（欄 basis）で何も書かない。ちょうど 200 字は通る", async () => {
    const { p, pc } = await fresh("根拠の人");
    const { ids, d, job } = await started(p, pc, ["一つ目", "二つ目"]);
    for (const basis of [undefined, 123, "", " \t\n　 ", "あ".repeat(201)]) {
      const r = await check(pc, d.job_id, job.tool_token, {
        spec_id: ids[0],
        ...(basis === undefined ? {} : { basis }),
      });
      expect(r.status, String(basis)).toBe(422);
      expect(JSON.stringify(await json(r))).toContain("basis");
    }
    expect((await specRow(ids[0]!)).checked_at).toBeNull();
    const ok = await check(pc, d.job_id, job.tool_token, { spec_id: ids[1], basis: "あ".repeat(200) });
    expect(ok.status).toBe(201);
    expect((await specRow(ids[1]!)).checked_basis).toBe("あ".repeat(200));
  });

  it("K736-API-007 確認項目の指し方：spec_id が無い・文字でない・uuid でないは 422（欄 spec_id）。知らない欄は捨てる", async () => {
    const { p, pc } = await fresh("指す人");
    const { ids, d, job } = await started(p, pc);
    for (const spec_id of [undefined, 5, "abc", ""]) {
      const r = await check(pc, d.job_id, job.tool_token, {
        ...(spec_id === undefined ? {} : { spec_id }),
        basis: "根拠",
      });
      expect(r.status, String(spec_id)).toBe(422);
      expect(JSON.stringify(await json(r))).toContain("spec_id");
    }
    const up = await check(pc, d.job_id, job.tool_token, {
      spec_id: ids[0]!.toUpperCase(),
      basis: "根拠",
      note: "知らない欄",
    });
    expect(up.status, await up.clone().text()).toBe(201);
  });

  it("K736-API-008 チェックを外す道は無い：checked が真でなければ 422（欄 checked）で何も変わらない。真なら付く", async () => {
    const { p, pc } = await fresh("外せない人");
    const { ids, d, job } = await started(p, pc, ["一つ目", "二つ目"]);
    await check(pc, d.job_id, job.tool_token, { spec_id: ids[0], basis: "根拠" });
    const before = await specRow(ids[0]!);
    for (const checked of [false, "false", 0, null]) {
      const r = await check(pc, d.job_id, job.tool_token, { spec_id: ids[0], basis: "外したい", checked });
      expect(r.status, String(checked)).toBe(422);
      expect(JSON.stringify(await json(r))).toContain("checked");
    }
    expect(await specRow(ids[0]!)).toEqual(before);
    const t = await check(pc, d.job_id, job.tool_token, { spec_id: ids[1], basis: "根拠", checked: true });
    expect(t.status).toBe(201);
  });

  it("K736-API-009 任された 1 枚の確認項目だけ：別のチケット・消した行・別の会社の行・ない行は 404（欄も詳細も付けない）で何も変わらない", async () => {
    const { p, pc } = await fresh("任された人");
    const { ids, d, job } = await started(p, pc);
    const elsewhere = await addSpec(await raw(p, "別のチケット"), "別のチケットの項目");
    const gone = await addSpec(await raw(p, "さらに別"), "消した項目", { deleted: true });
    const q = await k.f.person(k.O.tenantId, k.O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    const theirs = await addSpec(
      await raw(
        q,
        "別の会社のチケット",
        k.O,
        (
          await k.q<{ id: string }>(
            "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
            [k.O.tenantId],
          )
        )[0]!.id,
      ),
      "別の会社の項目",
    );
    const sameTicketGone = await addSpec(
      (await k.q<{ ticket_id: string }>("select ticket_id from test_specs where id = $1", [ids[0]]))[0]!.ticket_id,
      "この中の消した項目",
      { deleted: true },
    );
    for (const spec_id of [elsewhere, gone, theirs, sameTicketGone, randomUUID()]) {
      const r = await check(pc, d.job_id, job.tool_token, { spec_id, basis: "根拠" });
      expect(r.status, spec_id).toBe(404);
      expect(Object.keys(await json(r)).sort()).toEqual(["code", "error"]);
      expect(
        (await k.q<{ checked_at: string | null }>("select checked_at from test_specs where id = $1", [spec_id]))[0]
          ?.checked_at ?? null,
      ).toBeNull();
    }
  });

  it("K736-API-010 道具は仕事の種類で分ける：会話の仕事の鍵で spec_check は 403・何も変わらない", async () => {
    const { p, pc } = await fresh("会話の人");
    const { ids, d, job } = await started(p, pc);
    await k.finish(pc, d.job_id, { state: "done", result: "見積", agent_session_id: SESS });
    const conv = (
      await k.q<{ id: string }>(
        "insert into conversations (tenant_id, scope_id, owner_member_id, title) values ($1, $2, $3, 'K736 道具') returning id",
        [k.T.tenantId, k.T.rootScope, p.id],
      )
    )[0]!.id;
    await k.f.admin.query(
      "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, permission_mode) values ($1, $2, $3, $4, 'queued', '話して', 'chat', 'manual')",
      [k.T.tenantId, k.T.rootScope, p.id, conv],
    );
    const chat = await k.takeJob(pc);
    expect(chat.kind).toBe("chat");
    const r = await check(pc, chat.job_id, chat.tool_token, { spec_id: ids[0], basis: "根拠" });
    expect(r.status).toBe(403);
    expect(job.tool_token).toBeTruthy();
    expect((await specRow(ids[0]!)).checked_at).toBeNull();
  });

  it("K736-API-011 鍵と PC（口の前段と DB の 2 層）：鍵が無い・ほかの仕事の鍵・ほかの PC・終わった仕事の鍵は 403 で何も変わらない", async () => {
    const a = await fresh("A の人");
    const b = await fresh("B の人");
    const sa = await started(a.p, a.pc);
    const sb = await started(b.p, b.pc);
    const input = { spec_id: sa.ids[0], basis: "根拠" };
    expect((await check(a.pc, sa.d.job_id, null, input)).status).toBe(403);
    expect((await check(a.pc, sa.d.job_id, sb.job.tool_token, input)).status).toBe(403);
    expect((await check(b.pc, sa.d.job_id, sa.job.tool_token, input)).status).toBe(403);
    await k.finish(a.pc, sa.d.job_id, { state: "done", result: "見積", agent_session_id: SESS });
    expect((await check(a.pc, sa.d.job_id, sa.job.tool_token, input)).status).toBe(403);
    expect((await specRow(sa.ids[0]!)).checked_at).toBeNull();
  });

  it("K736-API-012 完了したチケット：409 E-SPEC-001（欄なし）で何も変わらない", async () => {
    const { p, pc } = await fresh("完了の人");
    const { t, ids, d, job } = await started(p, pc);
    await k.q(
      "update tickets t set stage_id = s.id, completed_at = now(), completed_by = t.assignee_member_id from ticket_stages s where t.id = $1 and s.tenant_id = t.tenant_id and s.key = 'done'",
      [t],
    );
    const r = await check(pc, d.job_id, job.tool_token, { spec_id: ids[0], basis: "根拠" });
    expect(r.status, await r.clone().text()).toBe(409);
    expect(await json(r)).toMatchObject({ code: SPEC_DONE });
    expect((await specRow(ids[0]!)).checked_at).toBeNull();
    expect(await messagesOf(t)).toHaveLength(0);
  });

  it("K736-API-013 DB の 2 層目の入口（app.ticket_tool_spec_check）を直に呼ぶ：鍵のハッシュ・PC・仕事の状態が合わなければ null で何も書かない。引数に「チェックを外す」道が無い", async () => {
    const { p, pc } = await fresh("直に呼ぶ人");
    const other = await fresh("別の PC の人");
    const { ids, d, job } = await started(p, pc);
    const call = async (hash: string, sess: string, basis = "根拠") =>
      (
        await k.q<{ v: unknown }>("select app.ticket_tool_spec_check($1, $2, $3, $4, $5) as v", [
          d.job_id,
          hash,
          sess,
          ids[0],
          basis,
        ])
      )[0]!.v;
    expect(await call(sha("違う鍵"), pc.sessionId)).toBeNull();
    expect(await call(sha(String(job.tool_token)), other.pc.sessionId)).toBeNull();
    expect((await specRow(ids[0]!)).checked_at).toBeNull();
    expect(await call(sha(String(job.tool_token)), pc.sessionId)).toMatchObject({ ok: true, unchanged: false });
    const sig = (
      await k.q<{ a: string }>(
        "select pg_get_function_arguments('app.ticket_tool_spec_check(uuid, text, uuid, uuid, text)'::regprocedure) as a",
      )
    )[0]!.a;
    expect(sig).not.toMatch(/checked|uncheck/i);
    await k.f.admin.query("update bridge_jobs set state_id = 'done' where id = $1", [d.job_id]);
    expect(await call(sha(String(job.tool_token)), pc.sessionId)).toBeNull();
  });

  it("K736-API-014 会社の文脈を借りるのは関数の中だけ：呼ぶ前の app.tenant_id の設定は呼んだ後に元へ戻る（接続を使い回しても別の会社に残らない）", async () => {
    const { p, pc } = await fresh("文脈の人");
    const { ids, d, job } = await started(p, pc);
    const c = await k.f.pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.tenant_id', $1, true)", [k.O.tenantId]);
      await c.query("select app.ticket_tool_spec_check($1, $2, $3, $4, '根拠')", [
        d.job_id,
        sha(String(job.tool_token)),
        pc.sessionId,
        ids[0],
      ]);
      expect((await c.query<{ v: string }>("select current_setting('app.tenant_id', true) as v")).rows[0]!.v).toBe(
        k.O.tenantId,
      );
      await c.query("rollback");
    } finally {
      c.release();
    }
    expect((await specRow(ids[0]!)).checked_by_ai).toBe(false);
  });

  it("K736-API-015 AI に渡す中身：確認項目が 1 件以上なら、頭の文の最後に「確かめられた物だけ spec_check でチェックを付けてから最後の返事」の指示が付く。保存した仕事の中身と関数の答えは同じ", async () => {
    const { p, pc } = await fresh("指示の人");
    const { t, d } = await started(p, pc);
    const prompt = String(
      (await k.q<{ prompt: string }>("select prompt from bridge_jobs where id = $1", [d.job_id]))[0]!.prompt,
    );
    const intro = prompt.split("\n\n## ")[0]!;
    expect(intro.endsWith(SENTENCE)).toBe(true);
    expect(prompt.split(SENTENCE)).toHaveLength(2);
    const ctx = (await k.q<{ v: { prompt: string } }>("select app.ticket_job_context($1) as v", [t]))[0]!.v;
    expect(ctx.prompt).toBe(prompt);
    expect(pc.sessionId).toBeTruthy();
  });

  it("K736-API-016 確認項目を使わないチケット（0 件・使わない理由つきで任せた）の中身には、この指示が付かない", async () => {
    const { p, pc } = await fresh("理由の人");
    const t = await raw(p);
    const r = await k.delegate(p, t, { no_spec_reason: "社内の確認だけで済む作業のため" });
    expect(r.status, await r.clone().text()).toBe(201);
    const d = await data<{ job_id: string }>(r);
    expect(pc.token).toBeTruthy();
    const prompt = String(
      (await k.q<{ prompt: string }>("select prompt from bridge_jobs where id = $1", [d.job_id]))[0]!.prompt,
    );
    expect(prompt).not.toContain("spec_check");
  });

  it("K736-API-017 やり取りの要約の名前は 1 回：変更の 1 行（kind change）は作者の名前を前に付けず、書き込みは「名前: 本文」。作者の無い行も「 : 」にならない", async () => {
    const { p } = await fresh("高本");
    const t = await raw(p);
    await addSpec(t, "一つ目");
    await k.q(
      "insert into ticket_messages (tenant_id, ticket_id, kind, author_member_id, body) values ($1, $2, 'post', $3, '確認お願いします')",
      [k.T.tenantId, t, p.id],
    );
    await k.q(
      "insert into ticket_messages (tenant_id, ticket_id, kind, author_member_id, body) values ($1, $2, 'change', $3, '高本 が状態を作業中にしました')",
      [k.T.tenantId, t, p.id],
    );
    await k.q(
      "insert into ticket_messages (tenant_id, ticket_id, kind, author_member_id, body) values ($1, $2, 'change', null, '守れていなかった決まりが 1 つ：請求書の送り方')",
      [k.T.tenantId, t],
    );
    const prompt = String(
      (await k.q<{ v: { prompt: string } }>("select app.ticket_job_context($1) as v", [t]))[0]!.v.prompt,
    );
    expect(prompt).toMatch(/\[やり取り\] \d\d\/\d\d \d\d:\d\d 高本: 確認お願いします/);
    expect(prompt).toMatch(/\[やり取り\] \d\d\/\d\d \d\d:\d\d 高本 が状態を作業中にしました(\n|$)/);
    expect(prompt).toMatch(/\[やり取り\] \d\d\/\d\d \d\d:\d\d 守れていなかった決まりが 1 つ：請求書の送り方/);
    expect(prompt).not.toMatch(/\d\d:\d\d : /);
    expect(prompt).not.toMatch(/高本: 高本 が/);
  });

  it("K736-API-018 取り消した決定・改められた古い決定は AI に渡す要約の [決定] に入らない（今の決定だけ）", async () => {
    const { p } = await fresh("決める人");
    const t = await raw(p);
    await addSpec(t, "一つ目");
    const ins = async (text: string) =>
      (
        await k.q<{ id: string }>(
          "insert into ticket_decisions (tenant_id, ticket_id, text, decided_by) values ($1, $2, $3, $4) returning id",
          [k.T.tenantId, t, text, p.id],
        )
      )[0]!.id;
    const oldId = await ins("古い決め：単価は 10 万円");
    const newId = await ins("新しい決め：単価は 12 万円");
    await ins("取り消した決め：値引きする");
    await ins("生きている決め：月末締め");
    await k.q("update ticket_decisions set superseded_by_id = $2 where id = $1", [oldId, newId]);
    await k.q(
      "update ticket_decisions set cancelled_at = now(), cancelled_by = $2, cancel_reason = '誤り' where text like '取り消した%' and ticket_id = $1",
      [t, p.id],
    );
    const prompt = String(
      (await k.q<{ v: { prompt: string } }>("select app.ticket_job_context($1) as v", [t]))[0]!.v.prompt,
    );
    expect(prompt).toContain("新しい決め：単価は 12 万円");
    expect(prompt).toContain("生きている決め：月末締め");
    expect(prompt).not.toContain("古い決め");
    expect(prompt).not.toContain("取り消した決め");
  });

  it("K736-API-019 確認項目が多いとき（500 件）：ticket_read の specs は全部返り、頭の文は 1 つの指示だけで長さが増えない", async () => {
    const { p, pc } = await fresh("たくさんの人");
    const t = await raw(p);
    // check_kind は段 5 の K-434 で任意になるが、切る段の木（段 5 の前）でも準備が通るよう値を入れておく（使わない列）
    await k.q(
      "insert into test_specs (tenant_id, ticket_id, title, check_kind, created_by, updated_by, created_at) select $1, $2, '項目 ' || g, 'human', $3, $3, now() + make_interval(secs => g) from generate_series(1, 500) g",
      [k.T.tenantId, t, p.id],
    );
    const d = await delegateOk(k, p, t);
    const job = await k.takeJob(pc);
    const specs = (await result(await k.tool(pc, d.job_id, "ticket_read", job.tool_token))).specs!;
    expect(specs).toHaveLength(500);
    const prompt = String(
      (await k.q<{ prompt: string }>("select prompt from bridge_jobs where id = $1", [d.job_id]))[0]!.prompt,
    );
    expect(prompt.split("spec_check").length - 1).toBe(1);
  });

  it("K736-API-020 S1 の失敗：チェック・根拠・やり取り・証跡は 1 つの取引：証跡を書けないときは 503（E-PAGE-003）で、チェックもやり取りも根拠も何も残らない", async () => {
    const { p, pc } = await fresh("失敗の人");
    const { t, ids, d, job } = await started(p, pc);
    await k.f.admin.query(
      "create or replace function public.k736_break() returns trigger language plpgsql as $$ begin raise exception 'k736 試験が起こした失敗'; end $$",
    );
    await k.f.admin.query(
      `create trigger k736_break_audit before insert on audit_events for each row when (new.action = 'tool.spec_check' and new.tenant_id = '${k.T.tenantId}'::uuid) execute function public.k736_break()`,
    );
    try {
      const r = await check(pc, d.job_id, job.tool_token, { spec_id: ids[0], basis: "根拠" });
      expect(r.status).toBe(503);
      expect(await json(r)).toMatchObject({ code: "E-PAGE-003" });
    } finally {
      await k.f.admin.query("drop trigger if exists k736_break_audit on audit_events");
    }
    expect(await specRow(ids[0]!)).toMatchObject({ checked_at: null, checked_basis: null, checked_by_ai: false });
    expect(await messagesOf(t)).toHaveLength(0);
    expect(await basisLinesOf(t)).toHaveLength(0);
  });

  it("K736-API-021 チケットの仕事で呼べる道具に spec_check が在り、会話の仕事には在らない（口の前段の決め）", async () => {
    const { toolsFor, TICKET_TOOLS } = await import("../../../src/features/F5/delegate/tools.js");
    expect(TICKET_TOOLS).toContain("ticket_read");
    expect(TICKET_TOOLS).toContain("spec_check");
    expect(toolsFor({ kind: "ticket", conversation_id: null })).toContain("spec_check");
    expect(toolsFor({ kind: "chat", conversation_id: randomUUID() })).not.toContain("spec_check");
  });
  it("K736-API-022 指示の 1 文は作る段の prompt だけ：承認が決まって（approve）実行がまだ無い間は出ず、その承認から出た実行が済んだ後の任せ直し・差し戻し（return）・承認が無いときは出る", async () => {
    const { p } = await fresh("段の人");
    const t = await raw(p);
    await addSpec(t, "一つ目");
    const promptNow = async () =>
      String((await k.q<{ v: { prompt: string } }>("select app.ticket_job_context($1) as v", [t]))[0]!.v.prompt);
    expect(await promptNow()).toContain(SENTENCE);
    const approval = async (decision: "approve" | "return") =>
      (
        await k.q<{ id: string }>(
          `insert into approvals (tenant_id, scope_id, kind, ticket_id, approver_member_id, requested_by, status_id, irreversible, human_checks, decision, decided_at, return_reason, created_by)
           values ($1, $2, 'artifact', $3, $4, $4, 'approved', false, '[]'::jsonb, $5, now(), $6, $4) returning id`,
          [k.T.tenantId, k.T.rootScope, t, p.id, decision, decision === "return" ? "直してください" : null],
        )
      )[0]!.id;
    const ret = await approval("return");
    expect(await promptNow()).toContain(SENTENCE);
    await k.q("update approvals set decided_at = now() - interval '2 minutes' where id = $1", [ret]);
    const ok = await approval("approve");
    expect(await promptNow()).not.toContain("spec_check");
    await k.q(
      "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, approval_id, created_by) values ($1, $2, $3, 'execute', 'done', $4, $5)",
      [k.T.tenantId, k.T.rootScope, t, ok, p.id],
    );
    expect(await promptNow()).toContain(SENTENCE);
  });
});
