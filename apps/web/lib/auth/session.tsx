"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { authClient } from "./client";
import { clearDraftCopies, setToken } from "@/lib/api/client";

/** 今のセッション。無ければ null（読み込み中は undefined） */
export function useSession() {
  const s = authClient.useSession();
  return { session: s.isPending ? undefined : (s.data ?? null), refetch: s.refetch };
}

/** ログインが要る画面の入口で使う。無ければ /login?next=… へ（入力途中の内容は各画面が saveDraft で残す） */
export function RequireSession({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { session } = useSession();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (session === null) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [session, router, path]);
  if (session === undefined) return fallback ?? null;
  if (session === null) return null;
  return <>{children}</>;
}

export async function signOut(): Promise<void> {
  await authClient.signOut();
  setToken(null);
  clearDraftCopies(); // この PC の書きかけの写し（K-60）。共有の PC で次の人に見せない
}
