import { Hono } from "hono";
import { MIGRATIONS, checkMigrationOrder } from "@kaname/db";

// 独立 API 層（Hono）。画面は API を叩くだけ（Server Actions に業務ロジックを置かない）。
// endpoint は T-A-* が 08_api/openapi.yaml どおりに足す。ここは起動時の存在確認（G-11）の入口だけ。
export interface Health {
  ok: boolean;
  version: string;
  migrations: { expected: readonly string[]; order: "ok" | "ng" };
}

export function health(version = "0.1.0"): Health {
  const order = checkMigrationOrder(MIGRATIONS);
  return { ok: order.ok, version, migrations: { expected: MIGRATIONS, order: order.ok ? "ok" : "ng" } };
}

export function createApp(version = "0.1.0"): Hono {
  const app = new Hono();
  app.get("/health", (c) => {
    const h = health(version);
    return c.json(h, h.ok ? 200 : 503);
  });
  return app;
}
