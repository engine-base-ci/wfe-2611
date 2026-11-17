"use client";
// ログインする（T-U-05・A13・K-221 → K-316）。見た目は段 2 の部品（views の LoginMain・LoginCode・LoginBlocked・入口の枠は views が持つ）。
//   口は契約の口だけ：signInWithPassword（メールとパスワード）・verifySignInCode（6 けた・バックアップコード）。Cookie は使わず Bearer だけ（D-051.2）。
//   答えの code で出し分ける：401 E-AUTH-001 違う／429 E-AUTH-002 ロック／429 そのほか 送りすぎ／403 E-AUTH-011・012・007 止め／
//   確かめの 401 E-AUTH-004 違う・401 E-AUTH-013 待ちの印が切れた・429 E-AUTH-014 確認のコードの止め。
//   待ちの印（pending）は画面のメモリだけに持つ（再読み込みで最初に戻る）。「この端末を信頼する」は送らない（D-128.60）。
//   パスキー・スマホの QR・端末をなくした は K-317 がつなぐ。それまでは出すがグレーで押せない（D-145.9）
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { CATALOG } from "@kaname/errors/catalog";
import { call, type CallErr } from "@/lib/api/call";
import { setToken } from "@/lib/api/client";
import { refreshSession } from "@/lib/auth/client";
import { afterLogin } from "@/lib/after-login";
import { CODE_LENGTH, EMPTY_CODE } from "./code-boxes";
import { LoginBlocked, LoginCode, LoginMain } from "./views";

