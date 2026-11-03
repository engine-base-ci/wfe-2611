// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.post("/api/v1/bridge/jobs/:id/conversation-entries", op(deps, "mirrorConversationEntries"));
  app.post("/api/v1/bridge/jobs/:id/questions", op(deps, "askFromBridge"));
  app.get("/api/v1/bridge/jobs/:id/questions/:qid", op(deps, "getBridgeQuestionAnswer"));
  app.post("/api/v1/client_requests/:id/reply", op(deps, "replyToClientRequest"));
  app.get("/api/v1/conversations/:id/messages", op(deps, "listConversationMessages"));
  app.post("/api/v1/conversations/:id/messages", op(deps, "sendConversationMessage"));
  app.post("/api/v1/conversations/:id/permissions/:pid", op(deps, "answerAgentPermission"));
  app.post("/api/v1/conversations/:id/stop", op(deps, "stopConversation"));
  app.post("/api/v1/inquiries/:id/messages", op(deps, "postInquiryMessage"));
  app.get("/api/v1/knowledge_pages/:id/messages", op(deps, "listKnowledgeMessages"));
  app.post("/api/v1/knowledge_pages/:id/messages", op(deps, "postKnowledgeMessage"));
  app.post("/api/v1/ops/inquiries/:id/notes", op(deps, "addOpsInquiryNote"));
  app.post("/api/v1/ops/inquiries/:id/replies", op(deps, "replyOpsInquiry"));
  app.post("/api/v1/portal/requests/:id/messages", op(deps, "postPortalRequestMessage"));
  app.post("/api/v1/tickets/:id/agent-session/messages", op(deps, "sendTicketAgentMessage"));
}
