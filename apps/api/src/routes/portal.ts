// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/portal", op(deps, "getPortalHome"));
  app.post("/api/v1/portal/attachments", op(deps, "uploadPortalAttachment"));
  app.get("/api/v1/portal/notices", op(deps, "listPortalNotices"));
  app.post("/api/v1/portal/requests", op(deps, "createPortalRequest"));
  app.post("/api/v1/portal/requests/questions", op(deps, "askPortalRequestQuestions"));
  app.get("/api/v1/portal/requests/:id", op(deps, "getPortalRequest"));
  app.post("/api/v1/portal/requests/:id/messages", op(deps, "postPortalRequestMessage"));
  app.get("/api/v1/portal/tickets/:id", op(deps, "getPortalTicket"));
}
