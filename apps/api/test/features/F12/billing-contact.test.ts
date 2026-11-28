// K-959 請求先を変える（updateBillingContact・PATCH /api/v1/workspace/billing-contact）。
//   テストの名前の頭の行 ID（K959-…）は 11_tickets/K-959.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1005：入力 company・attn・email（全部必須）・答え { company, attn, email }。請求先は会社に 1 つ（tenants.billing_contact・K-958）。
//   変えたら管理者全員に画面のお知らせ（notifications の inapp・billing.contact_changed）と記録（audit_events）。新しいメールへの確かめは送らない（D-156.30）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startBilling, type Billing, type World } from "./billing.harness.js";

let t: Billing;
let w: World;
let far: World;

beforeAll(async () => {
  t = await startBilling("k959", ["billing-contact", "billing-read"]);
  w = await t.world("ENGINE BASE", { plan: "team" });
  far = await t.world("遠くの会社", { plan: "team" });
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const OK = { company: "株式会社ENGINE BASE", attn: "経理 佐々木", email: "keiri@example.com" };
const patch = async (body: unknown, who = w.admin) => {
  const r = await t.call(who, "PATCH", "/workspace/billing-contact", body);
  return { r, b: await t.json(r) };
};
const stored = async (tenantId = w.tenantId) =>
  (await t.row<{ c: Row | null }>("select billing_contact as c from tenants where id = $1", [tenantId]))!.c;
const notes = (tenantId: string) =>
  t.n("select count(*) as n from notifications where tenant_id = $1 and event_kind_id = 'billing.contact_changed'", [
    tenantId,
  ]);
const audits = (tenantId: string) =>
  t.n("select count(*) as n from audit_events where tenant_id = $1 and action = 'billing.contact_update'", [tenantId]);
/** もう 1 人の管理者を足す（D-156.30 の「管理者全員」を数える） */
const addAdmin = async (me: World): Promise<string> => {
  const id = (await t.row<{ id: string }>(
    "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '2 人目の管理者') returning id",
    [me.tenantId, me.rootScope],
  ))!.id;
  await t.f.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, role, status) values ($1, $2, 'admin', 'active')",
    [me.tenantId, id],
  );
  return id;
};

