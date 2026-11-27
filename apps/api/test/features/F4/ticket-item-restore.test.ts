// K-576「項目の変更を、比べた点の形に戻す口（restoreTicketItems）」の単体の試験（口と DB・本物の Postgres）。名前の頭の行 ID（K576-API-…）は 11_tickets/K-576.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台は K-432 の ticket-body.harness.ts（チケット・やり取りの行を DB に直に入れる）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py と screen_api.d/K-576.py で作る）:
//   restoreTicketItems   POST /api/v1/tickets/:id/item-changes/restore   入力（strict）: { from: integer(>=1), to: integer(>=1) }
//     from＝戻す先の点（K-433 の points の n）・to＝今見ている点（いまの最新の n でなければ 409 E-ITM-002）。from から to までの正味の変わり（K-433 の diff）を、from の形に戻す
//     200 { data: { changed, restored: [{ field, name }], skipped: [{ field, name, why }] } }（戻せる物だけ戻し、戻せなかった項目と訳を返す・1 つの取引・何も戻せなくても 200 で changed false）
//     409 E-ITM-001（完了したチケット）／E-ITM-002（先に変えられた）／E-ITM-003（戻す物が無い：from が to 以上・差分が空）。404（無い点・無いチケット）・409 の体は {error, code, message, action, undo, support_code} だけで field・details・detail を付けない
//   戻す先は各組の決まりを通る（期限・開始日＝K-483・優先度＝K-440・会社の項目＝K-564）。それぞれの関数が自分の変更の行・お知らせ・証跡を書く。この口はまとめの行（changes の field が item_restore）と証跡 ticket.item_restore を足す
//   前提：K-564 の変更の行の changes は {field: "field:<項目の id>", from, to, raw_from, raw_to}（raw_* は保存する生の値か null）。K-433 の diff の各行は raw_from・raw_to を通す
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KanameError } from "@kaname/errors";
import { setupBody, type Json, type Person, type World } from "./ticket-body.harness.js";

