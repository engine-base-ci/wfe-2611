// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.patch("/api/v1/ticket_messages/:id", op(deps, "updateTicketMessage"));
  app.delete("/api/v1/ticket_messages/:id", op(deps, "deleteTicketMessage"));
  app.post("/api/v1/ticket_messages/:id/star", op(deps, "starTicketMessage"));
}
