// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.post("/api/v1/memories/:id/promote", op(deps, "promoteMemoryToRule"));
  app.get("/api/v1/rules", op(deps, "listRules"));
  app.post("/api/v1/rules", op(deps, "createRule"));
  app.get("/api/v1/rules/:id", op(deps, "getRule"));
  app.patch("/api/v1/rules/:id", op(deps, "updateRule"));
  app.delete("/api/v1/rules/:id", op(deps, "deleteRule"));
  app.post("/api/v1/rules/check", op(deps, "checkRule"));
  app.post("/api/v1/workspace/escalation-rules", op(deps, "createEscalationRule"));
  app.patch("/api/v1/workspace/escalation-rules/:id", op(deps, "updateEscalationRule"));
  app.delete("/api/v1/workspace/escalation-rules/:id", op(deps, "deleteEscalationRule"));
  app.post("/api/v1/workspace/escalation-rules/preview", op(deps, "previewEscalationRule"));
  app.get("/api/v1/workspace/rules", op(deps, "getWorkspaceRules"));
  app.post("/api/v1/workspace/rules", op(deps, "createWorkspaceRule"));
  app.patch("/api/v1/workspace/rules/:id", op(deps, "updateWorkspaceRule"));
  app.delete("/api/v1/workspace/rules/:id", op(deps, "deleteWorkspaceRule"));
}
