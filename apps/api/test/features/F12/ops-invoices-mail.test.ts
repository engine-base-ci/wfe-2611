// K-1109 請求書を出したときの、PDF を付けたメール（issueOpsInvoices が出し終えた後に、会社ごとに管理者全員へ・関門 C6）。
//   テストの名前の頭の行 ID（K1109-…）は 11_tickets/K-1109.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   メールは土台 billing-ops.harness.ts の送出の 1 か所（deps.mailer）が貯めた物（t.mails）を見る。宛先を落とすのは t.failMailTo。
//   月は 2014 年の昔の月を試験ごとに分けて使い、会社は名前の頭（run）で見る。宛先のメールは認証の人（kaname_auth."user"）の物
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { startBillingOps, STEP, type BillingOps, type Who, type World } from "./billing-ops.harness.js";

let t: BillingOps;
let money: Who;

beforeAll(async () => {
  t = await startBillingOps("k1109", ["ops-invoices-issue"]);
  money = await t.opsWho("佐野", ["money"]);
});
beforeEach(() => {
  t.mails.length = 0;
  t.failMailTo.clear();
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const issue = async (body: unknown) => {
  const r = await t.call(money, "POST", "/ops/invoices/issue", body, { stepUpAgoSec: STEP });
  return { r, j: await t.json(r) };
};
/** その人に認証の人とメールを付ける（無ければ足す）。返すのはメール */
const emailOf = async (who: Who): Promise<string> => {
  const have = await t.row<{ e: string | null }>(
    'select u.email as e from members m left join kaname_auth."user" u on u.id = m.auth_user_id where m.id = $1',
    [who.id],
  );
  if (have?.e) return have.e;
  const id = randomUUID();
  const email = `${t.run}-${id.slice(0, 8)}@example.test`;
  await t.f.admin.query(
    `insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, true, now(), now())`,
    [id, `k1109 ${id.slice(0, 4)}`, email],
  );
  await t.f.admin.query("update members set auth_user_id = $2 where id = $1", [who.id, id]);
  await t.f.admin.query("update tenant_memberships set auth_user_id = $2 where member_id = $1", [who.id, id]);
  return email;
};
/** 2 人目の管理者（メールつき） */
const admin2 = async (w: World, label: string): Promise<{ who: Who; email: string }> => {
  const id = randomUUID();
  const email = `${t.run}-${label}-${id.slice(0, 6)}@example.test`;
  await t.f.admin.query(
    `insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, true, now(), now())`,
    [id, label, email],
  );
  const p = await t.f.person(w.tenantId, w.rootScope, { name: label, authUserId: id });
  await t.f.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status, joined_at) values ($1, $2, $3, 'admin', 'active', now())",
    [w.tenantId, p.id, id],
  );
  return { who: { id: p.id, tenantId: w.tenantId, role: "member" }, email };
};
const paying = async (label: string): Promise<World> => {
  const w = await t.world(label);
  await t.contract(w, "team", "2013-01-01");
  return w;
};
const to = (email: string) => t.mails.filter((m) => m.to === email);
/** 宛先の関数を、この試験の会社が入った呼び出しだけ落とす（元の関数を脇に置き、包みで例外にする）。
 *  差し替えも戻しも 1 回の query（複数の文を 1 回で送る＝1 つの取引）にまとめ、片方だけ通ることを無くす。返す関数で元に戻す */
const breakTargets = async (tenants: readonly string[]): Promise<() => Promise<void>> => {
  const keep = `ops_invoice_mail_targets_${t.run.replace(/[^a-z0-9]/gi, "")}`;
  const list = `{${tenants.join(",")}}`;
  await t.f.admin.query(
    `alter function app.ops_invoice_mail_targets(uuid[]) rename to ${keep};
     create function app.ops_invoice_mail_targets(p_tenants uuid[]) returns jsonb
     language plpgsql stable set search_path = public, app, pg_temp as $$
     begin
       if p_tenants && '${list}'::uuid[] then
         raise exception 'k1109 宛先を落とす' using errcode = '08006';
       end if;
       return app.${keep}(p_tenants);
     end $$;
     revoke all on function app.ops_invoice_mail_targets(uuid[]) from public;
     grant execute on function app.ops_invoice_mail_targets(uuid[]) to kaname_app;`,
  );
  return async () => {
    await t.f.admin.query(
      `drop function app.ops_invoice_mail_targets(uuid[]);
       alter function app.${keep}(uuid[]) rename to ops_invoice_mail_targets;`,
    );
  };
};

