// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/inquiries", op(deps, "listMyInquiries"));
  app.post("/api/v1/inquiries", op(deps, "createInquiry"));
  app.post("/api/v1/inquiries/attachments", op(deps, "uploadInquiryAttachment"));
  app.get("/api/v1/inquiries/:id", op(deps, "getMyInquiry"));
  app.post("/api/v1/inquiries/:id/messages", op(deps, "postInquiryMessage"));
  app.post("/api/v1/inquiries/:id/resolve", op(deps, "resolveMyInquiry"));
}
