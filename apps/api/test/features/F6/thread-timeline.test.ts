// K-383「やり取りを読む口（listTicketTimeline）と、最後に開いた時刻の表」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K383-API-…）は 11_tickets/K-383.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py の RESPONSES と 05_flow/screen_api.d/K-383.py で直す。画面の試験の道具 apps/web/tests/k/thread-mock.ts と同じ形）:
//   listTicketTimeline  GET /api/v1/tickets/:id/timeline?limit&before_at&before_id&filter（そのチケットを読める人・120 回／分／人）
//     200 { data: TimelineItem[], meta: { limit, older_count, new_count, mine_count, post_count, people? } }・Cache-Control: private, no-store
//     data は新しい方から limit 件（既定 20・1〜100）を、古い順（at・id の昇順）に並べたもの。before_at と before_id（いちばん古い行の時刻と id）を渡すと、それより前の同じ件数
//     older_count：返した中のいちばん古い行より前に、同じ絞り込みであと何件あるか
//     filter：all（既定・全部）／talk（書き込みと、消した書き込みの跡だけ）／mine（自分あて：自分が @ されたか知らせる人に入っていた、ほかの人の消していない書き込み）
//     new_count：最後に開いた時刻（app.ticket_thread_seen）より後の、ほかの人の消していない書き込みの数（絞り込みとページに依らない）。時刻が無ければ全部
//     mine_count：自分あての数（全部）。post_count：消していない書き込みの数（全部）
//     people：before が無いとき（最初の 1 回）だけ。そのチケットを見られる、抜けていない・止められていない人（見ている人も含む）。
//             { member_id, display_name, call_name, label（担当者／承認する人／グループの名前）, is_assignee, is_approver }（@ と知らせる人の候補・⑨）
//   TimelineItem = { id, kind: post|change|system|deleted|run, at, actor, message, changes, run, deleted }
//     message（書き込み・仕組みの行だけ）= { body, mentions, notified, quote: { id, excerpt } | null, edited_at, stars, starred, is_new, decided, can_edit, can_delete }
//     run（AI の実行 1 回＝1 枚・D-128.45）= { id, summary, started_at, finished_at, minutes, result（実行の状態の鍵）}
// DB（migration 20261120130000_ticket_timeline.sql）:
//   ticket_messages に notify_member_ids uuid[]（既定 '{}'）・quote_text text・edited_at timestamptz・deleted_by uuid（members）
//   app.ticket_thread_seen（tenant_id・ticket_id・member_id・seen_at・アプリの役は直に触れない）。読む関数 app.ticket_timeline
import { beforeAll, describe, expect, it } from "vitest";
import { ITEM_KEYS, MESSAGE_KEYS, setupThread, who, type Item, type Person, type Ticket } from "./thread.harness.js";

const h = setupThread(["ticket-timeline"]);

const tl = (p: Person | null, t: Ticket, q = "") => h.req(p, "GET", `/tickets/${t.id}/timeline${q}`);
const items = async (r: Response) => ((await h.json(r)).data ?? []) as Item[];
const meta = async (r: Response) => (await h.json(r)).meta as Record<string, unknown>;
const pick = async (p: Person, t: Ticket, id: string) => (await items(await tl(p, t, "?limit=100"))).find((x) => x.id === id)!;
const seen = (t: Ticket, p: Person, minutesAgo: number) =>
  h.f.admin.query(
    "insert into app.ticket_thread_seen (tenant_id, ticket_id, member_id, seen_at) values ($1, $2, $3, now() - make_interval(mins => $4))",
    [t.tenant, t.id, p.id, minutesAgo],
  );
const del = (id: string, by: Person) =>
  h.f.admin.query("update ticket_messages set deleted_at = now(), deleted_by = $2 where id = $1", [id, by.id]);
const STAGE = [{ field: "stage", from: "作業中", to: "保留" }];

let common: Ticket;
beforeAll(async () => {
  common = await h.ticket({ title: "K383 ふつうのチケット" });
});

