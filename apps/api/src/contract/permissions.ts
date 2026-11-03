// 権限の言葉の段（ZT1・ZT5・KN-51）。契約の perm（08_api の permission から生成）を、入口（op.ts）で言葉ごとに確かめる。
//   役の段（member／ops／client／device）は op.ts が先に見る。ここはその上の「誰が呼べるか」。
//   行に結ぶ言葉（self・assignee・approver・recipient・manager・read・write）は KN-52 で足す。それまでは行の守り（RLS）が行を絞る。
import type { EndpointDef } from "@kaname/contracts";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";

export interface PermArgs {
  e: EndpointDef;
  ctx: TenantContext;
  repo: Repository;
  id: string | null;
}
type Check = (a: PermArgs) => Promise<boolean>;

/** 言葉 → 確かめ。キーが無い言葉は、まだ入口で見ていない（zt_gate の perm_words_missing に出る） */
export const CHECKS: Record<string, Check> = {
  public: async () => true,
  client: async ({ ctx }) => ctx.role === "client",
  device: async ({ ctx }) => ctx.role === "device",
  // 管理者の段：その能力（招く・書き出す・お金・消す・表ごとの読む／書く）を、会社全体で（scope: any はどこかのグループで）持つ人
  admin: async ({ e, ctx, repo }) => {
    const p = e.perm;
    if (p.adminOnly) return repo.isAdmin(ctx);
    if (!p.target || !p.ability) return false;
    return p.scope === "any" ? repo.canAny(ctx, p.target, p.ability) : repo.can(ctx, p.target, null, p.ability);
  },
  // 運営：そのできること（ops_members.caps）を持つ運営の人だけ
  //   ops:any は運営の人なら誰でも（運営の人の行があること）
  "ops:*": async ({ e, ctx, repo }) => {
    if (ctx.role !== "ops" || !e.perm.cap) return false;
    const caps = await repo.opsCaps(ctx);
    return caps !== null && (e.perm.cap === "any" || caps.includes(e.perm.cap));
  },
};

export const checkFor = (word: string): Check | undefined => CHECKS[word.startsWith("ops:") ? "ops:*" : word];

/** 本人確認の取り直しが新しいか（15 分以内・D-125.139） */
export const STEP_UP_MS = 15 * 60 * 1000;
export const stepUpFresh = (ctx: TenantContext, now = Date.now()): boolean =>
  !!ctx.stepUpAt && now - new Date(ctx.stepUpAt).getTime() <= STEP_UP_MS;
