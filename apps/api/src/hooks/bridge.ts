// PC をつなぐ（K-57）の契約の口。振る舞いの本体は apps/api/src/features/F3/connect-pc/（流れと操作ごとのフォルダ・D-128.130）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type { Hook } from "../contract/deps.js";
import { connectPcHooks, type ConnectPcDeps } from "../features/F3/connect-pc/hooks.js";
import { defineHooks } from "./registry.js";

export function bridgeHooks(d: ConnectPcDeps): Record<string, Hook> {
  const h = connectPcHooks(d);
  return {
    createPairingCode: { ...h["createPairingCode"] },
    claimPairingCode: { ...h["claimPairingCode"] },
    sendHeartbeat: { ...h["sendHeartbeat"] },
    listMyDevices: { ...h["listMyDevices"] },
    getLatestBridgeRelease: { ...h["getLatestBridgeRelease"] },
    downloadBridgeRelease: { ...h["downloadBridgeRelease"] },
  };
}

export const register = defineHooks({
  name: "bridgeHooks",
  make: (d) =>
    bridgeHooks({
      appPool: d.appPool,
      release: { dir: d.config.bridgeReleaseDir ?? "", base: d.config.bridgeReleaseBase ?? "" },
      objects: d.objects,
    }),
  fuzz: "same",
});
