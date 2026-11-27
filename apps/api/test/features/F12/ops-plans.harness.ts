// 段 13「配るもの › プラン」の口（K-987 listOpsPlans・listPlanProposals・listPlanHistory／K-988 createPlanProposal・updatePlanProposal・
//   submitPlanProposal／K-989 getPlanProposalImpact／K-990 decidePlanProposal・returnPlanProposal／K-1017 値段の版を請求とプランの選びに効かせる）の
//   単体の試験の土台（K-987 が持ち込む）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   会社・人・運営の人・本人確認の取り直しは ops-act.harness.ts（K-969）をそのまま使い、プランと案の準備だけを足す:
//     ・plan：運営の会社の 3 つのプラン（ops-ws.harness.ts の PLANS）の行と今の版を読む
//     ・proposal：案（ops_plan_proposals）を DB に直に置く（口を通さない準備）。状態・作った人・決めた人を選べる。
//       開いた案を置くときは、そのプランの前の開いた案を消した印にする（1 つのプランに開いた案は 1 つ・K-988）
//     ・restorePlans：試験がプランの行（値段・今の版）や版の行を変えたら、afterAll で元に戻す（共用の DB・G-10）
//   案の行は消せない（0076 の revoke delete）ので、afterAll では管理者の接続で消す
import { afterAll } from "vitest";
import type { Person } from "../fixture.js";
import { OPS_TENANT, PLANS, type PlanKey } from "./ops-ws.harness.js";
import { startOpsAct, STEP, type OpsAct } from "./ops-act.harness.js";

export { OPS_TENANT, PLANS, STEP, type PlanKey };
export const PLANS_PATH = "/ops/plans";
export const PROPOSALS = "/ops/plan_proposals";
export const HISTORY = "/ops/plan_history";
/** listOpsPlans の 1 行の 8 欄（K-987） */
export const PLAN_ROW_KEYS = [
  "facts",
  "member_limit",
  "name",
  "places",
  "plan_key",
  "price_monthly",
  "proposal",
  "version",
] as const;
/** listPlanProposals ほか案の 1 行の 20 欄（K-987） */
export const PROPOSAL_KEYS = [
  "before",
  "can_decide",
  "can_edit",
  "changes",
  "created_at",
  "decided_at",
  "decider",
  "existing_policy",
  "from_version",
  "id",
  "new_from",
  "notice_days",
  "plan_key",
  "plan_name",
  "proposer",
  "reason",
  "return_reason",
  "state",
  "submitted_at",
  "to_version",
] as const;

export interface ProposalRow {
  plan?: PlanKey;
  by: Person;
  state?: "draft" | "waiting" | "decided" | "returned";
  price?: number;
  members?: number;
  policy?: "after_days" | "keep";
  days?: number | null;
  newFrom?: string | null;
  reason?: string;
  decidedBy?: Person;
  returnReason?: string;
}
export interface OpsPlans extends OpsAct {
  /** そのプランの行（id・今の値段・今の版・人数の上限） */
  plan: (key: PlanKey) => Promise<{ id: string; price: number; version: number; members: number }>;
  /** 案を DB に直に置き、id を返す */
  proposal: (o: ProposalRow) => Promise<string>;
  /** 案の行（DB） */
  proposalRow: (id: string) => Promise<Record<string, unknown> | undefined>;
}

