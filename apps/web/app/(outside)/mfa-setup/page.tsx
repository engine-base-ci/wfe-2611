"use client";
// 2段階認証を設定する（T-U-04・A04）。状態：登録／回復コード（10 個・閉じると二度と表示しない＝2FA 紛失で復旧不能を構造で潰す）
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { OutsideLayout } from "@/components/outside/outside-layout";
import { authClient } from "@/lib/auth/client";

export default function MfaSetupPage() {
  const [state, setState] = useState<"n" | "rc">("n");
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const secret = uri ? (new URL(uri).searchParams.get("secret") ?? "") : "";
  useEffect(() => {
    if (!uri) return;
    QRCode.toDataURL(uri, { margin: 1, width: 180 }).then(setQr);
  }, [uri]);
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (r.error) return setMsg(r.error.status === 401 ? "ログインしてから設定してください" : "パスワードが違います");
    const d = r.data as { totpURI: string; backupCodes: string[] };
    setUri(d.totpURI);
    setCodes(d.backupCodes);
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await authClient.twoFactor.verifyTotp({ code: code.normalize("NFKC").replace(/\s+/g, "") });
    setBusy(false);
    if (r.error) return setMsg("6 桁が違います。認証アプリの今の数字を入れてください");
    setState("rc");
  };
  const copy = () => navigator.clipboard?.writeText(codes.join("\n"));
  // ファイルで保存（モックの「ファイルで保存」）：ブラウザのダウンロードだけ。サーバには送らない
  const saveFile = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([`Kaname 回復コード（1 つ使うと消えます）\n\n${codes.join("\n")}\n`], { type: "text/plain" }),
    );
    a.download = "kaname-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <OutsideLayout
      pitch={
        <>
          入るときは、
          <br />
          もう1つの鍵を。
        </>
      }
      lead="パスワードだけでは入れません。認証アプリの6桁が要ります。端末を失くしたときのために回復コードを保管してください。"
    >
      {state === "rc" ? (
        <div data-state="rc">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">回復コードを保管してください</h1>
          <p className="mt-2 text-[14px] leading-[1.8]">
            端末を失くしたとき、この10個のどれか1つで入れます。1つ使うと消えます。
            <b>ここを閉じると二度と表示しません。</b>
          </p>
          <ul
            className="num mt-5 grid grid-cols-2 gap-2 rounded-[var(--r-md)] bg-[var(--sv)] p-4 font-[var(--font-code)] text-[14px]"
            data-backup-codes
          >
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copy}>
              コピー
            </Button>
            <Button variant="outline" size="sm" onClick={saveFile}>
              ファイルで保存
            </Button>
          </div>
          <label className="mt-6 flex items-center gap-2 text-[13.5px]">
            <input type="checkbox" className="size-4" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            安全な場所に保管しました
          </label>
          <Link
            href="/setup/bridge"
            className={`mt-4 inline-flex ${saved ? "" : "pointer-events-none"}`}
            aria-disabled={!saved}
          >
            <Button disabled={!saved}>次へ（PCをつなぐ）</Button>
          </Link>
        </div>
      ) : (
        <div data-state="n">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">2段階認証を設定する</h1>
          {!uri ? (
            <form onSubmit={start} noValidate className="mt-6">
              <p className="mb-4 text-[13.5px] text-[var(--on-sv)]">
                確認のため、いまのパスワードを入れてください。認証アプリ（Google Authenticator 等）が要ります。
              </p>
              <Field label="パスワード" error={msg ?? undefined}>
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="current-password"
                    placeholder="いまのパスワード"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    invalid={!!msg}
                  />
                )}
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>
                認証アプリを登録する
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} noValidate className="mt-6">
              <p className="text-[13.5px] text-[var(--on-sv)]">
                認証アプリ（Google Authenticator 等）で読み取ってください。
              </p>
              <div className="mt-4 flex flex-wrap items-start gap-5">
                {qr ? (
                  <img
                    src={qr}
                    alt="認証アプリで読み取る QR コード"
                    width={180}
                    height={180}
                    className="rounded-[var(--r-md)] bg-white p-1 shadow-[0_0_0_1px_var(--line)]"
                  />
                ) : null}
                <div className="min-w-0 text-[13px]">
                  <div className="text-[12px] font-semibold text-[var(--on-sv)]">読み取れない場合は</div>
                  <code
                    className="num mt-1 block rounded-[var(--r-md)] bg-[var(--sv)] px-3 py-2 font-[var(--font-code)] text-[14px] tracking-[0.12em] break-all"
                    data-totp-secret
                  >
                    {secret.replace(/(.{4})/g, "$1 ").trim()}
                  </code>
                </div>
              </div>
              <div className="mt-5">
                <Field label="アプリに出た6桁" error={msg ?? undefined}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      invalid={!!msg}
                    />
                  )}
                </Field>
                <Button type="submit" className="w-full" disabled={busy}>
                  登録する
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </OutsideLayout>
  );
}
