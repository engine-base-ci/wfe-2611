"use client";
// メールを確認する（T-U-02・A02・D-088）。ここを押した時点で登録が終わる（それまで会社も利用者も作られていない）。
// 状態：送信済み／送れなかった／確認できた／リンクが使えない。詰まらせない：再送と、こちらの都合で送れないときの出口を出す。
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { OutsideLayout, SETUP_STEPS } from "@/components/outside/outside-layout";
import { AuthExtError, resendSignup, verifySignup } from "@/lib/auth/ext";
import { OPS_EMAIL } from "@/lib/ops";

type State = "n" | "f" | "ok" | "x";

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
        if (e instanceof AuthExtError && e.code === "E-CONF-001") {
          setNotice("この登録はもう終わっています。ログインしてください");
          router.replace("/login?done=1");
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
      {kind === "recipient" ? (
        <p className="mt-2 text-[14px] leading-[1.8]">
          このメールアドレスは受け取れませんでした。<b>受信箱がいっぱいか、アドレスが違うかもしれません。</b>
          受信箱を空けてから送り直すか、入力し直して別のアドレスで登録してください。
        </p>
      ) : (
        <p className="mt-2 text-[14px] leading-[1.8]">
          こちら側の都合で確認のメールを出せませんでした。<b>あなたのメールアドレスに問題はありません。</b>
          申し込みは 30 分預かっているので、送り直せば続けられます。
        </p>
      )}
      {reason ? (
        <p className="mt-2 text-[12.5px] text-[var(--on-sv)]">
          出せなかった理由：<span className="num">{reason}</span>
        </p>
      ) : null}
      <ul className="mt-4 list-disc pl-5 text-[13.5px] leading-[1.9]">
        <li>
          {kind === "recipient"
            ? "受信箱を空けてから「もう一度送る」を押してください"
            : "少し時間をおいて「もう一度送る」を押してください"}
        </li>
        <li>
          急ぐときは別のメールアドレスで{" "}
          <Link className="font-semibold text-[var(--primary)] underline" href="/signup">
            はじめから登録し直す
          </Link>
          ことができます
        </li>
        <li>
          それでも出せないときは <span className="num">{OPS_EMAIL}</span> までご連絡ください
        </li>
      </ul>
      <div className="mt-6">
        <Button onClick={resend}>もう一度送る</Button>
      </div>
    </>
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
    >
      {state === "ok" ? (
        <div data-state="ok">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">登録できました</h1>
          <p className="mt-2 text-[14px] leading-[1.8]">
            ここで登録が終わりました。次は自分のPCをつなぎます。
            <b>自分のAIはあなたのPCで、あなたのサブスクで動く</b>
            ので、つながるまで話せません。そのあと訊かれたことに答えるだけで、会社のたたき台ができます。
          </p>
          <Link href="/setup/bridge" className="mt-6 inline-flex">
            <Button>はじめの設定をはじめる（PCをつなぐ）</Button>
          </Link>
        </div>
      ) : state === "x" ? (
        <div data-state="x">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">
            {checking ? "確認しています" : "このリンクは使えません"}
          </h1>
          {!checking ? (
            <>
              <p className="mt-2 text-[14px] leading-[1.8]">
                30 分を過ぎたか、もう使われたリンクです。登録はまだ終わっていません。
                <Link className="font-semibold text-[var(--primary)] underline" href="/signup">
                  はじめから登録し直す
                </Link>
                と、新しいリンクを送ります。
              </p>
              {notice ? (
                <p className="mt-3 text-[13px] text-[var(--on-sv)]" role="status">
                  {notice}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : state === "f" ? (
        <div data-state="f">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">
            {kind === "recipient" ? "このメールアドレスに届けられませんでした" : "確認のメールを出せませんでした"}
          </h1>
          {undelivered}
          {notice ? (
            <p className="mt-3 text-[13px] text-[var(--on-sv)]" role="status">
              {notice}
            </p>
          ) : null}
        </div>
      ) : (
        <div data-state="n">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">メールを確認してください</h1>
          <p className="mt-2 text-[14px] leading-[1.8]">
            <b className="num">{email || "登録したメールアドレス"}</b> にリンクを送りました。
            <b>押した時点で登録が終わります。</b>押すまで会社は作られません。
          </p>
          <p className="mt-2 text-[13px] text-[var(--on-sv)]">
            リンクは <b>30分</b> で失効します。届かない場合は迷惑メールも確認してください。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={resend}>
              もう一度送る
            </Button>
            <span className="text-[13px] text-[var(--on-sv)]">
              メールアドレスを間違えた？{" "}
              <Link className="font-semibold text-[var(--primary)] underline" href="/signup">
                入力し直す
              </Link>
            </span>
          </div>
          {notice ? (
            <p className="mt-3 text-[13px] text-[var(--on-sv)]" role="status">
              {notice}
            </p>
          ) : null}
          <p className="mt-8 text-[12.5px] text-[var(--on-sv)]">
            何度送っても届かないときは <span className="num">{OPS_EMAIL}</span> までご連絡ください。
          </p>
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
