"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { authClient, refreshSession } from "./client";
import { call } from "@/lib/api/call";
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

/** ログアウト（K-317）：契約の口 signOut（POST /api/v1/auth/sign-out・K-306）で今のセッションを閉じる。部品の道 /api/auth/sign-out は閉じた。
 *  口が失敗しても（落ちた・網が切れた）この PC の印と書きかけの写しは消す（手元に印を残さない。閉じられなかったことは口の側の記録に残る） */
export async function signOut(): Promise<void> {
  try {
    await call("signOut", { body: {}, keepOn401: true });
  } catch {
    // 網が切れた：下で手元の印は消す（ログアウトの押し直しは要らない形にする）
  } finally {
    setToken(null);
    clearDraftCopies(); // この PC の書きかけの写し（K-60）。共有の PC で次の人に見せない
    refreshSession(); // 今のセッションの見え方（useSession）も読み直させる
  }
}
