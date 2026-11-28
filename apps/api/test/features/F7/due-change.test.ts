// K-483「期限・開始日を変える」の単体の試験（口・本物の DB）。名前の頭の行 ID（K483-API-…）は 11_tickets/K-483.md の行の表と 1 対 1。
// 口：PATCH /api/v1/tickets/:id（updateTicket）の期限の組。体：{ due_on?, start_on?, due_reason?, expected_due_on?, expected_start_on? }。
//   due_on を送るときは due_reason が要る（期限をなくす null も・最初に決めるときも）。start_on だけの直しは理由が要らない。
//   答え：{ data: { ticket, changed, message_id } }。ticket は id・number・updated_at と、送った欄の列（due_on・start_on のうち送った欄）だけ。stage は付けない（K-440 の答えの組み立て：stage は段・実績・保留の組の鍵が送られたときだけ）。
//   変えたらやり取りに変更の 1 行（kind change）。期限を変えたときだけ、承認する人（決まっていない承認の人・無ければ担当者）と担当者のうち、変えた人でない人の受け箱にお知らせ 1 つずつ。
// 土台 due.harness.ts（K-483 が運ぶ）。口の振る舞いは段 7 の K-387 の hooks（apps/api/src/hooks/ticket-update.ts）の欄の表に、K-440・K-564・K-583 の後ろにこの葉が組を足す（組が複数でも通る・断れば取引ごと戻るのは K-440 の振り分け）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DUE_DONE,
  DUE_KIND,
  DUE_NO_REASON,
  DUE_ORDER_STATE,
  DUE_OVER_PARENT,
  DUE_REASON_LONG,
  DUE_STALE,
  DUE_UNDER_CHILD,
  REASON_MAX,
  TEXT,
  VAL_NOT_YET,
  DUE_PAST,
  approver,
  asMember,
  audits,
  boss,
  captureLogs,
  detail,
  doneTicket,
  due,
  f,
  failsAs,
  fields,
  jst,
  json,
  lines,
  mmdd,
  notices,
  num,
  one,
  outsider,
  patch,
  pendingApproval,
  row,
  setupDue,
  stopped,
  ticket,
  viewer,
  writer,
} from "./due.harness.js";

setupDue();

const code = async (r: Response) => String((await json(r))["code"]);
/** 何も変わっていない：期限・開始日・更新時刻が前のまま・やり取り・お知らせ・証跡が 0 */
async function untouched(id: string, before: Awaited<ReturnType<typeof row>>) {
  const now = await row(id);
  expect([now.due_on, now.start_on]).toEqual([before.due_on, before.start_on]);
  expect(new Date(now.updated_at).getTime()).toBe(new Date(before.updated_at).getTime());
  expect(await lines(id)).toHaveLength(0);
  expect(await notices(id)).toHaveLength(0);
  expect(await audits(id)).toHaveLength(0);
}

