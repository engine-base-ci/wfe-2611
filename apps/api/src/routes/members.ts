// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/members", op(deps, "listMembers"));
  app.get("/api/v1/members/:id", op(deps, "getMember"));
  app.delete("/api/v1/members/:id", op(deps, "removeMember"));
  app.patch("/api/v1/members/:id/groups", op(deps, "updateMemberGroups"));
  app.post("/api/v1/members/:id/nudge", op(deps, "nudgeMember"));
  app.patch("/api/v1/members/:id/permissions", op(deps, "updateMemberPermissions"));
  app.get("/api/v1/members/:id/remove-preview", op(deps, "previewMemberRemoval"));
  app.post("/api/v1/members/:id/resume", op(deps, "resumeMember"));
  app.patch("/api/v1/members/:id/role", op(deps, "updateMemberRole"));
  app.post("/api/v1/members/:id/suspend", op(deps, "suspendMember"));
  app.post("/api/v1/members/:id/two-factor/reset", op(deps, "resetMemberTwoFactor"));
}
