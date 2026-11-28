import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WEB_ENV } from "@/lib/env";

// 部品の見本と実ブラウザの検査の的（T-US-01〜06）。本番には出さない
export default function DevLayout({ children }: { children: ReactNode }) {
  if (WEB_ENV.isProduction && !WEB_ENV.devPages) notFound();
  return <>{children}</>;
}
