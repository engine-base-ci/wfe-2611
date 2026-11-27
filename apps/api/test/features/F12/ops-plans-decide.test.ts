// K-990「値段を変える案を決める・差し戻す」の単体の試験（本物の DB・本物の入口・偽のログイン（取り直しの秒）・土台 ops-plans.harness.ts＝K-987）。
// テストの名前の頭の行 ID（K990-…）は 11_tickets/K-990.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
// 決める人の数を見る行は、plan_decide をこの回の人だけが持つ形に一時的に寄せ、finally で戻す（共用の DB・G-10）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import type { Person } from "../fixture.js";
import { OPS_TENANT, PROPOSALS, STEP, startOpsPlans, type OpsPlans } from "./ops-plans.harness.js";

let t: OpsPlans;
let proposer: Person;
let decider: Person;
beforeAll(async () => {
  t = await startOpsPlans("k990", ["ops-plans-read", "ops-plans-decide"]);
  proposer = await t.ops("案の佐野", ["plan_propose"]);
  decider = await t.ops("決める高本", ["plan_decide"]);
});
afterAll(async () => t?.close());

const NOTICE = "チームプランの料金を改めます。それまでは今の料金のままです。";
const decide = (
  who: Person | null,
  id: string,
  body: unknown = { notice_body: NOTICE },
  step: number | undefined = STEP,
) => t.act(who, "POST", `${PROPOSALS}/${id}/decide`, body, step === undefined ? {} : { stepUpAgoSec: step });
const ret = (who: Person | null, id: string, body: unknown = { reason: "上げ幅が大きい" }) =>
  t.act(who, "POST", `${PROPOSALS}/${id}/return`, body);
const versionRow = (planId: string, version: number) =>
  t.row<Record<string, unknown>>(
    "select *, to_char(existing_from, 'YYYY-MM-DD') as ef from plan_versions where plan_id = $1 and version = $2",
    [planId, version],
  );
const noticesFor = (tenantId: string) =>
  t.n("select count(*)::int as n from notices where tenant_id = $1 and $2 = any(target_tenant_ids)", [
    OPS_TENANT,
    tenantId,
  ]);
const stateOf = async (id: string) => (await t.proposalRow(id))!["state"];
/** plan_decide を keep の人だけが持つ形にする。返す関数で戻す */
const alone = async (keep: Person[]) => {
  const others = await t.f.admin.query<{ id: string; caps: string[] }>(
    `select id, caps from ops_members where not (member_id = any($1::uuid[]))
        and revoked_at is null and deleted_at is null and 'plan_decide' = any(caps)`,
    [keep.map((p) => p.id)],
  );
  await t.f.admin.query("update ops_members set caps = array_remove(caps, 'plan_decide') where id = any($1::uuid[])", [
    others.rows.map((x) => x.id),
  ]);
  return async () => {
    for (const x of others.rows)
      await t.f.admin.query("update ops_members set caps = $2 where id = $1", [x.id, x.caps]);
  };
};

