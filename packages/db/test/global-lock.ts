// 試験の DB は 1 回の試験の間、1 つの vitest だけが使う（vitest.config.ts の globalSetup）。
//   DB の試験は表を種で入れ替える（seedAccessMatrix が tenants を truncate する）ので、別の vitest（別の段・別の端末）が同じ DB を
//   同時に使うと、互いの種を消し合って重複キー・FK 違反・行が無いの偽の赤になる（dagci で G3 と G27 が同じ Postgres に当たった・2026-11-04）。
//   同じ DB に勧告ロックを取り、取れなければ取れるまで待つ（誰が持っているかを出す）。黙って混ざらない
import type PgModule from "pg";
import { createRequire } from "node:module";
import { hostname } from "node:os";

// globalSetup は根（vitest.config.ts）から読まれ、根には pg が無い（pnpm は包みごと）。packages/db の pg をこのファイルの場所から引く
const pg = createRequire(import.meta.url)("pg") as typeof PgModule;

const LOCK_KEY = 0x6b616e61; // "kana"。この DB の試験の全体で 1 つ
const APP_NAME = `kaname-vitest ${hostname()} pid=${process.pid}`;

export default async function setup(): Promise<(() => Promise<void>) | void> {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    // DB を使わない検査（ci:authz など）。DB の試験が混ざっていれば、その試験が接続先の無いことで落ちる
    console.warn("[db-lock] DATABASE_URL が無い：DB の試験の排他は取らない（DB の試験は流れない）");
    return;
  }
  const c = new pg.Client({ connectionString: url, application_name: APP_NAME });
  try {
    await c.connect();
  } catch (e) {
    // DB が無い手元で DB を使わない試験だけを流す場合。DB の試験はそれぞれの接続で落ちる
    console.warn(`[db-lock] DB につながらない（${(e as Error).message}）：排他は取らない`);
    await c.end().catch(() => undefined);
    return;
  }
  let told = false;
  for (;;) {
    const r = await c.query<{ ok: boolean }>("select pg_try_advisory_lock($1) as ok", [LOCK_KEY]);
    if (r.rows[0]!.ok) break;
    if (!told) {
      const who = await c.query<{ name: string; since: string }>(
        `select a.application_name as name, a.backend_start::text as since
           from pg_locks l join pg_stat_activity a on a.pid = l.pid
          where l.locktype = 'advisory' and l.objid = $1 and l.granted and l.database = (select oid from pg_database where datname = current_database())`,
        [LOCK_KEY],
      );
      const h = who.rows[0];
      console.warn(
        `[db-lock] 別の試験がこの DB を使っている（${h ? `${h.name}・${h.since} から` : "持ち主は不明"}）。終わるまで待つ`,
      );
      told = true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return async () => {
    await c.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => undefined);
    await c.end().catch(() => undefined);
  };
}
