"use client";
// 入り直す（T-U-06・A28）。状態：入り直す／送信後／新しいパスワード。登録の有無は漏らさない。再設定で既存の端末と Bridge は全部切れる（G-14）
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { OutsideLayout } from "@/components/outside/outside-layout";
import { authClient } from "@/lib/auth/client";

export default function PasswordResetPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token");
  const [state, setState] = useState<"n" | "s" | "p">(token ? "p" : "n");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await authClient.requestPasswordReset({
      email: email.normalize("NFKC").replace(/\s+/g, "").toLowerCase(),
      redirectTo: "/password-reset",
    });
    setBusy(false);
    setState("s"); // 登録の有無は表示しない（メールが届くかどうかだけ）
  };
  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 12) return setMsg("パスワードは 12 文字以上にしてください");
    if (pw !== pw2) return setMsg("2 つのパスワードが違います");
    setBusy(true);
    const r = await authClient.resetPassword({ newPassword: pw, token: token ?? "" });
    setBusy(false);
    if (r.error) return setMsg("リンクの期限が切れているか、前と同じパスワードです。もう一度メールを送ってください");
    router.push("/login");
  };
  return (
    <OutsideLayout
      pitch={<>詰まらせない。</>}
      lead="パスワードを忘れても、端末を失くしても、自分で入り直せます。運営に連絡しなくて済むように作ってあります。"
    >
      {state === "p" ? (
        <form onSubmit={reset} noValidate data-state="p">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">新しいパスワード</h1>
          <p className="mt-1 text-[13.5px] text-[var(--on-sv)]">前と同じものは使えません。</p>
          <div className="mt-6">
            <Field label="新しいパスワード">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
              )}
            </Field>
            <Field label="もう一度" error={msg ?? undefined}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  invalid={!!msg}
                />
              )}
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              変更してログイン
            </Button>
          </div>
        </form>
      ) : state === "s" ? (
        <div data-state="s">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">送りました</h1>
          <p className="mt-2 text-[14px] leading-[1.8]">
            登録があれば、<b>{email}</b> に届きます（登録の有無はここでは表示しません）。リンクは30分で失効します。
          </p>
          <p className="mt-2 text-[13.5px] leading-[1.8]">
            再設定すると、<b>今ログイン中の端末と Bridge の接続はすべて切れます</b>
            。入り直してからつなぎ直してください。
          </p>
          <Link href="/login" className="mt-6 inline-flex">
            <Button variant="outline">ログインへ戻る</Button>
          </Link>
        </div>
      ) : (
        <div data-state="n">
          <form onSubmit={send} noValidate>
            <h1 className="text-h1 font-bold tracking-[-0.015em]">入り直す</h1>
            <p className="mt-1 text-[13.5px] text-[var(--on-sv)]">登録したメールアドレスに再設定のリンクを送ります。</p>
            <div className="mt-6">
              <Field label="メールアドレス">
                {(id) => (
                  <Input
                    id={id}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>
                再設定メールを送る
              </Button>
            </div>
          </form>
          <section className="mt-10 border-t border-[var(--line)] pt-6" data-backup>
            <h2 className="text-h2 font-bold">端末を失くした（認証アプリが使えない）</h2>
            <p className="mt-1 text-[13.5px] text-[var(--on-sv)]">
              設定時に保管した回復コードのどれか1つで入れます。ログインでパスワードを入れたあと、「端末を失くした（回復コードで入る）」を押してください。
            </p>
            <Link href="/login" className="mt-4 inline-flex">
              <Button variant="outline">回復コードで入る（ログインへ）</Button>
            </Link>
          </section>
          <p className="mt-6 text-[13px] text-[var(--on-sv)]">
            <Link className="font-semibold text-[var(--primary)] underline" href="/login">
              ログインへ戻る
            </Link>
          </p>
        </div>
      )}
    </OutsideLayout>
  );
}
