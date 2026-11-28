// 依頼を出す・グループの依頼を読む契約の口（K-907）：createPortalRequest・getPortalRequest。振る舞いの本体は apps/api/src/features/F11/portal/request-*.ts。
//   返事を書く口（K-908）・添付を足す口（K-909）・書く間に分身が聞く口（K-910）は、それぞれの葉が自分の hooks のファイルを作る（このファイルに足さない）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createCreatePortalRequest } from "../features/F11/portal/request-create.js";
import { createGetPortalRequest } from "../features/F11/portal/request-read.js";
import { defineHooks, type HookMailer } from "./registry.js";

export function portalRequestHooks(appPool: pg.Pool, mailer?: HookMailer, webBaseUrl = ""): Record<string, Hook> {
  return {
    createPortalRequest: { before: createCreatePortalRequest(appPool, mailer, webBaseUrl) },
    getPortalRequest: { before: createGetPortalRequest(appPool) },
  };
}

export const register = defineHooks({
  name: "portalRequestHooks",
  make: (d) => portalRequestHooks(d.appPool, d.mailer, d.config?.webBaseUrl ?? ""),
  fuzz: "same",
});
