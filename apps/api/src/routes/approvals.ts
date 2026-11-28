// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.post("/api/v1/approvals/bulk", op(deps, "bulkApprove"));
  app.post("/api/v1/approvals/bulk/preview", op(deps, "previewBulkApproval"));
  app.get("/api/v1/approvals/history", op(deps, "listApprovalHistory"));
  app.get("/api/v1/approvals/queue", op(deps, "listApprovalQueue"));
  app.get("/api/v1/approvals/:id", op(deps, "getApproval"));
  app.post("/api/v1/approvals/:id/approve", op(deps, "approveApproval"));
  app.post("/api/v1/approvals/:id/edit", op(deps, "editApproval"));
  app.post("/api/v1/approvals/:id/return", op(deps, "returnApproval"));
  app.post("/api/v1/approvals/:id/stop", op(deps, "stopApproval"));
  app.post("/api/v1/approvals/:id/withdraw", op(deps, "withdrawApproval"));
}
