"use client";
// 役割の判定と「この権限では見えない」（D-086）。画面の access_roles（R1〜R6）と、DB の members.role_id を突き合わせる。
// 役割で見えない画面に直接 URL で来たら、無言の空画面にせず理由と導線を出す（screen-derivation §6）
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { me } from "@/lib/auth/ext";
import { useSession } from "@/lib/auth/session";
import { FALLBACKS, NAV, type ScreenId } from "@/lib/nav.legacy";
import { pendingRoute } from "@/lib/pending-route";

/** members.role_id（owner／staff／viewer／ops）→ 画面の役割（R1〜R6） */
const ROLE_OF: Record<string, string[]> = {
  owner: ["R1", "R2"],
  admin: ["R1", "R2"],
  staff: ["R3"],
  viewer: ["R4"],
  ops: ["R6"],
  // ゲスト（招いた外の人・D-155.35）はどの社内の役割にも入れない。知らない role_id のように管理者へ倒さない
  requester: [],
};

/** ゲストの役割の id と、ゲストの場所（入口と「この権限では見えない」の戻る先・K-877） */
export const GUEST_ROLE = "requester";
export const GUEST_HOME = "/portal";

/** 自分のこと（/me）の role_id。入っていなければ null・まだ分からなければ undefined。問い合わせは useMyRoles と同じ ["me"] を使う */
export function useMyRoleId(): { roleId: string | null | undefined } {
  const { session } = useSession();
  const q = useQuery({ queryKey: ["me"], queryFn: me, enabled: session != null, retry: false });
  if (session === undefined || (session != null && q.isPending)) return { roleId: undefined };
  if (session === null) return { roleId: null };
  return { roleId: q.data?.role_id ?? "owner" };
}

export function useMyRoles(): { roles: string[] | undefined; isGuest: boolean } {
  const { roleId } = useMyRoleId();
  if (roleId === undefined) return { roles: undefined, isGuest: false };
  if (roleId === null) return { roles: [], isGuest: false };
  return { roles: ROLE_OF[roleId] ?? ["R1", "R2"], isGuest: roleId === GUEST_ROLE };
}

/** その画面を見られる役割のときだけ中身を出す。見られないなら理由と導線 */
export function RequireRole({ screen, children }: { screen: ScreenId; children: ReactNode }) {
  const { roles, isGuest } = useMyRoles();
  const allowed = NAV.screens[screen]?.roles ?? [];
  if (roles === undefined) return <p className="p-8 text-[13.5px] text-[var(--on-sv)]">確かめています</p>;
  if (allowed.length && !roles.some((r) => allowed.includes(r)))
    return (
      <main className="mx-auto max-w-2xl px-4 py-20" data-state="forbidden">
        <h1 className="text-h1 font-bold tracking-[-0.015em]">{FALLBACKS.forbidden.title}</h1>
        <p className="mt-2 text-[14px] leading-[1.8]">
          この画面は「{NAV.screens[screen]?.name}」です。いまの権限では開けません。見える画面へ戻ります。
        </p>
        <Link
          href={isGuest ? pendingRoute(GUEST_HOME, "K-911") : pendingRoute(FALLBACKS.forbidden.back, "T-U-13")}
          className="mt-6 inline-flex"
        >
          <Button>見える画面へ</Button>
        </Link>
      </main>
    );
  return <>{children}</>;
}
