// K-970 運営が 1 社を止める・再開する（stopWorkspace・POST /api/v1/ops/workspaces/:id/stop／resumeWorkspace・POST …/resume）と、
//   止める日の帯（getServiceStatusForMember の bands の kind stop・K-955 の app.member_stop_band を差し替える）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   代表の答え 2026-11-23（D-156.23）：止める日までの間はその会社の管理者にお知らせと画面の上の帯（管理者だけ）。止めた後は全員に止めた帯。
//   印は tenants の stop_on・stopped_at・stop_reason_key・stop_noticed_at（K-963 が足した）と、この葉が足す stop_notice（管理者へのお知らせの本文）。
//   答えは getOpsWorkspace と同じ 14 欄（K-1006）。止めても会社のデータと実行待ちは消さない（D-125.126）。入口で止めるのは K-1012
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startOpsAct, STEP, type OpsAct } from "./ops-act.harness.js";
import { isFlat, OPS_TENANT, WS_KEYS, type Json, type Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

let t: OpsAct;
let opsAll: Person;
let opsNoStop: Person;
const made: string[] = [];

beforeAll(async () => {
  t = await startOpsAct("k970", ["ops-stop", "service-status-member"]);
  opsAll = await t.ops("高本");
  opsNoStop = await t.ops("問い合わせだけ", ["inquiry"]);
});
afterAll(async () => {
  if (made.length) await t.f.admin.query("update tenants set stop_notice = null where id = any($1::uuid[])", [made]);
  await t.close();
});

/** 日本の暦の日（YYYY-MM-DD）。offsetDays だけずらす */
const jstDay = (offsetDays = 0): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(Date.now() + offsetDays * 86_400_000));
const NOTICE =
  "10 月分の請求書のお支払いが確かめられていません。止める日までに確かめられない場合、ワークスペースを止めます。";
const later = (o: Json = {}): Json => ({
  reason_key: "unpaid",
  mode: "scheduled",
  stop_on: jstDay(7),
  admin_notice: NOTICE,
  ...o,
});
const NOW: Json = { reason_key: "violation", mode: "now", note: "規約の 12 条に反する送信が続いた" };

const fresh = async (label: string): Promise<Ws> => {
  const w = await t.ws(label, { members: 2 });
  made.push(w.tenantId);
  return w;
};
const stop = async (wsId: string, body: unknown, who: Person = opsAll, ...opt: [step?: number]) => {
  // 送らない（undefined）と既定の STEP を分ける：既定の引数は undefined を渡しても STEP になり、取り直していない場合を作れなかった
  const step = opt.length ? opt[0] : STEP;
  const r = await t.act(who, "POST", `/ops/workspaces/${wsId}/stop`, body, { stepUpAgoSec: step });
  return { r, b: await t.json(r) };
};
const resume = async (wsId: string, body: unknown = {}, who: Person = opsAll, ...opt: [step?: number]) => {
  // 送らない（undefined）と既定の STEP を分ける：既定の引数は undefined を渡しても STEP になり、取り直していない場合を作れなかった
  const step = opt.length ? opt[0] : STEP;
  const r = await t.act(who, "POST", `/ops/workspaces/${wsId}/resume`, body, { stepUpAgoSec: step });
  return { r, b: await t.json(r) };
};
const marks = (wsId: string) =>
  t.row<{ on: string | null; at: string | null; key: string | null; noticed: string | null; body: string | null }>(
    "select to_char(stop_on, 'YYYY-MM-DD') as on, stopped_at as at, stop_reason_key as key, stop_noticed_at as noticed, stop_notice as body from tenants where id = $1",
    [wsId],
  );
const opsLog = (wsId: string, action: string) =>
  t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1 and action = $2", [wsId, action]);
const stopBand = async (who: Person) => {
  const r = await t.act(who, "GET", "/service-status");
  const b = await t.json(r);
  return ((b.data as { bands?: Json[] } | undefined)?.bands ?? []).filter((x) => x["kind"] === "stop");
};
const notices = (w: Ws, kind: string) =>
  t.n("select count(*) as n from notifications where tenant_id = $1 and event_kind_id = $2 and channel_id = 'inapp'", [
    w.tenantId,
    kind,
  ]);
