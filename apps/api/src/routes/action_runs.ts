// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/action_runs/:id", op(deps, "getActionRun"));
  app.post("/api/v1/action_runs/:id/retry", op(deps, "retryActionRun"));
  app.post("/api/v1/action_runs/:id/stop", op(deps, "stopActionRun"));
  app.post("/api/v1/action_runs/:id/takeover", op(deps, "takeoverActionRun"));
  app.post("/api/v1/bridge/jobs/:id/tools/:name", op(deps, "callKanameTool"));
  app.get("/api/v1/clones/me/activity", op(deps, "listCloneActivity"));
  app.get("/api/v1/clones/me/growth", op(deps, "getCloneGrowth"));
  app.get("/api/v1/clones/me/now", op(deps, "getCloneNow"));
  app.post("/api/v1/tickets/:id/delegate", op(deps, "delegateTicket"));
  app.post("/api/v1/tickets/:id/dry-run", op(deps, "dryRunTicket"));
  app.get("/api/v1/tickets/:id/runs", op(deps, "listTicketRuns"));
}
