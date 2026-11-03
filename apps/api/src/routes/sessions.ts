// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.post("/api/v1/auth/password/reset", op(deps, "resetPassword"));
  app.post("/api/v1/auth/sign-in", op(deps, "signInWithPassword"));
  app.post("/api/v1/auth/sign-out", op(deps, "signOut"));
  app.post("/api/v1/auth/step-up", op(deps, "stepUp"));
  app.post("/api/v1/auth/two-factor/verify", op(deps, "verifySignInCode"));
  app.post("/api/v1/bridge/claim", op(deps, "claimPairingCode"));
  app.get("/api/v1/bridge/devices", op(deps, "listMyDevices"));
  app.patch("/api/v1/bridge/devices/:id", op(deps, "updateMyDevice"));
  app.delete("/api/v1/bridge/devices/:id", op(deps, "revokeMyDevice"));
  app.post("/api/v1/bridge/heartbeat", op(deps, "sendHeartbeat"));
  app.get("/api/v1/bridge/releases/:name/file", op(deps, "downloadBridgeRelease"));
  app.get("/api/v1/bridge/releases/latest", op(deps, "getLatestBridgeRelease"));
  app.get("/api/v1/me/sessions", op(deps, "listMySessions"));
  app.delete("/api/v1/me/sessions/:id", op(deps, "revokeMySession"));
  app.post("/api/v1/me/sessions/revoke-others", op(deps, "revokeOtherSessions"));
}
