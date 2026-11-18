"use client";
// ログインする（T-U-05・A13・K-221 → K-316）。見た目は段 2 の部品（views の LoginMain・LoginCode・LoginBlocked・入口の枠は views が持つ）。
//   口は契約の口だけ：signInWithPassword（メールとパスワード）・verifySignInCode（6 けた・バックアップコード）。Cookie は使わず Bearer だけ（D-051.2）。
//   答えの code で出し分ける：401 E-AUTH-001 違う／429 E-AUTH-002 ロック／429 そのほか 送りすぎ／403 E-AUTH-011・012・007 止め／
//   確かめの 401 E-AUTH-004 違う・401 E-AUTH-013 待ちの印が切れた・429 E-AUTH-014 確認のコードの止め。
//   待ちの印（pending）は画面のメモリだけに持つ（再読み込みで最初に戻る）。「この端末を信頼する」は送らない（D-128.60）。
//   K-317：パスキー（部品の口・lib/auth/client の signInWithPasskey）・スマホの QR（同じ手順・QR はブラウザが出す）・この PC の外で入った後の「入れました」・
//   端末をなくした（requestAdminRecovery）・いまの様子の帯（getServiceStatus・読めなければ帯なし）・別のアカウントでログイン中（入れたら前のログインを signOut で閉じる）
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { CATALOG } from "@kaname/errors/catalog";
import { call, type CallErr } from "@/lib/api/call";
import { clearDraftCopies, getToken, setToken } from "@/lib/api/client";
import { passkeySupported, refreshSession, signInWithPasskey } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import { afterLogin } from "@/lib/after-login";
import type { ServiceIncident } from "@/components/k/auth-parts";
import { toIncidents } from "@/features/F1/service-status/to-incidents";
import { CODE_LENGTH, EMPTY_CODE } from "./code-boxes";
import { LoginAdded, LoginBlocked, LoginCode, LoginMain, LoginRecover } from "./views";

