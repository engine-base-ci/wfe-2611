import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";

// 段 8（F7 毎日見る・探す・片付ける）の下絵のモックの 1 つの状態。1 つの id ＝ 1 つの状態。
// 状態は区画ごとのファイル states/<区画>.tsx に置き、mocks.tsx は集めるだけ（持ち主の欄 ticket は切る段で入れてしまう）。
export interface MockEntry {
  id: string;
  /** どの画面か：shell（外枠）・tickets（チケットの一覧・詳細）・ai-activity は使わない（段 6） */
  screen: "shell" | "tickets";
  label: string;
  /** この状態を本物にする葉（11_tickets/K-4xx・K-59x。切り方.md の 2 章） */
  ticket: string;
  /** 下絵の頁に出す葉の名前（ticket と同じ番号） */
  leaf: string;
  /** 見るときの幅（撮る台本が使う） */
  widths: readonly (375 | 768 | 1440)[];
  render: (theme: Theme) => ReactNode;
}
