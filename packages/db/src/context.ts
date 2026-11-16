// テナント文脈（関門 C2）。要求ごとに 1 トランザクションを開き、SET LOCAL app.tenant_id / app.user_id / app.role を入れてから中を実行する。
// これを通らない読み書きは RLS で 0 行（FND-02-002 上流を故意に壊す）。
import { AsyncLocalStorage } from "node:async_hooks";
import type pg from "pg";
import { UUID_RE } from "./id.js";

export interface TenantContext {
  tenantId: string | null; // null = 運営（会社をまたぐ）
  userId: string | null; // members.id
  role: "member" | "ops" | "client" | "device" | "anonymous";
  /** 直前の本人確認の時刻（sessions.step_up_at・K-14）。無ければ未確認 */
  stepUpAt?: Date | null;
  /** PC の印で来た要求の、その PC の行（sessions.id・role: device のときだけ・K-57） */
  sessionId?: string | null;
}

const UUID = UUID_RE; // 正式な uuid の正本（id.ts・K-145）

export function assertContext(ctx: TenantContext): void {
  if (ctx.tenantId !== null && !UUID.test(ctx.tenantId)) throw new Error("tenantId が uuid でない");
  if (ctx.userId !== null && !UUID.test(ctx.userId)) throw new Error("userId が uuid でない");
  if (ctx.role === "member" && (ctx.tenantId === null || ctx.userId === null))
    throw new Error("member の文脈には tenantId と userId が要る");
}

// set_config は値をパラメータで渡せる（文字列連結しない・G10）
const SET_CONTEXT =
  "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', $3, true)";
const contextParams = (ctx: TenantContext) => [ctx.tenantId ?? "", ctx.userId ?? "", ctx.role];

/** 要求の取引（K-234）：1 つの要求の withTenant を 1 本の接続・1 つの取引にまとめる。最初の withTenant で開く（遅く開く） */
interface RequestTx {
  readonly pool: pg.Pool;
  readonly ctx: TenantContext;
  /** 開いた（begin・set_config を流した）接続。開くまで null */
  client: pg.PoolClient | null;
  /** 開いている途中の約束（同時に来ても開くのは 1 回） */
  opening: Promise<pg.PoolClient> | null;
  /** 順番の尾：入った withTenant は前の呼び出しが終わってから流す */
  tail: Promise<void>;
  /** 要求の取引を閉じた（以後の withTenant は自分の取引で流れる） */
  closed: boolean;
}
/** 入った withTenant の中で流れている間だけ active（中で呼ばれた withTenant は待たずにそのまま流す） */
interface Inside {
  active: boolean;
}
const requestStore = new AsyncLocalStorage<{ tx: RequestTx; inside: Inside | null }>();

const sameContext = (a: TenantContext, b: TenantContext) =>
  a.tenantId === b.tenantId && a.userId === b.userId && a.role === b.role;

async function openTx(tx: RequestTx): Promise<pg.PoolClient> {
  if (tx.client) return tx.client;
  tx.opening ??= (async () => {
    const client = await tx.pool.connect();
    try {
      await client.query("begin");
      await client.query(SET_CONTEXT, contextParams(tx.ctx));
    } catch (e) {
      client.release(e as Error);
      throw e;
    }
    tx.client = client;
    return client;
  })();
  return tx.opening;
}

/** 要求の取引の中で fn を流す（前の呼び出しが終わってから・閉じていれば自分の取引で） */
async function inRequestTx<T>(tx: RequestTx, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const prev = tx.tail;
  let release!: () => void;
  const slot = new Promise<void>((r) => (release = r));
  tx.tail = prev.then(() => slot);
  await prev;
  try {
    if (tx.closed) {
      release();
      return await ownTx(tx.pool, tx.ctx, fn);
    }
    const client = await openTx(tx);
    const inside: Inside = { active: true };
    try {
      return await requestStore.run({ tx, inside }, () => fn(client));
    } finally {
      inside.active = false;
    }
  } finally {
    release();
  }
}

/** 今までどおりの 1 回の取引（接続を借りて begin・set_config・中身・commit） */
async function ownTx<T>(pool: pg.Pool, ctx: TenantContext, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(SET_CONTEXT, contextParams(ctx));
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

/** SET LOCAL は commit/rollback で消える（接続プールに文脈が残らない）。
 *  要求の取引（withRequest）の中で、同じプール・同じ文脈なら、その取引に入って流す（K-234）。ほかは自分の取引 */
export async function withTenant<T>(
  pool: pg.Pool,
  ctx: TenantContext,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  assertContext(ctx);
  const here = requestStore.getStore();
  const tx = here?.tx;
  if (tx && !tx.closed && tx.pool === pool && sameContext(tx.ctx, ctx)) {
    // 入った中でもう一度呼ばれた：待ち合わずにそのまま同じ接続で流す
    if (here.inside?.active && tx.client) return fn(tx.client);
    return inRequestTx(tx, fn);
  }
  return ownTx(pool, ctx, fn);
}

/** 要求の取引（K-234）：fn の中の withTenant（同じプール・同じ文脈）を 1 本の接続・1 つの取引で流す。
 *  取引は最初の withTenant で開く（呼ばれなければ開かない）。fn が終われば閉じ、開いていれば commit（例外なら rollback して投げ直す）。
 *  閉じた後に流れる withTenant（応答の後の処理など）は今までどおり自分の取引で流れる */
export async function withRequest<T>(pool: pg.Pool, ctx: TenantContext, fn: () => Promise<T>): Promise<T> {
  const tx: RequestTx = { pool, ctx, client: null, opening: null, tail: Promise.resolve(), closed: false };
  let out: T;
  try {
    out = await requestStore.run({ tx, inside: null }, fn);
  } catch (e) {
    await closeTx(tx, false);
    throw e;
  }
  await closeTx(tx, true);
  return out;
}

async function closeTx(tx: RequestTx, ok: boolean): Promise<void> {
  tx.closed = true;
  await tx.tail; // 流れている途中の呼び出しが終わるのを待つ（待っていた物は自分の取引に回る）
  if (tx.opening) await tx.opening.catch(() => undefined);
  const client = tx.client;
  if (!client) return;
  tx.client = null;
  try {
    // 例外で止まった取引の commit は、Postgres が rollback として扱う（答えは変わらない）
    await client.query(ok ? "commit" : "rollback");
  } catch (e) {
    client.release(e as Error);
    throw e;
  }
  client.release();
}
