// K-1012 止めた会社の入口：止めた会社の人は、止められた画面で使う口（稼働状況・外枠・お知らせ・問い合わせ）だけ通し、ほかの口は 403 E-OPS-007。
//   PC には新しい仕事を渡さず、動いている仕事は次の区切り（止める合図の口）で止める（D-156.23・D-125.126）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   止めているかの決めは K-970 の app.tenant_stopped（止めた時刻か、止める日が今日以前）。印は DB に直に置く（K-970 の口を通さない）。
//   通す口の正本は apps/api/src/contract/stop-open.ts の STOP_OPEN_OPS。hooks は読まない（止めが先に効けば 403、通れば 501 か 2xx）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STOP_OPEN_OPS } from "../../../src/contract/stop-open.js";
import { ENDPOINTS } from "@kaname/contracts/registry";
import { startOpsAct, type OpsAct } from "./ops-act.harness.js";
import { isFlat, type Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

let t: OpsAct;
let opsAll: Person;
let w: Ws;
let staff: Person;
let other: Ws;

beforeAll(async () => {
  t = await startOpsAct("k1012", []);
  opsAll = await t.ops("高本");
  w = await t.ws("止める会社");
  staff = await t.member(w, "田中");
  other = await t.ws("別の会社");
});
afterAll(async () => {
  await t.close();
});

const jstDay = (offsetDays = 0): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(Date.now() + offsetDays * 86_400_000));
const setMarks = (tenant: string, o: { stoppedNow?: boolean; stopOn?: string | null }) =>
  t.f.admin.query(
    "update tenants set stopped_at = case when $2 then now() end, stop_on = $3::date, stop_reason_key = case when $2 or $3::date is not null then 'unpaid' end where id = $1",
    [tenant, o.stoppedNow ?? false, o.stopOn ?? null],
  );
const clear = (tenant: string) => setMarks(tenant, {});
/** 止める口の代表（会社の人の読む口と書く口・hooks が無ければ 501） */
const BLOCKED: [string, string, unknown?][] = [
  ["GET", "/tickets"],
  ["POST", "/tickets", { title: "止めた後に作る" }],
  ["GET", "/approvals/queue"],
];
/** 通す口の道（STOP_OPEN_OPS の操作 ID と同じ並び・道の :id は形の正しい uuid） */
const OPEN: [string, string, string, unknown?][] = [
  ["getServiceStatusForMember", "GET", "/service-status"],
  ["getShell", "GET", "/shell"],
  ["listNotices", "GET", "/notices"],
  ["markNoticeRead", "POST", "/notices/00000000-0000-4000-8000-0000000000aa/read", {}],
  ["listMyInquiries", "GET", "/inquiries"],
  ["createInquiry", "POST", "/inquiries", { topic: "billing", title: "止められた", body: "再開したい" }],
  ["getMyInquiry", "GET", "/inquiries/00000000-0000-4000-8000-0000000000ab"],
  [
    "postInquiryMessage",
    "POST",
    "/inquiries/00000000-0000-4000-8000-0000000000ab/messages",
    { body: "どうなりますか" },
  ],
  ["resolveMyInquiry", "POST", "/inquiries/00000000-0000-4000-8000-0000000000ab/resolve", {}],
  ["uploadInquiryAttachment", "POST", "/inquiries/attachments", { name: "a.png", content_type: "image/png", size: 10 }],
];
const hit = async (who: Person, method: string, path: string, body?: unknown, tenant?: string) => {
  const r = await t.act(who, method, path, body, tenant ? { tenant } : {});
  return { r, b: await t.json(r) };
};
const isStopped = (x: { r: Response; b: Record<string, unknown> }) => x.r.status === 403 && x.b["code"] === "E-OPS-007";

