// K-768「まとめて承認の口（previewBulkApproval・bulkApprove）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K768-API-…・K768-DB-…）は 11_tickets/K-768.md の行の表と 1 対 1。土台は K-63 の F5/approve-complete.harness.ts と K-732 が持ち込む F5/approval-more.kit.ts（loadHook）。
// 口：POST /api/v1/approvals/bulk/preview ← { approval_ids?: uuid[1..50] }（無ければ「自分が承認する物の全部」）→ 201 { data: { eligible, excluded, count, irreversible_count, unchecked_count } }（何も書かない）。
//     POST /api/v1/approvals/bulk ← { approval_ids: uuid[1..50] } → 201 { data: { updated: [{ approval_id, ticket_id, number, run_id, pc }], skipped: [{ approval_id, number, title, reason }] } }。
//   1 件ずつ、1 件承認する口（app.approval_decide）と同じ守りを通す。1 件ごとの取引（一部できなくても、通った物は承認される）。古い物から順に。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の列をずらして置く。
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  setupApproveComplete,
  ARTIFACT,
  T,
  O,
  boss,
  writer,
  viewer,
  outsider,
  f,
  json,
  one,
  num,
  req,
  auth,
  approve,
  stageKeyOf,
  ticket,
  delegated,
  approvalRow,
  runsOf,
  jobOf,
  messagesOf,
  snapshot,
  breakWritable,
  type Ticket,
  type Delegated,
} from "./approve-complete.harness.js";
import { loadHook } from "./approval-more.kit.js";
import type { Person } from "../fixture.js";

setupApproveComplete();

const E_MANY = "E-APR-030";
const hooks = () => loadHook("approval-bulk", "previewBulkApproval", "bulkApprove");
const preview = async (p: Person, body: unknown = {}) => {
  await hooks();
  return req("POST", "/approvals/bulk/preview", { body, headers: auth(p) });
};
const bulk = async (p: Person, ids: string[], extra: Record<string, unknown> = {}) => {
  await hooks();
  return req("POST", "/approvals/bulk", { body: { approval_ids: ids, ...extra }, headers: auth(p) });
};
type Item = {
  approval_id: string;
  ticket_id: string;
  number: string;
  title: string;
  irreversible: boolean;
  unchecked: number;
};
type Prev = {
  eligible: Item[];
  excluded: { approval_id: string; reason: string }[];
  count: number;
  irreversible_count: number;
  unchecked_count: number;
};
type Done = {
  updated: { approval_id: string; ticket_id: string; number: string; run_id: string; pc: string }[];
  skipped: { approval_id: string; number: string | null; title: string | null; reason: string }[];
};
const dataOf = async <R>(r: Response): Promise<R> => (await json(r)).data as unknown as R;

/** 承認する人（担当者）を 1 人作る。「全部」は自分が承認する物だけなので、試験ごとに別の人にして数を独立させる */
const approver = (name: string) => f.person(T.tenantId, T.rootScope, { name, ticketAbility: "edit" });
interface Mine {
  t: Ticket;
  d: Delegated;
}
/** その人が承認する承認待ちの成果物を n 件（古い順に 1 件ずつ作る） */
async function mine(p: Person, n: number, o: { prefix?: string; irreversible?: boolean } = {}): Promise<Mine[]> {
  const out: Mine[] = [];
  for (let i = 1; i <= n; i += 1) {
    const t = await ticket({ assignee: p, title: `${o.prefix ?? "請求"} ${i}` });
    out.push({ t, d: await delegated(t, o.irreversible === undefined ? {} : { irreversible: o.irreversible }) });
  }
  return out;
}
const spec = (t: Ticket, checked: boolean) =>
  f.admin.query(
    "insert into test_specs (tenant_id, ticket_id, title, check_kind, checked_at, checked_by_ai, created_by, updated_by) values ($1, $2, '確認 1 件', 'human', $3, $4, $5, $5)",
    [t.tenant, t.id, checked ? new Date().toISOString() : null, checked, boss.id],
  );
