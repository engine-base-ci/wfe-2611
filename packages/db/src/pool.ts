// 接続プール（関門 C2 の中で 1 つだけ）。1 要求 1 接続以下・上限は待機列（G-16）。専用接続は台帳登録制（choke-point-exceptions.md）。
// 並ぶ時間と、接続を作る時間は別の上限にする（L-023）：pg-pool の connectionTimeoutMillis は「空きを待つ」にも効くので、
// 上限まで埋まった後に来た要求は 5 秒で断られていた。並ぶのはこの関門の待機列（queueTimeoutMs）で、
// 枠を受け取ってから pg-pool の connect を呼ぶ（このときは作る時間だけが connectionTimeoutMillis に当たる）。
import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import pg from "pg";

// 日付（date）は文字列のまま返す（K-35）。Date にすると、サーバーの時刻の帯で前の日に化ける（Asia/Tokyo の 0 時 → 前日 15 時 Z）。契約は format: date
pg.types.setTypeParser(1082, (v: string) => v);

export interface PoolOptions {
  databaseUrl: string;
  max?: number;
  statementTimeoutMs?: number;
  /** 空きを待つ上限（既定 30 秒）。超えたら理由つきで断る */
  queueTimeoutMs?: number;
  /** 接続を新しく作る上限（既定 5 秒） */
  connectTimeoutMs?: number;
}

/** 数を数える待機列。take は枠を 1 つ受け取るまで待つ（timeoutMs を超えたら断る）、give は返す */
function slots(size: number) {
  let free = size;
  const waiting: { go: () => void; timer: NodeJS.Timeout }[] = [];
  return {
    take(timeoutMs: number): Promise<void> {
      if (free > 0) {
        free -= 1;
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        const w = {
          go: () => {
            clearTimeout(w.timer);
            resolve();
          },
          timer: setTimeout(() => {
            const i = waiting.indexOf(w);
            if (i >= 0) waiting.splice(i, 1);
            reject(new Error(`DB の接続の順番待ちが ${timeoutMs} ms を超えた（G-16）`));
          }, timeoutMs),
        };
        waiting.push(w);
      });
    },
    give(): void {
      const next = waiting.shift();
      if (next)
        next.go(); // 枠はそのまま次の人へ渡す
      else free += 1;
    },
  };
}

type ConnectCb = (err: Error | undefined, client?: pg.PoolClient, done?: (release?: unknown) => void) => void;

/** 1 要求の DB の数え（K-237）。文の数と、文が答えるまでにかかった時間の合計（ms） */
export interface DbCount {
  statements: number;
  ms: number;
  /** この要求でログインのセッションが解けた（markDbSession が立てる）。Server-Timing はこれが立った答えにだけ付ける */
  session?: boolean;
}

const counting = new AsyncLocalStorage<DbCount>();

/** fn の中（その非同期の続きも）で、数える印の付いたプールの接続が流した文を count に足す。数え器の外（起動・ジョブ）では数えない */
export function withDbCount<T>(count: DbCount, fn: () => T): T {
  return counting.run(count, fn);
}

/** 今の要求の数え器に「セッションが解けた」印を立てる（数え器の外では何もしない） */
export function markDbSession(): void {
  const count = counting.getStore();
  if (count) count.session = true;
}

type Query = (...a: unknown[]) => unknown;
const COUNTED = Symbol("k-db-counted");

/** 接続の query を 1 回だけ包む。流す文・引数・答えは変えず、数え器が在るときだけ文の数と時間を足す */
function countClient(client: pg.PoolClient): pg.PoolClient {
  const c = client as pg.PoolClient & { [COUNTED]?: true };
  if (c[COUNTED]) return client;
  const orig = c.query.bind(c) as Query;
  (c as unknown as { query: Query }).query = (...a: unknown[]) => {
    const count = counting.getStore();
    if (!count) return orig(...a);
    count.statements += 1;
    const t0 = performance.now();
    const done = () => {
      count.ms += performance.now() - t0;
    };
    const last = a.length - 1;
    if (last >= 0 && typeof a[last] === "function") {
      const cb = a[last] as (...r: unknown[]) => unknown;
      a[last] = (...r: unknown[]) => {
        done();
        return cb(...r);
      };
      return orig(...a);
    }
    const out = orig(...a);
    if (out && typeof (out as Promise<unknown>).then === "function") (out as Promise<unknown>).then(done, done);
    return out;
  };
  c[COUNTED] = true;
  return client;
}

/** プールが貸す接続（connect の両方の形・pool.query も中でこれを呼ぶ）を数える形にする。createPool のプールと認証のプールに掛ける */
export function countQueries(pool: pg.Pool): pg.Pool {
  const p = pool as unknown as { connect: (cb?: ConnectCb) => Promise<pg.PoolClient> | undefined };
  const orig = p.connect.bind(pool) as (cb?: ConnectCb) => Promise<pg.PoolClient> | undefined;
  // コールバックの形（pool.query が中で使う）は、呼び手の文脈に縛ってから渡す。素の pg.Pool は空いた接続を
  //   別の要求の release の中で配るので、縛らないとコールバックの中の client.query が別の要求の数え器に足される（K-237・Q の指摘 2）
  p.connect = (cb?: ConnectCb) =>
    cb
      ? orig(
          AsyncResource.bind((err: Error | undefined, client?: pg.PoolClient, done?: (release?: unknown) => void) =>
            cb(err, client ? countClient(client) : client, done),
          ),
        )
      : (orig() as Promise<pg.PoolClient>).then(countClient);
  return pool;
}

export function createPool(o: PoolOptions): pg.Pool {
  const max = o.max ?? 10;
  const pool = new pg.Pool({
    connectionString: o.databaseUrl,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: o.connectTimeoutMs ?? 5_000,
    statement_timeout: o.statementTimeoutMs ?? 15_000, // 黙って固まらない（G-15）
  });
  pool.on("error", (e) => {
    console.error("[db pool] idle client error", e.message);
  });
  const gate = slots(max);
  const queueTimeout = o.queueTimeoutMs ?? 30_000;
  const realConnect = pool.connect.bind(pool) as () => Promise<pg.PoolClient>;
  const acquire = async (): Promise<pg.PoolClient> => {
    await gate.take(queueTimeout);
    let client: pg.PoolClient;
    try {
      client = await realConnect();
    } catch (e) {
      gate.give();
      throw e;
    }
    const release = client.release.bind(client);
    let returned = false;
    client.release = ((err?: Error | boolean) => {
      if (!returned) {
        returned = true;
        gate.give();
      }
      return release(err);
    }) as typeof client.release;
    return client;
  };
  // pool.query も内部でこの connect（コールバック形）を呼ぶので、両方の形を受ける
  (pool as unknown as { connect: (cb?: ConnectCb) => Promise<pg.PoolClient> | undefined }).connect = (
    cb?: ConnectCb,
  ) => {
    if (!cb) return acquire();
    acquire().then(
      (client) => cb(undefined, client, (r) => client.release(r as Error | undefined)),
      (err: Error) => cb(err),
    );
    return undefined;
  };
  return countQueries(pool);
}
