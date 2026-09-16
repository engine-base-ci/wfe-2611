"use client";
// メールを確認する（T-U-02・A02）。状態：送信済み／確認できた／期限切れ。詰まらせない：再送だけで回復できる
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { OutsideLayout, SETUP_STEPS } from "@/components/outside/outside-layout";
import { authClient } from "@/lib/auth/client";
import { setToken } from "@/lib/api/client";

function VerifyEmailInner() {
  const sp = useSearchParams();
  const token = sp.get("token");
  const email = sp.get("email") ?? "";
  const [state, setState] = useState<"n" | "ok" | "x">(token ? "x" : "n");
  const [checking, setChecking] = useState(!!token);
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    authClient
      .verifyEmail({ query: { token } })
      .then((r) => {
        if (!alive) return;
        setChecking(false);
        if (r.error) return setState("x");
        const t = (r.data as { token?: string } | null)?.token;
        if (t) setToken(t);
        setState("ok");
      })
      .catch(() => {
        if (!alive) return;
        setChecking(false);
        setState("x");
      });
    return () => {
      alive = false;
    };
  }, [token]);
  const resend = async () => {
    const r = await authClient.sendVerificationEmail({ email: email || "", callbackURL: "/verify-email" });
    setSent(
      r.error
        ? "送れませんでした。メールアドレスを確かめてください"
        : "もう一度送りました。届くまで 1〜2 分かかることがあります",
    );
  };
  return (
    <OutsideLayout
      pitch={
        <>
          自分のAIが、
          <br />
          会社を回す。
        </>
      }
      lead="会社のことを自分のAIに話すだけで、目標・台帳・担当業務・AI社員のたたき台ができます。"
      steps={SETUP_STEPS}
    >
      {state === "ok" ? (
        <div data-state="ok">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">確認できました</h1>
          <p className="mt-2 text-[14px] leading-[1.8]">
            次は自分のPCをつなぎます。<b>自分のAIはあなたのPCで、あなたのサブスクで動く</b>
            ので、つながるまで話せません。そのあと訊かれたことに答えるだけで、会社のたたき台ができます。
          </p>
          <Link href="/setup/bridge" className="mt-6 inline-flex">
            <Button>はじめの設定をはじめる（PCをつなぐ）</Button>
          </Link>
        </div>
      ) : state === "x" ? (
        <div data-state="x">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">
            {checking ? "確認しています" : "リンクの期限が切れています"}
          </h1>
          {!checking ? (
            <>
              <p className="mt-2 text-[14px] leading-[1.8]">
                30分を過ぎました。新しいリンクを送ります。古いリンクはもう使えません。
              </p>
              <div className="mt-6">
                <Button onClick={resend}>新しいリンクを送る</Button>
              </div>
              {sent ? (
                <p className="mt-3 text-[13px] text-[var(--on-sv)]" role="status">
                  {sent}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <div data-state="n">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">メールを確認してください</h1>
          <p className="mt-2 text-[14px] leading-[1.8]">
            <b className="num">{email || "登録したメールアドレス"}</b>{" "}
            にリンクを送りました。押すと本人であることが記録され、自分のAIとのはじめの設定に進みます。
          </p>
          <p className="mt-2 text-[13px] text-[var(--on-sv)]">
            リンクは <b>30分</b> で失効します。届かない場合は迷惑メールも確認してください。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={resend}>
              もう一度送る
            </Button>
            <span className="text-[13px] text-[var(--on-sv)]">
              メールアドレスを間違えた？{" "}
              <Link className="font-semibold text-[var(--primary)] underline" href="/signup">
                入力し直す
              </Link>
            </span>
          </div>
          {sent ? (
            <p className="mt-3 text-[13px] text-[var(--on-sv)]" role="status">
              {sent}
            </p>
          ) : null}
          <p className="mt-8 text-[12.5px] text-[var(--on-sv)]">
            先に進む：
            <Link className="font-semibold text-[var(--primary)] underline" href="/setup/bridge">
              はじめの設定をはじめる
            </Link>
            （メールの確認はあとからでもできます）
          </p>
        </div>
      )}
    </OutsideLayout>
  );
}

// useSearchParams は Suspense の中でしか使えない（本番ビルドの prerender で落ちる。dev では出ない）
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="p-8 text-[13.5px] text-[var(--on-sv)]">読み込み中</p>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
