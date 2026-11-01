"use client";
// 記憶の毎朝のまとめと確認待ち（D-105）の見本。本物の API につながる（ログインが要る）。
// 置き場の画面（今日 T-U-13・自分のAIの記憶 T-U-29・ルール T-U-34・アカウント T-U-44・お知らせ T-U-51）ができるまで、ここで押して確かめる
import { AlwaysAllowList, MemoryDigest, MemoryReviews, NotifyToggles, UsagePanel } from "@/components/ai";
import { RequireSession } from "@/lib/auth/session";

export default function DevMemory() {
  return (
    <RequireSession fallback={<p className="p-8">ログインを確かめています</p>}>
      <main className="mx-auto flex max-w-[860px] flex-col gap-8 p-6">
        <h1 className="text-h1 font-bold">記憶のまとめ（見本）</h1>
        <MemoryDigest />
        <MemoryReviews />
        <AlwaysAllowList />
        <UsagePanel />
        <NotifyToggles />
      </main>
    </RequireSession>
  );
}
