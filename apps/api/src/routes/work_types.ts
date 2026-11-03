// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/work_types", op(deps, "listWorkTypes"));
  app.post("/api/v1/work_types", op(deps, "createWorkType"));
  app.get("/api/v1/work_types/:id", op(deps, "getWorkType"));
  app.post("/api/v1/work_types/:id/copy", op(deps, "copyWorkType"));
  app.patch("/api/v1/work_types/:id/draft", op(deps, "updateWorkTypeDraft"));
  app.post("/api/v1/work_types/:id/release", op(deps, "releaseWorkType"));
  app.post("/api/v1/work_types/:id/spread-requests", op(deps, "requestWorkTypeSpread"));
  app.post("/api/v1/work_types/:id/try", op(deps, "tryWorkType"));
  app.get("/api/v1/work_types/:id/versions", op(deps, "listWorkTypeVersions"));
}
