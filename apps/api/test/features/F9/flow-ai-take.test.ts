// K-714「中間（段 10・J2）：AI が読んで守る」の 2 つ目の試験：取る口を通した全体（PC の印つき）（本物の Postgres・本物の口・本物の PC の印）。
//   行 ID は K714-J-NNN（チケット 11_tickets/K-714.md の表の行と 1 対 1）。K-697 の md の申し送りが「口を通した全体は K-714 が受ける」と決めた分。
//   土台は本線の K-62 の試験と同じ apps/api/test/features/F5/delegate-kit.ts（makeKit：本物の Postgres・本物の PC の印・任せる・取る・道具・返す の口）に、
//   完了の口の振る舞い approveHooks（K-63・K-566・K-701）を足す。承認の口 approveApproval も本物（承認 → 実行の仕事 → 実行を終える の道を通す）。
//   ナレッジのページは行の守りの外で DB に直に入れる（書く口は flow-knowledge-shelves.test.ts が通す）。AI がチェックを付ける道は段 5 の K-435 の
//   DB の関数 app.test_spec_check_by_ai（段 6 が未切りなので試験の準備で直に呼ぶ）。
//   使用者の本物の Bridge に触らない（38617 を開かない・プロセスを止めない）。PC は試験の PC（本物の印の解決）。固定の待ちは置かない。
//   行 011〜015 は 1 本の筋で、前の行が作った物を次の行が読む（上から順に流れる）。行 016 は自分の準備を持つ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { approveHooks } from "../../../src/features/F5/approve-complete/index.js";
import type { Person } from "../fixture.js";
import { data, delegateOk, json, makeKit, type Device, type Kit } from "../F5/delegate-kit.js";
import { bodyOf } from "./knowledge.harness.js";

type Row = Record<string, unknown>;
/** Claude Code の作業セッションの id（本物は uuid・作る段の仕事と実行の仕事で同じ物を使う） */
const SESSION = "71471471-0000-4000-8000-00000000b001";

let k: Kit;
beforeAll(async () => {
  k = await makeKit();
  // 本物のサーバーと同じ並び：完了・承認の口の振る舞い（approveHooks）を、任せる・取る口の後に足す
  Object.assign(k.f.hooks, approveHooks(k.f.pool));
  for (const op of ["completeTicket", "approveApproval", "listApprovalQueue", "getApproval"]) k.f.limits[op] = 100_000;
}, 120_000);
afterAll(async () => {
  await k?.close();
});

interface Co {
  tenantId: string;
  rootScope: string;
  g1: string;
  g2: string;
  boss: Person;
  taka: Person;
  ken: Person;
}
interface Story {
  co: Co;
  pc: Device;
  ticket: string;
  jobId: string;
  token: string | null;
  pages: { co: string; gp: string; me: string; dev: string; menu: string };
}
let S: Story;

const group = async (tenantId: string, parent: string, name: string, prefix: string): Promise<string> =>
  (
    await k.q<{ id: string }>(
      "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, $3, $4) returning id",
      [tenantId, parent, name, prefix],
    )
  )[0]!.id;
const member = async (c: { tenantId: string }, scope: string, name: string): Promise<Person> => {
  const p = await k.f.person(c.tenantId, scope, { name, ticketAbility: "edit" });
  await k.q(
    "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, true, 'member')",
    [c.tenantId, p.id, scope],
  );
  return p;
};
const addPage = async (
  tenantId: string,
  scope: string,
  owner: Person,
  title: string,
  text: string,
  o: { must?: boolean; personal?: boolean } = {},
): Promise<string> => {
  const id = (
    await k.q<{ id: string }>(
      "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, is_must, title, summary, current_version) values ($1, $2, $3, $4, 'published', $5, $6, $7, 1) returning id",
      [tenantId, scope, o.personal ?? false, owner.id, o.must ?? false, title, `${title}の説明`],
    )
  )[0]!.id;
  await k.q(
    "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) values ($1, $2, 1, 'published', $3::jsonb, $4, now(), $4)",
    [tenantId, id, JSON.stringify(bodyOf(text)), owner.id],
  );
  return id;
};
const promptOf = (job: Row): string => String(job["prompt"]);
const aiCheck = (p: Person, spec: string): Promise<unknown> =>
  withTenant(
    k.f.pool,
    { tenantId: p.tenantId, userId: p.id, role: "member", stepUpAt: null },
    async (cl) => (await cl.query("select app.test_spec_check_by_ai($1, true) as v", [spec])).rows[0]!.v,
  );
const knowledgeSpecs = (ticket: string): Promise<Row[]> =>
  k.q(
    "select id, title, source, source_ref_id, checked_at from test_specs where ticket_id = $1 and source = 'knowledge' and deleted_at is null",
    [ticket],
  );
