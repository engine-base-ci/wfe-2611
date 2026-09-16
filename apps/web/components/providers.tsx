"use client";
import type { ReactNode } from "react";
import { ApiProvider } from "@/lib/api/query";

export function Providers({ children }: { children: ReactNode }) {
  return <ApiProvider>{children}</ApiProvider>;
}
