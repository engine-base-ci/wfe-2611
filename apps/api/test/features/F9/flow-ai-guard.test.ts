// K-714「中間（段 10・J2）：AI が読んで守る」の試験・DB の関数と口の組み（本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K714-J-NNN・K714-H-001（チケット 11_tickets/K-714.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md の 6 章。
//   取る口を通した全体（PC の印つき・道具の口・承認の道・完了の口）は flow-ai-take.test.ts（K-714 の 2 つ目の試験・行 011〜016・段 5 の K-62 の土台を使う）。
//   ここは K-697〜K-701・K-695 の単体が受けた分岐を重ねず、葉をまたいで初めて分かること（任せる → 渡す → 開く → 数える → 止める → 管理に出る）を見る。
//   行 001〜007 は 1 本の筋で、前の行が作った物を次の行が読む（上から順に流れる）。行 008〜010 は自分の準備を持つ。
//   「任せる」は DB の関数 app.ticket_delegate、「取る」は PC が受け取った印を仕事の行に書く準備（K-699 の試験と同じ形）、
//   「AI がチェックを付ける」は段 5 の K-435 の DB の関数 app.test_spec_check_by_ai（段 6 が未切りなので試験の準備で直に呼ぶ）、
//   「終わりを知らせる」は仕事の行を結果つきの done にする（本線の bridge_finish_job が最後にすること・guard-kit の finishJob）。
//   土台は knowledge.harness.ts（K-675）・knowledge.requests-kit.ts（K-687）・knowledge.guard-kit.ts（K-700）を読むだけで、変えない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { setupKnowledge, type Person } from "./knowledge.harness.js";
import { makeWorld, type Json, type World } from "./knowledge.requests-kit.js";
import {
  breachLines,
  breachRows,
  finishJob,
  guardSpec,
  humanUncheck,
  mkJob,
  mkTicket,
  pubPage,
  scene,
} from "./knowledge.guard-kit.js";

const h = setupKnowledge();
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const q = async <T>(sql: string, p: unknown[] = []): Promise<T[]> => (await h.admin.query(sql, p)).rows as T[];

const call = async (p: Person, method: string, path: string, body?: unknown): Promise<Response> => {
  await h.ready();
  return h.req(method, path, { headers: h.as(p), ...(body === undefined ? {} : { body }) });
};
const asJson = async (r: Response): Promise<Json> => ((await h.json(r)).data ?? {}) as Json;

type Del = { ok: boolean; code?: string; run_id?: string; job_id?: string; pc?: string };
const delegate = (p: Person, ticket: string): Promise<Del> =>
  withTenant(
    h.pool,
    p.ctx,
    async (cl) => (await cl.query<{ v: Del }>("select app.ticket_delegate($1, null) as v", [ticket])).rows[0]!.v,
  );
interface Left {
  id: string;
  title: string;
  page_id: string;
  page_title: string;
}
interface Complete {
  error?: string;
  left?: Left[];
  ticket_id?: string;
}
const complete = (p: Person, ticket: string): Promise<Complete> =>
  withTenant(
    h.pool,
    p.ctx,
    async (cl) =>
      (
        await cl.query<{ v: Complete }>("select app.ticket_complete($1, null::integer[], null::integer, true) as v", [
          ticket,
        ])
      ).rows[0]!.v,
  );
/** 段 5 の K-435 の関数：機械・AI がチェックを付ける（会社の文脈だけで動く）。段 6 が口にするまで試験の準備で直に呼ぶ */
const aiCheckVia = (p: Person, spec: string): Promise<unknown> =>
  withTenant(
    h.pool,
    p.ctx,
    async (cl) => (await cl.query("select app.test_spec_check_by_ai($1, true) as v", [spec])).rows[0]!.v,
  );
const stageOf = async (t: string): Promise<string> =>
  (
    await q<{ k: string }>(
      "select s.key as k from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1",
      [t],
    )
  )[0]!.k;
/** 承認と実行が済んで作業中に戻った形（承認の道は段 5・段 9 の単体と flow-ai-take が通す） */
const backToDoing = async (w: World, ticket: string): Promise<void> => {
  await q("update action_runs set status_id = 'done', finished_at = now() where ticket_id = $1", [ticket]);
  await q(
    "update tickets set stage_id = (select id from ticket_stages where tenant_id = $1 and key = 'doing') where id = $2",
    [w.co.tenantId, ticket],
  );
};
const specIdOf = async (ticket: string, page: string): Promise<string> =>
  (
    await q<{ id: string }>(
      "select id from test_specs where ticket_id = $1 and source = 'knowledge' and source_ref_id = $2 and deleted_at is null",
      [ticket, page],
    )
  )[0]!.id;
