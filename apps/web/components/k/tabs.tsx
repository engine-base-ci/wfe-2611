"use client";
// タブ（KN-104・Base UI Tabs）。←→ で移り、選んだタブの中身だけを出す（読み上げは tablist / tab / tabpanel）
import { Tabs as T } from "@base-ui-components/react/tabs";
import type { ReactNode } from "react";

export interface TabItem {
  value: string;
  label: ReactNode;
  panel: ReactNode;
  disabled?: boolean;
}
export interface TabsProps {
  label: string;
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
}

export function Tabs({ label, items, value, defaultValue, onValueChange }: TabsProps) {
  return (
    <T.Root
      {...(value !== undefined ? { value } : {})}
      defaultValue={defaultValue ?? items[0]?.value}
      onValueChange={(v) => onValueChange?.(v as string)}
    >
      <T.List className="k-tabs-list" aria-label={label}>
        {items.map((i) => (
          <T.Tab key={i.value} value={i.value} disabled={i.disabled} className="k-tab">
            {i.label}
          </T.Tab>
        ))}
      </T.List>
      {items.map((i) => (
        <T.Panel key={i.value} value={i.value} className="k-tab-panel">
          {i.panel}
        </T.Panel>
      ))}
    </T.Root>
  );
}
