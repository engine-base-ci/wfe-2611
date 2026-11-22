// 人を招く口（K-419）の契約の口：メンバーの並びを読む getWorkspaceMembers・メールで招く createInvitations（D-148.1）。
//   振る舞いの本体は apps/api/src/features/F10/invite/。招待のリンク（createInvitationLink）は K-421 が自分の hooks に足す。
//   前からの hooks/invitations.ts は招かれた人が参加する側（F2）なので触らない
import type { Hook } from "../contract/deps.js";
import { createCreateInvitations } from "../features/F10/invite/create.js";
import { createGetWorkspaceMembers } from "../features/F10/invite/members.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function workspaceInvitationHooks(d: HookDeps): Record<string, Hook> {
  return {
    getWorkspaceMembers: { before: createGetWorkspaceMembers(d.appPool) },
    createInvitations: { before: createCreateInvitations(d) },
  };
}

export const register = defineHooks({
  name: "workspaceInvitationHooks",
  make: (d) => workspaceInvitationHooks(d),
  fuzz: "same",
});
