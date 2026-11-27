// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/me", op(deps, "getMe"));
  app.patch("/api/v1/me", op(deps, "updateMe"));
  app.post("/api/v1/me/avatar", op(deps, "uploadAvatar"));
  app.post("/api/v1/me/backup-codes", op(deps, "regenerateBackupCodes"));
  app.post("/api/v1/me/email-change", op(deps, "requestEmailChange"));
  app.post("/api/v1/me/email-change/verify", op(deps, "verifyEmailChange"));
  app.get("/api/v1/me/invitations", op(deps, "listMyInvitations"));
  app.get("/api/v1/me/notification-settings", op(deps, "getNotificationSettings"));
  app.patch("/api/v1/me/notification-settings", op(deps, "updateNotificationSettings"));
  app.post("/api/v1/me/notification-settings/copy", op(deps, "copyNotificationSettings"));
  app.patch("/api/v1/me/passkeys/:id", op(deps, "renamePasskey"));
  app.delete("/api/v1/me/passkeys/:id", op(deps, "deletePasskey"));
  app.post("/api/v1/me/password", op(deps, "setMyPassword"));
  app.patch("/api/v1/me/password", op(deps, "changePassword"));
  app.get("/api/v1/me/security", op(deps, "getMySecurity"));
  app.get("/api/v1/me/sessions", op(deps, "listMySessions"));
  app.post("/api/v1/me/sessions/revoke-others", op(deps, "revokeOtherSessions"));
  app.delete("/api/v1/me/sessions/:id", op(deps, "revokeMySession"));
  app.get("/api/v1/me/setup-tasks", op(deps, "listSetupTasks"));
  app.post("/api/v1/me/setup-tasks/dismiss", op(deps, "dismissSetupTasks"));
  app.get("/api/v1/me/ticket-drafts", op(deps, "listMyTicketDrafts"));
  app.post("/api/v1/me/ticket-drafts", op(deps, "saveMyTicketDraft"));
  app.delete("/api/v1/me/two-factor", op(deps, "disableTwoFactor"));
  app.post("/api/v1/me/two-factor/confirm", op(deps, "confirmTwoFactor"));
  app.post("/api/v1/me/two-factor/enable", op(deps, "startTwoFactor"));
  app.get("/api/v1/me/usage", op(deps, "getMyUsage"));
  app.delete("/api/v1/me/workspaces/:id", op(deps, "leaveWorkspace"));
  app.post("/api/v1/me/workspaces/:id/switch", op(deps, "switchWorkspace"));
}
