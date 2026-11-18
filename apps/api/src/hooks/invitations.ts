// 招待の契約の口の振る舞い（K-331 下見。K-332・K-333 参加・K-334 送り直しも同じ hooks に足す）。中身は apps/api/src/features/F2/invitations/。
//   上限・道の値の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import type { InvitationDeps } from "../features/F2/invitations/deps.js";
import { invitationPreviewFeature } from "../features/F2/invitations/preview.js";
import { defineHooks } from "./registry.js";

export type { InvitationDeps, InvitationMailer } from "../features/F2/invitations/deps.js";

export function invitationHooks(d: InvitationDeps): Record<string, Hook> {
  const preview = invitationPreviewFeature(d);
  return {
    getInvitation: { before: preview.read },
  };
}

export const register = defineHooks({
  name: "invitationHooks",
  make: (d) =>
    invitationHooks({
      auth: d.auth,
      appPool: d.appPool,
      authPool: d.authPool,
      ...(d.mailer ? { mailer: d.mailer } : {}),
      config: { opsEmail: d.config.opsEmail, webBaseUrl: d.config.webBaseUrl ?? "" },
    }),
  fuzz: "same",
});
