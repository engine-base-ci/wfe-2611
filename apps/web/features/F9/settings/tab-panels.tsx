// チケットの設定のタブの中身の登録口（K-707）。K-708 が stages・K-709 が fields を 1 行ずつ足す。
//   登録の無いタブは押せない形で出す（settings-tabs.ts の isInertTab）
import type { ComponentType } from "react";
import { FieldsContainer } from "./fields-container";
import { KindsContainer, type SettingsPanelProps } from "./kinds-container";
import type { SettingsTabKey } from "./settings-tabs";
import { StagesContainer } from "./stages-container";

export const TAB_PANELS: Partial<Record<SettingsTabKey, ComponentType<SettingsPanelProps>>> = {
  kinds: KindsContainer,
  stages: StagesContainer,
  fields: FieldsContainer,
};