describe("K-1109 出すと送る", () => {
  it("K1109-API-001 出すと送る：201・管理者 2 人に 1 通ずつ・件名・添付 1 つ（請求書_2014-05.pdf・application/pdf）・中身は置き場に置いた PDF と同じ bytes", async () => {
    const w = await paying("送る会社");
    const a1 = await emailOf(w.admin);
    const a2 = (await admin2(w, "二人目の管理者")).email;
    const { r, j } = await issue({ month: "2014-05" });
    expect(r.status, JSON.stringify(j)).toBe(201);
    for (const e of [a1, a2]) {
      const got = to(e);
      expect(got).toHaveLength(1);
      expect(got[0]!.subject).toBe("【Kaname】2014 年 5 月分の請求書");
      expect(got[0]!.attachments.map((x) => [x.filename, x.contentType])).toEqual([
        ["請求書_2014-05.pdf", "application/pdf"],
      ]);
      const keys = [...t.store.objects.keys()].filter((k) => k.includes(w.tenantId));
      expect(keys, "この会社の名前空間に置いた PDF は 1 つ").toHaveLength(1);
      const placed = t.store.objects.get(keys[0]!)!;
      expect(Buffer.from(got[0]!.attachments[0]!.content).equals(Buffer.from(placed))).toBe(true);
    }
  });

  it("K1109-API-002 本文：宛名の会社名 御中・2014 年 6 月分・ご請求額 ¥16,500（税込）・期限 2014/07/31・設定 › 請求書 が在り、ほかの会社の名前が無い", async () => {
    const w = await paying("本文の会社");
    const other = await paying("ほかの会社");
    const e = await emailOf(w.admin);
    await emailOf(other.admin);
    expect((await issue({ month: "2014-06" })).r.status).toBe(201);
    const text = to(e)[0]!.text;
    expect(text).toContain(`${w.name} 御中`);
    expect(text).toContain("2014 年 6 月分");
    expect(text).toContain("ご請求額：¥16,500（税込）");
    expect(text).toContain("お支払い期限：2014/07/31");
    expect(text).toContain("設定 › 請求書");
    expect(text).not.toContain(other.name);
  });

  it("K1109-API-003 宛先：管理者だけ。プランと支払いの人・ふつうの人・抜けた管理者には送らない・会社ごとに自分の会社の PDF だけ", async () => {
    const w = await paying("宛先の会社");
    const v = await paying("宛先の会社 2");
    const admin = await emailOf(w.admin);
    const payer = await emailOf(w.payer);
    const staff = await emailOf(w.staff);
    const left = await admin2(w, "抜けた管理者");
    await t.f.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [left.who.id]);
    const vAdmin = await emailOf(v.admin);
    expect((await issue({ month: "2014-07" })).r.status).toBe(201);
    expect(to(admin)).toHaveLength(1);
    expect([to(payer).length, to(staff).length, to(left.email).length]).toEqual([0, 0, 0]);
    const wPdf = to(admin)[0]!.attachments[0]!.content;
    const vPdf = to(vAdmin)[0]!.attachments[0]!.content;
    expect(Buffer.from(wPdf).equals(Buffer.from(vPdf))).toBe(false);
  });

  it("K1109-API-004 下書き：dry_run の 201（契約の outputs_2xx・K-981 と同じ）ではメールが 0 通・meta が無い", async () => {
    const w = await paying("下書きの会社");
    await emailOf(w.admin);
    const { r, j } = await issue({ month: "2014-08", dry_run: true });
    expect(r.status).toBe(201);
    expect(j["meta"]).toBeUndefined();
    expect(t.mails).toHaveLength(0);
  });
});