type Step = "main" | "code" | "blocked";
const FALLBACK = "うまくいきませんでした。もう一度試してください";
const NEED_CODE = "6 けたを入れてください";
/** 空のバックアップコード：新しい文は作らず、正本の「コードが空」の文（E-VAL-009） */
const EMPTY_BACKUP = CATALOG["E-VAL-009"]?.message ?? "E-VAL-009";
/** パスワードが合った後に分かる止め（人・会社が止められた・会社の人が無い）：止めの画面（LoginBlocked）に出す */
const BLOCKED = new Set(["E-AUTH-011", "E-AUTH-012", "E-AUTH-007"]);
/** 「パスワードを忘れた」で再設定の画面へメールを渡す置き場（URL に載せない・読んで消すのは再設定の画面） */
const RESET_EMAIL_KEY = "kaname.reset-email";
const MS_PER_SEC = 1000;
/** バックアップコードは全角を半角にし、前後の空白を落とすだけ（大小は口がそろえる） */
const tidyBackup = (v: string): string => v.normalize("NFKC").trim();
const textOf = (r: CallErr): string => r.message ?? CATALOG[r.code as keyof typeof CATALOG]?.message ?? FALLBACK;
/** 回数の守りの 429（ロック・確認のコードの止めでないもの）：画面で文を作る（connect-pc と同じ文） */
const waitText = (sec: number): string => `続けて押されました。${sec} 秒たってから、もう一度押してください`;

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("main");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [code, setCode] = useState<readonly string[]>(EMPTY_CODE);
  const [backup, setBackup] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  /** 確認のコードを止めた（E-AUTH-014・E-AUTH-013）：もう送らない */
  const [stopped, setStopped] = useState(false);
  /** 待ちの印が切れた（E-AUTH-013）：「最初からログインし直す」を出す */
  const [expired, setExpired] = useState(false);
  const sending = useRef(false); // 2 回押し・6 つそろった瞬間の重なりで口を 2 回呼ばない
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** ロック・送りすぎの間だけ押せない。時間がたつと押せ、文は消える */
  const holdFor = (sec: number) => {
    if (timer.current) clearTimeout(timer.current);
    setLocked(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setLocked(false);
      setMsg(null);
    }, sec * MS_PER_SEC);
  };

  // 口が成功して行き先へ移るときは、移り終わるまで送る印を戻さない（移る途中の二度押しで口を 2 回呼ばない）。
  //   戻すのは、失敗したときと、移らずに画面の中で次の段（確認のコード）へ進むときだけ。網が切れた（口が答えない）ときは決めた文
  const run = async (send: () => Promise<"moving" | "stay">) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMsg(null);
    const release = () => {
      sending.current = false;
      setBusy(false);
    };
    try {
      if ((await send()) === "stay") release();
    } catch {
      release();
      setMsg(FALLBACK);
    }
  };
  // 行き先が今のログインの画面なら、移りが起きず回り続けるので入口（/）へ移す
  const go = (token: string) => {
    setToken(token);
    refreshSession(); // ログインの部品の見え方（セッションの印）にも新しいログインを知らせる
    const to = afterLogin(next);
    router.push(to === "/login" || to.startsWith("/login?") || to.startsWith("/login/") ? ("/" as Route) : to);
  };
  /** メールとパスワードの画面へ戻る（止め・待ちの印が切れた の後）：メールは残し、パスワードと待ちの印は捨てる */
  const restart = () => {
    setStep("main");
    setPassword("");
    setPending(null);
    setMsg(null);
    setCode(EMPTY_CODE);
    setBackup("");
    setUseBackup(false);
    setStopped(false);
    setExpired(false);
  };
  const block = (r: CallErr) => {
    setPending(null);
    setMsg(textOf(r));
    setStep("blocked");
  };

  const onSignInFail = (r: CallErr) => {
    if (r.status === 403 && BLOCKED.has(r.code)) return block(r);
    if (r.status === 429 && r.code !== "E-AUTH-002" && r.retryAfterSec !== null) {
      setMsg(waitText(r.retryAfterSec));
      return holdFor(r.retryAfterSec);
    }
    setMsg(textOf(r));
    if (r.status === 429 && r.retryAfterSec !== null) holdFor(r.retryAfterSec);
  };

  const submit = () => {
    if (locked) return;
    void run(async () => {
      const r = await call("signInWithPassword", { body: { email, password }, keepOn401: true, screenId: "login" });
      if (!r.ok) {
        onSignInFail(r);
        return "stay";
      }
      if (r.data.two_factor && r.data.pending) {
        setPending(r.data.pending);
        setCode(EMPTY_CODE);
        setStep("code");
        return "stay";
      }
      if (!r.data.token) {
        setMsg(FALLBACK);
        return "stay";
      }
      go(r.data.token);
      return "moving";
    });
  };

  const onVerifyFail = (r: CallErr, withCode: boolean) => {
    if (r.status === 403 && BLOCKED.has(r.code)) return block(r);
    if (r.code === "E-AUTH-013" || r.code === "E-AUTH-014") {
      setMsg(textOf(r));
      setCode(EMPTY_CODE); // もう使わないコードは枠に残さない（止めた画面は空の枠・モック login-code-lock・login-tf-expired）
      setStopped(true);
      setExpired(r.code === "E-AUTH-013");
      return;
    }
    if (r.status === 429 && r.retryAfterSec !== null) {
      setMsg(waitText(r.retryAfterSec));
      return holdFor(r.retryAfterSec);
    }
    setMsg(textOf(r));
    if (withCode) {
      setCode(EMPTY_CODE);
      boxes.current[0]?.focus();
    }
  };

  const verify = (body: { code: string } | { backup_code: string }) =>
    run(async () => {
      const r = await call("verifySignInCode", {
        body: { pending: pending ?? "", ...body },
        keepOn401: true,
        screenId: "login",
      });
      if (!r.ok) {
        onVerifyFail(r, "code" in body);
        return "stay";
      }
      if (!r.data.token) {
        setMsg(FALLBACK);
        return "stay";
      }
      go(r.data.token);
      return "moving";
    });

  const codeClosed = stopped || locked;
  const onCode = (nextCode: string[]) => {
    setCode(nextCode);
    if (!codeClosed && nextCode.every((d) => d !== "")) void verify({ code: nextCode.join("") });
  };

  const submitCode = () => {
    if (codeClosed) return;
    if (useBackup) {
      const v = tidyBackup(backup);
      if (!v) return setMsg(EMPTY_BACKUP);
      return void verify({ backup_code: v });
    }
    const joined = code.join("");
    if (joined.length < CODE_LENGTH) return setMsg(NEED_CODE);
    void verify({ code: joined });
  };

  const switchBackup = () => {
    setUseBackup(!useBackup);
    setCode(EMPTY_CODE);
    setBackup("");
    if (!codeClosed) setMsg(null);
  };

  // 再設定の画面（K-320）へメールを渡す。置けない（ブラウザが保存を断った）ときは渡さずに移る（再設定の画面で打ち直せる）
  const forgot = () => {
    const v = email.trim();
    if (!v) return;
    try {
      window.sessionStorage.setItem(RESET_EMAIL_KEY, v);
    } catch {
      // 保存を断られても移るのは止めない（メールは URL に載せない決まりのため、ほかの渡し方はしない）
    }
  };

  if (step === "blocked") return <LoginBlocked msg={msg ?? FALLBACK} onBack={restart} />;

  if (step === "code")
    return (
      <LoginCode
        code={code}
        backup={useBackup}
        backupValue={backup}
        msg={msg}
        stopped={codeClosed}
        busy={busy}
        inputs={boxes}
        onCode={onCode}
        onBackupChange={setBackup}
        onSubmit={submitCode}
        onToggleBackup={switchBackup}
        {...(expired ? { onRestart: restart } : {})}
        recoverOff
      />
    );

  return (
    <LoginMain
      email={email}
      password={password}
      msg={msg}
      locked={locked}
      busy={busy}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={submit}
      onForgot={forgot}
      passkeyOff
      recoverOff
    />
  );
}
