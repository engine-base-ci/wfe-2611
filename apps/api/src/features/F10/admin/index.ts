// 段 11（F10 人とアカウントを管理する）の口の置き場（K-800）。束 G（グループ・層）・束 A（招くの残り）・束 C（メンバー）の 13 口の run を束ねるだけ。
//   後ろの葉は口ごとのファイルを差し替えるだけ（このファイルは触らない）。束 D・E・F の口は、それぞれの葉が自分の hooks のファイルで持つ
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { AdminDeps } from "./deps.js";
import * as getMember from "./members/get.js";
import * as updateMemberGroups from "./members/groups.js";
import * as removeMember from "./members/remove.js";
import * as previewMemberRemoval from "./members/remove-preview.js";
import * as resumeMember from "./members/resume.js";
import * as updateMemberRole from "./members/role.js";
import * as suspendMember from "./members/suspend.js";
import * as resendInvitation from "./invitations/resend.js";
import * as revokeInvitation from "./invitations/revoke.js";
import * as createLayer from "./layers/create.js";
import * as updateLayer from "./layers/update.js";
import * as createScope from "./scopes/create.js";
import * as updateScope from "./scopes/update.js";
import type { AdminOp } from "./op.js";

export type { AdminDeps } from "./deps.js";

/** 口の名前 → 口ごとのファイルの run */
const OPS = {
  createScope: createScope.run,
  updateScope: updateScope.run,
  createLayer: createLayer.run,
  updateLayer: updateLayer.run,
  resendInvitation: resendInvitation.run,
  revokeInvitation: revokeInvitation.run,
  getMember: getMember.run,
  updateMemberRole: updateMemberRole.run,
  updateMemberGroups: updateMemberGroups.run,
  suspendMember: suspendMember.run,
  resumeMember: resumeMember.run,
  previewMemberRemoval: previewMemberRemoval.run,
  removeMember: removeMember.run,
} as const satisfies Record<string, AdminOp>;

export type AdminFeature = { [K in keyof typeof OPS]: (a: HookArgs) => Promise<HookReply> };

export function adminFeature(d: AdminDeps): AdminFeature {
  const bind = (run: AdminOp) => (a: HookArgs) => run({ d, a });
  return {
    createScope: bind(OPS.createScope),
    updateScope: bind(OPS.updateScope),
    createLayer: bind(OPS.createLayer),
    updateLayer: bind(OPS.updateLayer),
    resendInvitation: bind(OPS.resendInvitation),
    revokeInvitation: bind(OPS.revokeInvitation),
    getMember: bind(OPS.getMember),
    updateMemberRole: bind(OPS.updateMemberRole),
    updateMemberGroups: bind(OPS.updateMemberGroups),
    suspendMember: bind(OPS.suspendMember),
    resumeMember: bind(OPS.resumeMember),
    previewMemberRemoval: bind(OPS.previewMemberRemoval),
    removeMember: bind(OPS.removeMember),
  };
}