const complete = (p: Person, ticket: string): Promise<Response> =>
  k.f.req("POST", `/tickets/${ticket}/complete`, { body: { conditions_confirmed: true }, headers: p.auth });

describe("K-714 中間：AI が読んで守る（取る口を通した全体）", () => {
  it("K714-J-011 取ると本文と目次が渡る：高本さん（営業）が営業のチケットを AI に任せ、PC が仕事を取ると、渡る仕事の prompt に 会社・営業・自分の「必ず守る」の本文が全部入り、目次に営業の「見積もりの出し方」の題名だけが入る（本文は入らない）。受託開発の「必ず守る」は題名も本文も入らない。確認項目には必ず守るの 3 行が入る", async () => {
    const c = await k.f.company("K714 take の会社", "KT");
    const g1 = await group(c.tenantId, c.rootScope, "営業", "KS");
    const g2 = await group(c.tenantId, c.rootScope, "受託開発", "KD");
    const boss = await member(c, c.rootScope, "管理者");
    const taka = await member(c, g1, "高本");
    const ken = await member(c, g2, "開発メンバー");
    const pages = {
      co: await addPage(c.tenantId, c.rootScope, boss, "請求書の送り方", "請求書は月末に締めて 5 日までに送る", {
        must: true,
      }),
      gp: await addPage(c.tenantId, g1, taka, "営業の型", "見積もりは 2 日以内に返す", { must: true }),
      me: await addPage(c.tenantId, g1, taka, "自分の工夫", "朝に返信をまとめる", { must: true, personal: true }),
      dev: await addPage(c.tenantId, g2, ken, "納品の前の確かめ", "納品の前に動作を確かめる", { must: true }),
      menu: await addPage(c.tenantId, g1, taka, "見積もりの出し方", "見積もりは項目ごとに書く"),
    };
    const pc = await k.device(taka);
    const ticket = await k.ticket(taka, { scope: g1 });
    const d = await delegateOk(k, taka, ticket);
    const job = await k.takeJob(pc);
    expect(job.job_id).toBe(d.job_id);
    const prompt = promptOf(job);
    for (const t of ["5 日までに送る", "2 日以内に返す", "朝に返信をまとめる"]) expect(prompt, t).toContain(t);
    expect(prompt).toContain("見積もりの出し方");
    expect(prompt).not.toContain("項目ごとに書く");
    expect(prompt).not.toContain("納品の前の確かめ");
    expect(prompt).not.toContain("動作を確かめる");
    expect((await knowledgeSpecs(ticket)).map((x) => x["source_ref_id"]).sort()).toEqual(
      [pages.co, pages.gp, pages.me].sort(),
    );
    S = {
      co: { tenantId: c.tenantId, rootScope: c.rootScope, g1, g2, boss, taka, ken },
      pc,
      ticket,
      jobId: job.job_id,
      token: job.tool_token,
      pages,
    };
  });

  it("K714-J-012 AI が道具でページを開く：PC が渡された鍵で「見積もりの出し方」を開くと 201 で本文が返り、開いた記録とやり取りの 1 行が 1 つずつ残る。もう一度開いても増えず（開いたばかりでない）、受託開発のページは 404（体に欄も details も無い）で何も残らない", async () => {
    const { pc, jobId, token, ticket, pages } = S;
    const open = (page: string) => k.tool(pc, jobId, "knowledge_open", token, { page_id: page });
    const first = await open(pages.menu);
    expect(first.status, await first.clone().text()).toBe(201);
    const res = (await data(first))["result"] as Row;
    expect(res).toMatchObject({ ok: true, opened_now: true, page: { id: pages.menu, title: "見積もりの出し方" } });
    expect(String((res["page"] as Row)["body_text"])).toContain("項目ごとに書く");
    const again = await open(pages.menu);
    expect(again.status).toBe(201);
    expect(((await data(again))["result"] as Row)["opened_now"]).toBe(false);
    const gone = await open(pages.dev);
    expect(gone.status).toBe(404);
    const body = await json(gone);
    expect(Object.keys(body)).not.toContain("field");
    expect(Object.keys(body)).not.toContain("details");
    const logs = await k.q<{ ref_id: string }>(
      "select ref_id from reference_logs where bridge_job_id = $1 and deleted_at is null",
      [jobId],
    );
    expect(logs.map((x) => x.ref_id)).toEqual([pages.menu]);
    expect(
      await k.n(
        "select count(*) as n from ticket_messages where ticket_id = $1 and changes->0->>'field' = 'knowledge_open'",
        [ticket],
      ),
    ).toBe(1);
  });

  it("K714-J-013 チェックを付けないまま終わりを知らせると破られた数が増える：PC が結果つきで終わりを知らせると 201（承認待ちになる）。必ず守るから入った 3 行がどれも未チェックなので、破られた数が 3 つ（会社・営業・自分の「未チェックで終わった」）数えられ、やり取りに「守れていなかった決まり」の行が 3 つ出る", async () => {
    const { pc, jobId, ticket, pages } = S;
    const r = await k.finish(pc, jobId, { state: "done", result: "請求書を作りました", agent_session_id: SESSION });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(((await data(r)) as Row)["outcome"]).toBe("awaiting_approval");
    const rows = await k.q<{ page_id: string; kind: string }>(
      "select page_id, kind from knowledge_breaches where ticket_id = $1",
      [ticket],
    );
    expect(rows.map((x) => [x.page_id, x.kind]).sort()).toEqual(
      [pages.co, pages.gp, pages.me].map((p) => [p, "ai_unchecked"]).sort(),
    );
    expect(
      await k.n(
        "select count(*) as n from ticket_messages where ticket_id = $1 and changes->0->>'field' = 'knowledge_breach'",
        [ticket],
      ),
    ).toBe(3);
  });

  it("K714-J-014 完了にしようとして止まる：承認して実行の仕事を PC が終わらせ、チケットが作業中に戻ったあとで完了にしようとすると、409 E-KNW-240 で止まり、残りの一覧に必ず守るから入った未チェックの 3 行（行の id・文・ページの id・ページの題名）が返る。人が足した確認項目（未チェック）は一覧に出ない。チケットは作業中のまま", async () => {
    const { co, pc, ticket, pages } = S;
    const approval = (
      await k.q<{ id: string }>("select id from approvals where ticket_id = $1 and decision is null", [ticket])
    )[0]!.id;
    const ok = await k.f.req("POST", `/approvals/${approval}/approve`, { body: {}, headers: co.taka.auth });
    expect(ok.status, await ok.clone().text()).toBe(201);
    await k.lastSeen(pc, 1);
    const exec = await k.takeJob(pc);
    const fin = await k.finish(pc, exec.job_id, { state: "done", result: "送りました", agent_session_id: SESSION });
    expect(fin.status, await fin.clone().text()).toBe(201);
    expect(await k.stageOf(ticket)).toBe("doing");
    const r = await complete(co.taka, ticket);
    expect(r.status, await r.clone().text()).toBe(409);
    const body = await json(r);
    expect(body.code).toBe("E-KNW-240");
    const left = ((body as Row)["detail"] as { left: Row[] }).left;
    expect(left.map((x) => x["page_id"]).sort()).toEqual([pages.co, pages.gp, pages.me].sort());
    for (const x of left) expect(Object.keys(x).sort()).toEqual(["id", "page_id", "page_title", "title"]);
    expect(await k.stageOf(ticket)).toBe("doing");
  });

  it("K714-J-015 全部にチェックが付くと完了にできる：AI が 3 つの確認項目にチェックを付けると、完了にでき（201）、チケットは完了になる。人が足した未チェックの確認項目は止めない", async () => {
    const { co, ticket } = S;
    for (const s of await knowledgeSpecs(ticket)) await aiCheck(co.taka, String(s["id"]));
    const r = await complete(co.taka, ticket);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await k.stageOf(ticket)).toBe("done");
  });

  it("K714-J-016 チケットのグループの外の必ず守るは渡らない：受託開発の開発メンバーが受託開発のチケットを任せて PC が取ると、prompt に会社と受託開発の「必ず守る」の本文が入り、営業の「営業の型」と「見積もりの出し方」は題名にも本文にも入らない", async () => {
    const { co, pages } = S;
    const ticket = await k.ticket(co.ken, { scope: co.g2 });
    const pc = await k.device(co.ken, "開発の PC");
    const d = await delegateOk(k, co.ken, ticket);
    const job = await k.takeJob(pc);
    expect(job.job_id).toBe(d.job_id);
    const prompt = promptOf(job);
    expect(prompt).toContain("5 日までに送る");
    expect(prompt).toContain("動作を確かめる");
    for (const t of ["営業の型", "2 日以内に返す", "見積もりの出し方", "項目ごとに書く", "朝に返信をまとめる"]) {
      expect(prompt, t).not.toContain(t);
    }
    expect((await knowledgeSpecs(ticket)).map((x) => x["source_ref_id"]).sort()).toEqual([pages.co, pages.dev].sort());
  });

  // K714-H-001 は人が確かめる行（画面を通す確認）。試験のコードは書かない（チケットの judge-skip）。
});
