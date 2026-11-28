"use client";
// ログインする（T-U-05・A13）。画面の中身は features/F1/login（K-221・入口の枠と k の部品）。ここは入れ物だけ
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ConsentTerms } from "@/features/F1/consent-terms/consent-terms";
import { AuthLoading } from "@/features/F1/sign-up/auth-loading";
import { LoginForm } from "@/features/F1/login";

function LoginInner() {
  const sp = useSearchParams();
  // 規約の同意し直し（K-53）はログインの画面の続き（/login?step=terms&next=…）として出す。新しい道は作らない
  if (sp.get("step") === "terms") return <ConsentTerms next={sp.get("next")} />;
  return <LoginForm next={sp.get("next")} />;
}

// useSearchParams は Suspense の中でしか使えない（本番ビルドの prerender で落ちる。dev では出ない）
export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <LoginInner />
    </Suspense>
  );
}
