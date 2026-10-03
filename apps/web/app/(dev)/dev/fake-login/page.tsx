"use client";
// 1 回のログインを試す（T-B-38・T-B-39）の的：外のサービスのログイン画面の代わり。本番には出さない（(dev) の枠）。
//   ?mode=ok       ログイン名 me@example.com・パスワード S3cret-Plain! で入れる。違えば文言を出して欄を残す
//   ?mode=2fa      入れた後に 6 桁のコードを求める（autocomplete=one-time-code）。通るコードは無い（種類を選んでいない人の的）
//   ?mode=sms      入れた後に SMS のコードを求める。通るコードは 246810。通ったら「この端末を信頼する」Cookie を置き、次からはコードを聞かない（D-117.4）
//   ?mode=totp     入れた後に認証アプリの 6 桁を求める。鍵 JBSWY3DPEHPK3PXP（WebCrypto で検算）
//   ?mode=push     入れた後に「スマホで承認してください」で止まり、6 秒後に承認されたことにして入る
//   ?mode=captcha  ログインの欄の横に CAPTCHA（ロボットでない確認）が出る
//   ?mode=twostep  先にログイン名 → 次へ → パスワード（Google のような 2 段の画面）
//   ?mode=noform   ログインの欄が無いページ
import { useEffect, useState } from "react";

const LOGIN = "me@example.com";
// 通すパスワードは S3cret-Plain!。ページ（JS の束）に値そのものを埋めない：Bridge のブラウザのキャッシュに値が残るのは的の側の都合になる
const PASSWORD_REVERSED = "!nialP-terc3S";
const okPassword = (v: string) => v.split("").reverse().join("") === PASSWORD_REVERSED;
const SMS_CODE = "246810";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
// 端末を覚える Cookie。?dev=<id> で分ける（試験ごとに別の「端末」として振る舞う）
const trustCookie = () => `fake-login-trusted-${new URLSearchParams(window.location.search).get("dev") ?? "default"}=1`;
type Mode = "ok" | "2fa" | "sms" | "totp" | "push" | "captcha" | "twostep" | "noform";
const MODES: Mode[] = ["ok", "2fa", "sms", "totp", "push", "captcha", "twostep", "noform"];

/** RFC 6238（SHA-1・30 秒・6 桁）を WebCrypto で */
async function totp(secretBase32: string, at = Date.now()): Promise<string> {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, ""))
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = new Uint8Array((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = new Uint8Array(8);
  new DataView(counter.buffer).setBigUint64(0, BigInt(Math.floor(at / 30_000)));
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", k, counter));
  const off = h[h.length - 1]! & 0xf;
  const code =
    ((h[off]! & 0x7f) << 24) | ((h[off + 1]! & 0xff) << 16) | ((h[off + 2]! & 0xff) << 8) | (h[off + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export default function FakeLoginPage() {
  const [mode, setMode] = useState<Mode>("ok");
  const [step, setStep] = useState<"login" | "password" | "otp" | "push" | "done">("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode") as Mode | null;
    setMode(m && MODES.includes(m) ? m : "ok");
  }, []);
  useEffect(() => {
    if (step !== "push") return;
    const t = setTimeout(() => setStep("done"), 6_000); // 本人がスマホで承認したことにする
    return () => clearTimeout(t);
  }, [step]);
  const trusted = () =>
    typeof document !== "undefined" && document.cookie.split(";").some((c) => c.trim() === trustCookie());
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
    if (mode === "sms" && trusted()) return setStep("done"); // 通したログインを覚えている（D-117.4）
    if (mode === "2fa" || mode === "sms" || mode === "totp") return setStep("otp");
    if (mode === "push") return setStep("push");
    setStep("done");
  };
  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = otp.trim();
    const ok =
      mode === "sms"
        ? v === SMS_CODE
        : mode === "totp"
          ? v === (await totp(TOTP_SECRET)) || v === (await totp(TOTP_SECRET, Date.now() - 30_000))
          : false;
    if (!ok) return setError("コードが違います");
    setError(null);
    if (mode === "sms") document.cookie = `${trustCookie()}; path=/; max-age=86400`;
    setStep("done");
  };
  const main = (children: React.ReactNode) => <main style={{ padding: 32, fontFamily: "sans-serif" }}>{children}</main>;
  if (mode === "noform")
    return main(
      <>
        <h1>テスト用サービス</h1>
        <p>このページにはログインの欄がありません。</p>
      </>,
    );
  if (step === "done")
    return main(
      <>
        <h1>ようこそ、{login}</h1>
        <p data-logged-in>ログインしました。</p>
      </>,
    );
  if (step === "push")
    return main(
      <>
        <h1>スマホで承認してください</h1>
        <p data-push-waiting>登録したスマホに通知を送りました。承認すると続きます。</p>
      </>,
    );
  if (step === "otp")
    return main(
      <>
        <h1>{mode === "totp" ? "認証アプリのコードを入れてください" : "認証コードを入れてください"}</h1>
        <form onSubmit={submitOtp}>
          <label>
            認証コード{" "}
            <input
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </label>
          {error ? (
            <p role="alert" style={{ color: "#b00020" }}>
              {error}
            </p>
          ) : null}
          <button type="submit">確認</button>
        </form>
      </>,
    );
  return main(
    <>
      <h1>テスト用サービス — ログイン</h1>
      <form onSubmit={submit}>
        {step === "login" ? (
          <p>
            <label>
              メールアドレス{" "}
              <input
                name="email"
                type="email"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </label>
          </p>
        ) : null}
        {mode !== "twostep" || step === "password" ? (
          <p>
            <label>
              パスワード{" "}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
    </>,
  );
}
