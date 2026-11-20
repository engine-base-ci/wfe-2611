"use client";
// 「PC と使った量」の行の「…」の代わりに出す物（more）と、つないでいる PC のカードのすぐ上に出す物（above）の置き場（K-349）。
//   K-363 が more に外すメニュー・above に帯（「外しました」・失敗の文）を返す。above は行が消えた後も出すので、行の外に置く。
//   この葉の時点ではどちらも何も出さない（more が無ければ行は今の押せない「…」）
import type { ReactNode } from "react";
import type { Device } from "./devices";

export function usePcRowMore(ctx: { reload: () => Promise<void> }): {
  more: ((d: Device) => ReactNode) | undefined;
  above: ReactNode;
} {
  void ctx;
  return { more: undefined, above: null };
}
