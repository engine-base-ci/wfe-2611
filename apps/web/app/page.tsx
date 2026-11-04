"use client";
// 入口（/）。指定が無いときの行き先は D-086／D-089：入っていなければ 入る画面、
// 入っていて はじめの設定（1〜6）が途中なら その段へ、通し終わっていれば 今日。
// 「どこまで進んだか」の判定は lib/onboarding に 1 か所だけ置く（L-008）
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/session";
import { resumeHref, useSetupStep } from "@/lib/onboarding";
import { FALLBACKS } from "@/lib/nav.legacy";
import { isBuilt } from "@/lib/built-routes";
import type { Route } from "next";

export default function Home() {
  const router = useRouter();
  const { session } = useSession();
  const { step, loading } = useSetupStep(session != null);
  useEffect(() => {
    if (session === undefined) return;
    if (session === null) return void router.replace(FALLBACKS.entry.anonymous);
    if (loading || step === null) return;
    const back = resumeHref(step);
    // 通し終わった人の行き先（今日）がまだ無い間は、ある画面へ送る。入口が 404 に送ると行き止まりの輪になる
    const done = isBuilt(FALLBACKS.entry.signedIn) ? (FALLBACKS.entry.signedIn as Route) : ("/ai/chat" as Route);
    router.replace(back ?? done);
  }, [session, loading, step, router]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-16" data-entry>
      <p className="text-[13.5px] text-[var(--on-sv)]">開いています</p>
    </main>
  );
}