interface Ctx {
  must: { id: string; title: string; body_text: string }[];
  index: { id: string; title: string }[];
}
const contextOf = async (session: string, job: string): Promise<Ctx | null> =>
  (await q<{ v: Ctx | null }>("select app.bridge_job_knowledge($1, $2) as v", [session, job]))[0]!.v;
const ageDays = (page: string, days: number): Promise<unknown> =>
  h.admin.query(
    "update knowledge_page_versions set published_at = now() - ($2 || ' days')::interval where page_id = $1",
    [page, String(days)],
  );
const review = async (p: Person): Promise<{ unused: Json[]; conflicts: Json[]; broken: Json[] }> => {
  const r = await call(p, "GET", "/knowledge/review");
  expect(r.status, await r.clone().text()).toBe(200);
  return (await asJson(r)) as { unused: Json[]; conflicts: Json[]; broken: Json[] };
};
const reviewCount = async (p: Person): Promise<unknown> =>
  ((await asJson(await call(p, "GET", "/knowledge/tree")))["admin_counts"] as Json | null)?.["review"];

interface Story {
  w: World;
  ticket: string;
  job: string;
  session: string;
  token: string;
  pages: { co: string; gp: string; me: string; dev: string; menu: string; old: string };
  specs: { co: string; gp: string; me: string };
}
let S: Story;

