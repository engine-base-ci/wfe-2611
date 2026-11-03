// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.post("/api/v1/bridge/claim", op(deps, "claimPairingCode"));
  app.post("/api/v1/bridge/credentials/resolve", op(deps, "resolveCredential"));
  app.post("/api/v1/bridge/credentials/:id/check-result", op(deps, "reportCredentialCheck"));
  app.get("/api/v1/bridge/devices", op(deps, "listMyDevices"));
  app.patch("/api/v1/bridge/devices/:id", op(deps, "updateMyDevice"));
  app.delete("/api/v1/bridge/devices/:id", op(deps, "revokeMyDevice"));
  app.get("/api/v1/bridge/files/:ref", op(deps, "getFileForBridge"));
  app.post("/api/v1/bridge/heartbeat", op(deps, "sendHeartbeat"));
  app.post("/api/v1/bridge/jobs/take", op(deps, "takeBridgeJob"));
  app.post("/api/v1/bridge/jobs/:id/artifacts", op(deps, "putArtifactFromBridge"));
  app.post("/api/v1/bridge/jobs/:id/browser", op(deps, "reportBrowserState"));
  app.get("/api/v1/bridge/jobs/:id/control", op(deps, "getJobControl"));
  app.post("/api/v1/bridge/jobs/:id/conversation-entries", op(deps, "mirrorConversationEntries"));
  app.post("/api/v1/bridge/jobs/:id/finish", op(deps, "finishBridgeJob"));
  app.post("/api/v1/bridge/jobs/:id/progress", op(deps, "reportJobProgress"));
  app.post("/api/v1/bridge/jobs/:id/questions", op(deps, "askFromBridge"));
  app.get("/api/v1/bridge/jobs/:id/questions/:qid", op(deps, "getBridgeQuestionAnswer"));
  app.post("/api/v1/bridge/jobs/:id/tools/:name", op(deps, "callKanameTool"));
  app.get("/api/v1/bridge/mirror-targets", op(deps, "listMirrorTargets"));
  app.post("/api/v1/bridge/pairing-codes", op(deps, "createPairingCode"));
  app.get("/api/v1/bridge/releases/latest", op(deps, "getLatestBridgeRelease"));
  app.get("/api/v1/bridge/releases/:name/file", op(deps, "downloadBridgeRelease"));
  app.post("/api/v1/bridge/usage", op(deps, "reportUsage"));
}
