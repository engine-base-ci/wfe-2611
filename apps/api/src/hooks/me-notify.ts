// 知らせの設定の口（K-837）の契約の口：getNotificationSettings・updateNotificationSettings・copyNotificationSettings。
//   振る舞いの本体は apps/api/src/features/F10/me/notify.ts（出来事の一覧は notify-events.ts）。保存だけで、受け箱・メールは F7（K-67）
import type { Hook } from "../contract/deps.js";
import {
  createCopyNotificationSettings,
  createGetNotificationSettings,
  createUpdateNotificationSettings,
  inputCopy,
  inputUpdate,
} from "../features/F10/me/notify.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function meNotifyHooks(d: HookDeps): Record<string, Hook> {
  return {
    getNotificationSettings: { before: createGetNotificationSettings(d.appPool) },
    updateNotificationSettings: { input: inputUpdate, before: createUpdateNotificationSettings(d.appPool) },
    copyNotificationSettings: { input: inputCopy, before: createCopyNotificationSettings(d.appPool) },
  };
}

export const register = defineHooks({
  name: "meNotifyHooks",
  make: (d) => meNotifyHooks(d),
  fuzz: "same",
});