describe("K-383 やり取りを読む：並び・形・続き", () => {
  it("K383-API-001 ふつう：書き込み・変更の 1 行・仕組みの行・AI の実行 1 回が、古い順に 1 本で出る。どの行も鍵がそろい、別のチケットの行は出ない", async () => {
    const t = common;
    const other = await h.ticket();
    await h.post(other, h.writer, { body: "別のチケットの書き込み", at: 50 });
    const p1 = await h.post(t, h.writer, { body: "見積もりを確認してください", at: 40 });
    const c1 = await h.post(t, h.boss, { kind: "change", at: 30, changes: [{ field: "stage", from: "未着手", to: "作業中" }] });
    const s1 = await h.post(t, h.boss, { kind: "system", body: "高本がAIに任せました", at: 20 });
    const r1 = await h.run(t, h.boss, { at: 15 });
    const p2 = await h.post(t, h.boss, { body: "確認しました", at: 10 });
    const r = await tl(h.writer, t);
    expect(r.status).toBe(200);
    const d = await items(r);
    expect(d.map((x) => x.id)).toEqual([p1, c1, s1, r1, p2]);
    expect(d.map((x) => x.kind)).toEqual(["post", "change", "system", "run", "post"]);
    for (const x of d) expect(Object.keys(x).sort()).toEqual(ITEM_KEYS);
    expect(JSON.stringify(d)).not.toContain("別のチケットの書き込み");
    expect(Object.keys(d[0]!.message!).sort()).toEqual(MESSAGE_KEYS);
    expect(d[0]!.message!.body).toBe("見積もりを確認してください");
    expect(d[0]!.actor).toEqual(who(h.writer, "佐藤"));
    expect(d[1]!.message).toBeNull();
    expect(d[1]!.changes).toEqual([{ field: "stage", from: "未着手", to: "作業中" }]);
    expect(d[2]!.message!.body).toBe("高本がAIに任せました");
    expect(d[2]!.message!.can_edit).toBe(false);
    expect(d[3]!.message).toBeNull();
    expect(d[3]!.actor?.member_id).toBe(h.boss.id);
    expect(Object.keys(d[3]!.run!).sort()).toEqual(["finished_at", "id", "minutes", "result", "started_at", "summary"]);
    expect(d[3]!.run!.id).toBe(r1);
    expect(d[3]!.run!.result).toBe("done");
    expect(d[3]!.run!.minutes).toBe(0);
    for (const x of [d[0]!, d[1]!, d[2]!, d[4]!]) expect(x.run).toBeNull();
    for (const x of d) expect(x.deleted).toBeNull();
  });

  it("K383-API-002 続き：25 件あれば、新しい方から 20 件を古い順に返し、older_count は 5。limit を渡せばその件数", async () => {
    const t = await h.ticket();
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) ids.push(await h.post(t, h.writer, { body: `書き込み ${i}`, at: 100 - i }));
    const r = await tl(h.writer, t);
    expect(r.status).toBe(200);
    expect((await items(r)).map((x) => x.id)).toEqual(ids.slice(5));
    const m = await meta(r);
    expect(m["older_count"]).toBe(5);
    expect(m["limit"]).toBe(20);
    const r2 = await tl(h.writer, t, "?limit=3");
    expect((await items(r2)).map((x) => x.id)).toEqual(ids.slice(22));
    expect((await meta(r2))["older_count"]).toBe(22);
  });

  it("K383-API-003 前を見る：before_at と before_id（いちばん古い行の時刻と id）で、それより前の同じ件数。同じ時刻の行は id の順で切れ目を飛ばさず重ねない。前を見る答えに people は無い", async () => {
    const t = await h.ticket();
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) ids.push(await h.post(t, h.writer, { body: `前 ${i}`, at: 60 - i }));
    await h.f.admin.query(
      "update ticket_messages set created_at = (select created_at from ticket_messages where id = $1) where id = $2",
      [ids[3], ids[2]],
    );
    const all = await items(await tl(h.writer, t, "?limit=100"));
    expect(all).toHaveLength(6);
    const first = await items(await tl(h.writer, t, "?limit=3"));
    const oldest = first[0]!;
    const r = await tl(h.writer, t, `?limit=3&before_at=${encodeURIComponent(oldest.at)}&before_id=${oldest.id}`);
    expect(r.status).toBe(200);
    const prev = await items(r);
    expect([...prev, ...first].map((x) => x.id)).toEqual(all.map((x) => x.id));
    const m = await meta(r);
    expect(m["older_count"]).toBe(0);
    expect(m["people"]).toBeUndefined();
  });
});

