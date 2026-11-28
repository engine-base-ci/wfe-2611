"use client";
// アプリの枠の画面は、はじめの設定（1〜6）を通していない人を、いま進んでいる段へ戻す（D-089）。
// 今いる段そのものの画面（例：段 4 ログイン情報）は通す ── 戻し続けるとその段から出られない
import type { ReactNode } from "react";
import { RequireSetup } from "@/components/wizard/require-setup";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <RequireSetup>{children}</RequireSetup>;
}
