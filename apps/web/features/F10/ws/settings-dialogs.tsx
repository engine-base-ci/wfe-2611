"use client";
// 設定の画面（K-831）の小窓の登録口。小窓を持つ葉が、ここに 2 字下げの `キー: 部品,` の 1 行を足す
//   （K-832 が delete を足す）。登録の無い間は、その小窓を開くボタンを押せない形（aria-disabled・「まだ使えません」）にする（K831-UI-019）
import { useState, type ComponentType } from "react";
import { DeleteFlow } from "./delete-flow";
import type { SettingsAnswer } from "./settings-shape";

export type SettingsDialogKey = "delete";

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: SettingsAnswer;
  /** 設定を読み直す（K-832：始めた人と日時は読みにしか無い） */
  reload?: () => Promise<unknown>;
  /** 口が 403（押せる人でなくなった）：画面を権限なしに替える */
  onDenied?: () => void;
}

export const SETTINGS_DIALOGS: Partial<Record<SettingsDialogKey, ComponentType<SettingsDialogProps>>> = {
  /* K-832 が delete を 2 字下げの キー: 部品, の形で 1 行足す */
  delete: DeleteFlow,
};

/** その小窓が登録されているか（押せる形にするか） */
export const openable = (key: SettingsDialogKey): boolean => SETTINGS_DIALOGS[key] !== undefined;

/** 開いている小窓の鍵（1 つだけ）。登録の無い鍵は開かない */
export function useOpenDialog(): {
  open: SettingsDialogKey | null;
  show: (key: SettingsDialogKey) => void;
  close: () => void;
} {
  const [open, setOpen] = useState<SettingsDialogKey | null>(null);
  return {
    open,
    show: (key) => {
      if (openable(key)) setOpen(key);
    },
    close: () => setOpen(null),
  };
}
