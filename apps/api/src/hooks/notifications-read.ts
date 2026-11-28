// 知らせを読んだことにする口（K-462）の契約の口 readNotification・readAllNotifications。振る舞いの本体は apps/api/src/features/F7/notifications/read.ts。
//   一覧の口・外枠の未読の数は、それぞれの葉が自分の hooks のファイルを作る（このファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createReadAllNotifications, createReadNotification } from "../features/F7/notifications/read.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function notificationsReadHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    readNotification: { before: createReadNotification(d.appPool) },
    readAllNotifications: { before: createReadAllNotifications(d.appPool) },
  };
}

export const register = defineHooks({
  name: "notificationsReadHooks",
  make: (d) => notificationsReadHooks(d),
  fuzz: "same",
});