const memberOf = async (w: Ws): Promise<Person> => t.member(w, `メンバー ${randomUUID().slice(0, 4)}`);

describe("K-970 先に知らせて止める", () => {
  it("K970-API-001 日を決めて止める：201・答えは 1 社の 14 欄。stop は reason_key unpaid・stop_on 7 日後・stopped_at null・noticed_at あり・state は active のまま。印の列に本文も入る", async () => {
    const w = await fresh("予定");
    const { r, b } = await stop(w.tenantId, later());
    expect(r.status, JSON.stringify(b)).toBe(201);
    const d = b.data as Json;
    expect(Object.keys(d).sort()).toEqual(WS_KEYS);
    const s = d["stop"] as Json;
    expect([s["reason_key"], s["stop_on"], s["stopped_at"], s["noticed_at"] === null, d["state"]]).toEqual([
      "unpaid",
      jstDay(7),
      null,
      false,
      "active",
    ]);
    const m = (await marks(w.tenantId))!;
    expect([m.on, m.at, m.key, m.noticed === null, m.body]).toEqual([jstDay(7), null, "unpaid", false, NOTICE]);
  });

  it("K970-API-002 管理者へのお知らせ：その会社の管理者全員に inapp の workspace.stop_scheduled が 1 行ずつ。管理者でない人には出ない。中身に本文の字を入れない", async () => {
    const w = await fresh("お知らせ");
    const admin2 = await t.member(w, "管理者 2", { role: "admin" });
    const staff = await memberOf(w);
    expect((await stop(w.tenantId, later())).r.status).toBe(201);
    const rows = await t.f.admin.query<{ m: string; p: Json }>(
      "select member_id as m, payload as p from notifications where tenant_id = $1 and event_kind_id = 'workspace.stop_scheduled' and channel_id = 'inapp'",
      [w.tenantId],
    );
    expect(rows.rows.map((x) => x.m).sort()).toEqual([w.admin.id, admin2.id].sort());
    expect(rows.rows.map((x) => x.m)).not.toContain(staff.id);
    expect(JSON.stringify(rows.rows.map((x) => x.p))).not.toContain("お支払い");
  });

  it("K970-API-003 記録：運営の記録と会社の記録に workspace.stop_scheduled が 1 行ずつ・対象 tenants とその id・payload の target_label は会社名・reason は理由の字「請求が払われない」", async () => {
    const w = await fresh("記録");
    expect((await stop(w.tenantId, later({ note: "3 回お知らせした" }))).r.status).toBe(201);
    expect(await opsLog(w.tenantId, "workspace.stop_scheduled")).toBe(1);
    expect(
      await t.n(
        "select count(*) as n from audit_events where tenant_id = $1 and action = 'workspace.stop_scheduled' and actor_role = 'ops'",
        [w.tenantId],
      ),
    ).toBe(1);
    const e = (await t.row<{ ty: string; id: string; p: Json }>(
      "select target_type as ty, target_id as id, payload as p from ops_audit_events where target_tenant_id = $1 and action = 'workspace.stop_scheduled'",
      [w.tenantId],
    ))!;
    expect([e.ty, e.id, e.p["target_label"], e.p["reason"]]).toEqual([
      "tenants",
      w.tenantId,
      w.name,
      "請求が払われない",
    ]);
  });

  it("K970-API-004 止める日の帯（管理者だけ）：管理者の稼働状況に stop の帯が 1 つ（notice_id null・題は理由の字・state は本文・note と ref は null・from は止める日の 0 時（日本）・closable false・more 0）。管理者でない人には出ない", async () => {
    const w = await fresh("帯");
    const staff = await memberOf(w);
    expect((await stop(w.tenantId, later())).r.status).toBe(201);
    const a = await stopBand(w.admin);
    expect(a.length).toBe(1);
    expect([a[0]!["notice_id"], a[0]!["title"], a[0]!["state"], a[0]!["closable"], a[0]!["more"]]).toEqual([
      null,
      "請求が払われない",
      NOTICE,
      false,
      0,
    ]);
    expect([a[0]!["note"], a[0]!["ref"]]).toEqual([null, null]);
    expect(new Date(String(a[0]!["from"])).getTime()).toBe(new Date(`${jstDay(7)}T00:00:00+09:00`).getTime());
    expect(await stopBand(staff)).toEqual([]);
  });
});

