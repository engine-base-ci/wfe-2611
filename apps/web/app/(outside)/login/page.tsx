"use client";
// ログインする（T-U-05・A13）。状態：通常／6 桁の入力（回復コードもここ）／失敗（残り回数）。5 回で 15 分ロック（E-AUTH-001／002）。Cookie は使わず Bearer だけ（D-051.2）
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { LogIn } from "lucide-react";
import { AuthFoot, OutsideLayout } from "@/components/outside/outside-layout";
import { AuthExtError, signIn, verifyTwoFactor } from "@/lib/auth/ext";
import { afterLogin } from "@/lib/after-login";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next"); // 行き先は afterLogin が今のデータから決める（設定が済んでいない人を 今日 へ飛ばさない）
  const [state, setState] = useState<"n" | "m" | "e">("n");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(true);
  const [tfCookie, setTfCookie] = useState<string | null>(null);
  const [useBackup, setUseBackup] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await signIn({ email, password });
      if (r.two_factor) {
        setTfCookie(r.two_factor_cookie);
        return setState("m");
      }
      router.push(afterLogin(next));
    } catch (err) {
      setState("e");
      setMsg(err instanceof AuthExtError ? err.message : "うまくいきませんでした。もう一度試してください");
    } finally {
      setBusy(false);
    }
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await verifyTwoFactor({
        two_factor_cookie: tfCookie ?? "",
        ...(useBackup ? { backup_code: code } : { code, trust_device: trust }),
      });
      router.push(afterLogin(next));
    } catch (err) {
      setMsg(err instanceof AuthExtError ? err.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  };
  return (
    <OutsideLayout
      pitch={
        <>
          今日も、
          <br />
          自分のAIが先に動いている。
        </>
      }
      lead="夜のうちにAI社員が動き、自分のAIが一次確認を終えています。ログインすると申し送りから始まります。"
    >
      {state === "m" ? (
        <form onSubmit={verify} noValidate data-state="m">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">
            {useBackup ? "回復コードを入れてください" : "6桁を入れてください"}
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--on-sv)]">
            {useBackup
              ? "設定時に保管した10個のどれか1つ。1つ使うと消えます。"
              : "認証アプリに出ている数字です。30秒ごとに変わります。"}
          </p>
          <div className="mt-6">
            <Field label={useBackup ? "回復コード" : "6桁"} error={msg ?? undefined}>
              {(id) => (
                <Input
                  id={id}
                  inputMode={useBackup ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  maxLength={useBackup ? 16 : 8}
                  placeholder={useBackup ? "k8f2-9x1m" : "000000"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  invalid={!!msg}
                />
              )}
            </Field>
            {!useBackup ? (
              <label className="mb-5 flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={trust}
                  onChange={(e) => setTrust(e.target.checked)}
                />
                この端末では30日間きかない
              </label>
            ) : null}
            <Button type="submit" className="w-full" icon={<LogIn />} disabled={busy}>
              今日の画面へ
            </Button>
          </div>
          <p className="mt-5 text-[13px] text-[var(--on-sv)]">
            <button
              type="button"
              className="font-semibold text-[var(--primary)] underline"
              onClick={() => {
                setUseBackup(!useBackup);
                setCode("");
                setMsg(null);
              }}
            >
              {useBackup ? "認証アプリの6桁で入る" : "端末を失くした（回復コードで入る）"}
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={submit} noValidate data-state={state}>
          <h1 className="text-h1 font-bold tracking-[-0.015em]">ログイン</h1>
          <p className="mt-1 text-[13.5px] text-[var(--on-sv)]">毎日ここから。</p>
          <div className="mt-6">
            <Field label="メールアドレス">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="yamada@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  invalid={state === "e"}
                />
              )}
            </Field>
            <Field label="パスワード" error={msg ?? undefined}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  placeholder="英字と数字で 12 文字以上"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  invalid={state === "e"}
                />
              )}
            </Field>
            <Button type="submit" className="w-full" icon={<LogIn />} disabled={busy}>
              ログイン
            </Button>
          </div>
          <AuthFoot>
            <Link href="/password-reset">パスワードをお忘れの方</Link>
            <span aria-hidden="true" className="mx-3">·</span>
            <Link href="/signup">アカウントを作る</Link>
          </AuthFoot>
        </form>
      )}
    </OutsideLayout>
  );
}

// useSearchParams は Suspense の中でしか使えない（本番ビルドの prerender で落ちる。dev では出ない）
export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-[13.5px] text-[var(--on-sv)]">読み込み中</p>}>
      <LoginInner />
    </Suspense>
  );
}
