"use client";
// はじめの設定（1〜6）を通していない人を、いま進んでいる段へ戻す（D-089）。アプリの枠の画面がこれで包む。
// はじめの設定の画面そのもの（手順バーの段）は包まない ── 包むとその段から出られなくなる。
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/auth/session";
import { resumeHref, useSetupStep } from "@/lib/onboarding";
import { useMyRoles } from "@/lib/auth/role";
import { NAV } from "@/lib/nav";

export function RequireSetup({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { session } = useSession();
  const { step, loading } = useSetupStep(session != null);
  const router = useRouter();
  const path = usePathname();
  const { roles } = useMyRoles();
  // その権限で見えない画面は、戻す前に「この権限では見えない」を出す（D-086 が先・無言で別画面へ飛ばさない）
  const scr = Object.values(NAV.screens).find((x) => x.route === path);
  const cannotSee = !!scr && !!roles && scr.roles.length > 0 && !roles.some((r) => scr.roles.includes(r));
  const target = step === null || roles === undefined || cannotSee ? null : resumeHref(step);
  // いま開いている画面が「戻す先」そのものなら、そこが今の段なので通す（でないとその段から出られない）
  const back = target === null || path.startsWith(target) ? null : target;
  useEffect(() => {
    if (session == null || loading || step === null || back === null) return;
    router.replace(back);
  }, [session, loading, step, back, router]);
  // 入っていないときは何もしない。画面の RequireSession が入り直し（/login?next=…）へ送る（D-086.4）
  if (session === null) return <>{children}</>;
  if (session === undefined || loading || step === null || roles === undefined) return fallback ?? null;
  if (back !== null) return null; // 戻している最中。中身を一瞬でも見せない
  return <>{children}</>;
}
