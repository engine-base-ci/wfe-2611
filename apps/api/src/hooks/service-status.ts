// いまの様子（K-307）の契約の口の振る舞い。中身は apps/api/src/features/F1/service-status/。上限・一覧の引数の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { serviceStatusFeature, type ServiceStatusDeps } from "../features/F1/service-status/index.js";

export function serviceStatusHooks(d: ServiceStatusDeps): Record<string, Hook> {
  const f = serviceStatusFeature(d);
  return {
    getServiceStatus: { before: f.read },
  };
}