const bulkAudits = () =>
  num("select count(*) as n from audit_events where action = 'approvals.bulk' and tenant_id = $1", [T.tenantId]);
const execRuns = (t: Ticket) => runsOf(t.id, "execute");
const flag = async (t: string) =>
  (await one<{ d: boolean }>("select delegated_to_clone as d from tickets where id = $1", [t])).d;

describe("K-768 まとめて承認の確かめ（previewBulkApproval：何も書かない）", () => {
  it("K768-API-001 全部：体なしで、自分が承認する承認待ちの成果物が古い順に全部返る（eligible の鍵は approval_id・ticket_id・number・title・irreversible・unchecked の 6 つ）。count・irreversible_count・unchecked_count・excluded は空。承認・実行・段・やり取りは何も変わらない", async () => {
    const a = await approver("まとめる人 1");
    const rows = await mine(a, 3);
    const noise = await ticket({ assignee: boss, title: "ほかの人の物" });
    await delegated(noise);
    const before = await Promise.all(rows.map((x) => snapshot(x.t)));
    const r = await preview(a);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = await dataOf<Prev>(r);
    expect(Object.keys(v).sort()).toEqual(["count", "eligible", "excluded", "irreversible_count", "unchecked_count"]);
    expect(v.eligible.map((x) => x.approval_id)).toEqual(rows.map((x) => x.d.approvalId));
    expect(Object.keys(v.eligible[0]!).sort()).toEqual([
      "approval_id",
      "irreversible",
      "number",
      "ticket_id",
      "title",
      "unchecked",
    ]);
    expect(v.eligible.map((x) => x.title)).toEqual(["請求 1", "請求 2", "請求 3"]);
    expect(v).toMatchObject({ count: 3, irreversible_count: 3, unchecked_count: 0, excluded: [] });
    expect(await Promise.all(rows.map((x) => snapshot(x.t)))).toEqual(before);
    expect(await bulkAudits()).toBe(0);
  });

  it("K768-API-002 全部に入らない物：ほかの人が承認する物・決まった物・取り下げた物・消したチケットの物・別の会社の物・成果物でない承認は入らない（excluded にも出ない）", async () => {
    const a = await approver("まとめる人 2");
    const [x, decided, gone] = await mine(a, 3);
    expect((await approve(a, decided!.d.approvalId)).status).toBe(201);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone!.t.id]);
    await f.admin.query("update approvals set withdrawn_at = now() where id = $1", [
      (await mine(a, 1, { prefix: "取り下げ" }))[0]!.d.approvalId,
    ]);
    await f.admin.query("update approvals set kind = 'escalation' where id = $1", [
      (await mine(a, 1, { prefix: "上位" }))[0]!.d.approvalId,
    ]);
    const other = await ticket({ tenant: O.tenantId, scope: O.rootScope, assignee: outsider, title: "別の会社" });
    await delegated(other);
    const v = await dataOf<Prev>(await preview(a));
    expect(v.eligible.map((e) => e.approval_id)).toEqual([x!.d.approvalId]);
    expect(v.excluded).toEqual([]);
    expect(v.count).toBe(1);
  });

  it("K768-API-003 選んだもの：approval_ids を渡すと、その中で承認できる物が eligible（古い順）・できない物が excluded（approval_id と理由：決まっている decided・担当者でない not_approver・書けなくなった not_writable・無い／見えない unavailable）", async () => {
    const a = await approver("まとめる人 3");
    const [p1, p2, p3] = await mine(a, 3);
    expect((await approve(a, p2!.d.approvalId)).status).toBe(201); // 先に決まっている
    const others = await ticket({ assignee: boss, title: "ほかの人の物 2" });
    const od = await delegated(others);
    const unknown = randomUUID();
    const v = await dataOf<Prev>(
      await preview(a, {
        approval_ids: [p3!.d.approvalId, p2!.d.approvalId, od.approvalId, unknown, p1!.d.approvalId],
      }),
    );
    expect(v.eligible.map((e) => e.approval_id)).toEqual([p1!.d.approvalId, p3!.d.approvalId]);
    const ex = Object.fromEntries(v.excluded.map((e) => [e.approval_id, e.reason]));
    expect(ex).toEqual({ [p2!.d.approvalId]: "decided", [od.approvalId]: "not_approver", [unknown]: "unavailable" });
    expect(Object.keys(v.excluded[0]!).sort()).toEqual(["approval_id", "reason"]);
    expect(v.count).toBe(2);
    // 書けなくなった
    const w = await ticket({ assignee: a, title: "書けない物" });
    const wd = await delegated(w);
    await f.admin.query("delete from permissions where grantee_member_id = $1", [a.id]);
    const v2 = await dataOf<Prev>(await preview(a, { approval_ids: [wd.approvalId] }));
    expect(v2.eligible).toEqual([]);
    expect(["not_writable", "unavailable"]).toContain(v2.excluded[0]!.reason);
  });

  it("K768-API-004 50 件の線（G-16）：全部が 51 件あれば 409・E-APR-030（何も書かない）。50 件なら返り、選んだ 50 件を 1 回で承認でき、1 件はそのまま残る。選んだ id が 51 個なら 422", async () => {
    const a = await approver("まとめる人 4");
    const rows = await mine(a, 51);
    const before = await snapshot(rows[0]!.t);
    const r = await preview(a);
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(E_MANY);
    expect(await snapshot(rows[0]!.t)).toEqual(before);
    const ids = rows.map((x) => x.d.approvalId);
    expect((await preview(a, { approval_ids: ids })).status).toBe(422);
    expect((await bulk(a, ids)).status).toBe(422);
    const first50 = ids.slice(0, 50);
    const pv = await dataOf<Prev>(await preview(a, { approval_ids: first50 }));
    expect(pv.count).toBe(50);
    const done = await dataOf<Done>(await bulk(a, first50));
    expect(done.updated).toHaveLength(50);
    expect(done.skipped).toEqual([]);
    expect((await approvalRow(ids[50]!))["decision"]).toBeNull();
    expect(await dataOf<Prev>(await preview(a))).toMatchObject({ count: 1 });
  }, 180_000); // 準備に 51 件・承認に 50 件の取引を続けて叩くので、時間を長くする（vitest.config の注）

  it("K768-API-005 形の誤り（422）：approval_ids が uuid でない・空の並び・51 個以上・文字の並びでない・null を含む・知らない項目を付けた。bulkApprove は approval_ids が無いのも 422。preview は体なし・空の体なら通る。どれも何も書かない", async () => {
    const a = await approver("まとめる人 5");
    const [x] = await mine(a, 1);
    const before = await snapshot(x!.t);
    const id = x!.d.approvalId;
    for (const bad of [
      { approval_ids: ["abc"] },
      { approval_ids: [] },
      { approval_ids: "x" },
      { approval_ids: [id, null] },
      { approval_ids: [id], extra: 1 },
      { approval_ids: Array.from({ length: 51 }, () => randomUUID()) },
    ]) {
      expect((await preview(a, bad)).status, JSON.stringify(bad).slice(0, 60)).toBe(422);
      expect((await bulk(a, [], bad)).status).toBe(422);
    }
    expect((await bulk(a, [], { approval_ids: undefined })).status).toBe(422);
    expect((await preview(a, {})).status).toBe(201);
    expect(await snapshot(x!.t)).toEqual(before);
  });

  it("K768-API-006 チェックの無い確認項目の数：承認ごとの unchecked はそのチケットの確認項目のうちチェックの無い数、unchecked_count はその合計（件数であって承認の数ではない）。確認項目が無いチケットは 0", async () => {
    const a = await approver("まとめる人 6");
    const [p, q, r] = await mine(a, 3);
    await spec(p!.t, false);
    await spec(p!.t, false);
    await spec(p!.t, true);
    await spec(q!.t, true);
    const v = await dataOf<Prev>(await preview(a));
    const by = Object.fromEntries(v.eligible.map((e) => [e.title, e.unchecked]));
    expect(by).toEqual({ "請求 1": 2, "請求 2": 0, "請求 3": 0 });
    expect(v.unchecked_count).toBe(2);
    expect(r).toBeDefined();
  });

  it("K768-API-007 取り消せない物も対象（D-153.11・「取り消せる物だけ」の縛りは外した）：irreversible が真の承認も偽の承認も eligible に入り、irreversible_count は真の件数。承認の行の取り消せないの印は前の承認と同じく真になる", async () => {
    const a = await approver("まとめる人 7");
    const x = await mine(a, 2, { irreversible: true });
    const y = await mine(a, 1, { prefix: "取り消せる", irreversible: false });
    const v = await dataOf<Prev>(await preview(a));
    expect(v.count).toBe(3);
    expect(v.irreversible_count).toBe(2);
    expect(v.eligible.filter((e) => e.irreversible)).toHaveLength(2);
    const r = await bulk(
      a,
      [...x, ...y].map((m) => m.d.approvalId),
    );
    expect((await dataOf<Done>(r)).updated).toHaveLength(3);
  });

  it("K768-API-008 利用者の状態：担当者でない人（書ける人・見るだけの人）の「全部」は空（承認できる物は無い・403 にしない）。別の会社の人は自分の会社の物だけを見る。別の会社の承認 id を選ぶと unavailable", async () => {
    const a = await approver("まとめる人 8");
    const [x] = await mine(a, 1);
    for (const who of [writer, viewer]) {
      const v = await dataOf<Prev>(await preview(who));
      expect(v.eligible.filter((e) => e.approval_id === x!.d.approvalId)).toEqual([]);
    }
    const v = await dataOf<Prev>(await preview(outsider, { approval_ids: [x!.d.approvalId] }));
    expect(v.eligible).toEqual([]);
    expect(v.excluded).toEqual([{ approval_id: x!.d.approvalId, reason: "unavailable" }]);
    expect(await approvalRow(x!.d.approvalId)).toMatchObject({ decision: null });
  });
});