const h = setupBody(["ticket-item-restore", "ticket-versions", "ticket-update"]);
const f = () => h.f;
const day = (n: number) => new Date(Date.now() + 9 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
type Change = Record<string, unknown>;
const WHY = {
  past: "期限は今日より前の日には戻せません",
  order: "開始日が期限より後になるので戻せません",
  parent: "親の期限より後になるので戻せません",
  child: "子の期限より前になるので戻せません",
  reason: "優先度を高に戻す理由が残っていないので戻せません",
  option: "選択肢が無くなったので戻せません",
  required: "必須の項目は空に戻せません",
  gone: "この項目は消されたので戻せません",
  stage: "状態は段の決まりがあるので戻せません",
  assignee: "担当者は「渡す」の流れで変えます",
  parentRule: "親は 3 段までの決まりがあるので戻せません",
} as const;
let w: World;
const noFields = (j: Json) => {
  for (const k of ["field", "details", "detail"]) expect(k in j, k).toBe(false);
};
/** 項目の更新の行を DB に直に入れる（raw_* 付きも）。by が null なら AI */
async function line(ticketId: string, changes: Change[], by: Person | null = w.writer): Promise<string> {
  const t = (await f().admin.query<{ tenant_id: string }>("select tenant_id from tickets where id = $1", [ticketId]))
    .rows[0]!;
  return (
    await f().admin.query<{ id: string }>(
      "insert into ticket_messages (tenant_id, ticket_id, kind, author_member_id, body, changes, created_by, updated_by) values ($1, $2, 'change', $3, '項目を変えました', $4::jsonb, $3, $3) returning id",
      [t.tenant_id, ticketId, by?.id ?? null, JSON.stringify(changes)],
    )
  ).rows[0]!.id;
}
const set = (id: string, cols: Record<string, unknown>) =>
  f().admin.query(
    `update tickets set ${Object.keys(cols)
      .map((k, i) => `${k} = $${i + 2}`)
      .join(", ")} where id = $1`,
    [id, ...Object.values(cols)],
  );
const row = async (id: string) =>
  (
    await f().admin.query<{
      due_on: string | null;
      start_on: string | null;
      priority: string;
      priority_reason: string | null;
      estimate_minutes: number | null;
    }>(
      "select due_on::text as due_on, start_on::text as start_on, priority, priority_reason, estimate_minutes from tickets where id = $1",
      [id],
    )
  ).rows[0]!;
const field = async (
  name: string,
  type: string,
  o: { options?: { id: string; name: string; position: number }[]; required?: boolean } = {},
) =>
  (
    await f().admin.query<{ id: string }>(
      "insert into custom_fields (tenant_id, name, field_type, options, required, position) values ($1, $2, $3, $4::jsonb, $5, 1) returning id",
      [w.tenantId, `${name} ${randomUUID().slice(0, 4)}`, type, JSON.stringify(o.options ?? []), o.required ?? false],
    )
  ).rows[0]!.id;
const val = (ticketId: string, fieldId: string, v: unknown) =>
  f().admin.query(
    "insert into ticket_field_values (tenant_id, ticket_id, field_id, value) values ($1, $2, $3, $4::jsonb)",
    [w.tenantId, ticketId, fieldId, JSON.stringify(v)],
  );
const valueOf = async (ticketId: string, fieldId: string) =>
  (
    await f().admin.query<{ value: unknown }>(
      "select value from ticket_field_values where ticket_id = $1 and field_id = $2 and deleted_at is null",
      [ticketId, fieldId],
    )
  ).rows[0]?.value;
const go = (who: Person | null, id: string, b: unknown, headers: Record<string, string> = {}) =>
  h.call(who, "POST", `/tickets/${id}/item-changes/restore`, { body: b, headers });
interface Out {
  changed: boolean;
  restored: { field: string; name: string }[];
  skipped: { field: string; name: string; why: string }[];
}
const ok = async (r: Response): Promise<Out> => {
  expect(r.status, await r.clone().text()).toBe(200);
  return (await h.json(r)).data as unknown as Out;
};
const fresh = async (o: { assignee?: Person } = {}) => {
  w = await h.world("K576");
  return h.ticket(w, { assignee: o.assignee ?? w.assignee });
};
const counts = async (id: string) => ({
  messages: await h.count("select count(*) as n from ticket_messages where ticket_id = $1", [id]),
  audits: await h.count("select count(*) as n from audit_events where target_id = $1", [id]),
  notes: await h.notifications(w.tenantId),
  row: JSON.stringify(await row(id)),
  values: await h.count("select count(*) as n from ticket_field_values where ticket_id = $1", [id]),
});

describe("K-576 項目の変更を点の形に戻す（restoreTicketItems・本物の DB）", () => {
  it("K576-API-001 期限・優先度・予定時間・会社の項目が変わった履歴を、点 1 の形に戻す（予定時間は変更の行の raw_from の分に戻る）", async () => {
    const t = await fresh();
    const memo = await field("メモ", "short_text");
    await set(t.id, { due_on: day(40), priority: "high", priority_reason: "急ぎ", estimate_minutes: 180 });
    await val(t.id, memo, "新");
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    await line(t.id, [{ field: "priority", from: "中", to: "高", note: "急ぎ" }]);
    await line(t.id, [{ field: `field:${memo}`, from: "旧", to: "新", raw_from: "旧", raw_to: "新" }]);
    await line(t.id, [{ field: "estimate_minutes", from: "1 時間", to: "3 時間", raw_from: 60, raw_to: 180 }]);
    const out = await ok(await go(w.writer, t.id, { from: 1, to: 5 }));
    expect(out.changed).toBe(true);
    expect(out.restored.map((x) => x.field).sort()).toEqual(
      ["due_on", "estimate_minutes", "priority", `field:${memo}`].sort(),
    );
    expect(out.skipped).toEqual([]);
    expect(await row(t.id)).toMatchObject({
      due_on: day(30),
      priority: "mid",
      priority_reason: null,
      estimate_minutes: 60,
    });
    expect(await valueOf(t.id, memo)).toBe("旧");
  });
  it("K576-API-002 期限と開始日は 1 つの組で一緒に戻る。期限の行の理由に「版 N に戻した」が付く", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(50), start_on: day(45) });
    await line(t.id, [
      { field: "due_on", from: day(30), to: day(50), note: "延ばす" },
      { field: "start_on", from: day(25), to: day(45) },
    ]);
    const out = await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    expect(out.restored.map((x) => x.field)).toEqual(["due_on", "start_on"]);
    expect(await row(t.id)).toMatchObject({ due_on: day(30), start_on: day(25) });
    const due = (await h.messages(t.id)).find((m) =>
      (m.changes ?? []).some((c) => c.field === "due_on" && c.to === day(30)),
    )!;
    expect(JSON.stringify(due.changes)).toContain("版 1 に戻した");
  });
  it("K576-API-003 優先度を高に戻す：前に高へ変えた行の理由が残っていれば、その理由で戻る", async () => {
    const t = await fresh();
    await line(t.id, [{ field: "priority", from: "中", to: "高", note: "先方が急いでいる" }]);
    await line(t.id, [{ field: "priority", from: "高", to: "中" }]);
    const out = await ok(await go(w.writer, t.id, { from: 2, to: 3 }));
    expect(out.restored.map((x) => x.field)).toEqual(["priority"]);
    expect(await row(t.id)).toMatchObject({ priority: "high", priority_reason: "先方が急いでいる" });
  });
  it("K576-API-004 優先度を高に戻す理由が残っていない（作ったときから高）：その項目だけ戻せず訳が付く。ほかの項目は戻る", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(40) });
    await line(t.id, [
      { field: "priority", from: "高", to: "中" },
      { field: "due_on", from: day(30), to: day(40), note: "延ばす" },
    ]);
    const out = await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    expect(out.skipped).toEqual([{ field: "priority", name: "優先度", why: WHY.reason }]);
    expect(out.restored.map((x) => x.field)).toEqual(["due_on"]);
    expect(await row(t.id)).toMatchObject({ priority: "mid", due_on: day(30) });
  });
  it("K576-API-005 会社の項目：型ごとに生の値（raw_from）で戻り、空に戻す項目は値が消える", async () => {
    const t = await fresh();
    const o1 = randomUUID(),
      o2 = randomUUID();
    const opts = [
      { id: o1, name: "営業", position: 1 },
      { id: o2, name: "開発", position: 2 },
    ];
    const spec: [string, string, unknown, unknown, object?][] = [
      ["文", "short_text", "旧文", "新文"],
      ["数", "number", 5, 9],
      ["日", "date", "2027-01-05", "2027-02-06"],
      ["選", "select", o1, o2, { options: opts }],
      ["複", "multi_select", [o1, o2], [o2], { options: opts }],
      ["箱", "check", true, false],
      ["空へ", "short_text", null, "入れた"],
    ];
    const ids: string[] = [];
    for (const [name, type, , nu, o] of spec) {
      const id = await field(name, type, o as never);
      ids.push(id);
      await val(t.id, id, nu);
    }
    await line(
      t.id,
      spec.map(([, , old, nu], i) => ({
        field: `field:${ids[i]}`,
        from: "表示の字",
        to: "表示の字",
        raw_from: old,
        raw_to: nu,
      })),
    );
    const out = await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    expect(out.restored).toHaveLength(7);
    expect(await valueOf(t.id, ids[0]!)).toBe("旧文");
    expect(await valueOf(t.id, ids[1]!)).toBe(5);
    expect(await valueOf(t.id, ids[2]!)).toBe("2027-01-05");
    expect(await valueOf(t.id, ids[3]!)).toBe(o1);
    expect(await valueOf(t.id, ids[4]!)).toEqual([o1, o2]);
    expect(await valueOf(t.id, ids[5]!)).toBe(true);
    expect(await valueOf(t.id, ids[6]!)).toBeUndefined();
  });
  it("K576-API-006 会社の項目をまとめて戻して断られたら項目ごとに試す：選択肢が外れた項目・必須の項目を空に戻す物・消した項目だけ戻せず、ほかは戻る", async () => {
    const t = await fresh();
    const o1 = randomUUID(),
      gone = randomUUID();
    const sel = await field("選ぶ", "select", { options: [{ id: o1, name: "営業", position: 1 }] });
    const req = await field("必須", "short_text", { required: true });
    const dead = await field("消す", "short_text");
    const memo = await field("メモ", "short_text");
    for (const [id, v] of [
      [sel, o1],
      [req, "いま"],
      [dead, "いま"],
      [memo, "新"],
    ] as const)
      await val(t.id, id, v);
    await f().admin.query("update custom_fields set deleted_at = now() where id = $1", [dead]);
    await line(t.id, [
      { field: `field:${sel}`, from: "古い選択", to: "営業", raw_from: gone, raw_to: o1 },
      { field: `field:${req}`, from: "（空）", to: "いま", raw_from: null, raw_to: "いま" },
      { field: `field:${dead}`, from: "旧", to: "いま", raw_from: "旧", raw_to: "いま" },
      { field: `field:${memo}`, from: "旧", to: "新", raw_from: "旧", raw_to: "新" },
    ]);
    const out = await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    expect(out.restored.map((x) => x.field)).toEqual([`field:${memo}`]);
    expect(out.skipped.map((x) => [x.field, x.why]).sort()).toEqual(
      [
        [`field:${sel}`, WHY.option],
        [`field:${req}`, WHY.required],
        [`field:${dead}`, WHY.gone],
      ].sort(),
    );
    expect(await valueOf(t.id, memo)).toBe("旧");
    expect(await valueOf(t.id, sel)).toBe(o1);
    expect(await valueOf(t.id, req)).toBe("いま");
  });
  it("K576-API-007 期限・開始日が今の決まりに合わない戻し先：今日より前・開始日が期限より後・親の期限より後・子の期限より前は戻せず訳が付く。ほかの項目は戻る", async () => {
    const past = await fresh();
    await set(past.id, { due_on: day(30) });
    await line(past.id, [{ field: "due_on", from: "2020-01-01", to: day(30), note: "延ばす" }]);
    expect((await ok(await go(w.writer, past.id, { from: 1, to: 2 }))).skipped).toEqual([
      { field: "due_on", name: "期限", why: WHY.past },
    ]);
    const order = await fresh();
    await set(order.id, { due_on: day(40), start_on: day(35) });
    await line(order.id, [{ field: "due_on", from: day(20), to: day(40), note: "延ばす" }]);
    expect((await ok(await go(w.writer, order.id, { from: 1, to: 2 }))).skipped).toEqual([
      { field: "due_on", name: "期限", why: WHY.order },
    ]);
    const child = await fresh();
    const parent = await h.ticket(w, { assignee: w.assignee });
    await set(parent.id, { due_on: day(35) });
    await set(child.id, { parent_ticket_id: parent.id, due_on: day(30) });
    await line(child.id, [{ field: "due_on", from: day(50), to: day(30), note: "縮める" }]);
    expect((await ok(await go(w.writer, child.id, { from: 1, to: 2 }))).skipped).toEqual([
      { field: "due_on", name: "期限", why: WHY.parent },
    ]);
    const upper = await fresh();
    const kid = await h.ticket(w, { assignee: w.assignee });
    await set(kid.id, { parent_ticket_id: upper.id, due_on: day(45) });
    await set(upper.id, { due_on: day(60) });
    await line(upper.id, [{ field: "due_on", from: day(30), to: day(60), note: "延ばす" }]);
    expect((await ok(await go(w.writer, upper.id, { from: 1, to: 2 }))).skipped).toEqual([
      { field: "due_on", name: "期限", why: WHY.child },
    ]);
    expect((await row(upper.id)).due_on).toBe(day(60));
  });
  it("K576-API-008 戻せない項目（状態・担当者・親）は戻さず訳を返す。書かない（値・やり取り・証跡）", async () => {
    const t = await fresh();
    await line(t.id, [
      { field: "stage", from: "未着手", to: "作業中" },
      { field: "assignee", from: "佐藤", to: "鈴木" },
      { field: "parent", from: null, to: "EG-1" },
    ]);
    const before = await counts(t.id);
    const out = await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    expect(out.changed).toBe(false);
    expect(out.restored).toEqual([]);
    expect(out.skipped.map((x) => [x.field, x.why])).toEqual([
      ["stage", WHY.stage],
      ["assignee", WHY.assignee],
      ["parent", WHY.parentRule],
    ]);
    expect(await counts(t.id)).toEqual(before);
  });
  it("K576-API-009 すでに点 1 の値になっている項目は戻した扱いにしない（行も書かない）。残りだけ戻る", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(30), priority: "high", priority_reason: "急ぎ" });
    await line(t.id, [
      { field: "due_on", from: day(30), to: day(40), note: "延ばす" },
      { field: "priority", from: "中", to: "高", note: "急ぎ" },
    ]);
    const out = await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    expect(out.restored.map((x) => x.field)).toEqual(["priority"]);
    expect(out.skipped).toEqual([]);
  });
  it("K576-API-010 戻す物が無い（from が to 以上・差分が空）：409・E-ITM-003・欄なし・何も書かない", async () => {
    const t = await fresh();
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    await line(t.id, [{ field: "due_on", from: day(40), to: day(30), note: "戻す" }]);
    const before = await counts(t.id);
    for (const b of [
      { from: 2, to: 2 },
      { from: 3, to: 2 },
      { from: 1, to: 3 },
    ]) {
      const r = await go(w.writer, t.id, b);
      expect(r.status, JSON.stringify(b)).toBe(409);
      const j = await h.json(r);
      expect(j["code"]).toBe("E-ITM-003");
      noFields(j);
    }
    expect(await counts(t.id)).toEqual(before);
  });
  it("K576-API-011 先に変えられた（to が今の最新の点でない）：409・E-ITM-002・欄なし・何も書かない", async () => {
    const t = await fresh();
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    await line(t.id, [{ field: "priority", from: "中", to: "高", note: "急ぎ" }]);
    const before = await counts(t.id);
    const r = await go(w.writer, t.id, { from: 1, to: 2 });
    expect(r.status).toBe(409);
    const j = await h.json(r);
    expect(j["code"]).toBe("E-ITM-002");
    noFields(j);
    expect(await counts(t.id)).toEqual(before);
  });
  it("K576-API-012 完了したチケット：409・E-ITM-001・欄なし・何も書かない", async () => {
    const t = await fresh();
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    await h.finish(t.id);
    const before = await counts(t.id);
    const r = await go(w.writer, t.id, { from: 1, to: 2 });
    expect(r.status).toBe(409);
    const j = await h.json(r);
    expect(j["code"]).toBe("E-ITM-001");
    noFields(j);
    expect(await counts(t.id)).toEqual(before);
  });
  it("K576-API-013 無い点（99）・別の会社の人・無いチケット・消したチケット：404（無い点と消したチケットは E-PAGE-001・別の会社と無い id は入口の NOT_FOUND）・欄なし・何も書かない", async () => {
    const t = await fresh();
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    const gone = await h.ticket(w);
    await h.removeTicket(gone.id);
    const before = await counts(t.id);
    for (const [who, id, b, code] of [
      [w.writer, t.id, { from: 1, to: 99 }, "E-PAGE-001"],
      [w.writer, t.id, { from: 99, to: 2 }, "E-PAGE-001"],
      [w.outsider, t.id, { from: 1, to: 2 }, "NOT_FOUND"],
      [w.writer, randomUUID(), { from: 1, to: 2 }, "NOT_FOUND"],
      [w.writer, gone.id, { from: 1, to: 2 }, "E-PAGE-001"],
    ] as const) {
      const r = await go(who, id, b);
      expect(r.status, code).toBe(404);
      const j = await h.json(r);
      expect(j["code"]).toBe(code);
      noFields(j);
    }
    expect(await counts(t.id)).toEqual(before);
  });
  it("K576-API-014 入力の形：欠け・0・負・小数・文字・知らない欄は 422（欄つき）・何も書かない", async () => {
    const t = await fresh();
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    const before = await counts(t.id);
    for (const b of [
      {},
      { from: 1 },
      { to: 2 },
      { from: 0, to: 2 },
      { from: -1, to: 2 },
      { from: 1.5, to: 2 },
      { from: "1", to: 2 },
      { from: 1, to: 2, fields: ["due_on"] },
    ]) {
      const r = await go(w.writer, t.id, b);
      expect(r.status, JSON.stringify(b)).toBe(422);
      expect(((await h.json(r))["details"] as unknown[]).length).toBeGreaterThan(0);
    }
    expect(await counts(t.id)).toEqual(before);
  });
  it("K576-API-015 守り：読むだけの人 403・止められた人 403・ログインなし 401。どれも何も書かない", async () => {
    const t = await fresh();
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    const stopped = await f().person(w.tenantId, w.rootScope, { name: "止められた人", ticketAbility: "edit" });
    await f().admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [stopped.id]);
    const before = await counts(t.id);
    expect((await go(w.viewer, t.id, { from: 1, to: 2 })).status).toBe(403);
    expect((await go(stopped, t.id, { from: 1, to: 2 })).status).toBe(403);
    expect((await go(null, t.id, { from: 1, to: 2 })).status).toBe(401);
    expect(await counts(t.id)).toEqual(before);
  });
  it("K576-API-016 担当者でない人が戻すと、担当者の受け箱にお知らせが組ごとに届く（メールなし）。担当者本人が戻すと届かない。題名と値の字は入らない", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(40) });
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    const n = await f().admin.query<{ member_id: string; channel: string; payload: Record<string, unknown> }>(
      "select member_id, channel, payload from notifications where tenant_id = $1",
      [w.tenantId],
    );
    expect(n.rows.length).toBeGreaterThanOrEqual(1);
    for (const x of n.rows) {
      expect(x.member_id).toBe(w.assignee.id);
      expect(x.channel).toBe("inapp");
      expect(JSON.stringify(x.payload)).not.toContain(day(30)); // 日付・値は入れない
    }
    const s = await fresh({ assignee: w.writer });
    await set(s.id, { due_on: day(40) });
    await line(s.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    const before = await h.notifications(w.tenantId);
    await ok(await go(w.writer, s.id, { from: 1, to: 2 }));
    expect(await h.notifications(w.tenantId)).toBe(before);
  });
  it("K576-API-017 まとめの行：changes の field が item_restore の行が 1 つ（書いた人は戻した人・本文「〈名前〉が項目を点 1 の形に戻しました」）。組ごとの変更の行は各組の関数が書く", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(40), priority: "high", priority_reason: "急ぎ" });
    await line(t.id, [
      { field: "due_on", from: day(30), to: day(40), note: "延ばす" },
      { field: "priority", from: "中", to: "高", note: "急ぎ" },
    ]);
    const before = (await h.messages(t.id)).length;
    await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    const added = (await h.messages(t.id)).slice(before);
    const summary = added.filter((m) => (m.changes ?? []).some((c) => c.field === "item_restore"));
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({ author_member_id: w.writer.id });
    expect(summary[0]!.body).toBe(`${await h.name(w.writer)}が項目を点 1 の形に戻しました`);
    expect(added.length).toBeGreaterThanOrEqual(2); // まとめの行のほかに、期限の組・優先度の組の行
  });
  it("K576-API-018 まとめの行は項目の変更の点に数えない：戻した後の点の増え方は各組の行の数だけ（K-433 の points）", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(40) });
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    const r = await h.call(w.writer, "GET", `/tickets/${t.id}/item-changes`);
    const pts = ((await h.json(r)).data as { points: { n: number }[] }).points.map((p) => p.n);
    expect(pts).toEqual([3, 2, 1]); // 期限の組の行が 1 つ増えただけ（まとめの行は点にならない）
  });
  it("K576-API-019 証跡：audit_events に ticket.item_restore が 1 行（C2・payload は from・to・戻した項目と戻せなかった項目の欄の名前だけ）。値の字は入れない", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(40) });
    await line(t.id, [
      { field: "due_on", from: day(30), to: day(40), note: "延ばす" },
      { field: "stage", from: "未着手", to: "作業中" },
    ]);
    await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    const a = await h.audits(w.tenantId, "ticket.item_restore", t.id);
    expect(a).toHaveLength(1);
    expect(a[0]!.choke_point_id).toBe("C2");
    expect(a[0]!.payload).toEqual({ from: 1, to: 2, restored: ["due_on"], skipped: ["stage"] });
    expect(JSON.stringify(a[0]!.payload)).not.toContain(day(30));
  });
  it("K576-API-020 失敗（手順 S1）：まとめの行を書く所で DB が落ちる：503・E-PAGE-003・期限も優先度も戻らず、各組の行・証跡も残らない（全部戻る）", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(40) });
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    const restore = await h.breakInsert("ticket_messages", 'new.changes @> \'[{"field":"item_restore"}]\'::jsonb');
    const before = await counts(t.id);
    const logs = await h.captureLogs(async () => {
      try {
        const r = await go(w.writer, t.id, { from: 1, to: 2 });
        expect(r.status).toBe(503);
        expect((await h.json(r))["code"]).toBe("E-PAGE-003");
      } finally {
        await restore();
      }
    });
    expect(await counts(t.id)).toEqual(before);
    expect(logs).not.toContain(day(30));
  });
  it("K576-API-021 失敗（手順 S2）：担当者へのお知らせの行を書く所で DB が落ちる：503・E-PAGE-003・全部戻る（値・各組の行・まとめの行・証跡が前のまま）", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(40) });
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    const restore = await h.breakInsert("notifications", `new.member_id = '${w.assignee.id}'`);
    const before = await counts(t.id);
    try {
      const r = await go(w.writer, t.id, { from: 1, to: 2 });
      expect(r.status).toBe(503);
      expect((await h.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await restore();
    }
    expect(await counts(t.id)).toEqual(before);
  });
  it("K576-API-022 二度押し：同じ冪等キーは同じ答え・書くのは 1 回。別のキーで押し直すと先に変えられた扱い（409・E-ITM-002）", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(40) });
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    const key = { "idempotency-key": randomUUID() };
    const r1 = await go(w.writer, t.id, { from: 1, to: 2 }, key);
    const after = await counts(t.id);
    const r2 = await go(w.writer, t.id, { from: 1, to: 2 }, key);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(await h.json(r2)).toEqual(await h.json(r1));
    expect(await counts(t.id)).toEqual(after);
    const r3 = await go(w.writer, t.id, { from: 1, to: 2 }, { "idempotency-key": randomUUID() });
    expect(r3.status).toBe(409);
    expect((await h.json(r3))["code"]).toBe("E-ITM-002");
  });
  it("K576-API-023 同時に 2 人が同じ戻しを押す（別の冪等キー）：1 つは 200 で戻り、もう 1 つは 409（E-ITM-002）。まとめの行は 1 つ", async () => {
    const t = await fresh();
    await set(t.id, { due_on: day(40) });
    await line(t.id, [{ field: "due_on", from: day(30), to: day(40), note: "延ばす" }]);
    const rs = await Promise.all([go(w.writer, t.id, { from: 1, to: 2 }), go(w.writer, t.id, { from: 1, to: 2 })]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const msgs = await h.messages(t.id);
    expect(msgs.filter((m) => (m.changes ?? []).some((c) => c.field === "item_restore"))).toHaveLength(1);
    expect((await row(t.id)).due_on).toBe(day(30));
  });
  it("K576-API-024 守り：ログに題名・値・理由の字が出ない（成功も断りも）", async () => {
    const t = await fresh();
    const memo = await field("メモ", "short_text");
    await val(t.id, memo, "ログに出してはいけない新しい値");
    await line(t.id, [
      {
        field: `field:${memo}`,
        from: "旧",
        to: "新",
        raw_from: "ログに出してはいけない古い値",
        raw_to: "ログに出してはいけない新しい値",
      },
    ]);
    const logs = await h.captureLogs(async () => {
      await go(w.writer, t.id, { from: 1, to: 2 });
      await go(w.writer, t.id, { from: 1, to: 99 });
    });
    expect(logs).not.toContain("ログに出してはいけない");
    expect(logs).not.toContain("請求書を送る");
  });
  it("K576-API-025 正本と契約：E-ITM-001・002・003 は 409（正本から引いた状態）。契約の restoreTicketItems の 4xx に 404 E-PAGE-001・409 の 3 つがあり、入力は from と to の 2 欄", async () => {
    for (const c of ["E-ITM-001", "E-ITM-002", "E-ITM-003"]) expect(new KanameError(c).status).toBe(409);
    const eps = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../../../08_api/endpoints.json", import.meta.url)), "utf8"),
    ) as {
      endpoints: {
        operation_id?: string;
        method?: string;
        path?: string;
        outputs_4xx: { status: number; code: string }[];
      }[];
    };
    const ep = eps.endpoints.find((x) => x.operation_id === "restoreTicketItems")!;
    expect(ep).toBeDefined();
    const pairs = ep.outputs_4xx.map((o) => `${o.status} ${o.code}`);
    for (const p of ["404 E-PAGE-001", "409 E-ITM-001", "409 E-ITM-002", "409 E-ITM-003"]) expect(pairs).toContain(p);
  });
  it("K576-API-026 優先度の字：K-440 の口（updateTicket）が本物に書く変更の行の字「中」「高」と、戻す値の決め方が合う。本物の口で 中 → 高（理由つき）に変えた履歴を点 1 に戻すと中に戻り、理由は空になる", async () => {
    const t = await fresh();
    const patched = await h.call(w.writer, "PATCH", `/tickets/${t.id}`, {
      body: { priority: "high", priority_reason: "先方が急いでいる" },
    });
    expect(patched.status, await patched.clone().text()).toBe(200);
    const last = (
      await f().admin.query<{ changes: Change[] }>(
        "select changes from ticket_messages where ticket_id = $1 and kind = 'change' order by created_at desc, id desc limit 1",
        [t.id],
      )
    ).rows[0]!;
    expect(last.changes[0]).toMatchObject({ field: "priority", from: "中", to: "高", note: "先方が急いでいる" });
    const out = await ok(await go(w.writer, t.id, { from: 1, to: 2 }));
    expect(out.restored.map((x) => x.field)).toEqual(["priority"]);
    expect(await row(t.id)).toMatchObject({ priority: "mid", priority_reason: null });
  });
});