describe("K-1109 送れない・数える", () => {
  it("K1109-API-005 1 通が送れない：もう 1 人には届き、201・meta.mail { sent 1, failed 1 }・請求書は出たまま・ログは 1 行で宛先と会社の名前が無い", async () => {
    const w = await paying("1 通落ちる会社");
    const a1 = await emailOf(w.admin);
    const a2 = (await admin2(w, "落ちる管理者")).email;
    t.failMailTo.add(a2);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { r, j } = await issue({ month: "2014-09" });
      expect(r.status).toBe(201);
      expect((j["meta"] as Row)["mail"]).toEqual({ sent: 1, failed: 1 });
      expect(to(a1)).toHaveLength(1);
      expect(await t.invoiceOf(w, "2014-09")).toBeDefined();
      const logs = [...warn.mock.calls, ...err.mock.calls].flat().map(String);
      expect(logs.filter((l) => l.includes("[ops] 請求書のメールを送れなかった（1 通）"))).toHaveLength(1);
      const all = logs.join("\n");
      expect(all).not.toContain(a2);
      expect(all).not.toContain(w.name);
    } finally {
      warn.mockRestore();
      err.mockRestore();
    }
  });

  it("K1109-API-006 数える：2 社（管理者 2 人と 1 人）を出すと meta.mail は { sent 3, failed 0 }・data の鍵は前と同じ", async () => {
    const w = await paying("2 人の会社");
    const v = await paying("1 人の会社");
    await emailOf(w.admin);
    await admin2(w, "2 人目");
    await emailOf(v.admin);
    const { r, j } = await issue({ month: "2014-10" });
    expect(r.status).toBe(201);
    const mine = t.mails.filter((m) => m.text.includes(w.name) || m.text.includes(v.name));
    expect(mine).toHaveLength(3);
    expect((j["meta"] as Row)["mail"]).toEqual({ sent: t.mails.length, failed: 0 });
    expect(Object.keys(j.data as Row).sort()).toEqual(["count", "lines", "month", "total"]);
  });

  it("K1109-API-007 DB が落ちる：記録の表への書き込みを落として 503 E-PAGE-003 なら、メールは 0 通", async () => {
    const w = await paying("落ちる会社");
    await emailOf(w.admin);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const restore = await t.breakWrites("ops_audit_events", { target_tenant_id: w.tenantId });
    try {
      const { r, j } = await issue({ month: "2014-11" });
      expect([r.status, j["code"]]).toEqual([503, "E-PAGE-003"]);
      expect(t.mails).toHaveLength(0);
    } finally {
      await restore();
      warn.mockRestore();
      err.mockRestore();
    }
  });

  it("K1109-API-009 宛先を引けない：出した後に宛先の関数が落ちると、201・メール 0 通・meta.mail { sent 0, failed 出した会社の数 }・請求書は出たまま・ログに宛先と会社の名前が無い", async () => {
    const w = await paying("宛先が引けない会社");
    const v = await paying("宛先が引けない会社 2");
    const aw = await emailOf(w.admin);
    const av = await emailOf(v.admin);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let restore: (() => Promise<void>) | undefined;
    try {
      restore = await breakTargets([w.tenantId, v.tenantId]);
      const { r, j } = await issue({ month: "2015-01" });
      expect(r.status).toBe(201);
      expect(t.mails).toHaveLength(0);
      const n = (j.data as Row)["count"] as number;
      expect(n).toBeGreaterThanOrEqual(2);
      expect((j["meta"] as Row)["mail"]).toEqual({ sent: 0, failed: n });
      expect(await t.invoiceOf(w, "2015-01")).toBeDefined();
      expect(await t.invoiceOf(v, "2015-01")).toBeDefined();
      const all = [...warn.mock.calls, ...err.mock.calls].flat().map(String).join("\n");
      for (const x of [aw, av, w.name, v.name]) expect(all).not.toContain(x);
    } finally {
      await restore?.();
      warn.mockRestore();
      err.mockRestore();
    }
  });

  it("K1109-API-008 もう一度押す：出した後にもう一度押すと 409 E-BILL-003 で、メールは増えない", async () => {
    const w = await paying("2 回押す会社");
    await emailOf(w.admin);
    expect((await issue({ month: "2014-12" })).r.status).toBe(201);
    const n = t.mails.length;
    expect(n).toBeGreaterThan(0);
    const again = await issue({ month: "2014-12" });
    expect([again.r.status, again.j["code"]]).toEqual([409, "E-BILL-003"]);
    expect(t.mails).toHaveLength(n);
  });
});

describe("K-1109 DB", () => {
  it("K1109-DB-001 2 層目：会社の人の文脈で app.ops_invoice_mail_targets を直に呼ぶと 42501・PUBLIC は呼べない", async () => {
    const w = await t.world("2 層目");
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.admin.id],
      );
      await expect(
        c.query("select app.ops_invoice_mail_targets(array[$1]::uuid[])", [w.tenantId]),
      ).rejects.toMatchObject({
        code: "42501",
      });
    } finally {
      await c.query("rollback");
      c.release();
    }
    const pub = await t.row<{ ok: boolean }>(
      "select has_function_privilege('public', 'app.ops_invoice_mail_targets(uuid[])', 'execute') as ok",
    );
    expect(pub!.ok).toBe(false);
  });
});
