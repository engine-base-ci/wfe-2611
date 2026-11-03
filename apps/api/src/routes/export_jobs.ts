// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.post("/api/v1/clones/me/activity/export", op(deps, "exportCloneActivity"));
  app.post("/api/v1/exports", op(deps, "createExport"));
  app.get("/api/v1/exports/:id", op(deps, "getExport"));
  app.post("/api/v1/ops/invoices/export", op(deps, "exportOpsInvoices"));
  app.post("/api/v1/ops/workspaces/export", op(deps, "exportOpsWorkspaces"));
}
