// 依頼のやり取りに書く契約の口（K-908）：postPortalRequestMessage。振る舞いの本体は apps/api/src/features/F11/portal/request-message.ts。
//   依頼を出す・読む口は K-907 の hooks/portal-request.ts（このファイルに足さない・あちらにも足さない）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createPostPortalRequestMessage } from "../features/F11/portal/request-message.js";
import { defineHooks, type HookMailer } from "./registry.js";

export function portalRequestMessageHooks(
  appPool: pg.Pool,
  mailer?: HookMailer,
  webBaseUrl = "",
): Record<string, Hook> {
  return {
    postPortalRequestMessage: { before: createPostPortalRequestMessage(appPool, mailer, webBaseUrl) },
  };
}

export const register = defineHooks({
  name: "portalRequestMessageHooks",
  make: (d) => portalRequestMessageHooks(d.appPool, d.mailer, d.config.webBaseUrl ?? ""),
  fuzz: "same",
});
