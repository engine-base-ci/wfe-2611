// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/conversations", op(deps, "listConversations"));
  app.post("/api/v1/conversations", op(deps, "createConversation"));
  app.get("/api/v1/conversations/:id", op(deps, "getConversation"));
  app.patch("/api/v1/conversations/:id", op(deps, "updateConversation"));
  app.delete("/api/v1/conversations/:id", op(deps, "deleteConversation"));
  app.post("/api/v1/conversations/:id/attachments", op(deps, "createConversationAttachment"));
  app.get("/api/v1/conversations/:id/messages", op(deps, "listConversationMessages"));
  app.post("/api/v1/conversations/:id/messages", op(deps, "sendConversationMessage"));
  app.post("/api/v1/conversations/:id/permissions/:pid", op(deps, "answerAgentPermission"));
  app.post("/api/v1/conversations/:id/stop", op(deps, "stopConversation"));
}
