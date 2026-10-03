"use client";
// 1 回のログインを試す（T-B-38）の的：外のサービスのログイン画面の代わり。本番には出さない（(dev) の枠）。
//   ?mode=ok       ログイン名 me@example.com・パスワード S3cret-Plain! で入れる。違えば文言を出して欄を残す
//   ?mode=2fa      入れた後に 6 桁のコードを求める（autocomplete=one-time-code）
//   ?mode=captcha  ログインの欄の横に CAPTCHA（ロボットでない確認）が出る
//   ?mode=twostep  先にログイン名 → 次へ → パスワード（Google のような 2 段の画面）
//   ?mode=noform   ログインの欄が無いページ
import { useEffect, useState } from "react";

const LOGIN = "me@example.com";
// 通すパスワードは S3cret-Plain!。ページ（JS の束）に値そのものを埋めない：Bridge のブラウザのキャッシュに値が残るのは的の側の都合になる
const PASSWORD_REVERSED = "!nialP-terc3S";
const okPassword = (v: string) => v.split("").reverse().join("") === PASSWORD_REVERSED;
type Mode = "ok" | "2fa" | "captcha" | "twostep" | "noform";

export default function FakeLoginPage() {
  const [mode, setMode] = useState<Mode>("ok");
  const [step, setStep] = useState<"login" | "password" | "otp" | "done">("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode") as Mode | null;
    setMode(m && ["ok", "2fa", "captcha", "twostep", "noform"].includes(m) ? m : "ok");
    setStep(m === "twostep" ? "login" : "login");
  }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "twostep" && step === "login") {
      if (!login) return setError("メールアドレスを入れてください");
      setError(null);
      setStep("password");
      return;
    }
    if (login !== LOGIN || !okPassword(password)) return setError("メールアドレスかパスワードが違います");
    setError(null);
    setStep(mode === "2fa" ? "otp" : "done");
  };
  if (mode === "noform")
    return (
      <main style={{ padding: 32, fontFamily: "sans-serif" }}>
        <h1>テスト用サービス</h1>
        <p>このページにはログインの欄がありません。</p>
      </main>
    );
  if (step === "done")
    return (
      <main style={{ padding: 32, fontFamily: "sans-serif" }}>
        <h1>ようこそ、{login}</h1>
        <p data-logged-in>ログインしました。</p>
      </main>
    );
  if (step === "otp")
    return (
      <main style={{ padding: 32, fontFamily: "sans-serif" }}>
        <h1>認証コードを入れてください</h1>
        <form onSubmit={(e) => e.preventDefault()}>
          <label>
            認証コード <input name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
          </label>
          <button type="submit">確認</button>
        </form>
      </main>
    );
  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>テスト用サービス — ログイン</h1>
      <form onSubmit={submit}>
        {step === "login" ? (
          <p>
            <label>
              メールアドレス <input name="email" type="email" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />
            </label>
          </p>
        ) : null}
        {mode !== "twostep" || step === "password" ? (
          <p>
            <label>
              パスワード <input name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </p>
        ) : null}
        {mode === "captcha" ? (
          <div className="g-recaptcha" style={{ border: "1px solid #999", padding: 12, width: 260 }}>
            <input type="checkbox" /> 私はロボットではありません
          </div>
        ) : null}
        {error ? (
          <p role="alert" style={{ color: "#b00020" }}>
            {error}
          </p>
        ) : null}
        <button type="submit">{mode === "twostep" && step === "login" ? "次へ" : "ログイン"}</button>
      </form>
    </main>
  );
}