type Step = "main" | "code" | "blocked" | "recover" | "added";
type Asked = "sent" | "already" | "failed" | "no_admin";
const ASKED_RESULTS: ReadonlySet<string> = new Set(["sent", "already", "no_admin", "failed"]);
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
  /** パスキーで入れなかった（本人がやめた・時間切れ・この端末に無い） */
  const [pkFailed, setPkFailed] = useState(false);
  /** このブラウザはパスキーを使えない（出すがグレー・D-145.9） */
  const [pkUnsupported, setPkUnsupported] = useState(false);
  const [pkBusy, setPkBusy] = useState(false);
  /** いまの様子の帯（障害・メンテナンス中）。読めなければ帯なし */
  const [status, setStatus] = useState<ServiceIncident[]>([]);
  const statusRead = useRef(false);
  /** 別のアカウントでログイン中（next つきで開いた）：そのメール。入れたら前のログインを閉じる */
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const otherToken = useRef<string | null>(null);
  const sessionChecked = useRef(false);
  /** 端末をなくしたとき：どこから来たか（確認のコードの画面からなら待ちの印があり管理者に頼める）と、頼んだ結果 */
  const [recoverFrom, setRecoverFrom] = useState<"main" | "code">("main");
  const [asked, setAsked] = useState<Asked | null>(null);
  const asking = useRef(false);
  const focusMail = useRef(false);
  const { session } = useSession();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => setPkUnsupported(!passkeySupported()), []);

  // いまの様子は開いたときに 1 回だけ読む（読めない・形が違うときは帯を出さず、ログインは止めない）
  useEffect(() => {
    if (statusRead.current) return;
    statusRead.current = true;
    call("getServiceStatus", { keepOn401: true, screenId: "login" })
      .then((r) => {
        if (r.ok) setStatus(toIncidents(r.data) ?? []);
      })
      .catch(() => undefined); // 網が切れた：帯なし（ログインの画面はそのまま使える）
  }, []);

  // ログイン中に開いた：next が無ければ入口へ。next があれば案内を出し、入れたときに閉じる前の印を覚える（開いただけでは閉じない）
  useEffect(() => {
    if (session === undefined || sessionChecked.current) return;
    sessionChecked.current = true;
    if (!session) return;
    if (!next) {
      router.replace(afterLogin(null));
      return;
    }
    setSignedInAs(session.user.email);
    otherToken.current = getToken();
  }, [session, next, router]);

  // 端末をなくしたときから「バックアップコードで入る」で戻った：メールの欄にフォーカス
  useEffect(() => {
    if (step !== "main" || !focusMail.current) return;
    focusMail.current = false;
    document.querySelector<HTMLInputElement>('[data-part="auth-box"] input[name="email"]')?.focus();
  }, [step]);

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
  const dest = (): Route => {
    const to = afterLogin(next);
    return to === "/login" || to.startsWith("/login?") || to.startsWith("/login/") ? ("/" as Route) : to;
  };
  /** 別のアカウントで入れた後：前のログインを前の印で閉じる（1 回だけ・失敗しても先へ進む）。前の人の書きかけの写しも消す */
  const closePrevious = async (token: string) => {
    const prev = otherToken.current;
    otherToken.current = null;
    if (!prev || prev === token) return;
    setToken(prev);
    try {
      await call("signOut", { body: {}, keepOn401: true, screenId: "login" });
    } catch {
      // 閉じられなかったことは口の側の記録に残る。新しいログインは止めない
    }
    clearDraftCopies();
    setToken(token);
  };
  const go = async (token: string) => {
    await closePrevious(token);
    setToken(token);
    refreshSession(); // ログインの部品の見え方（セッションの印）にも新しいログインを知らせる
    router.push(dest());
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
  const block = (text: string) => {
    setPending(null);
    setMsg(text);
    setStep("blocked");
  };

  const onSignInFail = (r: CallErr) => {
    if (r.status === 403 && BLOCKED.has(r.code)) return block(textOf(r));
    if (r.status === 429 && r.code !== "E-AUTH-002" && r.retryAfterSec !== null) {
      setMsg(waitText(r.retryAfterSec));
      return holdFor(r.retryAfterSec);
    }
    setMsg(textOf(r));
    if (r.status === 429 && r.retryAfterSec !== null) holdFor(r.retryAfterSec);
  };

  const submit = () => {
    if (locked) return;
    setPkFailed(false);
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
      await go(r.data.token);
      return "moving";
    });
  };

  const onVerifyFail = (r: CallErr, withCode: boolean) => {
    if (r.status === 403 && BLOCKED.has(r.code)) return block(textOf(r));
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
      await go(r.data.token);
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

  // パスキーで入る・スマホの QR（同じ手順。QR はブラウザが出す）。パスワードのロックの外（ロック中でも押せる）
  const passkey = async () => {
    if (pkUnsupported || sending.current) return;
    sending.current = true;
    setPkBusy(true);
    setPkFailed(false);
    let moving = false;
    try {
      const r = await signInWithPasskey();
      if (!r.ok) {
        if (r.status === 403 && BLOCKED.has(r.code))
          block(r.message ?? CATALOG[r.code as keyof typeof CATALOG]?.message ?? FALLBACK);
        else setPkFailed(true);
      } else if (r.crossPlatform) {
        // この PC の外（スマホ・鍵）で入った：入れた。この PC にもパスキーを付けるかを聞く
        await closePrevious(r.token);
        setToken(r.token);
        refreshSession();
        setStep("added");
      } else {
        await go(r.token);
        moving = true;
      }
    } catch {
      setPkFailed(true);
    } finally {
      if (!moving) {
        sending.current = false;
        setPkBusy(false);
      }
    }
  };

  const openRecover = (from: "main" | "code") => {
    setRecoverFrom(from);
    setAsked(null);
    setStep("recover");
  };
  /** 管理者に頼めるのは、パスワードを通った直後（待ちの印がある）だけ */
  const canAsk = recoverFrom === "code" && pending !== null && !expired;
  const ask = async () => {
    if (!canAsk || !pending || asking.current || (asked !== null && asked !== "failed")) return;
    asking.current = true;
    try {
      const r = await call("requestAdminRecovery", { body: { pending }, keepOn401: true, screenId: "login" });
      if (!r.ok && r.code === "E-AUTH-013") {
        // 待ちの印が切れた：確認のコードの画面と同じく止める。管理者のカードは「先にメールとパスワードで」の形に戻る（押し直しても通らない）
        setMsg(textOf(r));
        setCode(EMPTY_CODE);
        setStopped(true);
        setExpired(true);
        setAsked(null);
        return;
      }
      const result = r.ok ? r.data.result : undefined;
      // 口が 5xx・答えの形が違うときも「送れなかった」（押し直せる）
      setAsked(result && ASKED_RESULTS.has(result) ? (result as Asked) : "failed");
    } catch {
      setAsked("failed"); // 網が切れた
    } finally {
      asking.current = false;
    }
  };
  const recoverBackup = () => {
    if (canAsk) {
      setUseBackup(true);
      setCode(EMPTY_CODE);
      setBackup("");
      setMsg(null);
      setStep("code");
      return;
    }
    // 確認のコードの画面から来た（印が切れた・止められた）ときは、メールを残して最初の状態に戻す（前の文・止めの印を持ち越さない）
    if (recoverFrom === "code") restart();
    focusMail.current = true;
    setStep("main");
  };

  if (step === "added")
    return (
      <LoginAdded
        onAdd={() => router.push(`/mfa-setup?add=passkey&next=${encodeURIComponent(dest())}` as Route)}
        onSkip={() => router.push(dest())}
      />
    );

  if (step === "recover")
    return (
      <LoginRecover
        canAsk={canAsk}
        asked={asked}
        onBack={() => setStep(recoverFrom)}
        onBackup={recoverBackup}
        onAsk={() => void ask()}
      />
    );

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
        onLost={() => openRecover("code")}
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
      passkeyFailed={pkFailed}
      passkeyUnsupported={pkUnsupported}
      passkeyBusy={pkBusy}
      status={status}
      signedInAs={signedInAs}
      onPasskey={() => void passkey()}
      onRecover={() => openRecover("main")}
    />
  );
}