describe("K-383 絞り込み・新しい・数・候補", () => {
  it("K383-API-004 絞り込み talk は書き込みと消した書き込みの跡だけ（変更・仕組みの行・AI の実行は出ない）。mine は自分が @ されたか知らせる人に入っていた、ほかの人の消していない書き込みだけで、mine_count はその数", async () => {
    const t = await h.ticket();
    const a = await h.post(t, h.writer, { body: "@高本 見てください", mentions: [h.boss], at: 50 });
    const b = await h.post(t, h.writer, { body: "知らせるだけ", at: 45 });
    await h.f.admin.query("update ticket_messages set notify_member_ids = $2 where id = $1", [b, [h.boss.id]]);
    const own = await h.post(t, h.boss, { body: "自分の書き込み（自分を @）", mentions: [h.boss], at: 40 });
    const gone = await h.post(t, h.writer, { body: "消した @", mentions: [h.boss], at: 35 });
    await del(gone, h.writer);
    const plain = await h.post(t, h.writer, { body: "ふつう", at: 30 });
    await h.post(t, h.boss, { kind: "change", at: 25, changes: STAGE });
    await h.post(t, null, { kind: "system", body: "仕組みの行", at: 20 });
    await h.run(t, h.boss, { at: 15 });
    const talk = await items(await tl(h.boss, t, "?filter=talk"));
    expect(talk.map((x) => x.id)).toEqual([a, b, own, gone, plain]);
    expect(talk.map((x) => x.kind)).toEqual(["post", "post", "post", "deleted", "post"]);
    const r = await tl(h.boss, t, "?filter=mine");
    expect((await items(r)).map((x) => x.id)).toEqual([a, b]);
    expect((await meta(r))["mine_count"]).toBe(2);
    expect((await meta(await tl(h.boss, t)))["mine_count"]).toBe(2);
  });

  it("K383-API-005 新しい：最後に開いた時刻より後の、ほかの人の消していない書き込みだけに is_new。new_count はその数（絞り込み・ページに依らない）。自分の書き込み・変更・仕組みの行は新しくない", async () => {
    const t = await h.ticket();
    await h.post(t, h.writer, { body: "前の書き込み", at: 50 });
    await seen(t, h.boss, 40);
    const n1 = await h.post(t, h.writer, { body: "後の書き込み 1", at: 30 });
    const n2 = await h.post(t, h.viewer, { body: "後の書き込み 2", at: 25 });
    await h.post(t, h.boss, { body: "自分の後の書き込み", at: 20 });
    const g = await h.post(t, h.writer, { body: "後に書いて消した", at: 15 });
    await del(g, h.writer);
    await h.post(t, h.writer, { kind: "change", at: 10, changes: STAGE });
    await h.post(t, null, { kind: "system", body: "仕組みの行", at: 5 });
    const r = await tl(h.boss, t);
    const d = await items(r);
    expect(d.filter((x) => x.message?.is_new).map((x) => x.id)).toEqual([n1, n2]);
    expect((await meta(r))["new_count"]).toBe(2);
    expect((await meta(await tl(h.boss, t, "?limit=1&filter=talk")))["new_count"]).toBe(2);
  });

  it("K383-API-006 一度も開いていない人（最後に開いた時刻が無い）：ほかの人の消していない書き込みは全部新しい", async () => {
    const t = await h.ticket();
    await h.post(t, h.writer, { body: "1", at: 30 });
    await h.post(t, h.writer, { body: "2", at: 20 });
    await h.post(t, h.boss, { body: "自分", at: 10 });
    expect((await meta(await tl(h.boss, t)))["new_count"]).toBe(2);
  });

  it("K383-API-007 post_count は消していない書き込みの数（変更・仕組みの行・AI の実行・消した跡は数えない・絞り込みとページに依らない）", async () => {
    const t = await h.ticket();
    await h.post(t, h.writer, { body: "1", at: 30 });
    await h.post(t, h.boss, { body: "2", at: 25 });
    await del(await h.post(t, h.boss, { body: "消した", at: 20 }), h.boss);
    await h.post(t, h.boss, { kind: "change", at: 15, changes: STAGE });
    await h.post(t, null, { kind: "system", body: "仕組み", at: 10 });
    await h.run(t, h.boss, { at: 5 });
    expect((await meta(await tl(h.writer, t)))["post_count"]).toBe(2);
    expect((await meta(await tl(h.writer, t, "?limit=1&filter=mine")))["post_count"]).toBe(2);
    const empty = await tl(h.writer, await h.ticket());
    expect(empty.status).toBe(200);
    expect(await items(empty)).toEqual([]);
    expect(await meta(empty)).toMatchObject({ older_count: 0, new_count: 0, mine_count: 0, post_count: 0 });
  });

  it("K383-API-008 people：そのチケットを見られる人だけ（見ている人も含む・見られない人・別の会社の人・抜けた人・止められた人は出ない）。担当者は is_assignee と「担当者」、承認を待っている人は is_approver と「承認する人」（グループの外でも出る）", async () => {
    const t = await h.ticket({ assignee: h.boss });
    const approver = await h.person("承認の人", { scope: h.sales, ability: null });
    await h.f.admin.query(
      `insert into approvals (tenant_id, scope_id, kind, ticket_id, approver_member_id, requested_by, status_id, created_by)
       values ($1, $2, 'artifact', $3, $4, $5, 'pending', $5)`,
      [t.tenant, t.scope, t.id, approver.id, h.writer.id],
    );
    const left = await h.person("抜けた人");
    await h.f.admin.query("update members set deleted_at = now() where id = $1", [left.id]);
    const stopped = await h.person("止められた人");
    await h.f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [stopped.id, h.boss.id]);
    const people = (await meta(await tl(h.writer, t)))["people"] as (Record<string, unknown> & { member_id: string })[];
    const ids = people.map((p) => p.member_id);
    for (const p of [h.boss, h.writer, h.viewer, h.manager, approver]) expect(ids, p.id).toContain(p.id);
    for (const p of [h.stranger, h.outsider, left, stopped]) expect(ids, p.id).not.toContain(p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const boss = people.find((p) => p.member_id === h.boss.id)!;
    expect(Object.keys(boss).sort()).toEqual(["call_name", "display_name", "is_approver", "is_assignee", "label", "member_id"]);
    expect(boss).toMatchObject({ display_name: "高本", is_assignee: true, is_approver: false, label: "担当者" });
    expect(people.find((p) => p.member_id === approver.id)).toMatchObject({ is_assignee: false, is_approver: true, label: "承認する人" });
    expect(people.find((p) => p.member_id === h.viewer.id)).toMatchObject({ is_assignee: false, is_approver: false, label: "開発" });
  });
});

