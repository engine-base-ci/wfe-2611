// 要求ごとにテナント文脈を決め、関門 C2（repository）だけを渡す。routes は c.get("repo") と c.get("ctx") 以外で DB に触れない（G6 ci:context-set が静的に検査）。
import type { MiddlewareHandler } from "hono";
import type { Context } from "hono";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { sessionUnresolved } from "../contract/op.js";
import { isUuid } from "@kaname/contracts";

/** 正式な uuid の形（契約の入口と同じ isUuid＝z.uuid()・版と variant の桁まで見る・K-145） */
const UUID = { test: (v: string): boolean => isUuid(v) };
/** 要求の解決の答え：テナントの文脈と、同意し直しの印（K-53。立っている間は契約の入口 op.ts が止める） */
/** mfaPending：付けるまで進めないの印（K-308 が立てる。立っている間は契約の入口 op.ts が止める・K-321）。持たなければ立っていない */
/** memberLeft：解決が抜けた人かを答えで持つとき（画面のログイン・K-233）。持たなければ入口が DB で確かめる */
export type SessionResolver = (c: Context) => Promise<{
  ctx: TenantContext;
  termsPending: boolean;
  mfaPending?: boolean;
  memberLeft?: boolean;
  tenantStopped?: boolean;
} | null>;
/** memberLeft：呼んだ人が会社から抜けた人か（D-131.7 ②・K-166）。契約の入口 op.ts が、認証を通した後に 1 回だけ呼ぶ（呼ばれるまで DB を引かない）。
 *  本物のアプリではこの中間の処理が必ず入れる。入口だけを偽の関門で試す小さなアプリ（authz.test.ts）には無い */
export type Vars = {
  Variables: {
    ctx: TenantContext;
    repo: Repository;
    termsPending: boolean;
    mfaPending: boolean;
    memberLeft?: () => Promise<boolean>;
    /** tenantStopped：呼んだ人の会社を運営が止めたか（K-970・K-1012）。memberLeft と同じ 1 回の答え（repo.memberState）を分けて使う。
     *  契約の入口 op.ts が、止めた会社でも通す口（stop-open.ts）でないときだけ呼ぶ。入口だけを試す小さなアプリには無い（止めない） */
    tenantStopped?: () => Promise<boolean>;
  };
};

/** 要求の頭 → 文脈（packages/auth の解決の形。同意し直しの印 termsPending も一緒に返す・K-53） */
export type HeaderResolver<R extends { ctx: TenantContext; termsPending: boolean }> = (
  headers: Headers,
) => Promise<R | null>;
/** PC の印の頭（x-bridge-session）がある要求は PC の印で解き、無ければ画面のログインで解く（K-57）。
 *  頭があるのに解けなければ anonymous（画面のログインに落とさない：PC の印と画面の鍵を混ぜない） */
export function withDevice<R extends { ctx: TenantContext; termsPending: boolean }>(
  web: HeaderResolver<R>,
  device: HeaderResolver<R>,
  header = "x-bridge-session",
): HeaderResolver<R> {
  return async (headers) => (headers.has(header) ? device(headers) : web(headers));
}

/** セッションの解決は T-F-05（Better Auth・sessions 表）。無ければ anonymous（RLS は全部 0 行） */
export const anonymousResolver: SessionResolver = async () => null;

export function tenantContext(repo: Repository, resolve: SessionResolver = anonymousResolver): MiddlewareHandler<Vars> {
  return async (c, next) => {
    // セッションを解く所で例外になったら通さず止める側に倒す（fail-closed・503・E-PAGE-003・K-53）。解けて null（ログインしていない）は anonymous
    let r: Awaited<ReturnType<SessionResolver>>;
    try {
      r = await resolve(c);
    } catch (e) {
      return sessionUnresolved(c, "契約の口の入口", e);
    }
    const base = r?.ctx ?? { tenantId: null, userId: null, role: "anonymous" as const };
    // 運営は対象の会社を x-tenant-id で指す（会社の 1 社の中で対応する・D-077）。会社の人は自分の会社だけ（無視）
    const target = c.req.header("x-tenant-id");
    const ctx = base.role === "ops" && target && UUID.test(target) ? { ...base, tenantId: target } : base;
    c.set("ctx", ctx);
    c.set("repo", repo);
    c.set("termsPending", r?.termsPending === true);
    c.set("mfaPending", r?.mfaPending === true);
    // 解決の答えが抜けた人かを持てば、それを使い DB を引かない（K-233）。持たなければ今までどおり引く（PC の印・試験の土台）
    //   止めた会社か（K-1012）も同じ：解決が答えを持てば使い（画面のログインは session_check の 1 本の文で引いてある）、
    //   持たないときだけ抜けた人と同じ 1 文（repo.memberState）で引き、2 つの確かめが同じ答えを使う（呼ばれるまで引かない・1 要求に 1 回）
    const known = r?.memberLeft;
    const knownStopped = r?.tenantStopped;
    let state: Promise<{ gone: boolean; stopped: boolean }> | undefined;
    const stateOnce = () => (state ??= repo.memberState(ctx));
    c.set("memberLeft", known === undefined ? async () => (await stateOnce()).gone : async () => known);
    c.set(
      "tenantStopped",
      knownStopped === undefined ? async () => (await stateOnce()).stopped : async () => knownStopped,
    );
    await next();
  };
}
