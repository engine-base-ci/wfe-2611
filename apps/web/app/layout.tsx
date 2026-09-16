import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// 共通シェル（サイドバー・第2ナビ・三画面・下タブ）は T-US-01。ここは html／body の土台だけ
export const metadata: Metadata = { title: "Kaname", description: "Kaname ── 目標を配り、自分のAIと回す" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
