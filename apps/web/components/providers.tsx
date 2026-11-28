"use client";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { ConfirmHost } from "@/components/ui/confirm";
import { ApiProvider } from "@/lib/api/query";

/** 小さな知らせ（コピーした・タスクにした 等）の置き場は全画面で 1 つ。右パネルが無い画面でも出る */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ApiProvider>
      {children}
      <Toaster position="bottom-center" richColors />
      <ConfirmHost />
    </ApiProvider>
  );
}