describe("K-970 すぐ止める・止める日が来た", () => {
  it("K970-API-005 すぐ止める（規約に反する）：201・stopped_at が今・stop_on は今日。全員の稼働状況に止めた帯（from は止めた時刻）。管理者へのお知らせは出さない", async () => {
    const w = await fresh("すぐ");
    const staff = await memberOf(w);
    const before = Date.now();
    const { r, b } = await stop(w.tenantId, NOW);
    expect(r.status, JSON.stringify(b)).toBe(201);
    const m = (await marks(w.tenantId))!;
    expect([m.on, m.key]).toEqual([jstDay(0), "violation"]);
    expect(Math.abs(new Date(String(m.at)).getTime() - before)).toBeLessThan(30_000);
    for (const who of [w.admin, staff]) {
      const s = await stopBand(who);
      expect(s.length).toBe(1);
      expect([s[0]!["title"], new Date(String(s[0]!["from"])).getTime()]).toEqual([
        "規約に反する",
        // stopped_at は pg が Date で返す。String(Date) は秒までの字になりミリ秒が落ちるので、Date のまま読む
        new Date(m.at!).getTime(),
      ]);
    }
    expect(await notices(w, "workspace.stop_scheduled")).toBe(0);
  });

  it("K970-API-006 止める日が来た（G-12）：明日止める会社は管理者にだけ予定の帯。止める日が今日になった直後から、管理者でない人にも止めた帯が出る（時間で動く仕組みは使わず、読むときの日で決める）", async () => {
    const w = await fresh("日が来た");
    const staff = await memberOf(w);
    expect((await stop(w.tenantId, later({ stop_on: jstDay(1) }))).r.status).toBe(201);
    expect(await stopBand(staff)).toEqual([]);
    // 明日止める会社の管理者には、止める予定の帯が出る（止める日が今日より後＝予定。D-156.23）
    const soon = await stopBand(w.admin);
    expect(soon.length).toBe(1);
    expect(new Date(String(soon[0]!["from"])).getTime()).toBe(new Date(`${jstDay(1)}T00:00:00+09:00`).getTime());
    await t.f.admin.query("update tenants set stop_on = $2::date where id = $1", [w.tenantId, jstDay(0)]);
    const s = await stopBand(staff);
    expect(s.length).toBe(1);
    expect(s[0]!["title"]).toBe("請求が払われない");
    expect(new Date(String(s[0]!["from"])).getTime()).toBe(new Date(`${jstDay(0)}T00:00:00+09:00`).getTime());
  });

  it("K970-API-007 止めてもデータと実行待ちは消さない（D-125.126）：止める前と後で、実行（action_runs）・問い合わせの行の数が同じ", async () => {
    const w = await fresh("残す");
    await t.run_(w, { status: "queued" });
    await t.inquiry(w, { state: "open" });
    const count = async () =>
      [
        await t.n("select count(*) as n from action_runs where tenant_id = $1 and deleted_at is null", [w.tenantId]),
        await t.n("select count(*) as n from inquiries where tenant_id = $1 and deleted_at is null", [w.tenantId]),
      ] as const;
    const before = await count();
    expect((await stop(w.tenantId, NOW)).r.status).toBe(201);
    expect(await count()).toEqual(before);
  });
});

