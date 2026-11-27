"use client";
// 入口（/）。指定が無いときの行き先は D-086／D-089：入っていなければ 入る画面、
// 入っていて はじめの設定（1〜6）が途中なら その段へ、通し終わっていれば 今日。
// 「どこまで進んだか」の判定は lib/onboarding に 1 か所だけ置く（L-008）。
// ゲスト（role_id requester）は、はじめの設定を通らずにゲストの場所へ送る（K-877・D-155.47）。役割の判定は入口だけ
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/session";
import { GUEST_HOME, GUEST_ROLE, useMyRoleId } from "@/lib/auth/role";
import { resumeHref, useSetupStep } from "@/lib/onboarding";
import { FALLBACKS } from "@/lib/nav.legacy";
import { isBuilt } from "@/lib/built-routes";
import type { Route } from "next";

export default function Home() {
  const router = useRouter();
  const { session } = useSession();
  const { roleId } = useMyRoleId();
  const isGuest = roleId === GUEST_ROLE;
  // ゲストには はじめの設定が無い：役割が分かるまで進み具合の口を呼ばない（ゲストは社内の口を呼ばない）
  const { step, loading } = useSetupStep(session != null && roleId != null && !isGuest);
  useEffect(() => {
    if (session === undefined) return;
    if (session === null) return void router.replace(FALLBACKS.entry.anonymous);
    if (roleId === undefined) return;
    if (isGuest) return void router.replace(GUEST_HOME as Route);
    if (loading || step === null) return;
    const back = resumeHref(step);
    // 通し終わった人の行き先（今日）がまだ無い間は、ある画面へ送る。入口が 404 に送ると行き止まりの輪になる
    const done = isBuilt(FALLBACKS.entry.signedIn) ? (FALLBACKS.entry.signedIn as Route) : ("/ai/talk" as Route);
    router.replace(back ?? done);
  }, [session, roleId, isGuest, loading, step, router]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-16" data-entry>
      <p className="text-[13.5px] text-[var(--on-sv)]">開いています</p>
    </main>
  );
}
