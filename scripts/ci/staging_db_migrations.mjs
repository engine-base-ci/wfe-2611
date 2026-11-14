// staging の DB から、当たっている migration の名前を読むだけの台本（K-200）。
// 標準出力は名前の並びの JSON 1 行だけ（scripts/ci/staging_health.py の --applied に渡す）。
// 書かない：読むだけの取引の中で 1 回読んで閉じる。値・接続先・例外の写しは、どの終わり方でも出さない。
// 終わりの値：0＝読めた／1＝読めない（つながらない・断られた・部品が無い）／2＝環境の値が無い（つながない）
import { createRequire } from "node:module";

const WAIT_MS = 15000; // つなぐ待ちと文の待ちの上限
const EXIT_UNREADABLE = 1;
const EXIT_NO_VALUE = 2;
const UNREADABLE = "★ staging の DB から migration の一覧を読めない（つながらない・断られた・部品が無い。中身は出さない）";

function stop(message, code) {
  console.error(message);
  process.exit(code);
}

// 思わぬ失敗でも、例外の写し（接続先が入りうる）を出さずに決まった 1 行で終わる
process.on("uncaughtException", () => stop(UNREADABLE, EXIT_UNREADABLE));
process.on("unhandledRejection", () => stop(UNREADABLE, EXIT_UNREADABLE));

const url = process.env.STAGING_DATABASE_ADMIN_URL;
if (!url || !url.trim()) {
  stop("★ 環境の値が無い：STAGING_DATABASE_ADMIN_URL", EXIT_NO_VALUE);
}

let client;
try {
  const pg = createRequire(new URL("../../packages/db/package.json", import.meta.url))("pg");
  client = new pg.Client({
    connectionString: url.trim(),
    connectionTimeoutMillis: WAIT_MS,
    statement_timeout: WAIT_MS,
    query_timeout: WAIT_MS,
  });
  client.on("error", () => {}); // 切れたときの知らせは、待っている文の失敗として下の catch に届く
  await client.connect();
  await client.query("begin transaction read only");
  const result = await client.query("select name from app.schema_migrations order by name");
  await client.query("rollback");
  const names = result.rows.map((row) => row.name);
  if (!names.every((name) => typeof name === "string")) {
    throw new Error("unexpected row");
  }
  await client.end();
  process.stdout.write(JSON.stringify(names) + "\n");
} catch {
  try {
    await client?.end();
  } catch {
    // 閉じられなくても終わりの値は変えない
  }
  stop(UNREADABLE, EXIT_UNREADABLE);
}
