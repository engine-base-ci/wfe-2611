"use client";
// 画面を描いている途中で落ちたとき（K-26）。素の真っ白にしない。文言は正本の E-PAGE-007（読み込めない）
import { ErrorPage, PAGE_ERROR } from "@/components/k";

export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPage code={PAGE_ERROR.loadFailed} acts={[reset, "/"]} />;
}