describe("K-383 1 件の中身（消した跡・直した印・引用・☆・名前・できること・決定）", () => {
  it("K383-API-009 消した書き込みは kind deleted の跡で message は null（本文・@・引用・☆ を返さない）。本人が消せば by_manager false、マネージャーが人の物を消せば true", async () => {
    const t = await h.ticket();
    const mine = await h.post(t, h.writer, { body: "本人が消した秘密の文", mentions: [h.boss], reactions: { star: [h.boss.id] }, at: 20 });
    const theirs = await h.post(t, h.writer, { body: "マネージャーが消した文", at: 10 });
    await del(mine, h.writer);
    await del(theirs, h.manager);
    const r = await tl(h.boss, t);
    const text = await r.clone().text();
    expect(text).not.toContain("秘密の文");
    expect(text).not.toContain("マネージャーが消した文");
    const [a, b] = await items(r);
    expect(a!.kind).toBe("deleted");
    expect(a!.message).toBeNull();
    expect(a!.deleted).toEqual({ by: who(h.writer, "佐藤"), author: who(h.writer, "佐藤"), by_manager: false });
    expect(a!.actor).toEqual(who(h.writer, "佐藤"));
    expect(b!.deleted).toEqual({ by: who(h.manager, "田中"), author: who(h.writer, "佐藤"), by_manager: true });
  });

  it("K383-API-010 直した印と引用：edited_at を返す（直していなければ null）。引用は quote_text の字（excerpt）と元の id（元が消されても字は残る）", async () => {
    const t = await h.ticket();
    const src = await h.post(t, h.boss, { body: "元の書き込み\n2 行目\n3 行目", at: 30 });
    const q = await h.post(t, h.writer, { body: "返事", quoteOf: src, at: 20 });
    await h.f.admin.query("update ticket_messages set quote_text = $2, edited_at = now() - interval '5 minutes' where id = $1", [
      q,
      "元の書き込み\n2 行目",
    ]);
    await del(src, h.boss);
    const d = await pick(h.writer, t, q);
    expect(d.message!.quote).toEqual({ id: src, excerpt: "元の書き込み\n2 行目" });
    expect(Date.parse(d.message!.edited_at!)).toBeLessThan(Date.now());
    const plain = await h.post(t, h.writer, { body: "直していない", at: 10 });
    const p = await pick(h.writer, t, plain);
    expect(p.message!.edited_at).toBeNull();
    expect(p.message!.quote).toBeNull();
  });

  it("K383-API-011 ☆：押した人の数と、見ている人が押したか", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "大事", reactions: { star: [h.boss.id, h.viewer.id] } });
    expect((await pick(h.boss, t, id)).message).toMatchObject({ stars: 2, starred: true });
    expect((await pick(h.writer, t, id)).message).toMatchObject({ stars: 2, starred: false });
    const none = await h.post(t, h.writer, { body: "☆ なし" });
    expect((await pick(h.boss, t, none)).message).toMatchObject({ stars: 0, starred: false });
  });

  it("K383-API-012 @ と知らせた人は、並びのまま名前つきで返す。会社から外れた人の名前も出る（D-128.96）", async () => {
    const t = await h.ticket();
    const gone = await h.person("外れた人");
    const id = await h.post(t, gone, { body: "@高本 @鈴木", mentions: [h.boss, h.viewer] });
    await h.f.admin.query("update ticket_messages set notify_member_ids = $2 where id = $1", [id, [h.manager.id]]);
    await h.f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    const d = await pick(h.writer, t, id);
    expect(d.message!.mentions).toEqual([who(h.boss, "高本"), who(h.viewer, "鈴木")]);
    expect(d.message!.notified).toEqual([who(h.manager, "田中")]);
    expect(d.actor).toEqual(who(gone, "外れた人"));
  });

  it("K383-API-013 できること：書いた本人は直す・消す、マネージャーは消すだけ、ほかの人（閲覧のみも）はどちらも無い", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "書いた" });
    const can = async (p: Person) => {
      const m = (await pick(p, t, id)).message!;
      return [m.can_edit, m.can_delete];
    };
    expect(await can(h.writer)).toEqual([true, true]);
    expect(await can(h.manager)).toEqual([false, true]);
    expect(await can(h.boss)).toEqual([false, false]);
    expect(await can(h.viewer)).toEqual([false, false]);
  });

  it("K383-API-014 決定：決定の元になった書き込みは decided true（ほかは false）", async () => {
    const t = await h.ticket();
    const src = await h.post(t, h.writer, { body: "月末締め翌月末払いで" });
    const plain = await h.post(t, h.writer, { body: "ふつう" });
    await h.f.admin.query(
      "insert into ticket_decisions (tenant_id, ticket_id, text, decided_by, source_message_id) values ($1, $2, '支払いは月末締め翌月末', $3, $4)",
      [t.tenant, t.id, h.writer.id, src],
    );
    expect((await pick(h.boss, t, src)).message!.decided).toBe(true);
    expect((await pick(h.boss, t, plain)).message!.decided).toBe(false);
  });

  it("K383-API-015 本文は切らない（D-130.4）：20 万字の書き込みもそのまま返す", async () => {
    const t = await h.ticket();
    const big = "長".repeat(200_000);
    const id = await h.post(t, h.writer, { body: big });
    expect((await pick(h.boss, t, id)).message!.body).toBe(big);
  });
});

