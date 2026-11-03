// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.post("/api/v1/auth/password/forgot", op(deps, "requestPasswordReset"));
  app.post("/api/v1/auth/recovery/admin-request", op(deps, "requestAdminRecovery"));
  app.post("/api/v1/me/backup-codes", op(deps, "regenerateBackupCodes"));
  app.post("/api/v1/me/email-change", op(deps, "requestEmailChange"));
  app.post("/api/v1/me/email-change/verify", op(deps, "verifyEmailChange"));
  app.patch("/api/v1/me/password", op(deps, "changePassword"));
  app.delete("/api/v1/me/two-factor", op(deps, "disableTwoFactor"));
  app.post("/api/v1/me/two-factor/confirm", op(deps, "confirmTwoFactor"));
  app.post("/api/v1/me/two-factor/enable", op(deps, "startTwoFactor"));
  app.post("/api/v1/members/:id/two-factor/reset", op(deps, "resetMemberTwoFactor"));
  app.post("/api/v1/ops/workspaces/:id/members/:mid/resend-verification", op(deps, "resendOpsVerification"));
}
