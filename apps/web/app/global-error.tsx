"use client";
// 根の layout で落ちたとき（K-30）。根の layout が読まれないので、見た目（globals.css）と書体はここで読む。
//   素の真っ白にしない。文言は正本の E-PAGE-007（読み込めない）
import "@fontsource-variable/noto-sans-jp";
import "./globals.css";
import { ErrorPage, PAGE_ERROR } from "@/components/k";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ja">
      <body>
        <ErrorPage code={PAGE_ERROR.loadFailed} acts={[reset, "/"]} />
      </body>
    </html>
  );
}