describe("K-383 守り・入力・失敗", () => {
  it("K383-API-016 守り：同じ会社でもチケットが見えない人・別の会社の人・消したチケットは 404。取引先の役は 403。どれも中身を返さない", async () => {
    const t = await h.ticket({ title: "K383 見えないチケット" });
    await h.post(t, h.writer, { body: "社内の話" });
    for (const p of [h.stranger, h.outsider]) {
      const r = await tl(p, t);
      expect(r.status, p.id).toBe(404);
      expect(await r.text()).not.toContain("社内の話");
    }
    const asClient = await h.req(null, "GET", `/tickets/${t.id}/timeline`, undefined, h.f.as(h.writer, "client"));
    expect(asClient.status).toBe(403);
    expect(await asClient.text()).not.toContain("社内の話");
    const gone = await h.ticket();
    await h.post(gone, h.writer, { body: "消したチケットの話" });
    await h.f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [gone.id, h.boss.id]);
    const r = await tl(h.writer, gone);
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("消したチケットの話");
  });

  it("K383-API-017 閲覧のみの人・担当者（グループの外でも）は読める", async () => {
    const t = await h.ticket({ assignee: h.stranger });
    await h.post(t, h.writer, { body: "読める" });
    expect((await tl(h.viewer, t)).status).toBe(200);
    expect((await tl(h.stranger, t)).status).toBe(200);
  });

  it("K383-API-018 ログインしていない：401・data が無い。上限（1 分に 120 回）を超えたら 429・retry_after_sec は 1〜60 の整数", async () => {
    const r = await tl(null, common);
    expect(r.status).toBe(401);
    expect((await h.json(r)).data).toBeUndefined();
    const p = await h.person("上限を見る人");
    h.f.limits["listTicketTimeline"] = 3;
    try {
      const codes: number[] = [];
      let last: Response | null = null;
      for (let i = 0; i < 4; i++) {
        last = await h.f.req("GET", `/tickets/${common.id}/timeline`, { headers: p.auth, ip: "198.51.100.251" });
        codes.push(last.status);
      }
      expect(codes).toEqual([200, 200, 200, 429]);
      const sec = (await h.json(last!))["retry_after_sec"] as number;
      expect(Number.isInteger(sec)).toBe(true);
      expect(sec).toBeGreaterThanOrEqual(1);
      expect(sec).toBeLessThanOrEqual(60);
    } finally {
      h.f.limits["listTicketTimeline"] = 10_000;
    }
  });

  it("K383-API-019 入力：limit が 0・101・数でない／before_at が日時でない／before_at と before_id の片方だけ／filter が決まった値でない／cursor を渡した は 422 で、理由のある欄の名前を返す", async () => {
    const id = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const cases: [string, string][] = [
      ["?limit=0", "limit"],
      ["?limit=101", "limit"],
      ["?limit=abc", "limit"],
      [`?before_at=yesterday&before_id=${id}`, "before_at"],
      ["?before_at=2026-11-20T10%3A00%3A00Z", "before_id"],
      [`?before_id=${id}`, "before_at"],
      ["?filter=star", "filter"],
      ["?cursor=abc", "cursor"],
    ];
    for (const [q, field] of cases) {
      const r = await tl(h.writer, common, q);
      expect(r.status, q).toBe(422);
      const fields = (((await h.json(r))["details"] ?? []) as { field: string }[]).map((x) => x.field);
      expect(fields, q).toContain(field);
    }
  });

  it("K383-API-020 失敗 × 守りの判定（見えるか）の所で例外になった：503・E-PAGE-003。中身と例外の文を返さない（D-136.1）", async () => {
    const title = "K383 守りが壊れる";
    const t = await h.ticket({ title });
    await h.post(t, h.writer, { body: "壊れたときに出てはいけない文" });
    await h.breakVisible(title, async () => {
      const r = await tl(h.writer, t);
      expect(r.status).toBe(503);
      const text = await r.clone().text();
      expect((await h.json(r))["code"]).toBe("E-PAGE-003");
      expect(text).not.toContain("壊れたときに出てはいけない文");
      expect(text).not.toContain("守りを壊した");
    });
  });

  it("K383-API-021 貯めない・読む口は書かない：Cache-Control に private と no-store。開いても最後に開いた時刻の行はできず、在る行も変わらない（書くのは K-384 の口）", async () => {
    const t = await h.ticket();
    await h.post(t, h.writer, { body: "1" });
    const r = await tl(h.boss, t);
    const cc = r.headers.get("cache-control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
    expect(await h.num("select count(*) as n from app.ticket_thread_seen where ticket_id = $1", [t.id])).toBe(0);
    await seen(t, h.boss, 60);
    const at = () =>
      h.one<{ s: Date }>("select seen_at as s from app.ticket_thread_seen where ticket_id = $1 and member_id = $2", [t.id, h.boss.id]);
    const before = (await at()).s.getTime();
    await tl(h.boss, t);
    expect((await at()).s.getTime()).toBe(before);
  });

  it("K383-API-022 表の形：新しい列の既定（notify_member_ids は空の並び・ほかは null）。最後に開いた時刻は人ごと・チケットごとに 1 行（2 行目は 23505）。アプリの役は表に直に触れない", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "既定を見る" });
    const row = await h.one<Record<string, unknown>>(
      "select notify_member_ids, quote_text, edited_at, deleted_by from ticket_messages where id = $1",
      [id],
    );
    expect(row).toEqual({ notify_member_ids: [], quote_text: null, edited_at: null, deleted_by: null });
    await seen(t, h.writer, 10);
    await expect(seen(t, h.writer, 5)).rejects.toMatchObject({ code: "23505" });
    await seen(t, h.boss, 5); // 別の人は入る
    const app = await h.f.pool.connect();
    try {
      await expect(app.query("select count(*) from app.ticket_thread_seen")).rejects.toMatchObject({ code: "42501" });
    } finally {
      app.release();
    }
  });
});
