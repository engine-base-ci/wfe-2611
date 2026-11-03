import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import { THEME_COOKIE, parseTheme, themeAttr } from "@/lib/theme";
import "./globals.css";

// html／body の土台と Provider（API・認証）。枠（サイドバー・第2ナビ・下タブ）は各画面が AppShell で組む（枠は導出：D-065）
//   見た目（システム・明るい・暗い・D-128.55）は cookie から読んで <html data-theme> に付ける（スクリプトを差し込まない）
export const metadata: Metadata = { title: "Kaname", description: "Kaname ── 目標を配り、自分のAIと回す" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = themeAttr(parseTheme((await cookies()).get(THEME_COOKIE)?.value));
  return (
    <html lang="ja" {...(theme ? { "data-theme": theme } : {})}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
