"use client";
// メールを確認する（T-U-02・A02・D-088）。ここを押した時点で登録が終わる（それまで会社も利用者も作られていない）。
// 状態：送信済み／送れなかった／確認できた／リンクが使えない。詰まらせない：再送と、こちらの都合で送れないときの出口を出す。
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Check, Info, LogIn, Mail, Plug, Repeat, TriangleAlert } from "lucide-react";
import {
  AuthFoot,
  AuthHead,
  AuthIcon,
  AuthNote,
  OutsideLayout,
  SETUP_STEPS,
} from "@/components/outside/outside-layout";
import { AuthExtError, resendSignup, signupStatus, verifySignup } from "@/lib/auth/ext";
import { navRoute } from "@/lib/pending-route";
import { OPS_EMAIL } from "@/lib/ops";

type State = "n" | "f" | "ok" | "x" | "gone" | "done";

function VerifyEmailInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token");
  const email = sp.get("email") ?? "";
  const failedAtSignup = sp.get("sent") === "0";
  const why = sp.get("why") ?? "";
  const [state, setState] = useState<State>(token ? "x" : failedAtSignup ? "f" : "n");
  const [checking, setChecking] = useState(!!token);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState<string>(why);
  // 宛先の側（受信箱が満杯・存在しない）か、こちらの側（送出先が落ちている・上限）か。
  // 当たらないときは「こちらの側」に倒す（相手のせいにしない・D-088.5）
  const [kind, setKind] = useState<"recipient" | "provider">(sp.get("kind") === "recipient" ? "recipient" : "provider");
  const [until, setUntil] = useState<string>("");

  // 待つ画面に来たら、その申し込みが今どうなっているかを見て行き先を変える（D-088.3）。
  // ずっと同じ画面に居させない：もう登録が済んでいれば入る画面へ、申し込みが無ければその旨を出す
  useEffect(() => {
    if (token || !email) return;
    let alive = true;
    signupStatus(email)
      .then((r) => {
        if (!alive) return;
        if (r.state === "registered") {
          setState("done"); // 確認まで終わっている。送り直させない・言い直す（D-088.9）
          return;
        }
        if (r.state === "none") {
          setState("gone");
          return;
        }
        if (r.expires_at)
          setUntil(new Date(r.expires_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
      })
      .catch(() => undefined);
    const again = (e: PageTransitionEvent) => {
      if (e.persisted) location.reload(); // 戻るで古い画面が出たら見直す
    };
    window.addEventListener("pageshow", again);
    return () => {
      alive = false;
      window.removeEventListener("pageshow", again);
    };
  }, [token, email, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    verifySignup(token)
      .then(() => {
        if (!alive) return;
        setChecking(false);
        setState("ok");
      })
      .catch((e) => {
        if (!alive) return;
        setChecking(false);
        // 既に登録が済んでいる（二度押し・リロード）＝詰まらせず、入る画面へ送る
        if (e instanceof AuthExtError && (e.code === "E-CONF-011" || e.code === "E-CONF-001")) {
          setState("done"); // リンクをもう一度押した＝終わっている（D-088.9）
          return;
        }
        setState("x");
      });
    return () => {
      alive = false;
    };
  }, [token, router]);

  const resend = async () => {
    setNotice(null);
    try {
      const r = await resendSignup(email);
      if (r.sent) {
        setState("n");
        setNotice("もう一度送りました。届くまで 1〜2 分かかることがあります");
        return;
      }
      if (!r.pending) {
        if (r.registered) {
          setState("done"); // 確認まで終わっている人が戻ってきて押した（D-088.9）
          return;
        }
        setNotice("この申し込みは残っていません。もう一度はじめからやり直してください");
        return;
      }
      setReason(r.mail_error ?? "");
      setKind(r.mail_error_kind === "recipient" ? "recipient" : "provider");
      setState("f");
    } catch {
      setReason("");
      setState("f");
    }
  };

  const undelivered = (
    <>
      <AuthHead
        title={kind === "recipient" ? "このメールアドレスに届けられませんでした" : "確認のメールを出せませんでした"}
      >
        {kind === "recipient" ? (
          <>
            このメールアドレスは受け取れませんでした。<b>受信箱がいっぱいか、アドレスが違うかもしれません。</b>
            受信箱を空けてから送り直すか、入力し直して別のアドレスで登録してください。
          </>
        ) : (
          <>
            こちら側の都合で確認のメールを出せませんでした。<b>あなたのメールアドレスに問題はありません。</b>
            申し込みは 30 分預かっているので、送り直せば続けられます。
          </>
        )}
        {reason ? (
          <span className="mt-2 block text-[12.5px]">
            出せなかった理由：<span className="num">{reason}</span>
          </span>
        ) : null}
      </AuthHead>
      <AuthNote icon={<Info />}>
        {kind === "recipient"
          ? "受信箱を空けてから「もう一度送る」を押してください。"
          : "少し時間をおいて「もう一度送る」を押してください。"}
        急ぐときは別のメールアドレスで{" "}
        <Link className="font-semibold text-[var(--primary)]" href="/signup">
          はじめから登録し直す
        </Link>
        こともできます。
      </AuthNote>
      <Button className="w-full" icon={<Repeat />} onClick={resend}>
        もう一度送る
      </Button>
      <AuthFoot>
        それでも出せないときは <b className="num">{OPS_EMAIL}</b> までご連絡ください
      </AuthFoot>
    </>
  );

  const gone = (
    <div data-state="gone">
      <AuthIcon tone="muted">
        <Info />
      </AuthIcon>
      <AuthHead title="この申し込みは残っていません">
        申し込みから 30 分を過ぎたか、このメールアドレスでまだ申し込んでいません。<b>登録は済んでいません。</b>
        はじめから登録し直すと、新しいリンクを送ります。
      </AuthHead>
      <Link href="/signup" className="block">
        <Button className="w-full" icon={<Mail />}>
          はじめから登録し直す
        </Button>
      </Link>
      <AuthFoot>
        <Link href="/login">もう登録した人はログイン</Link>
      </AuthFoot>
    </div>
  );

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
      stepsDone={1}
    >
      {state === "gone" ? (
        gone
      ) : state === "done" ? (
        <div data-state="done">
          <AuthIcon tone="ok">
            <Check />
          </AuthIcon>
          <AuthHead title="登録は確認まで終わっています">
            <b className="num">{email || "このメールアドレス"}</b>{" "}
            の登録は、メールの確認まで済んでいます。確認メールを送り直す必要はありません。
            <b>ログインしてください。</b>
          </AuthHead>
          <Link href={navRoute("/login?done=1")} className="block">
            <Button className="w-full" icon={<LogIn />}>
              ログインへ
            </Button>
          </Link>
          <AuthFoot>
            <Link href="/password-reset">パスワードを忘れた</Link>
          </AuthFoot>
        </div>
      ) : state === "ok" ? (
        <div data-state="ok">
          <AuthIcon tone="ok">
            <Check />
          </AuthIcon>
          <AuthHead title="登録できました">
            ここで登録が終わりました。次は自分のPCをつなぎます。<b>自分のAIはあなたのPCで、あなたのサブスクで動く</b>
            ので、つながるまで話せません。そのあと訊かれたことに答えるだけで、会社のたたき台ができます。
          </AuthHead>
          <Link href="/setup/bridge" className="block">
            <Button className="w-full" icon={<Plug />}>
              はじめの設定をはじめる（PCをつなぐ）
            </Button>
          </Link>
        </div>
      ) : state === "x" ? (
        <div data-state="x">
          {checking ? (
            <AuthHead title="確認しています" />
          ) : (
            <>
              <AuthIcon tone="ng">
                <TriangleAlert />
              </AuthIcon>
              <AuthHead title="このリンクは使えません">
                30 分を過ぎたか、もう使われたリンクです。<b>登録はまだ終わっていません。</b>
                はじめから登録し直すと、新しいリンクを送ります。
              </AuthHead>
              <Link href="/signup" className="block">
                <Button className="w-full" icon={<Mail />}>
                  はじめから登録し直す
                </Button>
              </Link>
              {notice ? (
                <p className="mt-3 text-[13px] text-[var(--on-sv)]" role="status">
                  {notice}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : state === "f" ? (
        <div data-state="f">
          <AuthIcon tone="ng">
            <TriangleAlert />
          </AuthIcon>
          {undelivered}
          {notice ? (
            <p className="mt-3 text-[13px] text-[var(--on-sv)]" role="status">
              {notice}
            </p>
          ) : null}
        </div>
      ) : (
        <div data-state="n">
          <AuthIcon>
            <Mail />
          </AuthIcon>
          <AuthHead title="メールを確認してください">
            <b className="num">{email || "登録したメールアドレス"}</b> にリンクを送りました。メールの中の
            <b>「登録を確定する」を押すと登録が終わります。</b>押すまで会社は作られません。
          </AuthHead>
          <AuthNote icon={<Info />}>
            リンクは <b>30 分</b>
            {until ? (
              <>
                （<span className="num">{until}</span> まで）
              </>
            ) : null}{" "}
            で失効します。届かない場合は迷惑メールも確認してください。
          </AuthNote>
          <Button className="w-full" variant="outline" icon={<Repeat />} onClick={resend}>
            もう一度送る
          </Button>
          {notice ? (
            <p className="mt-3 text-[13px] text-[var(--on-sv)]" role="status">
              {notice}
            </p>
          ) : null}
          <AuthFoot>
            メールアドレスを間違えた？ <Link href="/signup">入力し直す</Link>
          </AuthFoot>
          <AuthFoot>
            何度送っても届かないときは <span className="num">{OPS_EMAIL}</span> までご連絡ください。
          </AuthFoot>
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