describe("K-768 まとめて承認（bulkApprove：1 件ずつ・1 件ごとの取引）", () => {
  it("K768-API-009 選んだ 2 件を承認：201 の updated（鍵は approval_id・ticket_id・number・run_id・pc）に 2 件・skipped は空。承認は 2 つとも approve・承認の後の実行が 1 つずつ待ちで積まれ、チケットは実行中・旗は立ち、やり取りと証跡は 1 件ごとに 1 つ。答えに成果物の本文は出ない", async () => {
    const a = await approver("まとめる人 9");
    const [p, q, rest] = await mine(a, 3);
    const r = await bulk(a, [q!.d.approvalId, p!.d.approvalId]);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const text = await r.clone().text();
    expect(text).not.toContain(ARTIFACT);
    const v = await dataOf<Done>(r);
    expect(Object.keys(v).sort()).toEqual(["skipped", "updated"]);
    expect(v.skipped).toEqual([]);
    expect(Object.keys(v.updated[0]!).sort()).toEqual(["approval_id", "number", "pc", "run_id", "ticket_id"]);
    for (const m of [p!, q!]) {
      expect(await approvalRow(m.d.approvalId)).toMatchObject({ decision: "approve", status_id: "approved" });
      const ex = await execRuns(m.t);
      expect(ex).toHaveLength(1);
      expect(ex[0]).toMatchObject({ status_id: "queued", approval_id: m.d.approvalId });
      expect(await jobOf(ex[0]!.bridge_job_id!)).toMatchObject({ state_id: "queued", permission_mode: "auto" });
      expect(await stageKeyOf(m.t.id)).toBe("running");
      expect(await flag(m.t.id)).toBe(true);
      expect((await messagesOf(m.t.id)).filter((x) => x.body.includes("が承認しました"))).toHaveLength(1);
      expect(
        await num("select count(*) as n from audit_events where action = 'approval.approve' and target_id = $1", [
          m.d.approvalId,
        ]),
      ).toBe(1);
    }
    expect(v.updated.map((u) => u.approval_id).sort()).toEqual([p!.d.approvalId, q!.d.approvalId].sort());
    expect(await approvalRow(rest!.d.approvalId)).toMatchObject({ decision: null }); // 選ばなかった物はそのまま
  });

  it("K768-API-010 全部：確かめで見た全部の id を渡すと、その全部が承認される（確かめと同じ並び・同じ件数）。承認待ちの一覧からは消える", async () => {
    const a = await approver("まとめる人 10");
    const rows = await mine(a, 4);
    const pv = await dataOf<Prev>(await preview(a));
    const done = await dataOf<Done>(
      await bulk(
        a,
        pv.eligible.map((e) => e.approval_id),
      ),
    );
    expect(done.updated.map((u) => u.approval_id)).toEqual(rows.map((x) => x.d.approvalId));
    expect(done.skipped).toEqual([]);
    const q = (await json(await req("GET", "/approvals/queue", { headers: auth(a) }))).data as { id: string }[];
    expect(q.filter((x) => rows.some((m) => m.d.approvalId === x.id))).toEqual([]);
    expect(await dataOf<Prev>(await preview(a))).toMatchObject({ count: 0, eligible: [] });
  });

  it("K768-API-011 一部できなかった（下絵 bulk-partial）：確かめた後に先にほかの手で決まった 1 件は skipped（reason decided・number と題名つき）で、通った物は承認される（1 件ずつの取引）。実行は決まった物の分だけ", async () => {
    const a = await approver("まとめる人 11");
    const [p, q] = await mine(a, 2);
    const pv = await dataOf<Prev>(await preview(a));
    expect((await approve(a, q!.d.approvalId)).status).toBe(201); // 確かめの後に先に決まった（別の画面で承認）
    const done = await dataOf<Done>(
      await bulk(
        a,
        pv.eligible.map((e) => e.approval_id),
      ),
    );
    expect(done.updated.map((u) => u.approval_id)).toEqual([p!.d.approvalId]);
    expect(done.skipped).toHaveLength(1);
    expect(done.skipped[0]).toEqual({
      approval_id: q!.d.approvalId,
      number: q!.t.number,
      title: "請求 2",
      reason: "decided",
    });
    expect(await execRuns(q!.t)).toHaveLength(1); // 先に承認した分の実行だけ（二重に積まない）
    expect(await execRuns(p!.t)).toHaveLength(1);
  });

  it("K768-API-012 承認できない id（担当者でない・別の会社・無い・取り下げた）は skipped（not_approver・unavailable・decided）。何も書かず、番号と題名は在ると言えるときだけ（unavailable は null）", async () => {
    const a = await approver("まとめる人 12");
    const [mineOne] = await mine(a, 1);
    const od = await delegated(await ticket({ assignee: boss, title: "ほかの人の物 3" }));
    const foreign = await delegated(
      await ticket({ tenant: O.tenantId, scope: O.rootScope, assignee: outsider, title: "別の会社 2" }),
    );
    const unknown = randomUUID();
    const before = await snapshot(mineOne!.t);
    const done = await dataOf<Done>(await bulk(a, [od.approvalId, foreign.approvalId, unknown]));
    expect(done.updated).toEqual([]);
    const by = Object.fromEntries(done.skipped.map((s) => [s.approval_id, s]));
    expect(by[od.approvalId]).toMatchObject({ reason: "not_approver" });
    expect(by[foreign.approvalId]).toEqual({
      approval_id: foreign.approvalId,
      number: null,
      title: null,
      reason: "unavailable",
    });
    expect(by[unknown]).toEqual({ approval_id: unknown, number: null, title: null, reason: "unavailable" });
    expect(await approvalRow(od.approvalId)).toMatchObject({ decision: null });
    expect(await approvalRow(foreign.approvalId)).toMatchObject({ decision: null });
    expect(await snapshot(mineOne!.t)).toEqual(before);
  });

  it("K768-API-013 チェックの無い確認項目が残っていても承認される（D-153.5）：未チェックの確認項目があるチケットも updated に入り、確認項目のチェックには触らない", async () => {
    const a = await approver("まとめる人 13");
    const [p] = await mine(a, 1);
    await spec(p!.t, false);
    const r = await bulk(a, [p!.d.approvalId]);
    expect((await dataOf<Done>(r)).updated).toHaveLength(1);
    const s = await one<{ checked_at: unknown; checked_by_ai: boolean }>(
      "select checked_at, checked_by_ai from test_specs where ticket_id = $1",
      [p!.t.id],
    );
    expect(s).toMatchObject({ checked_at: null, checked_by_ai: false });
  });

  it("K768-API-014 古い物から順に承認する：渡した id の並びに関わらず、承認待ちになった順（古い順）に 1 件ずつ。答えの updated の並びも、承認の後の実行が積まれた順も同じ", async () => {
    const a = await approver("まとめる人 14");
    const rows = await mine(a, 4);
    const shuffled = [rows[2]!, rows[0]!, rows[3]!, rows[1]!].map((x) => x.d.approvalId);
    const done = await dataOf<Done>(await bulk(a, shuffled));
    expect(done.updated.map((u) => u.approval_id)).toEqual(rows.map((x) => x.d.approvalId));
    const created = await Promise.all(rows.map(async (x) => (await execRuns(x.t))[0]!.id));
    const order = (
      await f.admin.query<{ id: string }>("select id from action_runs where id = any($1) order by created_at, id", [
        created,
      ])
    ).rows.map((x) => x.id);
    expect(order).toEqual(created);
  });

  it("K768-API-015 二重に押す・同時に押す（操作の揺れ）：同じ id をもう 1 度送ると全部 skipped（decided）で実行は増えない。同時に 2 つ送っても、1 件につき承認は 1 度だけで実行は 1 つだけ", async () => {
    const a = await approver("まとめる人 15");
    const rows = await mine(a, 3);
    const ids = rows.map((x) => x.d.approvalId);
    const rs = await Promise.all([bulk(a, ids), bulk(a, ids)]);
    expect(rs.map((r) => r.status)).toEqual([201, 201]);
    const [x, y] = await Promise.all(rs.map((r) => dataOf<Done>(r)));
    expect(x!.updated.length + y!.updated.length).toBe(3);
    expect(x!.skipped.length + y!.skipped.length).toBe(3);
    for (const m of rows) expect(await execRuns(m.t)).toHaveLength(1);
    const again = await dataOf<Done>(await bulk(a, ids));
    expect(again.updated).toEqual([]);
    expect(again.skipped.map((s) => s.reason)).toEqual(["decided", "decided", "decided"]);
    for (const m of rows) expect(await execRuns(m.t)).toHaveLength(1);
  });

  it("K768-API-016 S1 の失敗・途中で守りの判定が落ちた（失敗）：その 1 件で止まり 503・E-PAGE-003。落ちる前に承認した物は承認のまま残り、落ちた物と後ろの物は決まっていない（何も書かれない）。ログに題名・番号・id を出さない", async () => {
    const a = await approver("まとめる人 16");
    const [p, q, r] = await mine(a, 3);
    let res!: Response;
    const logs: string[] = [];
    const orig = console.error;
    console.error = (...x: unknown[]) => void logs.push(x.map(String).join(" "));
    try {
      res = await breakWritable(q!.t.title, () =>
        bulk(
          a,
          [p!, q!, r!].map((m) => m.d.approvalId),
        ),
      );
    } finally {
      console.error = orig;
    }
    expect(res.status).toBe(503);
    expect((await json(res))["code"]).toBe("E-PAGE-003");
    expect(await approvalRow(p!.d.approvalId)).toMatchObject({ decision: "approve" });
    expect(await approvalRow(q!.d.approvalId)).toMatchObject({ decision: null });
    expect(await approvalRow(r!.d.approvalId)).toMatchObject({ decision: null });
    expect(await execRuns(q!.t)).toHaveLength(0);
    expect(logs.join("\n")).not.toContain(q!.t.title);
    expect(logs.join("\n")).not.toContain(q!.d.approvalId);
  });

  it("K768-API-017 動かす AI が使えない（任せた人が外された）：承認は記録され updated に入る（承認の後の実行はその場で止まりになる・1 件承認する口と同じ）。ほかの物には影響しない", async () => {
    const a = await approver("まとめる人 17");
    const [p, q] = await mine(a, 2);
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [p!.d.by.id]);
    const done = await dataOf<Done>(
      await bulk(
        a,
        [p!, q!].map((m) => m.d.approvalId),
      ),
    );
    expect(done.updated).toHaveLength(2);
    expect(await approvalRow(p!.d.approvalId)).toMatchObject({ decision: "approve" });
    expect((await execRuns(p!.t))[0]).toMatchObject({ status_id: "stopped" });
    expect(await stageKeyOf(p!.t.id)).toBe("doing");
    expect((await execRuns(q!.t))[0]).toMatchObject({ status_id: "queued" });
  });

  it("K768-API-018 S2 の失敗・まとめての証跡：1 回につき approvals.bulk が 1 行（payload は requested・updated・skipped の件数だけ・題名・番号・id を入れない）。この証跡が書けなくても、承認は残り 201 を返す（1 件ごとの証跡 approval.approve は先に書けている）", async () => {
    const a = await approver("まとめる人 18");
    const [p, q] = await mine(a, 2);
    const before = await bulkAudits();
    await bulk(a, [p!.d.approvalId, randomUUID()]);
    expect(await bulkAudits()).toBe(before + 1);
    const row = await one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where action = 'approvals.bulk' and tenant_id = $1 order by created_at desc limit 1",
      [T.tenantId],
    );
    expect(row.payload).toEqual({ requested: 2, updated: 1, skipped: 1 });
    expect(JSON.stringify(row.payload)).not.toContain(p!.t.title);
    // 証跡が書けない
    const fn = `k768_fail_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    await f.admin.query(
      `create function ${fn}() returns trigger language plpgsql as $$ begin if new.action = 'approvals.bulk' then raise exception 'k768 わざと落とす' using errcode = 'XX000'; end if; return new; end $$`,
    );
    await f.admin.query(`create trigger ${fn} before insert on audit_events for each row execute function ${fn}()`);
    try {
      const r = await bulk(a, [q!.d.approvalId]);
      expect(r.status).toBe(201);
      expect((await dataOf<Done>(r)).updated).toHaveLength(1);
    } finally {
      await f.admin.query(`drop trigger if exists ${fn} on audit_events`);
      await f.admin.query(`drop function if exists ${fn}()`);
    }
    expect(await approvalRow(q!.d.approvalId)).toMatchObject({ decision: "approve" });
    expect(await bulkAudits()).toBe(before + 1);
  });

  it("K768-DB-001 DB の形：app.approval_bulk_scan は kaname_app だけが実行できる（読むだけ）。1 件承認する app.approval_decide は前のまま 3 つ目までの呼び方で通る（まとめて承認はこの関数を 1 件ずつ呼ぶ）", async () => {
    const acl = await f.admin.query<{ app: boolean; pub: boolean; args: string }>(
      `select has_function_privilege('kaname_app', p.oid, 'execute') as app, has_function_privilege('public', p.oid, 'execute') as pub,
              pg_get_function_identity_arguments(p.oid) as args
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'approval_bulk_scan'`,
    );
    expect(acl.rows).toHaveLength(1);
    expect(acl.rows[0]).toMatchObject({ app: true, pub: false });
    expect(acl.rows[0]!.args).toBe("p_ids uuid[], p_all boolean");
    const a = await approver("まとめる人 19");
    const [p] = await mine(a, 1);
    const v = (
      await f.admin.query<{ v: unknown }>("select app.approval_bulk_scan($1, false) as v", [[p!.d.approvalId]])
    ).rows[0]!.v;
    expect(v).toBeNull(); // 要求の文脈（呼んだ人）が無いときは何も返さない
  });
});
