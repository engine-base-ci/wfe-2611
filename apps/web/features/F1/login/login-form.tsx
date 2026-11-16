"use client";
// ログインする（T-U-05・A13・K-221・キャンバス AuthLogin・Auth2FA）。入口の枠（AuthFrame）と k の部品（size lg）に載せる。
//   状態（form の data-state）：n 通常／e 失敗（残り回数・ロック）／m 確認のコード（バックアップコードもここ）。
//   ロックと残り回数は口が決める（E-AUTH-001／002）。Cookie は使わず Bearer だけ（D-051.2）。
//   パスキー・QR・端末をなくした はまだ作っていない（K-74・K-75）ので、出すが押せない（D-145.9）
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Fingerprint } from "lucide-react";
import { Button, PasswordField, TextField } from "@/components/k";
import { AuthExtError, signIn, verifyTwoFactor } from "@/lib/auth/ext";
import { afterLogin } from "@/lib/after-login";
import { AuthFrame } from "../sign-up/frame";
import { CODE_LENGTH, CodeBoxes, EMPTY_CODE } from "./code-boxes";
import "./login.css";

type Step = "n" | "e" | "m";
const FALLBACK = "うまくいきませんでした。もう一度試してください";
const NEED_CODE = "6 けたを入れてください";
const messageOf = (err: unknown): string => (err instanceof AuthExtError ? err.message : FALLBACK);
/** バックアップコードは全角を半角にし、前後の空白を落とすだけ（口はちょうど同じかで照らすので、大小はそろえない） */
const tidyBackup = (v: string): string => v.normalize("NFKC").trim();

/** 押せない行き先（その画面がまだ無い）。href なし・Tab で止まらない・正本の使えない状態の薄さ */
function Unbuilt({ children }: { children: string }) {
  return (
    <a role="link" aria-disabled="true" tabIndex={-1} className="k-login-off">
      {children}
    </a>
  );
}

function Alert({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="alert" className="k-login-alert">
      {msg}
    </p>
  ) : null;
}

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("n");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState<readonly string[]>(EMPTY_CODE);
  const [backup, setBackup] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [tfCookie, setTfCookie] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false); // 2 回押し・6 つそろった瞬間の重なりで口を 2 回呼ばない
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const run = async (call: () => Promise<void>, onError: (err: unknown) => void) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMsg(null);
    try {
      await call();
    } catch (err) {
      onError(err);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(
      async () => {
        const r = await signIn({ email, password });
        if (r.two_factor) {
          setTfCookie(r.two_factor_cookie);
          setStep("m");
          return;
        }
        router.push(afterLogin(next));
      },
      (err) => {
        setStep("e");
        setMsg(messageOf(err));
      },
    );
  };

  const verify = (body: { code: string; trust_device: true } | { backup_code: string }) =>
    run(
      async () => {
        await verifyTwoFactor({ two_factor_cookie: tfCookie ?? "", ...body });
        router.push(afterLogin(next));
      },
      (err) => {
        setMsg(messageOf(err));
        if ("code" in body) {
          setCode(EMPTY_CODE);
          boxes.current[0]?.focus();
        }
      },
    );

  // この端末では 30 日間きかない のチェックはキャンバスに無いので出さず、今の既定どおり trust_device: true（PM の決め）
  const onCode = (nextCode: string[]) => {
    setCode(nextCode);
    if (nextCode.every((d) => d !== "")) void verify({ code: nextCode.join(""), trust_device: true });
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (useBackup) {
      void verify({ backup_code: tidyBackup(backup) });
      return;
    }
    const joined = code.join("");
    if (joined.length < CODE_LENGTH) {
      setMsg(NEED_CODE);
      return;
    }
    void verify({ code: joined, trust_device: true });
  };

  const switchBackup = (on: boolean) => {
    setUseBackup(on);
    setCode(EMPTY_CODE);
    setBackup("");
    setMsg(null);
  };

  if (step === "m")
    return (
      <AuthFrame>
        <form className="k-auth-form" data-auth="login" data-state="m" onSubmit={submitCode} noValidate>
          {useBackup ? (
            <>
              <h1>バックアップコードで入る</h1>
              <p className="k-auth-lead" data-kind="body">
                2 段階認証を付けたときに保管したバックアップコードの 1 つを入れてください。1 つ使うと消える
              </p>
              <TextField
                size="lg"
                label="バックアップコード"
                name="backup_code"
                aria-label="バックアップコード"
                autoComplete="off"
                placeholder="例：7KQM-2XPA"
                value={backup}
                onChange={(e) => setBackup(e.target.value)}
              />
            </>
          ) : (
            <>
              <h1>確認のコード</h1>
              <p className="k-auth-lead" data-kind="body">
                2 段階認証を付けているので、認証アプリ（Google Authenticator・1Password など）に出ている 6
                けたの数字を入れてください
              </p>
              <CodeBoxes code={code} onCode={onCode} inputs={boxes} />
              <p className="k-auth-note">数字は 30 秒ごとに変わる ・ 6 つそろうと自動で進む</p>
            </>
          )}
          <Alert msg={msg} />
          <Button type="submit" size="lg" loading={busy}>
            入る
          </Button>
          <div className="k-auth-alt k-login-alt-col">
            <button type="button" className="k-login-textbtn" onClick={() => switchBackup(!useBackup)}>
              {useBackup ? "認証アプリの 6 けたで入る" : "認証アプリが使えない"}
            </button>
            <span className="k-login-muted">この画面は 2 段階認証を付けている人だけに出る</span>
          </div>
        </form>
      </AuthFrame>
    );

  return (
    <AuthFrame>
      <form className="k-auth-form" data-auth="login" data-state={step} onSubmit={submit} noValidate>
        <h1>ログイン</h1>
        <Button
          type="button"
          size="lg"
          data-act="passkey"
          disabled
          aria-disabled="true"
          icon={<Fingerprint size={18} />}
        >
          パスキーで入る
        </Button>
        <p className="k-auth-note k-login-pk-note">
          指・顔・PC のロックで入る。いちばん安全で速い ・ この PC にパスキーが無いときは{" "}
          <Unbuilt>スマホで QR を読み取る</Unbuilt>
        </p>
        <div className="k-login-sep">
          <span aria-hidden="true" className="k-login-sep-line" />
          <span>またはメールとパスワード</span>
          <span aria-hidden="true" className="k-login-sep-line" />
        </div>
        <div className="k-login-bare">
          <TextField
            size="lg"
            label="メールアドレス"
            name="email"
            aria-label="メールアドレス"
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="メール"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={step === "e" || undefined}
          />
          <PasswordField
            size="lg"
            label="パスワード"
            name="password"
            aria-label="パスワード"
            autoComplete="current-password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={step === "e" || undefined}
          />
        </div>
        <Alert msg={msg} />
        <Button type="submit" size="lg" variant="outlined" loading={busy}>
          次へ
        </Button>
        <div className="k-login-links">
          <Link href="/password-reset">パスワードを忘れた</Link>
          <Unbuilt>端末をなくした</Unbuilt>
        </div>
        <p className="k-auth-alt">
          はじめての方は <Link href="/signup">アカウントを作る</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
