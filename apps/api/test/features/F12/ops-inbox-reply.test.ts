// K-975 運営が問い合わせに返す（replyOpsInquiry・POST /api/v1/ops/inquiries/:id/replies）と社内メモ（addOpsInquiryNote・POST …/notes）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えは OpsInquiryMessage の 6 欄（K-948）。返事は顧客の 困ったとき・お知らせ と鈴に届く（D-156.28・問い合わせた本人だけ・関門 C6 の inapp）。
//   社内メモは運営の中だけ（visibility ops_only・顧客の口にも鈴にも出ない・D-156.25）。顧客の側の読み方は K-951 の口（hooks inquiry-read）で確かめる
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startOpsInbox, OPS_MESSAGE, type OpsInbox } from "./ops-inbox.harness.js";
import { isFlat, type Json, type World } from "./inquiry.harness.js";
import type { Person } from "../fixture.js";

let t: OpsInbox;
let me: Person;
let other: Person;
let noInquiry: Person;
let w: World;

beforeAll(async () => {
  t = await startOpsInbox("k975", ["ops-inbox-reply", "inquiry-read"]);
  me = await t.ops("高本");
  other = await t.ops("佐野");
  noInquiry = await t.ops("お金だけ", ["money"]);
  w = await t.world("ミナト企画");
});
afterAll(async () => {
  await t.close();
});

const reply = async (id: string, body: unknown, who: Person = me) => {
  const r = await t.call(who, "POST", `/ops/inquiries/${id}/replies`, body);
  return { r, b: await t.json(r) };
};
const note = async (id: string, body: unknown, who: Person = me) => {
  const r = await t.call(who, "POST", `/ops/inquiries/${id}/notes`, body);
  return { r, b: await t.json(r) };
};
const inq = (id: string) =>
  t.row<{ s: string; a: string | null; l: string | null; at: string }>(
    "select state as s, assignee_ops_member_id as a, later_until::text as l, last_message_at::text as at from inquiries where id = $1",
    [id],
  );
const msgs = (id: string) =>
  t.n(
    "select count(*) as n from messages m join inquiries i on i.conversation_id = m.conversation_id where i.id = $1",
    [id],
  );
const bells = (who: Person) =>
  t.n(
    "select count(*) as n from notifications where member_id = $1 and event_kind_id = 'inquiry.replied' and channel_id = 'inapp'",
    [who.id],
  );
const mine = async (id: string) => (await t.json(await t.call(w.asker, "GET", `/inquiries/${id}`))).data as Json;

