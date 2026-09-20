"use client";
// 入口（/）。指定が無いときの行き先は D-086：入っていなければ 入る画面、入っていれば 製品の時点の画面
// （PC をつないでいなければ 自分のPCをつなぐ／つないでいれば 今日）。素のプレースホルダを出さない
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/session";
import { useList } from "@/lib/api";
import { pendingRoute } from "@/lib/pending-route";
import { FALLBACKS } from "@/lib/nav";

export default function Home() {
  const router = useRouter();
  const { session } = useSession();
  // 時点：自分の Bridge のセッションが生きているか（入っているときだけ引く）
  const sessions = useList<{ kind_id?: string; revoked_at?: string | null }>("sessions", { limit: 50 }, "entry", {
    enabled: session != null,
  });
  const ready = session === null || (session != null && !sessions.isPending);
  useEffect(() => {
    if (!ready) return;
    if (session === null) return void router.replace(FALLBACKS.entry.anonymous);
    const bridge = (sessions.data?.data ?? []).some((s) => s.kind_id === "bridge" && !s.revoked_at);
    router.replace(bridge ? pendingRoute(FALLBACKS.entry.signedIn, "T-U-13") : FALLBACKS.entry.noBridge);
  }, [ready, session, sessions.data, router]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-16" data-entry>
      <p className="text-[13.5px] text-[var(--on-sv)]">開いています</p>
    </main>
  );
}
