import { Hono } from "hono";
import { cors } from "hono/cors";
import { MIGRATIONS, checkMigrationOrder } from "@kaname/db";
import type { Repository } from "@kaname/db/repository";
import { tenantContext, type SessionResolver, type Vars } from "./middleware/tenant.js";
import type { Auth } from "@kaname/auth";
import type { Resolved } from "@kaname/auth/resolver";
import { KanameError, recordErrorEvent } from "@kaname/errors";
import { ENDPOINTS } from "@kaname/contracts";
import { registerAll } from "./routes/index.js";
import { defaultDeps } from "./contract/memory.js";
import type { ContractDeps } from "./contract/deps.js";

// 独立 API 層（Hono）。画面は API を叩くだけ。endpoint は T-A-* が 08_api/openapi.yaml どおりに足す（routes/ 配下・c.get("repo") 経由）。
export interface Health {
  ok: boolean;
  version: string;
  migrations: { expected: readonly string[]; order: "ok" | "ng" };
}

const CONTRACT_PATHS = ENDPOINTS.map((e) => ({
  method: e.method,
  re: new RegExp(`^${e.path.replace(/:[a-z_]+/gi, "[^/]+")}$`),
}));

export function health(version = "0.1.0"): Health {
  const order = checkMigrationOrder(MIGRATIONS);
  return { ok: order.ok, version, migrations: { expected: MIGRATIONS, order: order.ok ? "ok" : "ng" } };
}

export interface AppOptions {
  version?: string;
  repo?: Repository;
  resolveSession?: SessionResolver;
  /** 認証（Better Auth）。/api/auth/* をこの handler に渡す */
  auth?: Auth;
  /** 要求の headers → 文脈（packages/auth の createSessionResolver）。resolveSession より優先 */
  resolve?: (headers: Headers) => Promise<Resolved | null>;
  /** 契約の route（08_api/openapi.yaml の 56 endpoint）。repo があれば既定で登録。hooks／上限／冪等の器を差し込める */
  contract?: Partial<ContractDeps> | false;
  /** 認証の拡張（/api/auth-ext/*：登録・ロック付きログイン・招待・Bridge の接続コード・資格情報を預ける） */
  authExt?: Hono;
  /** 画面の origin（別 origin から Bearer で呼ぶ。Cookie は使わない） */
  /** 画面の出どころ（"," 区切りで複数可）。CORS の許可元 */
  corsOrigin?: string | null;
}

export function createApp(o: AppOptions | string = {}): Hono<Vars> {
  const opts = typeof o === "string" ? { version: o } : o;
  const app = new Hono<Vars>();
  if (opts.corsOrigin)
    app.use(
      "/api/*",
      cors({
        // 画面の出どころは 1 つとは限らない（本番・staging・プレビュー）。WEB_BASE_URL は "," 区切りで複数書ける
        origin: opts.corsOrigin
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        allowHeaders: [
          "authorization",
          "content-type",
          "idempotency-key",
          "x-screen-id",
          "x-tenant-id",
          "x-signup-token",
        ], // x-signup-token：登録の申し込みの印（K-51）
        exposeHeaders: ["set-auth-token", "content-disposition"], // 成果物を落とすときのファイル名（D-106.7）
        credentials: true,
        maxAge: 600,
      }),
    );
  app.get("/health", (c) => {
    const h = health(opts.version ?? "0.1.0");
    return c.json(h, h.ok ? 200 : 503);
  });
  // 認証の endpoint（sign-in／sign-up／2 段階／セッション）。境界 B2 の handler にそのまま渡す
  if (opts.auth) app.on(["GET", "POST"], "/api/auth/*", (c) => opts.auth!.handler(c.req.raw));
  if (opts.authExt) app.route("/api/auth-ext", opts.authExt);
  // /api/* 配下は全部テナント文脈を通る（SET LOCAL の網羅＝G6）
  const resolver: SessionResolver | undefined = opts.resolve
    ? async (c) => (await opts.resolve!(c.req.raw.headers))?.ctx ?? null
    : opts.resolveSession;
  if (opts.repo) app.use("/api/*", tenantContext(opts.repo, resolver));
  if (opts.repo && opts.contract !== false) registerAll(app, defaultDeps(opts.contract ?? {}));
  // 契約にある道すじに、契約に無いメソッド（TRACE など）で来たら 405 と使えるメソッド（Allow）を返す（404 にしない・K-35）
  app.notFound((c) => {
    const allow = [...new Set(CONTRACT_PATHS.filter((p) => p.re.test(c.req.path)).map((p) => p.method))];
    if (allow.length)
      return c.json({ error: "method_not_allowed", code: "METHOD_NOT_ALLOWED" }, 405, { allow: allow.join(", ") });
    return c.json({ error: "not_found", code: "NOT_FOUND" }, 404);
  });
  // エラーは正本（errors.json）の 1 件として返す（D-069）。出た記録は error_events に（文脈があるときだけ）。正本に無い例外は 500・文言を作らない
  app.onError(async (err, c) => {
    if (err instanceof KanameError) {
      const ctx = c.get("ctx");
      let eventId: string | null = null;
      if (opts.repo && ctx) {
        try {
          eventId = await recordErrorEvent(opts.repo, ctx, err.code, c.req.header("x-screen-id") ?? null, {
            path: c.req.path,
          });
        } catch {
          eventId = null; // 記録に失敗しても応答は返す（記録の失敗で二重に落とさない）
        }
      }
      return c.json({ ...err.toJSON(), event_id: eventId }, err.status as 400);
    }
    console.error("[api] 500", c.req.method, c.req.path, err instanceof Error ? (err.stack ?? err.message) : err); // 詳細はログにだけ（応答には出さない）
    return c.json(
      {
        error: "internal",
        code: null,
        message: null,
        action: null,
        support_code: c.req.header("x-request-id") ?? null,
      },
      500,
    );
  });
  return app;
}