describe("K-975 返す", () => {
  it("K975-API-001 返す：201・鍵はちょうど 6・kind reply・名前は返した運営の人。問い合わせは返事待ち（waiting）・後では空・最後のやり取りが進む・担当なしなら自分が担当になる", async () => {
    const id = await t.asked(w, "返す");
    const before = (await inq(id))!.at;
    const { r, b } = await reply(id, { body: "確かめます。少しお待ちください" });
    expect(r.status, JSON.stringify(b)).toBe(201);
    const d = b.data as Json;
    expect(Object.keys(d).sort()).toEqual(OPS_MESSAGE);
    expect([d["kind"], d["author_name"], d["body"], d["attachments"]]).toEqual([
      "reply",
      "運営 高本",
      "確かめます。少しお待ちください",
      [],
    ]);
    const q = (await inq(id))!;
    expect([q.s, q.a, q.l]).toEqual(["waiting", me.id, null]);
    expect(new Date(q.at).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it("K975-API-002 顧客の側：問い合わせた本人の 1 件に from ops・運営 高本 の返事が出て、状態は 返事あり（replied）・返事の印が立つ", async () => {
    const id = await t.asked(w, "顧客の側");
    expect((await reply(id, { body: "直しました" })).r.status).toBe(201);
    const d = await mine(id);
    expect(d["state"]).toBe("replied");
    expect(d["has_unread_reply"]).toBe(true);
    const last = (d["messages"] as Json[]).at(-1)!;
    expect([last["from"], last["author_name"], last["body"]]).toEqual(["ops", "運営 高本", "直しました"]);
  });

  it("K975-API-003 鈴（D-156.28）：問い合わせた本人にだけ inapp の inquiry.replied が 1 行（payload は inquiry_id だけ・本文の字が無い）。同じ会社のほかの人・メールには出ない", async () => {
    const id = await t.asked(w, "鈴");
    const [a0, m0] = [await bells(w.asker), await bells(w.admin)];
    expect((await reply(id, { body: "返事の本文" })).r.status).toBe(201);
    expect([await bells(w.asker), await bells(w.admin)]).toEqual([a0 + 1, m0]);
    const p = (await t.row<{ p: Json }>(
      "select payload as p from notifications where member_id = $1 and event_kind_id = 'inquiry.replied' order by created_at desc limit 1",
      [w.asker.id],
    ))!.p;
    expect(p["inquiry_id"]).toBe(id);
    expect(JSON.stringify(p)).not.toContain("返事の本文");
    expect(
      await t.n(
        "select count(*) as n from notifications where tenant_id = $1 and channel_id = 'email' and event_kind_id = 'inquiry.replied'",
        [w.tenantId],
      ),
    ).toBe(0);
  });

  it("K975-API-004 記録：運営の記録と会社の記録に inquiry.reply が 1 行ずつ（target_label は題・本文の字が無い）", async () => {
    const id = await t.asked(w, "記録");
    expect((await reply(id, { body: "記録に出ない本文" })).r.status).toBe(201);
    expect(
      await t.n("select count(*) as n from ops_audit_events where action = 'inquiry.reply' and target_id = $1", [id]),
    ).toBe(1);
    const e = (await t.row<{ p: Json }>(
      "select payload as p from ops_audit_events where action = 'inquiry.reply' and target_id = $1",
      [id],
    ))!;
    expect(e.p["target_label"]).toBe("記録");
    expect(JSON.stringify(e.p)).not.toContain("記録に出ない本文");
  });

  it("K975-API-005 済みの問い合わせに返す：201・返事待ち（顧客には 返事あり）に戻る", async () => {
    const id = await t.asked(w, "済みに返す");
    await t.assign(id, me);
    await t.setState(id, "done");
    expect((await reply(id, { body: "追って確かめました" })).r.status).toBe(201);
    expect((await inq(id))!.s).toBe("waiting");
    expect((await mine(id))["state"]).toBe("replied");
  });

  it("K975-API-006 ほかの人が担当：返すと 409・E-OPS-005（欄なし）で書き込みも鈴も増えない", async () => {
    const id = await t.asked(w, "ほかの人の担当");
    await t.assign(id, other);
    const [n0, b0] = [await msgs(id), await bells(w.asker)];
    const x = await reply(id, { body: "横から" });
    expect([x.r.status, x.b["code"]]).toEqual([409, "E-OPS-005"]);
    expect(isFlat(x.b)).toBe(true);
    expect([await msgs(id), await bells(w.asker)]).toEqual([n0, b0]);
  });
});

describe("K-975 社内メモ", () => {
  it("K975-API-007 社内メモ：201・kind note。書き込みは ops_only。状態・担当・最後のやり取りは変わらず、顧客の 1 件にも鈴にも出ない", async () => {
    const id = await t.asked(w, "メモ");
    const before = (await inq(id))!;
    const b0 = await bells(w.asker);
    const { r, b } = await note(id, { body: "PC のログを見る" });
    expect(r.status, JSON.stringify(b)).toBe(201);
    expect([(b.data as Json)["kind"], (b.data as Json)["author_name"]]).toEqual(["note", "運営 高本"]);
    expect(
      (await t.row<{ v: string }>("select visibility as v from messages where id = $1", [(b.data as Json)["id"]]))!.v,
    ).toBe("ops_only");
    expect(await inq(id)).toEqual(before);
    expect(await bells(w.asker)).toBe(b0);
    expect(JSON.stringify((await mine(id))["messages"])).not.toContain("PC のログを見る");
  });

  it("K975-API-008 社内メモはほかの人が担当でも書ける（運営の中の申し送り）：201・担当は変わらない", async () => {
    const id = await t.asked(w, "人の担当にメモ");
    await t.assign(id, other);
    expect((await note(id, { body: "前に同じ件があった" })).r.status).toBe(201);
    expect((await inq(id))!.a).toBe(other.id);
  });
});

describe("K-975 断る・失敗", () => {
  it("K975-API-009 添付：運営の添付を上げる道は無いので attachment_ids は契約に無い欄。uuid を入れても空の [] でも 422 で書かない（D-156.40）", async () => {
    const id = await t.asked(w, "添付");
    const n0 = await msgs(id);
    for (const ids of [[randomUUID()], []]) {
      const x = await reply(id, { body: "添付つき", attachment_ids: ids });
      expect(x.r.status, JSON.stringify(ids)).toBe(422);
    }
    expect(await msgs(id)).toBe(n0);
  });

  it("K975-API-010 無い・消した問い合わせは、返す・メモとも 404（欄なし）", async () => {
    const gone = await t.asked(w, "消した");
    await t.f.admin.query("update inquiries set deleted_at = now() where id = $1", [gone]);
    for (const id of [gone, randomUUID()]) {
      for (const x of [await reply(id, { body: "x" }), await note(id, { body: "x" })]) {
        expect(x.r.status, id).toBe(404);
        expect(isFlat(x.b)).toBe(true);
      }
    }
  });

  it("K975-API-011 入口：ログインなし 401・会社の人 403・問い合わせ（inquiry）を持たない運営の人 403（返す・メモとも）。書かない", async () => {
    const id = await t.asked(w, "入口");
    const n0 = await msgs(id);
    expect((await t.call(null, "POST", `/ops/inquiries/${id}/replies`, { body: "x" })).status).toBe(401);
    expect((await reply(id, { body: "x" }, w.admin)).r.status).toBe(403);
    expect((await reply(id, { body: "x" }, noInquiry)).r.status).toBe(403);
    expect((await note(id, { body: "x" }, noInquiry)).r.status).toBe(403);
    expect(await msgs(id)).toBe(n0);
  });

  it("K975-API-012 形の誤り：本文が無い・空・空白だけ・4001 字・NUL 入り、知らない欄（kind・visibility）、:id が uuid でないは 422 で書かない", async () => {
    const id = await t.asked(w, "形");
    const n0 = await msgs(id);
    const bad: unknown[] = [
      {},
      { body: "" },
      { body: "   " },
      { body: "あ".repeat(4001) },
      { body: "a\u0000b" },
      { body: "x", kind: "note" },
      { body: "x", visibility: "all" },
    ];
    for (const body of bad) {
      expect((await reply(id, body)).r.status, JSON.stringify(body)).toBe(422);
      expect((await note(id, body)).r.status, JSON.stringify(body)).toBe(422);
    }
    expect((await reply("abc", { body: "x" })).r.status).toBe(422);
    expect(await msgs(id)).toBe(n0);
  });

  it("K975-API-013 鈴に書けない（G-15）：503・E-PAGE-003 で「返した」と言わない。返事の書き込み・状態・記録のどれも残らない（同じ取引で戻る）", async () => {
    const id = await t.asked(w, "落ちる");
    const [n0, s0] = [await msgs(id), (await inq(id))!.s];
    const restore = await t.breakWrites("notifications", { tenant_id: w.tenantId });
    try {
      const x = await reply(id, { body: "届かない返事" });
      expect([x.r.status, x.b["code"]]).toEqual([503, "E-PAGE-003"]);
    } finally {
      await restore();
    }
    expect([await msgs(id), (await inq(id))!.s]).toEqual([n0, s0]);
    expect(
      await t.n("select count(*) as n from ops_audit_events where action = 'inquiry.reply' and target_id = $1", [id]),
    ).toBe(0);
  });

  it("K975-API-014 上限：replyOpsInquiry を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数。429 では書かない", async () => {
    const id = await t.asked(w, "上限");
    t.f.limits["replyOpsInquiry"] = 1;
    try {
      expect((await reply(id, { body: "1 回目" })).r.status).toBe(201);
      const n0 = await msgs(id);
      const x = await reply(id, { body: "2 回目" });
      expect(x.r.status).toBe(429);
      const s = x.b["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
      expect(await msgs(id)).toBe(n0);
    } finally {
      delete t.f.limits["replyOpsInquiry"];
    }
  });

  it("K975-DB-001 2 層目：会社の人の文脈で app.ops_inquiry_reply・app.ops_inquiry_note を直に呼ぶと 42501。どちらも security definer で PUBLIC は呼べない", async () => {
    const id = await t.asked(w, "2 層目");
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.asker.id],
      );
      await expect(c.query("select app.ops_inquiry_note($1, 'x')", [id])).rejects.toMatchObject({ code: "42501" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    const fns = await t.f.admin.query<{ name: string; definer: boolean; pub: boolean }>(
      `select p.proname as name, p.prosecdef as definer, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('ops_inquiry_note', 'ops_inquiry_reply') order by 1`,
    );
    expect(fns.rows.map((x) => [x.name, x.definer, x.pub])).toEqual([
      ["ops_inquiry_note", true, false],
      ["ops_inquiry_reply", true, false],
    ]);
  });
});
