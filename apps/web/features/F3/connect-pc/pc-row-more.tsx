"use client";
// 「PC と使った量」の行の「…」の代わりに出す物（more）と、つないでいる PC のカードのすぐ上に出す物（above）の置き場（K-349・K-363）。
//   more … 行の「…」のメニュー（この PC を外す・remove-pc.tsx）。小窓は Portal なので行の直の子は「…」のボタン 1 つだけ。
//   above … 外した後の帯（外しました・失敗の文）。行が消えた後も出すので、行の外（この hook）が値を持つ
import { useState, type ReactNode } from "react";
import type { Device } from "./devices";
import { RemoveBannerView, RemovePc, type RemoveBanner } from "./remove-pc";

export function usePcRowMore(ctx: { reload: () => Promise<void> }): {
  more: ((d: Device) => ReactNode) | undefined;
  above: ReactNode;
} {
  const [banner, setBanner] = useState<RemoveBanner | null>(null);
  return {
    more: (d) => <RemovePc device={d} reload={ctx.reload} onBanner={setBanner} />,
    above: <RemoveBannerView banner={banner} />,
  };
}