describe("K-990 決める", () => {
  it("K990-API-001 決める：decided・版の行・今の版・値段の列は前のまま・お知らせ 1 行（鈴なし）・記録 plan.decide", async () => {
    const team = await t.plan("team");
    const w = await t.ws("決めるチーム");
    const id = await t.proposal({
      by: proposer,
      state: "waiting",
      price: team.price + 3000,
      members: team.members + 2,
    });
    const bells = await t.n("select count(*)::int as n from notifications where tenant_id = $1", [w.tenantId]);
    const r = await decide(decider, id);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await t.json(r)).data as Record<string, unknown>;
    expect(d["state"]).toBe("decided");
    expect((d["decider"] as Record<string, unknown>)["member_id"]).toBe(decider.id);
    expect(typeof d["decided_at"]).toBe("string");
    const v = await versionRow(team.id, team.version + 1);
    expect([v?.["price_monthly"], v?.["member_limit"], v?.["proposal_id"]]).toEqual([
      team.price + 3000,
      team.members + 2,
      id,
    ]);
    const want = (await t.row<{ d: string }>(
      "select to_char(app.plan_existing_from('after_days', 90, false, (now() at time zone 'Asia/Tokyo')::date), 'YYYY-MM-DD') as d",
    ))!.d;
    expect(v?.["ef"]).toBe(want);
    const after = await t.plan("team");
    expect([after.version, after.price]).toEqual([team.version + 1, team.price]);
    const n = await t.row<Record<string, unknown>>(
      "select kind_id, state, placements, body, admins_only from notices where tenant_id = $1 and $2 = any(target_tenant_ids) order by created_at desc limit 1",
      [OPS_TENANT, w.tenantId],
    );
    expect([n?.["kind_id"], n?.["state"], n?.["placements"], n?.["body"], n?.["admins_only"]]).toEqual([
      "release",
      "published",
      ["list"],
      NOTICE,
      true,
    ]);
    expect(await t.n("select count(*)::int as n from notifications where tenant_id = $1", [w.tenantId])).toBe(bells);
    const a = await t.row<{ payload: Record<string, unknown> }>(
      "select payload from ops_audit_events where action = 'plan.decide' and target_id = $1",
      [id],
    );
    expect(a?.payload["step_up"]).toBe(true);
  });

  it("K990-API-002 ずっと今の値段：版の行の existing_from が null・お知らせが増えない", async () => {
    const free = await t.plan("free");
    const w = await t.ws("ずっと無料", { plan: "free" });
    const id = await t.proposal({
      plan: "free",
      by: proposer,
      state: "waiting",
      price: 500,
      policy: "keep",
      days: null,
    });
    const before = await noticesFor(w.tenantId);
    expect((await decide(decider, id)).status).toBe(200);
    expect((await versionRow(free.id, free.version + 1))?.["existing_from"]).toBeNull();
    expect(await noticesFor(w.tenantId)).toBe(before);
  });

  it("K990-API-003 すぐ効く：値下げの案は existing_from が今日の次の月の 1 日・お知らせ 1 行", async () => {
    const biz = await t.plan("business");
    const w = await t.ws("値下げビジネス", { plan: "business" });
    const id = await t.proposal({
      plan: "business",
      by: proposer,
      state: "waiting",
      price: biz.price - 5000,
      members: biz.members,
    });
    expect((await decide(decider, id)).status).toBe(200);
    const next = (await t.row<{ d: string }>(
      "select to_char(date_trunc('month', (now() at time zone 'Asia/Tokyo')::date) + interval '1 month', 'YYYY-MM-DD') as d",
    ))!.d;
    expect((await versionRow(biz.id, biz.version + 1))?.["ef"]).toBe(next);
    expect(await noticesFor(w.tenantId)).toBe(1);
  });

  it("K990-API-004 自分の案：ほかに決める人が居ると 409・E-OPS-022・欄なし・waiting のまま。自分 1 人だけなら 200", async () => {
    const both = await t.ops("作って決める", ["plan_propose", "plan_decide"]);
    const back = await alone([both, decider]);
    try {
      const id = await t.proposal({ by: both, state: "waiting" });
      const r = await decide(both, id);
      expect(r.status).toBe(409);
      const j = await t.json(r);
      expect(j["code"]).toBe("E-OPS-022");
      expect(j["field"]).toBeUndefined();
      expect(await stateOf(id)).toBe("waiting");
      await t.f.admin.query("update ops_members set caps = array_remove(caps, 'plan_decide') where member_id = $1", [
        decider.id,
      ]);
      const ok = await decide(both, id);
      expect(ok.status, await ok.clone().text()).toBe(200);
    } finally {
      await t.f.admin.query("update ops_members set caps = array['plan_decide'] where member_id = $1", [decider.id]);
      await back();
    }
  });

  it("K990-API-005 状態：下書きと決めた案は、決めるも差し戻すも 409・E-OPS-021・欄なし・版の行が増えない", async () => {
    const free = await t.plan("free");
    const draft = await t.proposal({ plan: "free", by: proposer, state: "draft" });
    const done = await t.proposal({ plan: "free", by: proposer, state: "decided", decidedBy: decider });
    const versions = await t.n("select count(*)::int as n from plan_versions where plan_id = $1", [free.id]);
    for (const id of [draft, done]) {
      const r = await decide(decider, id);
      expect(r.status, id).toBe(409);
      const j = await t.json(r);
      expect(j["code"]).toBe("E-OPS-021");
      expect(j["field"]).toBeUndefined();
      expect((await ret(decider, id)).status, id).toBe(409);
    }
    expect(await t.n("select count(*)::int as n from plan_versions where plan_id = $1", [free.id])).toBe(versions);
  });

  it("K990-API-012 同時に決める：2 人が同時に決めると 200 と 409 E-OPS-021・版の行 1 つ・お知らせ 1 行", async () => {
    const team = await t.plan("team");
    const w = await t.ws("同時のチーム");
    const second = await t.ops("決める木村", ["plan_decide"]);
    const id = await t.proposal({ by: proposer, state: "waiting", price: team.price + 2000 });
    const rs = await Promise.all([decide(decider, id), decide(second, id)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await t.n("select count(*)::int as n from plan_versions where proposal_id = $1", [id])).toBe(1);
    expect(await noticesFor(w.tenantId)).toBe(1);
  });

  it("K990-API-013 書けない：plan_versions への書き込みを落とすと 503・E-PAGE-003・waiting・今の版は前のまま・お知らせも記録も増えない", async () => {
    const team = await t.plan("team");
    const w = await t.ws("書けないチーム");
    const id = await t.proposal({ by: proposer, state: "waiting", price: team.price + 1000 });
    const fix = await t.breakWrites("plan_versions", { plan_id: team.id });
    try {
      const r = await decide(decider, id);
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect(await stateOf(id)).toBe("waiting");
    expect((await t.plan("team")).version).toBe(team.version);
    expect(await noticesFor(w.tenantId)).toBe(0);
    expect(
      await t.n("select count(*)::int as n from ops_audit_events where action = 'plan.decide' and target_id = $1", [
        id,
      ]),
    ).toBe(0);
  });
});

describe("K-990 差し戻す・入口", () => {
  it("K990-API-006 差し戻す：200・returned・return_reason・版とお知らせが増えない・記録 plan.return（理由）", async () => {
    const team = await t.plan("team");
    const id = await t.proposal({ by: proposer, state: "waiting" });
    const r = await ret(decider, id, { reason: "上げ幅が大きい。人数の上限を広げるなら考える" });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await t.json(r)).data as Record<string, unknown>;
    expect([d["state"], d["return_reason"]]).toEqual(["returned", "上げ幅が大きい。人数の上限を広げるなら考える"]);
    expect((await t.plan("team")).version).toBe(team.version);
    expect(await t.n("select count(*)::int as n from plan_versions where proposal_id = $1", [id])).toBe(0);
    const a = await t.row<{ payload: Record<string, unknown> }>(
      "select payload from ops_audit_events where action = 'plan.return' and target_id = $1",
      [id],
    );
    expect(a?.payload["reason"]).toBe("上げ幅が大きい。人数の上限を広げるなら考える");
  });

  it("K990-API-007 自分の案を差し戻す：ほかに決める人が居ると 409・E-OPS-022・waiting のまま", async () => {
    const both = await t.ops("作って差し戻す", ["plan_propose", "plan_decide"]);
    const id = await t.proposal({ plan: "free", by: both, state: "waiting" });
    const r = await ret(both, id);
    expect(r.status).toBe(409);
    expect((await t.json(r))["code"]).toBe("E-OPS-022");
    expect(await stateOf(id)).toBe("waiting");
  });

  it("K990-API-008 取り直していない：決めるは 403・STEP_UP_REQUIRED・waiting のまま。差し戻すは 200", async () => {
    const id = await t.proposal({ plan: "business", by: proposer, state: "waiting" });
    const r = await decide(decider, id, { notice_body: NOTICE }, undefined);
    expect(r.status).toBe(403);
    expect((await t.json(r))["code"]).toBe("STEP_UP_REQUIRED");
    expect(await stateOf(id)).toBe("waiting");
    expect((await ret(decider, id)).status).toBe(200);
  });

  it("K990-API-009 形の誤り：notice_body・reason の無い・空白だけ・長すぎ、余計な欄、:id が uuid でないは 422・waiting のまま", async () => {
    const id = await t.proposal({ by: proposer, state: "waiting" });
    for (const b of [
      {},
      { notice_body: "　 " },
      { notice_body: "あ".repeat(2001) },
      { notice_body: NOTICE, price_monthly: 1 },
    ])
      expect((await decide(decider, id, b)).status, JSON.stringify(b).slice(0, 40)).toBe(422);
    for (const b of [{}, { reason: " \t" }, { reason: "あ".repeat(501) }, { reason: "理由", notice_body: NOTICE }])
      expect((await ret(decider, id, b)).status, JSON.stringify(b).slice(0, 40)).toBe(422);
    expect((await decide(decider, "not-a-uuid")).status).toBe(422);
    expect(await stateOf(id)).toBe("waiting");
  });

  it("K990-API-010 無い・消した：決めるも差し戻すも 404・欄なし", async () => {
    const gone = await t.proposal({ plan: "free", by: proposer, state: "waiting" });
    await t.f.admin.query("update ops_plan_proposals set deleted_at = now() where id = $1", [gone]);
    for (const id of [randomUUID(), gone]) {
      const r = await decide(decider, id);
      expect(r.status, id).toBe(404);
      expect((await t.json(r))["field"]).toBeUndefined();
      expect((await ret(decider, id)).status, id).toBe(404);
    }
  });

  it("K990-API-011 入口：ログインなし 401・会社の人 403・値段の案だけの人は 2 本とも 403", async () => {
    const id = await t.proposal({ plan: "free", by: proposer, state: "waiting" });
    const w = await t.ws("入口の会社");
    expect((await decide(null, id)).status).toBe(401);
    expect((await decide(w.admin, id)).status).toBe(403);
    expect((await decide(proposer, id)).status).toBe(403);
    expect((await ret(proposer, id)).status).toBe(403);
  });

  it("K990-API-014 上限：決めるの上限の次が 429・retry_after_sec は 1〜60 の整数", async () => {
    const p = await t.ops("上限", ["plan_decide"]);
    const id = randomUUID();
    let last: Response | null = null;
    for (let i = 0; i < 70; i += 1) {
      last = await decide(p, id);
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    const sec = Number((await t.json(last!))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
  });

  it("K990-DB-001 2 層目：会社の人の文脈で app.ops_plan_decide を直に呼ぶと 42501・PUBLIC は app.ops_plan_return を呼べない", async () => {
    const app = new pg.Client({
      connectionString: process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
    });
    await app.connect();
    try {
      await app.query("begin");
      await app.query("select set_config('app.role', 'member', true)");
      await expect(app.query("select app.ops_plan_decide($1, '文')", [randomUUID()])).rejects.toMatchObject({
        code: "42501",
      });
      await app.query("rollback");
    } finally {
      await app.end();
    }
    const pub = await t.row<{ ok: boolean }>(
      "select has_function_privilege('public', 'app.ops_plan_return(uuid, text)', 'execute') as ok",
    );
    expect(pub?.ok).toBe(false);
  });
});
