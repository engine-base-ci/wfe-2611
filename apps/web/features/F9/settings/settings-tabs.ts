// チケットの設定のタブの決め方（K-707・画面の外の純粋な関数）：?tab= の字 → タブ・登録の無いタブは押せない形。
//   タブの中身の登録は tab-panels.tsx（K-708 が stages・K-709 が fields を 1 行ずつ足す）

export type SettingsTabKey = "kinds" | "stages" | "fields";
const TABS: readonly SettingsTabKey[] = ["kinds", "stages", "fields"];

/** ?tab= の字をタブに（無い・知らない値は種別） */
export function tabOf(raw: string | null | undefined): SettingsTabKey {
  return TABS.find((t) => t === raw) ?? "kinds";
}

/** 押せない形のタブか（種別はいつも動く・状態と項目は登録があるときだけ動く） */
export function isInertTab(panels: Partial<Record<SettingsTabKey, unknown>>, tab: SettingsTabKey): boolean {
  if (tab === "kinds") return false;
  return !panels[tab];
}

/** 押せない形のタブの並び */
export const inertTabsOf = (panels: Partial<Record<SettingsTabKey, unknown>>): SettingsTabKey[] =>
  TABS.filter((t) => isInertTab(panels, t));
