import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

// html／body の土台と Provider（API・認証）。枠（サイドバー・第2ナビ・下タブ）は各画面が AppShell で組む（枠は導出：D-065）
export const metadata: Metadata = { title: "Kaname", description: "Kaname ── 目標を配り、自分のAIと回す" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
