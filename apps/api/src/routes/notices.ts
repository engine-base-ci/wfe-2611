// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/notices", op(deps, "listNotices"));
  app.get("/api/v1/ops/notices", op(deps, "listOpsNotices"));
  app.post("/api/v1/ops/notices", op(deps, "createOpsNotice"));
  app.get("/api/v1/ops/notices/:id", op(deps, "getOpsNotice"));
  app.patch("/api/v1/ops/notices/:id", op(deps, "updateOpsNotice"));
  app.post("/api/v1/ops/notices/:id/publish", op(deps, "publishOpsNotice"));
  app.post("/api/v1/ops/workspaces/:id/notices", op(deps, "sendWorkspaceNotice"));
  app.get("/api/v1/portal/notices", op(deps, "listPortalNotices"));
}
