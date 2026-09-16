// 起動時のブート設定（例外 X-002：process.env をここだけが読む）。1 回だけ読み、型付きで配る。顧客の資格情報は絶対に扱わない（それは関門 C8）。
// .env.example が正本。CI G13（ci:env-audit）がここで読む名前と .env.example の整合を検査する。
export interface Config {
  env: "development" | "staging" | "production" | "test";
  databaseUrl: string;
  authDatabaseUrl: string;
  authSecret: string;
  baseUrl: string;
  storage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
  secretsMasterKey: string;
  resendApiKey: string | null;
  /** 画面の URL（メールのリンクの先・CORS）。無ければ null（API と同じ origin） */
  /** 画面の正の出どころ（メールのリンクはここで組む）。WEB_BASE_URL の 1 つ目 */
  webBaseUrl: string | null;
  /** CORS の許可元（WEB_BASE_URL は "," 区切りで複数書ける：本番・staging・プレビュー） */
  webOrigins: string[];
  /** メールの差出人（Resend の送信ドメイン） */
  mailFrom: string;
  port: number;
}
const REQUIRED = [
  "DATABASE_URL",
  "AUTH_DATABASE_URL",
  "AUTH_SECRET",
  "BASE_URL",
  "STORAGE_ENDPOINT",
  "STORAGE_REGION",
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "SECRETS_MASTER_KEY",
] as const;
export { runStartupChecks, assertStartup, type StartupCheck, type StartupReport } from "./startup.js";
export const ENV_KEYS = [
  ...REQUIRED,
  "NODE_ENV",
  "RESEND_API_KEY",
  "PORT",
  "STORAGE_FORCE_PATH_STYLE",
  "DATABASE_ADMIN_URL",
  "KANAME_APP_DB_PASSWORD",
  "KANAME_AUTH_DB_PASSWORD",
  "WEB_BASE_URL",
  "MAIL_FROM",
] as const;
export type EnvKey = (typeof ENV_KEYS)[number];
/** migration が役割に入れるパスワード（T-F-18）。process.env を読むのはここだけ（X-002） */
export function rolePasswords(
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  return {
    KANAME_APP_DB_PASSWORD: env["KANAME_APP_DB_PASSWORD"],
    KANAME_AUTH_DB_PASSWORD: env["KANAME_AUTH_DB_PASSWORD"],
  };
}
/** migration だけが使う管理者の接続（staging／本番）。無ければ null（ローカルは DATABASE_URL が superuser） */
export function adminDatabaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  return env["DATABASE_ADMIN_URL"] || null;
}
/** 任意の名前を 1 つ読む（無ければ null）。migration の管理者 URL など */
export function optionalEnv(name: EnvKey, env: Record<string, string | undefined> = process.env): string | null {
  return env[name] || null;
}
/** 1 つだけ読む（migration の CLI 等、全部の設定が要らない入口用）。無ければ名前を挙げて落ちる */
export function requireEnv(name: EnvKey, env: Record<string, string | undefined> = process.env): string {
  const v = env[name];
  if (!v) throw new Error(`設定が無い: ${name}（.env.example を見る）`);
  return v;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`起動に要る設定が無い: ${missing.join(", ")}（.env.example を見る）`);
  const mk = env["SECRETS_MASTER_KEY"]!;
  if (Buffer.from(mk, "base64").length < 32) throw new Error("SECRETS_MASTER_KEY は base64 で 32 バイト以上");
  const e = (env["NODE_ENV"] ?? "development") as Config["env"];
  if (!["development", "staging", "production", "test"].includes(e)) throw new Error(`NODE_ENV が不明: ${e}`);
  return {
    env: e,
    databaseUrl: env["DATABASE_URL"]!,
    authDatabaseUrl: env["AUTH_DATABASE_URL"]!,
    authSecret: env["AUTH_SECRET"]!,
    baseUrl: env["BASE_URL"]!,
    storage: {
      endpoint: env["STORAGE_ENDPOINT"]!,
      region: env["STORAGE_REGION"]!,
      bucket: env["STORAGE_BUCKET"]!,
      accessKeyId: env["STORAGE_ACCESS_KEY_ID"]!,
      secretAccessKey: env["STORAGE_SECRET_ACCESS_KEY"]!,
      forcePathStyle: (env["STORAGE_FORCE_PATH_STYLE"] ?? "true") === "true",
    },
    secretsMasterKey: mk,
    resendApiKey: env["RESEND_API_KEY"] ?? null,
    webBaseUrl: (env["WEB_BASE_URL"] || "").split(",")[0]?.trim() || null,
    webOrigins: (env["WEB_BASE_URL"] || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    mailFrom: env["MAIL_FROM"] || "Kaname <noreply@kaname.app>",
    port: Number(env["PORT"] ?? 3001),
  };
}
