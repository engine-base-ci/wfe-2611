// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/clients/link-candidates", op(deps, "listClientLinkCandidates"));
  app.get("/api/v1/portal/tickets/:id", op(deps, "getPortalTicket"));
  app.get("/api/v1/scopes/:id/overview", op(deps, "getScopeOverview"));
  app.get("/api/v1/search", op(deps, "search"));
  app.get("/api/v1/tickets", op(deps, "listTickets"));
  app.post("/api/v1/tickets", op(deps, "createTicket"));
  app.get("/api/v1/tickets/:id", op(deps, "getTicket"));
  app.patch("/api/v1/tickets/:id", op(deps, "updateTicket"));
  app.delete("/api/v1/tickets/:id", op(deps, "deleteTicket"));
  app.patch("/api/v1/tickets/:id/client-share", op(deps, "updateTicketClientShare"));
  app.post("/api/v1/tickets/:id/complete", op(deps, "completeTicket"));
  app.get("/api/v1/tickets/:id/delete-preview", op(deps, "previewTicketDelete"));
  app.get("/api/v1/tickets/:id/kind-change-preview", op(deps, "previewTicketKindChange"));
  app.post("/api/v1/tickets/:id/restore", op(deps, "restoreTicket"));
  app.post("/api/v1/tickets/bulk", op(deps, "bulkUpdateTickets"));
}
