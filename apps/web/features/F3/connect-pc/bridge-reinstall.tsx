"use client";
// Bridge が古い PC の行の「入れ直す」区画（K-375・口は K-57 の downloadBridgeRelease）。
//   見た目は下絵の部品 pc-row-parts.tsx の BridgeReinstall（K-369）。ここは見分けと押した結果をつなぐ。
//   行ごとに持つ：受け取り中の OS・受け取った OS・失敗の文（画面を読み込み直すと受け取る前の形に戻る）
import { useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import { getInstaller } from "@/lib/bridge-presence";
import { BridgeReinstall, type InstallerOs } from "./pc-row-parts";

const CATALOG_IDS: Record<string, unknown> = CATALOG;

/** 自己診断（並び）に fix が update で ok が false の行が 1 つでも在るか（会話の帯の見分けと同じ・並びでなければ無いのと同じ） */
export function isOutdated(health: unknown): boolean {
  if (!Array.isArray(health)) return false;
  return health.some(
    (h: unknown) =>
      typeof h === "object" &&
      h !== null &&
      (h as { fix?: unknown }).fix === "update" &&
      (h as { ok?: unknown }).ok === false,
  );
}

export function BridgeReinstallRow({ canInstall }: { canInstall: boolean }) {
  const [busy, setBusy] = useState<InstallerOs | null>(null);
  const [taken, setTaken] = useState<InstallerOs | null>(null);
  const [error, setError] = useState<string | null>(null);

  const take = async (os: InstallerOs): Promise<void> => {
    if (busy) return; // 2 回押し・もう 1 つのボタンでも口は 1 回
    setError(null);
    setBusy(os);
    const r = await getInstaller(os);
    setBusy(null);
    if (r.ok) {
      setTaken(os);
      return;
    }
    // 401 は受け取りの呼び手が共通の決まり（入り直し）へ送る。ここでは足さない
    if (r.status === 401) return;
    setTaken(null);
    setError(errorText(r.code in CATALOG_IDS ? r.code : PAGE_ERROR.loadFailed).entry.message);
  };

  return (
    <BridgeReinstall canInstall={canInstall} taken={taken} busy={busy} error={error} onTake={(os) => void take(os)} />
  );
}
