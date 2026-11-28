// 届いた依頼に社内がする 2 つ（K-893）の契約の口：届け先を変える updateClientRequest・返事を送る replyToClientRequest。
//   振る舞いの本体は apps/api/src/features/F11/requests/（route.ts・reply.ts・mail.ts）。読む口（K-892）は client-requests-read.ts
import type { Hook } from "../contract/deps.js";
import { createReplyToClientRequest } from "../features/F11/requests/reply.js";
import { createUpdateClientRequest } from "../features/F11/requests/route.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function clientRequestsRouteReplyHooks(d: HookDeps): Record<string, Hook> {
  return {
    updateClientRequest: { before: createUpdateClientRequest(d.appPool) },
    replyToClientRequest: { before: createReplyToClientRequest(d) },
  };
}

export const register = defineHooks({
  name: "clientRequestsRouteReplyHooks",
  make: (d) => clientRequestsRouteReplyHooks(d),
  fuzz: "same",
});