/** hookFiles：読む hooks のファイル名（拡張子なし。例 "ops-plans-read"） */
export async function startOpsPlans(prefix: string, hookFiles: readonly string[]): Promise<OpsPlans> {
  const t = await startOpsAct(prefix, hookFiles);
  // プランの行がまだ無い DB でも始められるよう、ws() を 1 回呼んだのと同じ 3 つの行を先に置く（ops-ws.harness.ts の planId と同じ値）
  for (const p of PLANS)
    await t.f.admin.query(
      `insert into plans (tenant_id, key, name, price_monthly, limits) values ($1, $2, $3, $4, $5)
       on conflict (tenant_id, key) do nothing`,
      [OPS_TENANT, p.key, p.name, p.price, { members: p.members }],
    );
  const snap = await t.f.admin.query<{
    id: string;
    price_monthly: string;
    current_version: number | null;
    limits: unknown;
  }>("select id, price_monthly, current_version, limits from plans where tenant_id = $1", [OPS_TENANT]);
  const versions = await t.f.admin.query<{ id: string }>("select id from plan_versions");
  const before = new Set(versions.rows.map((r) => r.id));
  const made: string[] = [];
  afterAll(async () => {
    for (const r of snap.rows)
      await t.f.admin.query("update plans set price_monthly = $2, current_version = $3, limits = $4 where id = $1", [
        r.id,
        r.price_monthly,
        r.current_version,
        r.limits,
      ]);
    const now = await t.f.admin.query<{ id: string }>("select id from plan_versions");
    const added = now.rows.map((r) => r.id).filter((id) => !before.has(id));
    if (added.length) await t.f.admin.query("delete from plan_versions where id = any($1::uuid[])", [added]);
    const mine = await t.f.admin.query<{ id: string }>(
      "select id from ops_plan_proposals where reason like $1 or id = any($2::uuid[])",
      [`${t.run}%`, made],
    );
    const ids = mine.rows.map((r) => r.id);
    if (ids.length) {
      // 運営の記録・会社の記録・安全の記録（ops_audit_events・audit_events・security_events）は追記専用（0003_audit.sql の引き金）なので消さない。試験は前の数との差かその回の印で絞って数える
      await t.f.admin.query("delete from ops_plan_proposals where id = any($1::uuid[])", [ids]);
    }
    await t.f.admin.query("delete from notices where tenant_id = $1 and title like $2", [OPS_TENANT, `${t.run}%`]);
  });

  const plan: OpsPlans["plan"] = async (key) => {
    const r = (await t.row<{
      id: string;
      price_monthly: string;
      current_version: number | null;
      limits: { members?: number };
    }>("select id, price_monthly, current_version, limits from plans where tenant_id = $1 and key = $2", [
      OPS_TENANT,
      key,
    ]))!;
    return {
      id: r.id,
      price: Number(r.price_monthly),
      version: r.current_version ?? 1,
      members: Number(r.limits?.members ?? 0),
    };
  };
  const proposal: OpsPlans["proposal"] = async (o) => {
    const p = await plan(o.plan ?? "team");
    const state = o.state ?? "draft";
    const decided = state === "decided" || state === "returned";
    // 1 つのプランに開いた案（下書き・待っている）は 1 つ（K-988 の部分の一意の索引）。開いた案を置くときは前の開いた案を消した印にする
    if (!decided)
      await t.f.admin.query(
        "update ops_plan_proposals set deleted_at = now() where plan_id = $1 and state in ('draft','waiting') and deleted_at is null",
        [p.id],
      );
    const id = (await t.row<{ id: string }>(
      `insert into ops_plan_proposals (plan_id, from_version, to_version, changes, existing_policy, notice_days, new_from,
                                       reason, proposed_by, decided_by, state, decided_at, return_reason)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
      [
        p.id,
        p.version,
        p.version + 1,
        { price_monthly: o.price ?? 18000, member_limit: o.members ?? 12 },
        o.policy ?? "after_days",
        o.days === undefined ? 90 : o.days,
        o.newFrom ?? null,
        `${t.run} ${o.reason ?? "人数の上限に当たる会社が多いため"}`,
        await t.opsMemberId(o.by),
        decided ? await t.opsMemberId(o.decidedBy ?? o.by) : null,
        state,
        decided ? new Date().toISOString() : null,
        state === "returned" ? (o.returnReason ?? "上げ幅が大きい") : null,
      ],
    ))!.id;
    made.push(id);
    return id;
  };
  const proposalRow: OpsPlans["proposalRow"] = async (id) =>
    t.row("select * from ops_plan_proposals where id = $1", [id]);
  return { ...t, plan, proposal, proposalRow };
}
