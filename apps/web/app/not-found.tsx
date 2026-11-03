"use client";
// 無いパス（D-086）。素の 404 にしない。文言と戻る導線（入っていれば 入口へ／入っていなければ 入る画面へ）。
// 「設計にあるがまだ作っていない画面」と「そもそも無いパス」を分けて言う（どちらも行き止まりにしない）。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/auth/session";
import { FALLBACKS, NAV } from "@/lib/nav";

/** その道筋に当たる画面（:id は実際の値でも合う）。見つかれば「まだありません」と名前を出せる */
function screenOf(path: string): { name: string; purpose: string } | null {
  const ps = path.replace(/\/+$/, "").split("/");
  for (const s of Object.values(NAV.screens)) {
    const bs = s.route.replace(/\/+$/, "").split("/");
    if (bs.length === ps.length && bs.every((x, i) => x.startsWith(":") || x === ps[i]))
      return { name: s.name, purpose: s.purpose };
  }
  return null;
}

export default function NotFound() {
  const { session } = useSession();
  const path = usePathname() ?? "";
  const soon = screenOf(path);
  const href = session ? "/" : FALLBACKS.entry.anonymous;
  return (
    <main className="mx-auto max-w-2xl px-4 py-20" data-state={soon ? "not-built" : "not-found"}>
      <h1 className="text-h1 font-bold tracking-[-0.015em]">
        {soon ? `「${soon.name}」はまだありません` : FALLBACKS.notFound.title}
      </h1>
      <p className="mt-2 text-[14px] leading-[1.8]">
        {soon ? (
          <>この画面はこれから作ります（{soon.purpose.slice(0, 60)}）。できるまでは開けません。下から戻れます。</>
        ) : (
          <>URL が違うか、その画面はまだありません。下から戻れます。</>
        )}
      </p>
      <Link href={href} className="mt-6 inline-flex">
        <Button>{session ? "入口へ戻る" : "ログインへ戻る"}</Button>
      </Link>
    </main>
  );
}
