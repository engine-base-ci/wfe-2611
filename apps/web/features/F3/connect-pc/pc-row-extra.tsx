"use client";
// 「PC と使った量」の行の本文の最後に差す物の置き場（K-349）。
//   K-361 → K-368 → K-375 がこの順に分かれ道を足す。mine の見分け・この PC の口の読みもこの hook の中。
//   この葉の時点では何も差さない（undefined を返す＝行は今の形のまま）
import type { ReactNode } from "react";
import type { Where0 } from "@/lib/bridge-presence";
import type { Device } from "./devices";

export interface PcRowCtx {
  devices: Device[];
  where: Where0["where"];
  bridge: Where0["bridge"];
  reload: () => Promise<void>;
}

export function usePcRowExtra(ctx: PcRowCtx): ((d: Device) => ReactNode) | undefined {
  void ctx;
  return undefined;
}