describe("K-970 断る", () => {
  it("K970-API-008 形の誤り（契約の決まり）：すぐ止めるの理由が unpaid・request、日を決めるのに stop_on が無い、すぐ止めるに stop_on、知らない理由、note 501 字、admin_notice 2001 字、知らない欄、道の :id が uuid でないは 422。印を書かない", async () => {
    const w = await fresh("形");
    const bad: unknown[] = [
      { ...NOW, reason_key: "unpaid" },
      { ...NOW, reason_key: "request" },
      { reason_key: "unpaid", mode: "scheduled" },
      { ...NOW, stop_on: jstDay(7) },
      later({ reason_key: "terms" }),
      later({ note: "あ".repeat(501) }),
      later({ admin_notice: "あ".repeat(2001) }),
      later({ stopped_at: new Date().toISOString() }),
    ];
    for (const body of bad) expect((await stop(w.tenantId, body)).r.status, JSON.stringify(body)).toBe(422);
    expect((await stop("abc", later())).r.status).toBe(422);
    const m = (await marks(w.tenantId))!;
    expect([m.on, m.at, m.key]).toEqual([null, null, null]);
  });

  it("K970-API-009 止める日が今日・昨日は 409・E-OPS-006（欄なし）。明日なら止められる", async () => {
    const w = await fresh("日");
    for (const d of [jstDay(0), jstDay(-1)]) {
      const x = await stop(w.tenantId, later({ stop_on: d }));
      expect(x.r.status, d).toBe(409);
      expect(x.b["code"]).toBe("E-OPS-006");
      expect(isFlat(x.b)).toBe(true);
    }
    expect((await marks(w.tenantId))!.on).toBeNull();
    expect((await stop(w.tenantId, later({ stop_on: jstDay(1) }))).r.status).toBe(201);
  });

  it("K970-API-010 もう止めている・止める予定がある：もう一度日を決めると 409・E-OPS-003（欄なし）で日が変わらない。予定がある会社をすぐ止めるのは通る。止めた会社にもう一度は 409", async () => {
    const w = await fresh("二重");
    expect((await stop(w.tenantId, later())).r.status).toBe(201);
    const again = await stop(w.tenantId, later({ stop_on: jstDay(3) }));
    expect(again.r.status).toBe(409);
    expect(again.b["code"]).toBe("E-OPS-003");
    expect((await marks(w.tenantId))!.on).toBe(jstDay(7));
    expect((await stop(w.tenantId, NOW)).r.status).toBe(201);
    const third = await stop(w.tenantId, { ...NOW, reason_key: "danger" });
    expect(third.r.status).toBe(409);
    expect(third.b["code"]).toBe("E-OPS-003");
  });

  it("K970-API-011 本人確認：止める・再開とも、取り直していない・16 分前は 403 STEP_UP_REQUIRED で印も記録も変わらない", async () => {
    const w = await fresh("本人確認");
    for (const step of [undefined, 16 * 60]) {
      const x = await stop(w.tenantId, later(), opsAll, step);
      expect(x.r.status, String(step)).toBe(403);
      expect(x.b["code"]).toBe("STEP_UP_REQUIRED");
    }
    expect((await marks(w.tenantId))!.on).toBeNull();
    expect((await stop(w.tenantId, later())).r.status).toBe(201);
    const y = await resume(w.tenantId, {}, opsAll, undefined);
    expect([y.r.status, y.b["code"]]).toEqual([403, "STEP_UP_REQUIRED"]);
    expect((await marks(w.tenantId))!.on).toBe(jstDay(7));
  });

  it("K970-API-012 入口：ログインなし 401・会社の人（管理者でも）403・止める（stop）を持たない運営の人 403。会社が無い・運営の会社は 404（欄なし）。どれも印を書かない", async () => {
    const w = await fresh("入口");
    expect((await t.act(null, "POST", `/ops/workspaces/${w.tenantId}/stop`, later())).status).toBe(401);
    expect((await stop(w.tenantId, later(), w.admin)).r.status).toBe(403);
    expect((await stop(w.tenantId, later(), opsNoStop)).r.status).toBe(403);
    expect((await resume(w.tenantId, {}, opsNoStop)).r.status).toBe(403);
    for (const id of [OPS_TENANT, randomUUID()]) {
      const x = await stop(id, later());
      expect(x.r.status, id).toBe(404);
      expect(isFlat(x.b)).toBe(true);
    }
    expect((await marks(w.tenantId))!.on).toBeNull();
    expect((await marks(OPS_TENANT))!.on).toBeNull();
  });

  it("K970-API-013 書けない（DB が落ちる）：503・E-PAGE-003。印・管理者へのお知らせ・記録のどれも残らない（同じ取引で戻る）", async () => {
    const w = await fresh("落ちる");
    const restore = await t.breakWrites("ops_audit_events", { target_tenant_id: w.tenantId });
    try {
      const x = await stop(w.tenantId, later());
      expect(x.r.status).toBe(503);
      expect(x.b["code"]).toBe("E-PAGE-003");
    } finally {
      await restore();
    }
    expect((await marks(w.tenantId))!.on).toBeNull();
    expect(await notices(w, "workspace.stop_scheduled")).toBe(0);
  });
});

