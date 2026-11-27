import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { legalValues } from "@kaname/config";
import { Providers } from "@/components/providers";
import { OpsContactProvider } from "@/features/F12/help/ops-contact";
import { WEB_ENV } from "@/lib/env";
import { apiPreconnect } from "@/lib/preconnect";
import { THEME_COOKIE, parseTheme, themeAttr } from "@/lib/theme";
// 新しい画面の書体（Noto Sans JP・D-128.3）。画面と同じ所から配る（CSP の font-src は self のまま）。使う画面だけが字の分を読む
import "@fontsource-variable/noto-sans-jp";
import "./globals.css";

// html／body の土台と Provider（API・認証）。枠（サイドバー・第2ナビ・下タブ）は各画面が AppShell で組む（枠は導出：D-065）
//   見た目（システム・明るい・暗い・D-128.55）は cookie から読んで <html data-theme> に付ける（スクリプトを差し込まない）
//   運営の宛先（設定の legalValues().operator.email）はここで読み、止められた画面に渡す（K-1008・画面に直書きしない）
export const metadata: Metadata = { title: "Kaname", description: "Kaname ── 目標を配り、自分のAIと回す" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  // 根で落ちたときの受け皿（global-error）を実ブラウザで確かめる仕掛け（K-30）。開発用の見本が開けるときだけ効く（本番は devPages が false）
  if (WEB_ENV.devPages && jar.get("k-boom-root")?.value === "1") throw new Error("見本：根の layout で落とす");
  const theme = themeAttr(parseTheme(jar.get(THEME_COOKIE)?.value));
  // 口が画面と別の住所なら、HTML の頭で先につなぐ（fetch は CORS なので crossorigin・K-235）。同じ住所なら出さない
  const api = apiPreconnect(WEB_ENV.apiBase);
  return (
    <html lang="ja" {...(theme ? { "data-theme": theme } : {})}>
      <body className="min-h-dvh antialiased">
        {api ? <link rel="preconnect" href={api} crossOrigin="anonymous" /> : null}
        <Providers>
          <OpsContactProvider email={legalValues().operator.email}>{children}</OpsContactProvider>
        </Providers>
      </body>
    </html>
  );
}