describe("K-959 請求先を変える", () => {
  it("K959-API-001 200 で鍵ちょうど company・attn・email。会社の請求先が変わり、請求書の口で読み直しても同じ", async () => {
    const me = await t.world("変える", { plan: "team" });
    const { r, b } = await patch(OK, me.admin);
    expect(r.status).toBe(200);
    expect(b.data).toEqual(OK);
    expect(await stored(me.tenantId)).toEqual(OK);
    const again = await t.json(await t.call(me.admin, "GET", "/workspace/billing"));
    expect((again.data as Row)["contact"]).toEqual(OK);
  });

  it("K959-API-002 表記ゆらぎ：会社名と宛名は NFKC と前後の空白を落とし、メールは小文字にして残す", async () => {
    const me = await t.world("ゆらぎ", { plan: "team" });
    const { r, b } = await patch(
      { company: "  株式会社ＥＮＧＩＮＥ ＢＡＳＥ ", attn: "経理　佐々木 ", email: "Keiri@Example.COM" },
      me.admin,
    );
    expect(r.status).toBe(200);
    expect(b.data).toEqual({ company: "株式会社ENGINE BASE", attn: "経理 佐々木", email: "keiri@example.com" });
    expect(await stored(me.tenantId)).toEqual(b.data);
  });

  it("K959-API-003 形の誤り（欄が無い・メールの形でない・101 字・空白だけ・NUL・知らない欄）は 422 で、何も変えない", async () => {
    const me = await t.world("形の誤り", { plan: "team" });
    await patch(OK, me.admin);
    for (const bad of [
      { company: OK.company, attn: OK.attn },
      { ...OK, email: "keiri@example" },
      { ...OK, company: "あ".repeat(101) },
      { ...OK, company: "   " },
      { ...OK, attn: "経理\u0000" },
      { ...OK, tenant_id: me.tenantId },
    ]) {
      const { r } = await patch(bad, me.admin);
      expect(r.status, JSON.stringify(bad)).toBe(422);
    }
    expect(await stored(me.tenantId)).toEqual(OK);
    expect(await audits(me.tenantId)).toBe(1);
  });

  it("K959-API-004 管理者全員（変えた本人を含む）に画面のお知らせが 1 つずつ。管理者でないプランと支払いの人には出ない・中身の字を入れない", async () => {
    const me = await t.world("お知らせ", { plan: "team" });
    const second = await addAdmin(me);
    const { r } = await patch(OK, me.payer);
    expect(r.status).toBe(200);
    const rows = (
      await t.f.admin.query<{ m: string; ch: string; p: Row }>(
        "select member_id as m, channel_id as ch, payload as p from notifications where tenant_id = $1 and event_kind_id = 'billing.contact_changed'",
        [me.tenantId],
      )
    ).rows;
    expect(rows.map((x) => x.m).sort()).toEqual([me.admin.id, second].sort());
    for (const x of rows) {
      expect(x.ch).toBe("inapp");
      expect(JSON.stringify(x.p)).not.toContain("keiri@example.com");
      expect(JSON.stringify(x.p)).not.toContain("佐々木");
    }
  });

  it("K959-API-005 記録：billing.contact_update が変えた回数だけ（2 回で 2 行）・関門 C2・payload は変えた欄の名前だけで値の字が無い", async () => {
    const me = await t.world("記録", { plan: "team" });
    await patch(OK, me.admin);
    await patch({ ...OK, email: "new@example.com" }, me.admin);
    const r = (
      await t.f.admin.query<{ c: string; p: Row }>(
        "select choke_point_id as c, payload as p from audit_events where tenant_id = $1 and action = 'billing.contact_update' order by occurred_at",
        [me.tenantId],
      )
    ).rows;
    expect(r.length).toBe(2);
    expect(r.every((x) => x.c === "C2")).toBe(true);
    expect(r[1]!.p).toEqual({ fields: ["email"] });
    expect(JSON.stringify(r)).not.toContain("example.com");
  });

  it("K959-API-006 同じ値でもう一度送ると 200 で、お知らせも記録も増えない", async () => {
    const me = await t.world("同じ値", { plan: "team" });
    await patch(OK, me.admin);
    const [n0, a0] = [await notes(me.tenantId), await audits(me.tenantId)];
    const { r, b } = await patch({ ...OK, email: "KEIRI@example.com" }, me.admin);
    expect(r.status).toBe(200);
    expect(b.data).toEqual(OK);
    expect(await notes(me.tenantId)).toBe(n0);
    expect(await audits(me.tenantId)).toBe(a0);
  });

  it("K959-API-007 新しいメールへの確かめのメールは送らない（送出の回が 0）", async () => {
    const me = await t.world("メールなし", { plan: "team" });
    const before = t.mails.length;
    await patch({ ...OK, email: "other@example.com" }, me.admin);
    expect(t.mails.length).toBe(before);
  });

  it("K959-API-008 能力の無い人・先方の権限の人は 403・ログインなしは 401 で、何も変えない", async () => {
    const me = await t.world("見られない", { plan: "team" });
    expect((await patch(OK, me.staff)).r.status).toBe(403);
    expect((await patch(OK, me.guest)).r.status).toBe(403);
    expect((await t.call(null, "PATCH", "/workspace/billing-contact", OK)).status).toBe(401);
    expect(await stored(me.tenantId)).toBeNull();
    expect(await notes(me.tenantId)).toBe(0);
  });

  it("K959-API-009 DB が落ちると 503 E-PAGE-003 で、請求先もお知らせも記録も変わらない", async () => {
    const me = await t.world("落ちる", { plan: "team" });
    const restore = await t.breakWrites("tenants", { id: me.tenantId });
    try {
      const { r, b } = await patch(OK, me.admin);
      expect(r.status).toBe(503);
      expect(b["code"]).toBe("E-PAGE-003");
    } finally {
      await restore();
    }
    expect(await stored(me.tenantId)).toBeNull();
    expect(await notes(me.tenantId)).toBe(0);
    expect(await audits(me.tenantId)).toBe(0);
  });

  it("K959-API-010 上限を超えると 429・retry_after_sec は 1〜60 の整数", async () => {
    t.limits["updateBillingContact"] = 1;
    try {
      const ip = "203.0.113.246";
      expect((await t.call(w.admin, "PATCH", "/workspace/billing-contact", OK, { ip })).status).toBe(200);
      const r = await t.call(w.admin, "PATCH", "/workspace/billing-contact", OK, { ip });
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.limits["updateBillingContact"];
    }
  });

  it("K959-API-011 同時に 2 つ変えると、どちらも 200 で、残るのはどちらか 1 つの値・記録は 2 行", async () => {
    const me = await t.world("同時", { plan: "team" });
    const a = { ...OK, email: "a@example.com" };
    const b = { ...OK, email: "b@example.com" };
    const [ra, rb] = await Promise.all([patch(a, me.admin), patch(b, me.payer)]);
    expect([ra.r.status, rb.r.status]).toEqual([200, 200]);
    expect([a, b]).toContainEqual(await stored(me.tenantId));
    expect(await audits(me.tenantId)).toBe(2);
  });

  it("K959-API-012 別の会社の請求先・お知らせは変わらない", async () => {
    const before = await stored(far.tenantId);
    await patch({ ...OK, company: "混ざらない株式会社" }, w.admin);
    expect(await stored(far.tenantId)).toEqual(before);
    expect(await notes(far.tenantId)).toBe(0);
  });

  it("K959-API-013 鈴の種類の表（段 8 の K-461 の kinds.ts）に billing.contact_changed が在り、札は setting・チケットに結ばない・行き先は請求書の画面（D-156.41）", async () => {
    const { KINDS } = await import("../../../src/features/F7/notifications/kinds.js");
    expect(KINDS["billing.contact_changed"]).toEqual({ tag: "setting", ticket: false, href: "/billing" });
  });
});
