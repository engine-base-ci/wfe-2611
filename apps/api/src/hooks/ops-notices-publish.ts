// 運営がお知らせを出す・1 社にお知らせを送る（K-978）の契約の口 publishOpsNotice・sendWorkspaceNotice。
//   振る舞いの本体は apps/api/src/features/F12/ops/notices/publish.ts。ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。
//   材料は appPool・repo（関門 C6 の記録）・mailer（無い fuzz の的では送らずにログだけ）
import type { Hook } from "../contract/deps.js";
import { createPublishOpsNotice, createSendWorkspaceNotice } from "../features/F12/ops/notices/publish.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsNoticesPublishHooks(d: HookDeps): Record<string, Hook> {
  return {
    publishOpsNotice: {
      before: createPublishOpsNotice({
        appPool: d.appPool,
        repo: d.repo,
        ...(d.mailer ? { mailer: d.mailer } : {}),
      }),
    },
    sendWorkspaceNotice: { before: createSendWorkspaceNotice(d.appPool), contractAtEntry: true },
  };
}

export const register = defineHooks({
  name: "opsNoticesPublishHooks",
  make: (d) => opsNoticesPublishHooks(d),
  fuzz: "same",
});
