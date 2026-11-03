"use client";
// パスワードの再設定（T-U-06・A28）。状態：再設定を送る／送信後／新しいパスワード。登録の有無は漏らさない。再設定で既存の端末と Bridge は全部切れる（G-14）
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { Check, Info, Mail } from "lucide-react";
import { AuthFoot, AuthHead, AuthIcon, AuthNote, OutsideLayout } from "@/components/outside/outside-layout";
import { authClient } from "@/lib/auth/client";

function PasswordResetInner() {
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
      lead="パスワードを忘れても、自分で入り直せます。運営に連絡しなくて済むように作ってあります。"
    >
      {state === "p" ? (
        <form onSubmit={reset} noValidate data-state="p">
          <AuthHead title="新しいパスワード">前と同じものは使えません。</AuthHead>
          <div>
            <Field label="新しいパスワード">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  placeholder="英字と数字で 12 文字以上"
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
                  placeholder="もう一度入れてください"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  invalid={!!msg}
                />
              )}
            </Field>
            <Button type="submit" className="w-full" icon={<Check />} disabled={busy}>
              変更してログイン
            </Button>
          </div>
        </form>
      ) : state === "s" ? (
        <div data-state="s">
          <AuthIcon>
            <Mail />
          </AuthIcon>
          <AuthHead title="送りました">
            登録があれば、<b>{email}</b> に届きます（登録の有無はここでは表示しません）。リンクは30分で失効します。
          </AuthHead>
          <AuthNote icon={<Info />}>
            再設定すると、<b>今ログイン中の端末と Bridge の接続はすべて切れます</b>
            。入り直してからつなぎ直してください。
          </AuthNote>
          <Link href="/login" className="block">
            <Button variant="ghost" className="w-full">
              ログインへ戻る
            </Button>
          </Link>
        </div>
      ) : (
        <div data-state="n">
          <form onSubmit={send} noValidate>
            <AuthHead title="パスワードの再設定">登録したメールアドレスに再設定のリンクを送ります。</AuthHead>
            <div>
              <Field label="メールアドレス">
                {(id) => (
                  <Input
                    id={id}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="yamada@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" className="w-full" icon={<Mail />} disabled={busy}>
                再設定メールを送る
              </Button>
            </div>
          </form>
          <AuthFoot>
            <Link href="/login">ログインへ戻る</Link>
          </AuthFoot>
        </div>
      )}
    </OutsideLayout>
  );
}

// useSearchParams は Suspense の中でしか使えない（本番ビルドの prerender で落ちる。dev では出ない）
export default function PasswordResetPage() {
  return (
    <Suspense fallback={<p className="p-8 text-[13.5px] text-[var(--on-sv)]">読み込み中</p>}>
      <PasswordResetInner />
    </Suspense>
  );
}
