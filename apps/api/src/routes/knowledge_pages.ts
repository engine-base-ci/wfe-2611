// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.post("/api/v1/knowledge/ask", op(deps, "askKnowledge"));
  app.get("/api/v1/knowledge/home", op(deps, "getKnowledgeHome"));
  app.get("/api/v1/knowledge/link-targets", op(deps, "searchKnowledgeLinkTargets"));
  app.get("/api/v1/knowledge/tree", op(deps, "getKnowledgeTree"));
  app.get("/api/v1/knowledge/verifications", op(deps, "listKnowledgeVerifications"));
  app.get("/api/v1/knowledge_pages", op(deps, "listKnowledgePages"));
  app.post("/api/v1/knowledge_pages", op(deps, "createKnowledgePage"));
  app.get("/api/v1/knowledge_pages/:id", op(deps, "getKnowledgePage"));
  app.patch("/api/v1/knowledge_pages/:id", op(deps, "updateKnowledgePage"));
  app.post("/api/v1/knowledge_pages/:id/archive", op(deps, "archiveKnowledgePage"));
  app.get("/api/v1/knowledge_pages/:id/markdown", op(deps, "exportKnowledgeMarkdown"));
  app.post("/api/v1/knowledge_pages/:id/unarchive", op(deps, "unarchiveKnowledgePage"));
  app.post("/api/v1/knowledge_pages/:id/verify", op(deps, "verifyKnowledgePage"));
}
