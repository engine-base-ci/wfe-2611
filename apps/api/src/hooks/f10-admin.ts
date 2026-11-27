// 段 11「人とアカウントを管理する」の口（K-800）。束 G（グループ・層）・束 A（招くの残り）・束 C（メンバー）の 13 口を登録する。
//   振る舞いの本体は apps/api/src/features/F10/admin/ の口ごとのファイル（後ろの葉 K-802〜K-815・K-848 が自分のファイルだけを本物にする）。
//   後ろの葉はこのファイルを changes に載せるが、登録の行は足さない・変えない（鍵はちょうど 13）。
//   束 D・E・F（記録・設定・自分の設定）の口はそれぞれの葉の hooks のファイル。getWorkspaceMembers は K-419 の hooks のまま。
//   本人確認の取り直し・上限・道の値の形・strict の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { adminFeature, type AdminDeps } from "../features/F10/admin/index.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function f10AdminHooks(d: HookDeps): Record<string, Hook> {
  const deps: AdminDeps = {
    appPool: d.appPool,
    ...(d.mailer ? { mailer: d.mailer } : {}),
    config: { webBaseUrl: d.config.webBaseUrl ?? "" },
  };
  const f = adminFeature(deps);
  return {
    createScope: { before: f.createScope },
    updateScope: { before: f.updateScope },
    createLayer: { before: f.createLayer },
    updateLayer: { before: f.updateLayer },
    resendInvitation: { before: f.resendInvitation },
    revokeInvitation: { before: f.revokeInvitation },
    getMember: { before: f.getMember },
    updateMemberRole: { before: f.updateMemberRole },
    updateMemberGroups: { before: f.updateMemberGroups },
    suspendMember: { before: f.suspendMember },
    resumeMember: { before: f.resumeMember },
    previewMemberRemoval: { before: f.previewMemberRemoval },
    removeMember: { before: f.removeMember },
  };
}

export const register = defineHooks({ name: "f10AdminHooks", make: (d) => f10AdminHooks(d), fuzz: "same" });
