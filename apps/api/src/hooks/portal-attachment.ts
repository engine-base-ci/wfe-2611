// ゲストが依頼に付ける添付を足す口（K-909）の契約の口 uploadPortalAttachment。
//   振る舞いの本体は apps/api/src/features/F11/portal/（attachment.ts・attachment-check.ts）。置き場は関門 C4（HookDeps.objects）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type pg from "pg";
import type { ObjectStore } from "@kaname/storage";
import type { Hook } from "../contract/deps.js";
import { createUploadPortalAttachment, input } from "../features/F11/portal/attachment.js";
import { defineHooks } from "./registry.js";

export function portalAttachmentHooks(appPool: pg.Pool, objects: ObjectStore | undefined): Record<string, Hook> {
  return {
    uploadPortalAttachment: { input, before: createUploadPortalAttachment(appPool, objects) },
  };
}

export const register = defineHooks({
  name: "portalAttachmentHooks",
  make: (d) => portalAttachmentHooks(d.appPool, d.objects),
  fuzz: "same",
});
