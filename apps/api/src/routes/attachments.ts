// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/bridge/files/:ref", op(deps, "getFileForBridge"));
  app.post("/api/v1/conversations/:id/attachments", op(deps, "createConversationAttachment"));
  app.post("/api/v1/inquiries/attachments", op(deps, "uploadInquiryAttachment"));
  app.post("/api/v1/knowledge_pages/:id/attachments", op(deps, "uploadKnowledgeAttachment"));
  app.post("/api/v1/portal/attachments", op(deps, "uploadPortalAttachment"));
  app.post("/api/v1/tickets/:id/attachments", op(deps, "createTicketAttachment"));
}
