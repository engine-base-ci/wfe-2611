// 要求ごとにテナント文脈を決め、関門 C2（repository）だけを渡す。routes は c.get("repo") と c.get("ctx") 以外で DB に触れない（G6 ci:context-set が静的に検査）。
import type { MiddlewareHandler } from "hono";
import type { Context } from "hono";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 要求の解決の答え：テナントの文脈と、同意し直しの印（K-53。立っている間は契約の入口 op.ts が止める） */
export type SessionResolver = (c: Context) => Promise<{ ctx: TenantContext; termsPending: boolean } | null>;
export type Vars = { Variables: { ctx: TenantContext; repo: Repository; termsPending: boolean } };

/** セッションの解決は T-F-05（Better Auth・sessions 表）。無ければ anonymous（RLS は全部 0 行） */
export const anonymousResolver: SessionResolver = async () => null;

export function tenantContext(repo: Repository, resolve: SessionResolver = anonymousResolver): MiddlewareHandler<Vars> {
  return async (c, next) => {
    const r = await resolve(c);
    const base = r?.ctx ?? { tenantId: null, userId: null, role: "anonymous" as const };
    // 運営は対象の会社を x-tenant-id で指す（会社の 1 社の中で対応する・D-077）。会社の人は自分の会社だけ（無視）
    const target = c.req.header("x-tenant-id");
    const ctx = base.role === "ops" && target && UUID.test(target) ? { ...base, tenantId: target } : base;
    c.set("ctx", ctx);
    c.set("repo", repo);
    c.set("termsPending", r?.termsPending === true);
    await next();
  };
}
