// 口の答えの Server-Timing（K-237・調べ .ticket-flow/perf-research.md の A-4）。
//   要求ごとに DB の数え器（@kaname/db/pool の withDbCount）を始め、答えに DB にかかった時間（ms）と流した文の数を書く。
//   文の中身・表の名前は出さない。手元の試験（K237-API-002）と staging の測り（scripts/ci/staging_perf.py）がこれを読む。
import type { MiddlewareHandler } from "hono";
import { withDbCount, type DbCount } from "@kaname/db/pool";

export const SERVER_TIMING = "Server-Timing";

export function serverTimingValue(count: DbCount): string {
  return `db;dur=${count.ms.toFixed(1)}, q;desc="statements";dur=${count.statements}`;
}

/** 認証の口（Better Auth の部品・auth-ext・契約の /api/v1/auth/*）。ログイン・登録・再設定・招待・2 段階の確かめの答えは、
 *  ログイン中でも成功でも付けない（登録の有無で文の数が変わる・Q の指摘 1・PM の決め） */
const AUTH_PATHS = /^\/api\/(auth|auth-ext|v1\/auth)(\/|$)/;
/** 認証の口の中で、ログインの要る読むだけの口（自分の情報）。セッションがあれば付ける */
const AUTH_SESSION_READS: readonly string[] = ["/api/auth-ext/me"];
/** セッションの無い要求でも付けてよい道（中身も文も、誰が呼んでも同じ。staging の測りが読む）。
 *  PM に確かめ中（K-237）：空にすれば「セッションのある答えだけ」になる */
export const PUBLIC_TIMING_PATHS: readonly string[] = ["/health", "/api/v1/auth/terms/current"];

/** 付けるか：上の誰でも同じ道の GET か、画面のログインのセッション（Better Auth の getSession）が解けて 401 でない答えで、認証の口でない物。
 *  PC（Bridge）の印で解けた要求には付けない（印は getSession を通らない） */
export function shouldTime(path: string, method: string, status: number, count: DbCount): boolean {
  if (method === "GET" && PUBLIC_TIMING_PATHS.includes(path)) return true;
  if (AUTH_PATHS.test(path) && !(method === "GET" && AUTH_SESSION_READS.includes(path))) return false;
  return count.session === true && status !== 401;
}

/** createApp の最初の middleware。数え器は全部の要求で始め、頭は shouldTime の答えにだけ付ける */
export function serverTiming(): MiddlewareHandler {
  return async (c, next) => {
    const count: DbCount = { statements: 0, ms: 0 };
    await withDbCount(count, () => next());
    if (!shouldTime(c.req.path, c.req.method, c.res.status, count)) return;
    const value = serverTimingValue(count);
    try {
      c.res.headers.set(SERVER_TIMING, value);
    } catch {
      // 頭を変えられない答え（外から受け取った Response）は写して付け直す
      c.res = new Response(c.res.body, c.res);
      c.res.headers.set(SERVER_TIMING, value);
    }
  };
}
