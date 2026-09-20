"use client";
// 無いパス（D-086）。素の 404 にしない。文言と戻る導線（入っていれば 入口へ／入っていなければ 入る画面へ）
import Link from "next/link";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/auth/session";
import { FALLBACKS } from "@/lib/nav";

export default function NotFound() {
  const { session } = useSession();
  const href = session ? "/" : FALLBACKS.entry.anonymous;
  return (
    <main className="mx-auto max-w-2xl px-4 py-20" data-state="not-found">
      <h1 className="text-h1 font-bold tracking-[-0.015em]">{FALLBACKS.notFound.title}</h1>
      <p className="mt-2 text-[14px] leading-[1.8]">URL が違うか、その画面はまだありません。下から戻れます。</p>
      <Link href={href} className="mt-6 inline-flex">
        <Button>{session ? "入口へ戻る" : "ログインへ戻る"}</Button>
      </Link>
    </main>
  );
}