describe("K-714 中間：AI が読んで守る", () => {
  it("K714-J-001 任せると確認項目に入る：高本さん（営業と受託開発に入っている）が営業のチケットを AI に任せると、会社・営業・自分の「必ず守る」のページごとに確認項目が 1 行ずつ入る（出どころ ナレッジ・チェックなし）。受託開発の「必ず守る」は入らない。やり取りに「このチケットで守る物」の行が 1 つ出て、3 つのページの名前が並び、受託開発のページの名前は無い", async () => {
    const w = await makeWorld(h, "K714 筋");
    await q(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, false, 'member')",
      [w.co.tenantId, w.mem1.id, w.g2],
    );
    const pages = {
      co: await pubPage(h, w.co.rootScope, w.boss, "請求書の送り方", {
        must: true,
        text: "請求書は月末に締めて 5 日までに送る",
      }),
      gp: await pubPage(h, w.g1, w.mgr1, "営業の型", { must: true, text: "見積もりは 2 日以内に返す" }),
      me: await pubPage(h, w.mem1.scopeId, w.mem1, "自分の工夫", {
        must: true,
        personal: true,
        text: "朝に返信をまとめる",
      }),
      dev: await pubPage(h, w.g2, w.mgr2, "納品の前の確かめ", { must: true, text: "納品の前に動作を確かめる" }),
      menu: await pubPage(h, w.g1, w.mgr1, "見積もりの出し方", { text: "見積もりは項目ごとに書く" }),
      old: await pubPage(h, w.g1, w.mgr1, "古い手順", { text: "昔の手順" }),
    };
    const ticket = await mkTicket(h, w, w.g1, w.mem1, "todo");
    const session = (
      await q<{ id: string }>(
        "insert into sessions (tenant_id, member_id, kind_id, device_label) values ($1, $2, 'bridge', 'PC') returning id",
        [w.co.tenantId, w.mem1.id],
      )
    )[0]!.id;
    const del = await delegate(w.mem1, ticket);
    expect(del.ok, JSON.stringify(del)).toBe(true);
    const specs = await q<{ title: string; source: string; source_ref_id: string | null; checked_at: unknown }>(
      "select title, source, source_ref_id, checked_at from test_specs where ticket_id = $1 and deleted_at is null",
      [ticket],
    );
    expect(specs.map((x) => x.source_ref_id).sort()).toEqual([pages.co, pages.gp, pages.me].sort());
    expect(specs.every((x) => x.source === "knowledge" && x.checked_at === null)).toBe(true);
    expect(specs.map((x) => x.title).sort()).toEqual(
      ["『請求書の送り方』を守った", "『営業の型』を守った", "『自分の工夫』を守った"].sort(),
    );
    const lines = await q<{ changes: unknown }>(
      "select changes from ticket_messages where ticket_id = $1 and changes->0->>'field' = 'guard_list'",
      [ticket],
    );
    expect(lines).toHaveLength(1);
    const text = JSON.stringify(lines[0]!.changes);
    for (const t of ["請求書の送り方", "営業の型", "自分の工夫"]) expect(text).toContain(t);
    expect(text).not.toContain("納品の前の確かめ");
    // 取る：PC が仕事を受け取った印（仕事を受け取った PC の印と道具の鍵）を仕事の行に書く
    const token = randomUUID() + randomUUID();
    await q(
      "update bridge_jobs set taken_session_id = $2, state_id = 'running', started_at = now(), tool_token_hash = $3 where id = $1",
      [del.job_id, session, sha(token)],
    );
    S = {
      w,
      ticket,
      job: String(del.job_id),
      session,
      token,
      pages,
      specs: {
        co: await specIdOf(ticket, pages.co),
        gp: await specIdOf(ticket, pages.gp),
        me: await specIdOf(ticket, pages.me),
      },
    };
  });

  it("K714-J-002 受け取った PC に渡る物：必ず守るは会社 → 営業 → 自分の順に本文ごと全部、ほかは目次（題名だけ）。受託開発の必ず守るは本文にも目次にも無い。高本さんが会社のページを写して直していなければ、写しは目次に出ない（上と同じ物は渡さない）。受け取った PC の印でない呼びには渡さない", async () => {
    const { w, job, session, pages } = S;
    const first = (await contextOf(session, job))!;
    expect(first.must.map((x) => x.id)).toEqual([pages.co, pages.gp, pages.me]);
    expect(first.must[0]!.body_text).toContain("5 日までに送る");
    expect(first.must[1]!.body_text).toContain("2 日以内");
    const idx = first.index.map((x) => x.id);
    expect(idx).toContain(pages.menu);
    expect(idx).toContain(pages.old);
    expect(idx).not.toContain(pages.dev);
    const copy = String((await asJson(await call(w.mem1, "POST", `/knowledge_pages/${pages.co}/copy`, {})))["id"]);
    expect(copy).not.toBe("undefined");
    const after = (await contextOf(session, job))!;
    expect(after.index.map((x) => x.id)).not.toContain(copy);
    expect(after.must.map((x) => x.id)).toEqual([pages.co, pages.gp, pages.me]);
    expect(await contextOf("00000000-0000-4000-8000-000000000002", job)).toBeNull();
  });

  it("K714-J-003 AI がページを開く：目次の「見積もりの出し方」を開くと本文が返り、開いた記録とやり取りの 1 行が 1 つずつ残る。もう一度開いても増えない。受託開発のページは同じ答え（見えない）で何も残らない。佐藤さんがそのページを読むと、足元の「AI がこの 30 日に開いた数」が 1", async () => {
    const { w, job, session, token, ticket, pages } = S;
    const open = async (page: string): Promise<Json | null> =>
      (
        await q<{ v: Json | null }>("select app.knowledge_open($1, $2, $3, $4) as v", [job, sha(token), session, page])
      )[0]!.v;
    const first = (await open(pages.menu))!;
    expect(first).toMatchObject({ ok: true, opened_now: true, page: { id: pages.menu, title: "見積もりの出し方" } });
    expect(String((first["page"] as Json)["body_text"])).toContain("項目ごと");
    expect((await open(pages.menu))!["opened_now"]).toBe(false);
    expect(await open(pages.dev)).toBeNull();
    const logs = await q<{ ref_id: string }>(
      "select ref_id from reference_logs where bridge_job_id = $1 and deleted_at is null",
      [job],
    );
    expect(logs.map((x) => x.ref_id)).toEqual([pages.menu]);
    const lines = await q<{ author_member_id: string | null }>(
      "select author_member_id from ticket_messages where ticket_id = $1 and changes->0->>'field' = 'knowledge_open'",
      [ticket],
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]!.author_member_id).toBeNull();
    const read = await asJson(await call(w.mgr1, "GET", `/knowledge_pages/${pages.menu}`));
    expect(read["foot"]).toMatchObject({ ai_opened_30d: 1 });
  });

  it("K714-J-004 終わりを知らせたのに未チェックだと破られた数に入る：AI が「自分の工夫」だけチェックを付けて終わりを知らせると、会社と営業の 2 つが 1 つずつ数えられ（自分の分は数えない）、やり取りに「守れていなかった決まり」の行が 2 つ出る。AI がもう一度終わりを知らせても増えない", async () => {
    const { w, job, ticket, pages, specs } = S;
    await aiCheckVia(w.mem1, specs.me);
    await finishJob(h, job, { state: "done", result: "請求書を作りました" });
    const rows = await breachRows(h, ticket);
    expect(rows.map((x) => [x.page_id, x.kind]).sort()).toEqual(
      [
        [pages.co, "ai_unchecked"],
        [pages.gp, "ai_unchecked"],
      ].sort(),
    );
    const lines = await breachLines(h, ticket);
    expect(lines).toHaveLength(2);
    expect(lines.every((x) => x.kind === "change" && x.author_member_id === null)).toBe(true);
    expect(lines.map((x) => x.changes[0]!.to).sort()).toEqual(["営業の型", "請求書の送り方"].sort());
    await finishJob(h, job, { state: "done", result: "請求書を作りました" });
    expect(await breachRows(h, ticket)).toHaveLength(2);
    expect(await breachLines(h, ticket)).toHaveLength(2);
  });

  it("K714-J-005 完了にしようとして止まる：作業中に戻ったあと完了にしようとすると、必ず守るから入った未チェックの 2 行（会社・営業）が残りの一覧で返り、チケットは作業中のまま。人が足した未チェックの確認項目があっても一覧は増えない", async () => {
    const { w, ticket, pages, specs } = S;
    await backToDoing(w, ticket);
    await guardSpec(h, w, ticket, pages.menu, w.mem1, { source: "manual", title: "人が足した確認" });
    const r = await complete(w.mem1, ticket);
    expect(r.error).toBe("knowledge_left");
    expect(r.left!.map((x) => x.id).sort()).toEqual([specs.co, specs.gp].sort());
    expect(r.left!.map((x) => x.page_title).sort()).toEqual(["営業の型", "請求書の送り方"].sort());
    expect(await stageOf(ticket)).toBe("doing");
  });

  it("K714-J-006 全部にチェックが付くと完了にできる：AI が会社の確認項目に、高本さんが営業の確認項目にチェックを付けると、完了にできてチケットは完了になる（人が足した未チェックは止めない）", async () => {
    const { w, ticket, specs } = S;
    await aiCheckVia(w.mem1, specs.co);
    await q(
      "update test_specs set checked_at = now(), checked_by_member_id = $2, checked_by_ai = false where id = $1",
      [specs.gp, w.mem1.id],
    );
    const r = await complete(w.mem1, ticket);
    expect(r.error).toBeUndefined();
    expect(r.ticket_id).toBe(ticket);
    expect(await stageOf(ticket)).toBe("done");
  });

  it("K714-J-007 見直すページに出る：管理者の「よく破られる」は会社の「請求書の送り方」だけ・佐藤さん（営業のマネージャー）は営業の「営業の型」だけ（どちらも 1 回・自分の棚は出ない）。AI が 1 度も開いていない古いページ（公開から 100 日）は「使われていない」に出て、AI が開いた「見積もりの出し方」は出ない。メンバーは 403。木の管理の数は 管理者 1・佐藤さん 2", async () => {
    const { w, pages } = S;
    await ageDays(pages.old, 100);
    await ageDays(pages.menu, 100);
    const boss = await review(w.boss);
    expect(boss.broken.map((x) => [x["id"], x["count"]])).toEqual([[pages.co, 1]]);
    expect(boss.unused).toEqual([]);
    const mgr = await review(w.mgr1);
    expect(mgr.broken.map((x) => [x["id"], x["count"]])).toEqual([[pages.gp, 1]]);
    expect(mgr.unused.map((x) => x["id"])).toEqual([pages.old]);
    expect(mgr.conflicts).toEqual([]);
    expect((await call(w.mem1, "GET", "/knowledge/review")).status).toBe(403);
    expect(await reviewCount(w.boss)).toBe(1);
    expect(await reviewCount(w.mgr1)).toBe(2);
    expect(await reviewCount(w.mem1)).toBeNull();
  });

  it("K714-J-008 AI のチェックを人が外すと数えられ、完了がまた止まる：AI が 3 つともチェックを付けて終わりを知らせると破られた数は 0。佐藤さんの側の営業の確認項目のチェックを人が外すと「人が外した」が 1 つ数えられ、完了にしようとすると止まる。付け直すと完了にできる。見直すページの「よく破られる」に営業のページが 1 回で出る", async () => {
    const s = await scene(h, "K714 外す");
    for (const id of Object.values(s.specs)) await aiCheckVia(s.w.mem1, id);
    await finishJob(h, s.job, { state: "done", result: "請求書を作りました" });
    expect(await breachRows(h, s.ticket)).toEqual([]);
    await humanUncheck(h, s.specs.gp);
    const rows = await breachRows(h, s.ticket);
    expect(rows.map((x) => [x.page_id, x.kind])).toEqual([[s.pages.gp, "human_unchecked"]]);
    expect((await breachLines(h, s.ticket)).map((x) => x.changes[0]!.from)).toEqual(["human_unchecked"]);
    await backToDoing(s.w, s.ticket);
    const blocked = await complete(s.w.mem1, s.ticket);
    expect(blocked.error).toBe("knowledge_left");
    expect(blocked.left!.map((x) => x.id)).toEqual([s.specs.gp]);
    await aiCheckVia(s.w.mem1, s.specs.gp);
    expect((await complete(s.w.mem1, s.ticket)).error).toBeUndefined();
    expect((await review(s.w.mgr1)).broken.map((x) => [x["id"], x["count"]])).toEqual([[s.pages.gp, 1]]);
  });

  it("K714-J-009 会話の仕事（チケットなし）にも渡る：高本さんの会話の仕事には、会社・入っている全部のグループ（営業・受託開発）・自分の「必ず守る」が渡り、チケットのグループの外という絞りはかからない。ほかのグループの人の物は渡らない", async () => {
    const { w, pages } = S;
    const job = await mkJob(h, w, w.mem1, w.g1, null);
    const session = (await q<{ s: string }>("select taken_session_id as s from bridge_jobs where id = $1", [job]))[0]!
      .s;
    const chat = (await contextOf(session, job))!;
    expect(chat.must.map((x) => x.id)).toEqual([pages.co, pages.gp, pages.dev, pages.me]);
    const other = await mkJob(h, w, w.mem3, w.g3, null);
    const otherSession = (
      await q<{ s: string }>("select taken_session_id as s from bridge_jobs where id = $1", [other])
    )[0]!.s;
    const theirs = (await contextOf(otherSession, other))!;
    expect(theirs.must.map((x) => x.id)).toEqual([pages.co]);
  });

  it("K714-J-010 必ず守るを外すと、これからの確認項目にも完了にも効く：佐藤さんが営業の「必ず守る」を外すと、次に任せたチケットの確認項目に営業の行は入らない（会社・自分の 2 行）。前に入って未チェックのまま残っていた営業の行は、今は必ず守るでないので完了を止めない", async () => {
    const { w, pages } = S;
    const off = await call(w.mgr1, "PUT", `/knowledge_pages/${pages.gp}/must`, { must: false });
    expect(off.status, await off.clone().text()).toBe(200);
    const t2 = await mkTicket(h, w, w.g1, w.mem1, "todo");
    const del = await delegate(w.mem1, t2);
    expect(del.ok, JSON.stringify(del)).toBe(true);
    const refs = (
      await q<{ r: string }>(
        "select source_ref_id as r from test_specs where ticket_id = $1 and source = 'knowledge' and deleted_at is null",
        [t2],
      )
    ).map((x) => x.r);
    expect(refs.sort()).toEqual([pages.co, pages.me].sort());
    const old = await guardSpec(h, w, t2, pages.gp, w.mem1, { title: "『営業の型』を守った" });
    await aiCheckVia(w.mem1, await specIdOf(t2, pages.co));
    await aiCheckVia(w.mem1, await specIdOf(t2, pages.me));
    await backToDoing(w, t2);
    expect(old).toBeTruthy();
    const r = await complete(w.mem1, t2);
    expect(r.error).toBeUndefined();
    expect(await stageOf(t2)).toBe("done");
  });

  // K714-H-001 は人が確かめる行（画面を通す確認）。試験のコードは書かない（チケットの judge-skip）。
});
