// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/clients", op(deps, "listClients"));
  app.post("/api/v1/clients", op(deps, "createClient"));
  app.get("/api/v1/clients/:id", op(deps, "getClient"));
  app.patch("/api/v1/clients/:id", op(deps, "updateClient"));
  app.get("/api/v1/clients/:id/portal-preview", op(deps, "getClientPortalPreview"));
  app.patch("/api/v1/clients/:id/share", op(deps, "updateClientShare"));
}
