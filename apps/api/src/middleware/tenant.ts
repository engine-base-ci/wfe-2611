// 要求ごとにテナント文脈を決め、関門 C2（repository）だけを渡す。routes は c.get("repo") と c.get("ctx") 以外で DB に触れない（G6 ci:context-set が静的に検査）。
import type { MiddlewareHandler } from "hono";
import type { Context } from "hono";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";

export type SessionResolver = (c: Context) => Promise<TenantContext | null>;
export type Vars = { Variables: { ctx: TenantContext; repo: Repository } };

/** セッションの解決は T-F-05（Better Auth・sessions 表）。無ければ anonymous（RLS は全部 0 行） */
export const anonymousResolver: SessionResolver = async () => null;

export function tenantContext(repo: Repository, resolve: SessionResolver = anonymousResolver): MiddlewareHandler<Vars> {
  return async (c, next) => {
    const ctx = (await resolve(c)) ?? { tenantId: null, userId: null, role: "anonymous" as const };
    c.set("ctx", ctx);
    c.set("repo", repo);
    await next();
  };
}
