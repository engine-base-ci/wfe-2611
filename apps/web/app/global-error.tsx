"use client";
// 根の layout で落ちたとき（K-30）。根の layout が読まれないので、見た目（globals.css）と書体はここで読む。
//   素の真っ白にしない。文言は正本の E-PAGE-007（読み込めない）
import "@fontsource-variable/noto-sans-jp";
import "./globals.css";
import { useEffect } from "react";
import { ErrorPage, PAGE_ERROR } from "@/components/k";
import { THEME_COOKIE, parseTheme, themeAttr } from "@/lib/theme";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // 見た目は根の layout と同じ既定（選んでいなければ明るい・K-147）。サーバーでも描かれるので cookie は描いた後に読む
  useEffect(() => {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${THEME_COOKIE}=`))
      ?.slice(THEME_COOKIE.length + 1);
    const a = themeAttr(parseTheme(raw));
    if (a) document.documentElement.dataset["theme"] = a;
    else delete document.documentElement.dataset["theme"];
  }, []);
  return (
    <html lang="ja" data-theme="light">
      <body>
        <ErrorPage code={PAGE_ERROR.loadFailed} acts={[reset, "/"]} />
      </body>
    </html>
  );
}
