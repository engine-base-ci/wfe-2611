// 見せたチケットのチャット（K-882）の契約の口。振る舞いの本体は apps/api/src/features/F11/portal-chat/（流れと操作ごとのフォルダ・D-128.130）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type pg from "pg";
import type { Hook, HookArgs } from "../contract/deps.js";
import { postPortalMessage } from "../features/F11/portal-chat/post.js";
import { defineHooks } from "./registry.js";

export function portalTicketChatHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    postPortalTicketMessage: { before: (a: HookArgs) => postPortalMessage(appPool, a) },
  };
}

export const register = defineHooks({
  name: "portalTicketChatHooks",
  make: (d) => portalTicketChatHooks(d.appPool),
  fuzz: "same",
});
