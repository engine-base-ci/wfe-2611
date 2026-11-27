// 空の描き手（K-670 が置く）。K-671 が carry で中身を差し替える（render.tsx は触らない）
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";

/** この葉ではまだどの状態も描かない（持っていない id は null） */
export const renderAdmin: (id: string, theme: Theme) => ReactNode | null = () => null;