describe("K-483 期限を変える（updateTicket の期限の組・本物の DB）", () => {
  it("K483-API-001 期限を変える（担当者本人）：200・答えの鍵（changed・message_id・ticket ちょうど・stage は付かない）・ticket は id・number・due_on・updated_at ちょうど（送った欄の列だけ）・期限が新しい日・変更の 1 行が 1 つ（書いた人は担当者・文「高本 が期限を MM/DD → MM/DD に変えた（理由：…）」・changes はちょうど due_on の from・to・note）・お知らせ 0（自分が担当者で変えたので）", async () => {
    const t = await ticket({ due: jst(5) });
    const r = await patch(boss, t.id, due(jst(10), "先方の都合"));
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["changed", "message_id", "ticket"]);
    expect(Object.keys(d["ticket"] as object).sort()).toEqual(["due_on", "id", "number", "updated_at"]);
    expect([d["changed"], (d["ticket"] as Record<string, unknown>)["due_on"]]).toEqual([true, jst(10)]);
    expect((await row(t.id)).due_on).toBe(jst(10));
    const ls = await lines(t.id);
    expect(ls).toHaveLength(1);
    expect(ls[0]!.id).toBe(d["message_id"]);
    expect([ls[0]!.author_member_id, ls[0]!.created_by]).toEqual([boss.id, boss.id]);
    expect(ls[0]!.body).toBe(`高本 が期限を ${mmdd(jst(5))} → ${mmdd(jst(10))} に変えた（理由：先方の都合）`);
    expect(ls[0]!.changes).toEqual([
      { field: "due_on", from: jst(5), to: jst(10), raw_from: jst(5), raw_to: jst(10), note: "先方の都合" },
    ]);
    expect(await notices(t.id)).toHaveLength(0);
  });

  it("K483-API-002 担当者でない人が変える：担当者の受け箱にお知らせ 1 つ（inapp・種類 ticket.due_changed・dedupe_key は種類と変更の 1 行の id・payload の鍵は fields・message_id・number・ticket_id・url ちょうど＝ほかの組と同じ形・題名と理由と日付の字は無い）。変えた人には 0。担当者がいない・止められているときも 0。期限と優先度を一緒に送ると担当者の受け箱は 1 行（前の組の行の fields に due_on を足す・1 回の要求は 1 人に 1 通 ⑮7）", async () => {
    const t = await ticket({ due: jst(5), title: "お知らせを見る" });
    const r = await patch(writer, t.id, due(jst(9), "社内の事情"));
    expect(r.status).toBe(200);
    const id = String(((await json(r)).data as Record<string, unknown>)["message_id"]);
    const ns = await notices(t.id);
    expect(ns).toHaveLength(1);
    expect([ns[0]!.member_id, ns[0]!.channel_id, ns[0]!.dedupe_key]).toEqual([boss.id, "inapp", `${DUE_KIND}:${id}`]);
    expect(Object.keys(ns[0]!.payload).sort()).toEqual(["fields", "message_id", "number", "ticket_id", "url"]);
    expect(ns[0]!.payload).toEqual({
      ticket_id: t.id,
      number: t.number,
      url: `/tickets/${t.id}`,
      message_id: id,
      fields: ["due_on"],
    });
    const text = JSON.stringify(ns[0]!.payload);
    expect(text).not.toContain("社内の事情");
    expect(text).not.toContain("お知らせを見る");
    expect(text).not.toContain(jst(9));
    // 1 回の要求は 1 人に 1 通：優先度の組（表の前の組）が書いた担当者の行に due_on を足し、期限の種類の行は新しく書かない
    const mixed = await ticket({ due: jst(5), title: "優先度と期限を一緒に" });
    const m = await patch(writer, mixed.id, { ...due(jst(9)), priority: "high", priority_reason: "急ぎの先方" });
    expect(m.status, await m.clone().text()).toBe(200);
    const all = await f.admin.query<{ member_id: string; event_kind_id: string; payload: { fields?: string[] } }>(
      "select member_id, event_kind_id, payload from notifications where payload->>'ticket_id' = $1::text",
      [mixed.id],
    );
    expect(all.rows.map((n) => n.member_id)).toEqual([boss.id]);
    expect(all.rows[0]!.event_kind_id).not.toBe(DUE_KIND);
    expect(all.rows[0]!.payload.fields).toContain("priority");
    expect(all.rows[0]!.payload.fields).toContain("due_on");
    // 担当者がいない・担当者が止められているときは、変えた人が別の人でも届かない
    const nobody = await ticket({ due: jst(5), assignee: null, title: "担当者がいない" });
    expect((await patch(writer, nobody.id, due(jst(9)))).status).toBe(200);
    expect(await notices(nobody.id)).toHaveLength(0);
    const gone = await ticket({ due: jst(5), assignee: stopped, title: "担当者が止められている" });
    expect((await patch(writer, gone.id, due(jst(9)))).status).toBe(200);
    expect(await notices(gone.id)).toHaveLength(0);
  });

  it("K483-API-003 承認する人：決まっていない承認の人と担当者の両方に 1 つずつ（変えた人は除く）。承認する人が担当者なら 1 つ・変えた人が承認する人ならその人には 0・決まった承認・取り下げた承認・消した承認の人・止められた承認する人には届かない", async () => {
    const both = await ticket({ title: "承認と担当" });
    await pendingApproval(both, approver);
    expect((await patch(writer, both.id, due(jst(8)))).status).toBe(200);
    expect((await notices(both.id)).map((n) => n.member_id).sort()).toEqual([approver.id, boss.id].sort());
    const same = await ticket({ title: "承認も担当" });
    await pendingApproval(same, boss);
    expect((await patch(writer, same.id, due(jst(8)))).status).toBe(200);
    expect((await notices(same.id)).map((n) => n.member_id)).toEqual([boss.id]);
    const byApprover = await ticket({ title: "承認する人が変える" });
    await pendingApproval(byApprover, approver);
    expect((await patch(approver, byApprover.id, due(jst(8)))).status).toBe(200);
    expect((await notices(byApprover.id)).map((n) => n.member_id)).toEqual([boss.id]);
    const old = await ticket({ title: "終わった承認" });
    await pendingApproval(old, approver, { decided: true });
    await pendingApproval(old, approver, { withdrawn: true });
    expect((await patch(writer, old.id, due(jst(8)))).status).toBe(200);
    expect((await notices(old.id)).map((n) => n.member_id)).toEqual([boss.id]);
    const removed = await ticket({ title: "消した承認" });
    await pendingApproval(removed, approver);
    await f.admin.query("update approvals set deleted_at = now() where ticket_id = $1", [removed.id]);
    expect((await patch(writer, removed.id, due(jst(8)))).status).toBe(200);
    expect((await notices(removed.id)).map((n) => n.member_id)).toEqual([boss.id]);
    const stoppedApprover = await ticket({ title: "止められた承認する人" });
    await pendingApproval(stoppedApprover, stopped);
    expect((await patch(writer, stoppedApprover.id, due(jst(8)))).status).toBe(200);
    expect((await notices(stoppedApprover.id)).map((n) => n.member_id)).toEqual([boss.id]);
  });

  it("K483-API-004 承認待ちの間も期限は変えられる：段が承認待ちで決まっていない承認がある → 200・承認する人にお知らせが届く", async () => {
    const t = await ticket({ stage: "awaiting_approval" });
    await pendingApproval(t, approver);
    const r = await patch(writer, t.id, due(jst(12), "確認が長引いた"));
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await row(t.id)).due_on).toBe(jst(12));
    expect((await notices(t.id)).map((n) => n.member_id)).toContain(approver.id);
  });

  it("K483-API-005 理由が足りない・長い：due_on を送って due_reason が無い・null・空・空白だけ（全角も）・制御文字だけは 422 E-DUE-001（欄 due_reason）／201 文字は 422 E-DUE-002。200 文字は通る。足りないときは何も変わらない", async () => {
    const t = await ticket({ due: jst(5) });
    const before = await row(t.id);
    const cases: [Record<string, unknown>, string][] = [
      [{ due_on: jst(8) }, DUE_NO_REASON],
      [{ due_on: jst(8), due_reason: "" }, DUE_NO_REASON],
      [{ due_on: jst(8), due_reason: null }, DUE_NO_REASON],
      [{ due_on: jst(8), due_reason: "　 " }, DUE_NO_REASON],
      [{ due_on: jst(8), due_reason: "\u0007\u0008" }, DUE_NO_REASON],
      [{ due_on: jst(8), due_reason: "あ".repeat(REASON_MAX + 1) }, DUE_REASON_LONG],
    ];
    for (const [body, c] of cases) {
      const r = await patch(boss, t.id, body);
      expect(r.status, JSON.stringify(body).slice(0, 50)).toBe(422);
      const j = await json(r);
      expect([j["code"], j["message"]]).toEqual([c, TEXT[c]]);
      expect(fields(j)).toEqual(["due_reason"]);
    }
    await untouched(t.id, before);
    expect((await patch(boss, t.id, due(jst(8), "あ".repeat(REASON_MAX)))).status).toBe(200);
  });

  it("K483-API-006 対の欄なしで送る：due_on が無いまま due_reason を送る（start_on だけに添えるのも）は 422（欄 due_reason）。expected_due_on を due_on なしで・expected_start_on を start_on なしで送る（expected だけ・start_on に expected_due_on を添える）は 422（欄 expected_due_on／expected_start_on）。何も変わらない", async () => {
    const t = await ticket({ due: jst(5), start: jst(1) });
    const before = await row(t.id);
    const cases: [Record<string, unknown>, string][] = [
      [{ due_reason: "理由だけ" }, "due_reason"],
      [{ start_on: jst(2), due_reason: "開始日の理由" }, "due_reason"],
      [{ expected_due_on: jst(5) }, "expected_due_on"],
      [{ expected_start_on: jst(1) }, "expected_start_on"],
      [{ start_on: jst(2), expected_due_on: jst(5) }, "expected_due_on"],
      [{ ...due(jst(8)), expected_start_on: jst(1) }, "expected_start_on"],
    ];
    for (const [body, field] of cases) {
      const r = await patch(boss, t.id, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      const j = await json(r);
      expect(j["code"]).toBe("VALIDATION_ERROR");
      expect(fields(j)).toContain(field);
    }
    await untouched(t.id, before);
  });

  it("K483-API-007 過去の日：期限が昨日以前は 409 E-VAL-012（今日の日付で決まる断りなので 422 でなく 409・details なし・何も変わらない）。今日は通る。開始日は過去でもよい", async () => {
    const t = await ticket({ due: jst(5), start: jst(-3) });
    const before = await row(t.id);
    const r = await patch(boss, t.id, due(jst(-1)));
    expect(r.status).toBe(409);
    const j = await json(r);
    expect([j["code"], j["message"]]).toEqual([DUE_PAST, TEXT[DUE_PAST]]);
    expect([j["field"], j["details"], j["detail"]]).toEqual([undefined, undefined, undefined]);
    await untouched(t.id, before);
    expect((await patch(boss, t.id, { start_on: jst(-10) })).status).toBe(200);
    expect((await patch(boss, t.id, due(jst(0)))).status).toBe(200);
    expect((await row(t.id)).due_on).toBe(jst(0));
  });

  it("K483-API-008 日付の形：暦に無い日（2 月 30 日）・斜線・文字・数・空の文字・時刻つきの字（時刻は持たない・D-150.4）は 422 VALIDATION_ERROR（欄 due_on／start_on／expected_due_on／expected_start_on）。何も変わらない", async () => {
    const t = await ticket({ due: jst(5) });
    const before = await row(t.id);
    for (const bad of ["2027-02-30", "2027/03/05", "来週", 20270305, "", "2027-03-05T18:00:00"]) {
      const a = await patch(boss, t.id, { due_on: bad, due_reason: "形" });
      expect(a.status, JSON.stringify(bad)).toBe(422);
      expect(fields(await json(a))).toContain("due_on");
      const b = await patch(boss, t.id, { start_on: bad });
      expect(b.status, JSON.stringify(bad)).toBe(422);
      expect(fields(await json(b))).toContain("start_on");
      const c = await patch(boss, t.id, { ...due(jst(8)), expected_due_on: bad });
      expect(c.status, JSON.stringify(bad)).toBe(422);
      expect(fields(await json(c))).toContain("expected_due_on");
      const e = await patch(boss, t.id, { start_on: jst(1), expected_start_on: bad });
      expect(e.status, JSON.stringify(bad)).toBe(422);
      expect(fields(await json(e))).toContain("expected_start_on");
    }
    await untouched(t.id, before);
  });

  it("K483-API-009 期限をなくす（due_on を null・理由つき）：200・期限が空・変更の 1 行「高本 が期限をなくした（理由：…）」・changes は to が null・お知らせは変えた人以外に届く（担当者が自分なら 0）", async () => {
    const t = await ticket({ due: jst(5) });
    const r = await patch(boss, t.id, due(null, "日を決めずに進める"));
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await row(t.id)).due_on).toBeNull();
    const ls = await lines(t.id);
    expect(ls[0]!.body).toBe("高本 が期限をなくした（理由：日を決めずに進める）");
    expect(ls[0]!.changes).toEqual([
      { field: "due_on", from: jst(5), to: null, raw_from: jst(5), raw_to: null, note: "日を決めずに進める" },
    ]);
    const t2 = await ticket({ due: jst(5) });
    expect((await patch(writer, t2.id, due(null, "なくす"))).status).toBe(200);
    expect((await notices(t2.id)).map((n) => n.member_id)).toEqual([boss.id]);
  });

  it("K483-API-010 期限を初めて決める（今は期限が無い）：理由は要る（無ければ 422 E-DUE-001）。理由つきは 200・変更の 1 行「高本 が期限を MM/DD に決めた（理由：…）」・changes の from は null", async () => {
    const t = await ticket({ due: null });
    const no = await patch(boss, t.id, { due_on: jst(7) });
    expect(no.status).toBe(422);
    expect(await code(no)).toBe(DUE_NO_REASON);
    expect((await row(t.id)).due_on).toBeNull();
    const r = await patch(boss, t.id, due(jst(7), "着手の日が決まった"));
    expect(r.status, await r.clone().text()).toBe(200);
    const ls = await lines(t.id);
    expect(ls).toHaveLength(1);
    expect(ls[0]!.body).toBe(`高本 が期限を ${mmdd(jst(7))} に決めた（理由：着手の日が決まった）`);
    expect(ls[0]!.changes).toEqual([
      { field: "due_on", from: null, to: jst(7), raw_from: null, raw_to: jst(7), note: "着手の日が決まった" },
    ]);
  });

  it("K483-API-011 開始日だけ直す：理由は要らない・200・変更の 1 行「高本 が開始日を MM/DD → MM/DD に変えた」（理由の字は無い）・changes は start_on だけ・お知らせは出ない（期限が変わらないので）", async () => {
    const t = await ticket({ due: jst(10), start: jst(2) });
    const r = await patch(writer, t.id, { start_on: jst(4) });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await row(t.id)).start_on).toBe(jst(4));
    const ls = await lines(t.id);
    expect(ls).toHaveLength(1);
    expect(ls[0]!.body).toBe(`佐藤 が開始日を ${mmdd(jst(2))} → ${mmdd(jst(4))} に変えた`);
    expect(ls[0]!.changes).toEqual([{ field: "start_on", from: jst(2), to: jst(4), raw_from: jst(2), raw_to: jst(4) }]);
    const d = (await json(r)).data as Record<string, unknown>;
    expect(Object.keys(d["ticket"] as object).sort()).toEqual(["id", "number", "start_on", "updated_at"]);
    expect(await notices(t.id)).toHaveLength(0);
  });

  it("K483-API-012 期限と開始日を一緒に変える：1 つの変更の 1 行「…が期限を A → B に変えた（理由：…）・開始日を C → D に変えた」・changes は due_on・start_on の順・お知らせは 1 つ（担当者へ）・証跡は 1 つ", async () => {
    const t = await ticket({ due: jst(5), start: jst(1) });
    const r = await patch(writer, t.id, { due_on: jst(8), start_on: jst(3), due_reason: "全体を後ろへ" });
    expect(r.status, await r.clone().text()).toBe(200);
    const now = await row(t.id);
    expect([now.due_on, now.start_on]).toEqual([jst(8), jst(3)]);
    const ls = await lines(t.id);
    expect(ls).toHaveLength(1);
    expect(ls[0]!.body).toBe(
      `佐藤 が期限を ${mmdd(jst(5))} → ${mmdd(jst(8))} に変えた（理由：全体を後ろへ）・開始日を ${mmdd(jst(1))} → ${mmdd(jst(3))} に変えた`,
    );
    expect(ls[0]!.changes.map((c) => c.field)).toEqual(["due_on", "start_on"]);
    expect(ls[0]!.changes.map((c) => [c.raw_from, c.raw_to])).toEqual([
      [jst(5), jst(8)],
      [jst(1), jst(3)],
    ]);
    const d = (await json(r)).data as Record<string, unknown>;
    expect(Object.keys(d["ticket"] as object).sort()).toEqual(["due_on", "id", "number", "start_on", "updated_at"]);
    expect((await notices(t.id)).map((n) => n.member_id)).toEqual([boss.id]);
    expect(await audits(t.id)).toHaveLength(1);
  });

  it("K483-API-013 開始日が期限より後（両方を送った）：409 E-VAL-028（欄なし・欄どうしの比べ合いは契約に書けないので 422 でなく 409）。何も変わらない", async () => {
    const t = await ticket({ due: jst(5), start: jst(1) });
    const before = await row(t.id);
    const r = await patch(boss, t.id, { due_on: jst(5), start_on: jst(6), due_reason: "順番を間違える" });
    expect(r.status).toBe(409);
    const j = await json(r);
    expect([j["code"], j["message"]]).toEqual([DUE_ORDER_STATE, TEXT[DUE_ORDER_STATE]]);
    expect([j["field"], j["details"], j["detail"]]).toEqual([undefined, undefined, undefined]);
    await untouched(t.id, before);
  });

  it("K483-API-014 片方だけ送って今の値と合わない：期限を今の開始日より前にする／開始日を今の期限より後にする は 409 E-VAL-028（欄なし）。何も変わらない", async () => {
    const t = await ticket({ due: jst(10), start: jst(5) });
    const before = await row(t.id);
    const a = await patch(boss, t.id, due(jst(3)));
    const b = await patch(boss, t.id, { start_on: jst(12) });
    for (const r of [a, b]) {
      expect(r.status).toBe(409);
      const j = await json(r);
      expect([j["code"], j["message"]]).toEqual([DUE_ORDER_STATE, TEXT[DUE_ORDER_STATE]]);
      expect([j["field"], j["details"], j["detail"]]).toEqual([undefined, undefined, undefined]);
    }
    await untouched(t.id, before);
  });

  it("K483-API-015 子は親より後にできない：子の期限が親の期限より後は 409 E-DUE-005（何も変わらない）。同じ日は通る。親に期限が無い・親を消したなら何日でもよい。親と期限を同じ要求で送ると、表の前の優先度と親の組が今の期限で比べる（新しい期限なら合っても 409 E-TKT-004・何も書かない）", async () => {
    const parent = await ticket({ due: jst(10), title: "親" });
    const child = await ticket({ due: jst(5), parent: parent.id, title: "子" });
    const before = await row(child.id);
    const over = await patch(boss, child.id, due(jst(11)));
    expect(over.status).toBe(409);
    const j = await json(over);
    expect([j["code"], j["message"]]).toEqual([DUE_OVER_PARENT, TEXT[DUE_OVER_PARENT]]);
    await untouched(child.id, before);
    expect((await patch(boss, child.id, due(jst(10)))).status).toBe(200);
    const free = await ticket({ due: null, title: "期限の無い親" });
    const kid = await ticket({ due: jst(5), parent: free.id, title: "期限の無い親の子" });
    expect((await patch(boss, kid.id, due(jst(40)))).status).toBe(200);
    const gone = await ticket({ due: jst(10), title: "消した親" });
    const orphan = await ticket({ due: jst(5), parent: gone.id, title: "消した親の子" });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.id]);
    expect((await patch(boss, orphan.id, due(jst(30)))).status).toBe(200);
    // 親と期限を一緒に：今の期限（jst(20)）は新しい親の期限（jst(10)）より後なので、優先度と親の組が先に断る
    const newParent = await ticket({ due: jst(10), title: "新しい親" });
    const moving = await ticket({ due: jst(20), title: "親を決める子" });
    const movingBefore = await row(moving.id);
    const both = await patch(boss, moving.id, { parent_ticket_id: newParent.id, ...due(jst(8)) });
    expect(both.status).toBe(409);
    expect(await code(both)).toBe("E-TKT-004");
    await untouched(moving.id, movingBefore);
  });

  it("K483-API-016 親は子より前にできない：親の期限を、子の期限より前にすると 409 E-DUE-006。子と同じ日は通る・期限をなくすのも通る・消した子は数えない", async () => {
    const parent = await ticket({ due: jst(10), title: "親" });
    await ticket({ due: jst(8), parent: parent.id, title: "子" });
    const before = await row(parent.id);
    const under = await patch(boss, parent.id, due(jst(7)));
    expect(under.status).toBe(409);
    const j = await json(under);
    expect([j["code"], j["message"]]).toEqual([DUE_UNDER_CHILD, TEXT[DUE_UNDER_CHILD]]);
    await untouched(parent.id, before);
    expect((await patch(boss, parent.id, due(jst(8)))).status).toBe(200);
    expect((await patch(boss, parent.id, due(null, "日を決めない"))).status).toBe(200);
    const p2 = await ticket({ due: jst(10), title: "親 2" });
    await ticket({ due: jst(20), parent: p2.id, title: "消した子", deleted: true });
    expect((await patch(boss, p2.id, due(jst(9)))).status).toBe(200);
  });

  it("K483-API-017 完了したチケット：期限も開始日だけの直しも 409 E-DUE-007。何も変わらない", async () => {
    const t = await doneTicket({ due: jst(5), start: jst(1) });
    const before = await row(t.id);
    for (const body of [due(jst(9)), { start_on: jst(2) }]) {
      const r = await patch(boss, t.id, body);
      expect(r.status).toBe(409);
      const j = await json(r);
      expect([j["code"], j["message"]]).toEqual([DUE_DONE, TEXT[DUE_DONE]]);
    }
    await untouched(t.id, before);
  });

  it("K483-API-018 同時に変えられた：画面が見ていた値（expected_due_on・expected_start_on）が今と違えば 409 E-DUE-008（何も変わらない）。合えば 200。期限が無かったことは expected_due_on の null で表す", async () => {
    const t = await ticket({ due: jst(5), start: jst(1) });
    const before = await row(t.id);
    const stale = await patch(boss, t.id, { ...due(jst(8)), expected_due_on: jst(6) });
    expect(stale.status).toBe(409);
    const j = await json(stale);
    expect([j["code"], j["message"]]).toEqual([DUE_STALE, TEXT[DUE_STALE]]);
    const staleStart = await patch(boss, t.id, { start_on: jst(2), expected_start_on: jst(9) });
    expect(staleStart.status).toBe(409);
    expect(await code(staleStart)).toBe(DUE_STALE);
    await untouched(t.id, before);
    expect((await patch(boss, t.id, { ...due(jst(8)), expected_due_on: jst(5) })).status).toBe(200);
    const none = await ticket({ due: null });
    expect((await patch(boss, none.id, { ...due(jst(6)), expected_due_on: null })).status).toBe(200);
    const wasSet = await ticket({ due: jst(5) });
    const bad = await patch(boss, wasSet.id, { ...due(jst(6)), expected_due_on: null });
    expect(bad.status).toBe(409);
  });

  it("K483-API-019 変わらない直し：今と同じ期限を送ると 200・changed false・message_id null・更新時刻もやり取りもお知らせも証跡も増えない", async () => {
    const t = await ticket({ due: jst(5) });
    const before = await row(t.id);
    const r = await patch(writer, t.id, due(jst(5)));
    expect(r.status).toBe(200);
    const d = (await json(r)).data as Record<string, unknown>;
    expect([d["changed"], d["message_id"]]).toEqual([false, null]);
    expect(Object.keys(d).sort()).toEqual(["changed", "message_id", "ticket"]); // 変わらなくても答えの鍵は同じ 3 つ
    await untouched(t.id, before);
  });

  it("K483-API-020 変えられない人：見るだけは 403・別の会社の人は 404・ログインしていないは 401・消したチケットは 404・止められた人は 403。何も変わらない", async () => {
    const t = await ticket({ due: jst(5) });
    const gone = await ticket({ due: jst(5), deleted: true });
    const before = await row(t.id);
    expect((await patch(viewer, t.id, due(jst(8)))).status).toBe(403);
    expect((await patch(outsider, t.id, due(jst(8)))).status).toBe(404);
    expect((await f.req("PATCH", `/tickets/${t.id}`, { body: due(jst(8)) })).status).toBe(401);
    expect((await patch(boss, gone.id, due(jst(8)))).status).toBe(404);
    expect((await patch(stopped, t.id, due(jst(8)))).status).toBe(403);
    expect((await patch(boss, randomUUID(), due(jst(8)))).status).toBe(404);
    await untouched(t.id, before);
  });

  it("K483-API-021 期限と実績・段を一緒に送る：期限の欄に actual_minutes を添えると 200 で両方書く（期限の変更の 1 行は 1 つ）。段の組が断られる要求（存在しない段の id）を添えると期限も書かない。実績の組が書いた後で期限の組が断る（昨日の期限・409 E-VAL-012）と、実績も戻る（取引ごと戻る・やり取りは 1 行も残らない）", async () => {
    const ok = await ticket({ due: jst(5) });
    const r = await patch(boss, ok.id, { ...due(jst(8)), actual_minutes: 30 });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await row(ok.id)).due_on).toBe(jst(8));
    const actual = await one<{ actual_minutes: number | null }>("select actual_minutes from tickets where id = $1", [
      ok.id,
    ]);
    expect(actual.actual_minutes).toBe(30);
    expect(await lines(ok.id)).toHaveLength(1);
    const bad = await ticket({ due: jst(5) });
    const before = await row(bad.id);
    const refused = await patch(boss, bad.id, { ...due(jst(8)), stage_id: randomUUID() });
    expect(refused.status).toBeGreaterThanOrEqual(400); // 段の組の断りの番号は K-387 の物（ここでは見ない）
    expect(refused.status).toBeLessThan(500);
    await untouched(bad.id, before);
    const late = await ticket({ due: jst(5) });
    const lateBefore = await row(late.id);
    const back = await patch(boss, late.id, { ...due(jst(-1)), actual_minutes: 30 });
    expect(back.status).toBe(409);
    expect(await code(back)).toBe(DUE_PAST);
    const kept = await one<{ actual_minutes: number | null }>("select actual_minutes from tickets where id = $1", [
      late.id,
    ]);
    expect(kept.actual_minutes).toBeNull();
    expect(await num("select count(*) as n from ticket_messages where ticket_id = $1", [late.id])).toBe(0);
    await untouched(late.id, lateBefore);
  });

  it("K483-API-022 ほかの欄はまだ変えられない：題名・見込みなどは 422 E-VAL-018（欄ごと。優先度・親は K-440 の組）。担当者も同じ（担当を変えるのは渡す口・F8）。期限の欄を添えても何も書かない", async () => {
    const t = await ticket({ due: jst(5) });
    const before = await row(t.id);
    const a = await patch(boss, t.id, { ...due(jst(8)), title: "題名は直せない" });
    expect(a.status).toBe(422);
    expect(await code(a)).toBe(VAL_NOT_YET);
    expect(fields(await json(a))).toEqual(["title"]);
    const b = await patch(boss, t.id, { assignee_member_id: writer.id });
    expect(b.status).toBe(422);
    expect(await code(b)).toBe(VAL_NOT_YET);
    expect(fields(await json(b))).toEqual(["assignee_member_id"]);
    await untouched(t.id, before);
  });

  it("K483-API-023 詳細の can.due：書ける人（担当者・書ける権限）は true・見るだけは false・完了したチケットは false", async () => {
    const t = await ticket();
    const done = await doneTicket();
    const can = async (who: typeof boss, id: string) =>
      (((await json(await detail(who, id))).data as Record<string, unknown>)["can"] as Record<string, unknown>)["due"];
    expect(await can(boss, t.id)).toBe(true);
    expect(await can(writer, t.id)).toBe(true);
    expect(await can(viewer, t.id)).toBe(false);
    expect(await can(boss, done.id)).toBe(false);
  });

  it("K483-API-024 DB の 2 層目（口を通さず関数と表を直に）：見るだけの人が関数 app.ticket_due_set を呼ぶと not_writable・止められた人は not_member・何も変わらない。表への直の更新で開始日を期限より後にすると check で断られる", async () => {
    const t = await ticket({ due: jst(5), start: jst(1) });
    const before = await row(t.id);
    const call = (who: typeof boss) =>
      asMember<{ v: { error?: string } }>(who, "select app.ticket_due_set($1, $2::jsonb) as v", [
        t.id,
        JSON.stringify({ due_on: jst(8), due_reason: "直に呼ぶ" }),
      ]).then((rs) => rs[0]!.v.error);
    expect(await call(viewer)).toBe("not_writable");
    expect(await call(stopped)).toBe("not_member");
    await untouched(t.id, before);
    expect(await failsAs(boss, "update tickets set start_on = $2 where id = $1", [t.id, jst(9)])).toMatch(
      /check constraint|violates check/,
    );
  });

  it("K483-API-025 失敗（手順 S1：DB に書く）：期限の列を書く所で DB が落ちると 503・E-PAGE-003。期限・やり取り・お知らせ・証跡は 1 つも残らない（1 つの取引）。ログに理由の字は無い。戻れば同じ操作が通る", async () => {
    const t = await ticket({ due: jst(5), title: "K483 壊れる更新" });
    const before = await row(t.id);
    await f.admin.query(`create or replace function public.k483_boom_row() returns trigger language plpgsql as $$
      begin
        if new.title like 'K483 壊れる更新%' and new.due_on is distinct from old.due_on then raise exception 'K483 の試験で更新を壊した'; end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k483_boom_row before update on tickets for each row execute function public.k483_boom_row()",
    );
    try {
      let status = 0;
      let errCode = "";
      const logs = await captureLogs(async () => {
        const r = await patch(writer, t.id, due(jst(8), "秘密の理由"));
        status = r.status;
        errCode = await code(r);
      });
      expect(status).toBe(503);
      expect(errCode).toBe("E-PAGE-003");
      expect(logs).not.toContain("秘密の理由");
      await untouched(t.id, before);
    } finally {
      await f.admin.query("drop trigger if exists k483_boom_row on tickets");
      await f.admin.query("drop function if exists public.k483_boom_row()");
    }
    expect((await patch(writer, t.id, due(jst(8)))).status).toBe(200);
  });

  it("K483-API-026 失敗（手順 S2：お知らせを書く）：受け箱の行を書く所で DB が落ちると 503・E-PAGE-003。期限・やり取り・証跡は前のまま（1 つの取引）。戻れば通る", async () => {
    const t = await ticket({ due: jst(5), title: "K483 壊れる通知" });
    const before = await row(t.id);
    await f.admin.query(`create or replace function public.k483_boom_note() returns trigger language plpgsql as $$
      begin
        if new.event_kind_id = 'ticket.due_changed' and new.payload->>'ticket_id' = '${t.id}' then raise exception 'K483 の試験でお知らせを壊した'; end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k483_boom_note before insert on notifications for each row execute function public.k483_boom_note()",
    );
    try {
      let status = 0;
      let errCode = "";
      await captureLogs(async () => {
        const r = await patch(writer, t.id, due(jst(8)));
        status = r.status;
        errCode = await code(r);
      });
      expect(status).toBe(503);
      expect(errCode).toBe("E-PAGE-003");
      await untouched(t.id, before);
    } finally {
      await f.admin.query("drop trigger if exists k483_boom_note on notifications");
      await f.admin.query("drop function if exists public.k483_boom_note()");
    }
    expect((await patch(writer, t.id, due(jst(8)))).status).toBe(200);
    expect(await notices(t.id)).toHaveLength(1);
  });

  it("K483-API-027 失敗（守りの判定）：書けるかの判定（app.ticket_writable）で例外になったら、口は通さず 503・E-PAGE-003（口の入口の行の守りが先に倒す）。関数 app.ticket_due_set を直に呼んでも guard_failed を返す（2 層目）。何も書かない（止める側に倒す）", async () => {
    const t = await ticket({ due: jst(5), title: "K483 守りが壊れる" });
    const before = await row(t.id);
    // 壊すのはこの試験の中だけ：ticket_writable を「この題名のチケットなら例外」に作り替え、finally で元の定義に戻す
    const orig = (
      await one<{ def: string }>("select pg_get_functiondef('app.ticket_writable(uuid)'::regprocedure) as def")
    ).def;
    await f.admin
      .query(`create or replace function app.ticket_writable(tid uuid) returns boolean language plpgsql stable security definer set search_path = public, app as $$
      begin
        if exists (select 1 from tickets x where x.id = tid and x.title = 'K483 守りが壊れる') then
          raise exception 'K483 の試験で守りを壊した';
        end if;
        return exists (
          select 1 from tickets x
          where x.id = tid and x.tenant_id = app.tenant_id()
            and app.ticket_draft_ok(x.draft_import_id, app.user_id())
            and (has_permission(app.user_id(), 'tickets', x.scope_id, 'edit') or x.assignee_member_id = app.user_id())
        );
      end $$`);
    try {
      const r = await patch(boss, t.id, due(jst(8)));
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
      const direct = await asMember<{ v: { error?: string } }>(boss, "select app.ticket_due_set($1, $2::jsonb) as v", [
        t.id,
        JSON.stringify(due(jst(8), "直に呼ぶ")),
      ]);
      expect(direct[0]!.v.error).toBe("guard_failed");
    } finally {
      await f.admin.query(orig);
    }
    await untouched(t.id, before);
  });

  it("K483-API-028 証跡：直すと証跡 ticket.due（関門 C2）が 1 つで、中身は直した欄の名前だけ（期限と開始日を一緒なら due_on・start_on の順）。日付と理由の字は入らない。開始日だけなら start_on だけ", async () => {
    const t = await ticket({ due: jst(5), start: jst(1) });
    expect((await patch(boss, t.id, due(jst(8), "証跡に理由を残さない"))).status).toBe(200);
    expect((await patch(boss, t.id, { start_on: jst(2) })).status).toBe(200);
    expect((await patch(boss, t.id, { due_on: jst(9), start_on: jst(3), due_reason: "両方" })).status).toBe(200);
    const as = await audits(t.id);
    expect(as.map((a) => a.payload)).toEqual([
      { fields: ["due_on"] },
      { fields: ["start_on"] },
      { fields: ["due_on", "start_on"] },
    ]);
    expect(as.every((a) => a.choke_point_id === "C2" && a.actor_member_id === boss.id)).toBe(true);
    expect(JSON.stringify(as)).not.toContain("証跡に理由を残さない");
  });

  it("K483-API-029 同時に 2 人が変える：どちらも 200（期限の列を行ごとにつないで書く）・やり取りは 2 つ・2 つ目の from は 1 つ目の to・今の期限は 2 つ目の to", async () => {
    const t = await ticket({ due: jst(5) });
    const rs = await Promise.all([patch(writer, t.id, due(jst(8))), patch(boss, t.id, due(jst(9)))]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    const ls = await lines(t.id);
    expect(ls).toHaveLength(2);
    // 並びは作った時刻（取引を始めた時刻）でなく、錠を取った順＝from の鎖でたどる（jst(5) から始まる行が 1 つ目）
    const first = ls.find((l) => l.changes[0]!.from === jst(5));
    const second = ls.find((l) => l !== first);
    expect(first).toBeDefined();
    expect(second!.changes[0]!.from).toBe(first!.changes[0]!.to);
    expect((await row(t.id)).due_on).toBe(second!.changes[0]!.to);
  });

  it("K483-API-030 失敗（手順 S3：証跡を書く）：証跡を書く所で DB が落ちると 503・E-PAGE-003。期限・やり取り・お知らせ・証跡は 1 つも残らない（1 つの取引）。ログに理由の字は無い。戻れば同じ操作が通る", async () => {
    const t = await ticket({ due: jst(5), title: "K483 壊れる証跡" });
    const before = await row(t.id);
    await f.admin.query(`create or replace function public.k483_boom_audit() returns trigger language plpgsql as $$
      begin
        if new.action = 'ticket.due' and new.target_id = '${t.id}' then raise exception 'K483 の試験で証跡を壊した'; end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k483_boom_audit before insert on audit_events for each row execute function public.k483_boom_audit()",
    );
    try {
      let status = 0;
      let errCode = "";
      const logs = await captureLogs(async () => {
        const r = await patch(writer, t.id, due(jst(8), "秘密の理由"));
        status = r.status;
        errCode = await code(r);
      });
      expect(status).toBe(503);
      expect(errCode).toBe("E-PAGE-003");
      expect(logs).not.toContain("秘密の理由");
      await untouched(t.id, before);
    } finally {
      await f.admin.query("drop trigger if exists k483_boom_audit on audit_events");
      await f.admin.query("drop function if exists public.k483_boom_audit()");
    }
    expect((await patch(writer, t.id, due(jst(8)))).status).toBe(200);
    expect(await audits(t.id)).toHaveLength(1);
  });
});
