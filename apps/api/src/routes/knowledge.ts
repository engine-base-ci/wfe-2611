// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/knowledge/approvals", op(deps, "listKnowledgeApprovals"));
  app.post("/api/v1/knowledge/folders", op(deps, "createKnowledgeFolder"));
  app.patch("/api/v1/knowledge/folders/:id", op(deps, "updateKnowledgeFolder"));
  app.delete("/api/v1/knowledge/folders/:id", op(deps, "deleteKnowledgeFolder"));
  app.delete("/api/v1/knowledge/requests/:id", op(deps, "withdrawKnowledgeRequest"));
  app.post("/api/v1/knowledge/requests/:id/approve", op(deps, "approveKnowledgeRequest"));
  app.post("/api/v1/knowledge/requests/:id/decline", op(deps, "declineKnowledgeRequest"));
  app.post("/api/v1/knowledge/requests/:id/dismiss", op(deps, "dismissKnowledgeRequest"));
  app.get("/api/v1/knowledge/review", op(deps, "getKnowledgeReview"));
  app.get("/api/v1/knowledge/shares", op(deps, "getKnowledgeShares"));
  app.put("/api/v1/knowledge/shares", op(deps, "setKnowledgeShares"));
  app.post("/api/v1/knowledge/similar", op(deps, "findSimilarKnowledge"));
  app.get("/api/v1/knowledge/tree", op(deps, "getKnowledgeTree"));
}