describe("K-1012 止めた会社の入口", () => {
  it("K1012-API-001 止めた後：その会社の管理者もメンバーも、止める口（チケットの一覧・作る・承認待ち）は 403・E-OPS-007（体は error と code だけ・欄なし）。書く口は何も書かない", async () => {
    await setMarks(w.tenantId, { stoppedNow: true });
    const n0 = await t.n("select count(*) as n from tickets where tenant_id = $1", [w.tenantId]);
    for (const who of [w.admin, staff])
      for (const [m, p, b] of BLOCKED) {
        const x = await hit(who, m, p, b);
        expect(isStopped(x), `${m} ${p} ${x.r.status} ${JSON.stringify(x.b)}`).toBe(true);
        expect(isFlat(x.b)).toBe(true);
        expect(Object.keys(x.b).sort()).toEqual(["code", "error"]);
      }
    expect(await t.n("select count(*) as n from tickets where tenant_id = $1", [w.tenantId])).toBe(n0);
    await clear(w.tenantId);
  });

  it("K1012-API-002 止めた後でも通す口（稼働状況・外枠・お知らせ・問い合わせの 10 本）は止めない（403 E-OPS-007 にならない）", async () => {
    await setMarks(w.tenantId, { stoppedNow: true });
    expect(OPEN.map((o) => o[0]).sort()).toEqual([...STOP_OPEN_OPS].sort());
    for (const [op, m, p, b] of OPEN) {
      const x = await hit(staff, m, p, b);
      expect(isStopped(x), `${op} ${x.r.status} ${JSON.stringify(x.b)}`).toBe(false);
    }
    await clear(w.tenantId);
  });

  it("K1012-API-003 止める日の前（予定だけ）：止める口も通す（今までどおり使える・D-156.23）", async () => {
    await setMarks(w.tenantId, { stopOn: jstDay(3) });
    for (const [m, p, b] of BLOCKED) expect(isStopped(await hit(staff, m, p, b)), `${m} ${p}`).toBe(false);
    await clear(w.tenantId);
  });

  it("K1012-API-004 切り替わりの直後（G-12）：止める日を今日にした直後から 403 E-OPS-007。印を消した直後（再開）から通る", async () => {
    await setMarks(w.tenantId, { stopOn: jstDay(1) });
    expect(isStopped(await hit(staff, "GET", "/tickets"))).toBe(false);
    await setMarks(w.tenantId, { stopOn: jstDay(0) });
    expect(isStopped(await hit(staff, "GET", "/tickets"))).toBe(true);
    await clear(w.tenantId);
    expect(isStopped(await hit(staff, "GET", "/tickets"))).toBe(false);
  });

  it("K1012-API-005 別の会社の人には効かない：止めた会社があっても、別の会社の人の止める口は通る", async () => {
    await setMarks(w.tenantId, { stoppedNow: true });
    expect(isStopped(await hit(other.admin, "GET", "/tickets"))).toBe(false);
    await clear(w.tenantId);
  });

  it("K1012-API-006 運営が中を見る：止めた会社でも、許可を持つ運営の人が x-tenant-id で会社の人の読む口を呼ぶのは止めない（運営は止めの外）", async () => {
    await setMarks(w.tenantId, { stoppedNow: true });
    await t.grant(w.tenantId, opsAll, { minutesLeft: 20 });
    const x = await hit(opsAll, "GET", "/tickets", undefined, w.tenantId);
    expect(isStopped(x), `${x.r.status} ${JSON.stringify(x.b)}`).toBe(false);
    await clear(w.tenantId);
  });

  it("K1012-API-007 判定できない（G-15）：止めているかを読む関数が呼べないと 503・E-PAGE-003（通す側に倒さない）。戻すと通る", async () => {
    const restore = await t.breakFn("app.tenant_stopped(uuid)");
    try {
      const x = await hit(staff, "GET", "/tickets");
      expect(x.r.status).toBe(503);
      expect(x.b["code"]).toBe("E-PAGE-003");
    } finally {
      await restore();
    }
    expect(isStopped(await hit(staff, "GET", "/tickets"))).toBe(false);
  });

  it("K1012-API-008 通す口の正本：STOP_OPEN_OPS の 10 本は全部、契約に在る会社の人の口（auth member）", async () => {
    const byOp = new Map(ENDPOINTS.map((e) => [e.operationId, e]));
    expect(STOP_OPEN_OPS.size).toBe(10);
    for (const op of STOP_OPEN_OPS) {
      expect(byOp.has(op), op).toBe(true);
      expect(byOp.get(op)!.auth, op).toBe("member");
    }
  });

  it("K1012-DB-001 PC の止め：app.bridge_tenant_stopped(<PC のセッション>) は止めた会社の PC で真・止めていない・止める予定の会社の PC で偽。会社の人の文脈から直に呼べない（PUBLIC は呼べない）", async () => {
    await t.pc(w, staff);
    await t.pc(other, other.admin);
    const sid = async (x: Ws) =>
      (await t.row<{ id: string }>("select id from sessions where tenant_id = $1 and kind_id = 'bridge' limit 1", [
        x.tenantId,
      ]))!.id;
    const on = async (x: Ws) =>
      (await t.row<{ s: boolean }>("select app.bridge_tenant_stopped($1) as s", [await sid(x)]))!.s;
    await setMarks(w.tenantId, { stopOn: jstDay(2) });
    expect([await on(w), await on(other)]).toEqual([false, false]);
    await setMarks(w.tenantId, { stoppedNow: true });
    expect([await on(w), await on(other)]).toEqual([true, false]);
    const pub = await t.row<{ p: boolean }>(
      "select has_function_privilege('public', 'app.bridge_tenant_stopped(uuid)', 'execute') as p",
    );
    expect(pub!.p).toBe(false);
    await clear(w.tenantId);
  });
});
