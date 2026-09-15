import { Hono } from "hono";
import { MIGRATIONS, checkMigrationOrder } from "@kaname/db";
import type { Repository } from "@kaname/db/repository";
import { tenantContext, type SessionResolver, type Vars } from "./middleware/tenant.js";

// 独立 API 層（Hono）。画面は API を叩くだけ。endpoint は T-A-* が 08_api/openapi.yaml どおりに足す（routes/ 配下・c.get("repo") 経由）。
export interface Health {
  ok: boolean;
  version: string;
  migrations: { expected: readonly string[]; order: "ok" | "ng" };
}

export function health(version = "0.1.0"): Health {
  const order = checkMigrationOrder(MIGRATIONS);
  return { ok: order.ok, version, migrations: { expected: MIGRATIONS, order: order.ok ? "ok" : "ng" } };
}

export interface AppOptions {
  version?: string;
  repo?: Repository;
  resolveSession?: SessionResolver;
}

export function createApp(o: AppOptions | string = {}): Hono<Vars> {
  const opts = typeof o === "string" ? { version: o } : o;
  const app = new Hono<Vars>();
  app.get("/health", (c) => {
    const h = health(opts.version ?? "0.1.0");
    return c.json(h, h.ok ? 200 : 503);
  });
  // /api/v1 配下は全部テナント文脈を通る（SET LOCAL の網羅＝G6）。repo が無い起動は文脈だけ入れる
  if (opts.repo) app.use("/api/*", tenantContext(opts.repo, opts.resolveSession));
  return app;
}