describe("K-970 再開する", () => {
  it("K970-API-014 止める予定を取り消す：201・stop null・state active。印の 5 列が空・管理者の帯が消える・記録に workspace.resume が両方 1 行（payload の note）", async () => {
    const w = await fresh("取り消す");
    expect((await stop(w.tenantId, later())).r.status).toBe(201);
    const { r, b } = await resume(w.tenantId, { note: "入金を確かめた" });
    expect(r.status, JSON.stringify(b)).toBe(201);
    const d = b.data as Json;
    expect([d["stop"], d["state"]]).toEqual([null, "active"]);
    const m = (await marks(w.tenantId))!;
    expect([m.on, m.at, m.key, m.noticed, m.body]).toEqual([null, null, null, null, null]);
    expect(await stopBand(w.admin)).toEqual([]);
    expect(await opsLog(w.tenantId, "workspace.resume")).toBe(1);
    expect(
      (await t.row<{ p: Json }>(
        "select payload as p from ops_audit_events where target_tenant_id = $1 and action = 'workspace.resume'",
        [w.tenantId],
      ))!.p["note"],
    ).toBe("入金を確かめた");
  });

  it("K970-API-015 止めた会社を再開する：201・止めた帯が全員から消える・実行待ちはそのまま残る", async () => {
    const w = await fresh("再開");
    const staff = await memberOf(w);
    await t.run_(w, { status: "queued" });
    expect((await stop(w.tenantId, NOW)).r.status).toBe(201);
    expect((await resume(w.tenantId)).r.status).toBe(201);
    expect(await stopBand(staff)).toEqual([]);
    expect(
      await t.n("select count(*) as n from action_runs where tenant_id = $1 and status_id = 'queued'", [w.tenantId]),
    ).toBe(1);
  });

  it("K970-API-016 止めていない会社を再開すると 409・E-OPS-004（欄なし）で記録が増えない。体の知らない欄・note 501 字は 422", async () => {
    const w = await fresh("止めていない");
    const x = await resume(w.tenantId);
    expect(x.r.status).toBe(409);
    expect(x.b["code"]).toBe("E-OPS-004");
    expect(isFlat(x.b)).toBe(true);
    expect(await opsLog(w.tenantId, "workspace.resume")).toBe(0);
    expect((await resume(w.tenantId, { note: "あ".repeat(501) })).r.status).toBe(422);
    expect((await resume(w.tenantId, { reason_key: "unpaid" })).r.status).toBe(422);
  });

  it("K970-API-017 上限：stopWorkspace を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数。429 では印を書かない", async () => {
    const a = await fresh("上限 1");
    const w = await fresh("上限 2");
    t.f.limits["stopWorkspace"] = 1;
    try {
      expect((await stop(a.tenantId, later())).r.status).toBe(201);
      const x = await stop(w.tenantId, later());
      expect(x.r.status).toBe(429);
      const s = x.b["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
      expect((await marks(w.tenantId))!.on).toBeNull();
    } finally {
      delete t.f.limits["stopWorkspace"];
    }
  });

  it("K970-DB-001 2 層目：会社の人の文脈で app.ops_workspace_stop・app.ops_workspace_resume を直に呼ぶと 42501。app.tenant_stopped は止めた日と止める日で真偽が変わる", async () => {
    const w = await fresh("2 層目");
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.admin.id],
      );
      await expect(
        c.query("select app.ops_workspace_stop($1, 'violation', 'now', null, null, null)", [w.tenantId]),
      ).rejects.toMatchObject({ code: "42501" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    const stopped = async () => (await t.row<{ s: boolean }>("select app.tenant_stopped($1) as s", [w.tenantId]))!.s;
    expect(await stopped()).toBe(false);
    await t.f.admin.query("update tenants set stop_on = $2::date where id = $1", [w.tenantId, jstDay(1)]);
    expect(await stopped()).toBe(false);
    await t.f.admin.query("update tenants set stop_on = $2::date where id = $1", [w.tenantId, jstDay(0)]);
    expect(await stopped()).toBe(true);
    await t.f.admin.query("update tenants set stop_on = null, stopped_at = now() where id = $1", [w.tenantId]);
    expect(await stopped()).toBe(true);
  });
});
