// staging の DB から、当たっている migration の名前を読むだけの台本（K-200）。
// 標準出力は名前の並びの JSON 1 行だけ（scripts/ci/staging_health.py の --applied に渡す）。
// 書かない：読むだけの取引の中で 1 回読んで閉じる。値・接続先・例外の写しは、どの終わり方でも出さない。
// TLS：手元（127.0.0.1・localhost）のほかは必ず TLS でつなぎ、証明書を確かめる。接続の文字列で外す指定は受け付けない。
// 終わりの値：0＝読めた／1＝読めない（つながらない・断られた・部品が無い・接続の文字列の形が違う）／2＝環境の値が無い（つながない）
import { createRequire } from "node:module";

const WAIT_MS = 15000; // つなぐ待ちと文の待ちの上限
const EXIT_UNREADABLE = 1;
const EXIT_NO_VALUE = 2;
const DEFAULT_PORT = 5432;
const LOOPBACK = ["127.0.0.1", "localhost"]; // 試験の作りものの口だけ TLS なしを許す
const SCHEMES = ["postgres:", "postgresql:"];
const STRICT_SSLMODES = ["require", "verify-ca", "verify-full"]; // どれも「TLS で証明書を確かめる」として扱う
const UNREADABLE = "★ staging の DB から migration の一覧を読めない（つながらない・断られた・部品が無い。中身は出さない）";
const BAD_SHAPE =
  "★ 接続の文字列の形を受け付けない（postgres の住所で、付けてよい指定は sslmode の require・verify-ca・verify-full だけ。TLS を外す指定は受け付けない。中身は出さない）";

function stop(message, code) {
  console.error(message);
  process.exit(code);
}

// 思わぬ失敗でも、例外の写し（接続先が入りうる）を出さずに決まった 1 行で終わる
process.on("uncaughtException", () => stop(UNREADABLE, EXIT_UNREADABLE));
process.on("unhandledRejection", () => stop(UNREADABLE, EXIT_UNREADABLE));

// 接続の文字列を自分で読む（部品の読み方に任せると、sslmode の書き方で TLS の確かめが外れる）。受け付けない形は null
function connectionConfig(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const params = [...parsed.searchParams.entries()];
  const onlyStrictSslmode = params.every(([key, value]) => key === "sslmode" && STRICT_SSLMODES.includes(value));
  if (!SCHEMES.includes(parsed.protocol) || !parsed.hostname || !onlyStrictSslmode || parsed.hash) {
    return null;
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  return {
    host,
    port: parsed.port ? Number(parsed.port) : DEFAULT_PORT,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.slice(1)) || undefined,
    ssl: LOOPBACK.includes(host) ? false : { rejectUnauthorized: true },
  };
}

const url = process.env.STAGING_DATABASE_ADMIN_URL;
if (!url || !url.trim()) {
  stop("★ 環境の値が無い：STAGING_DATABASE_ADMIN_URL", EXIT_NO_VALUE);
}
let config = null;
try {
  config = connectionConfig(url.trim());
} catch {
  config = null;
}
if (!config) {
  stop(BAD_SHAPE, EXIT_UNREADABLE);
}

let client;
try {
  const pg = createRequire(new URL("../../packages/db/package.json", import.meta.url))("pg");
  client = new pg.Client({
    ...config,
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
