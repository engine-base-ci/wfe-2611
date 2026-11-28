"use client";
// 差し込み口 DryRunActSlot・DryRunSlot の先（K-730 の器・持ち主の葉は K-747）。
//   K-747 で本物に替えた：カードの［試し打ち（自分宛）］と、承認の帯の箱の直後の試し打ちの帯（features/F5/dry-run）
import { DryRunAct, DryRunBand } from "@/features/F5/dry-run/dry-run";

export interface DryRunActFillProps {
  approvalId?: string;
  ticketId?: string;
}
export interface DryRunFillProps {
  approvalId: string;
  ticketId?: string;
  /** E-RUN-003（承認待ちの成果物が無い）のとき、チケットを読み直す（任意で足した・無ければ詳細の問い合わせを読み直す） */
  onChanged?: () => Promise<void>;
}

export function DryRunActFill(props: DryRunActFillProps) {
  return <DryRunAct {...props} />;
}

export function DryRunFill(props: DryRunFillProps) {
  return <DryRunBand {...props} />;
}
