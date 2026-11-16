"use client";
// 待つ画面（K-51・/verify-email の手がかり無し・キャンバスの AuthVerify）。見出し「確認メールを送りました」・30 分以内にメールのリンクを押す。
//   確定はメールのリンク（K-52）。6 けたのコードを入れる欄は無い（D-128.142）。
//   状態と送り直しは、登録の答えで受け取った申し込みの印（頭 x-signup-token）で引く。メールでは引かない（登録済みかを探らせない）。
//   再読み込み・戻る・進むでも印で今の状態を引き直す（期限切れ・別の端末で確定した後 を出し分ける・D-088.9）
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Callout, Loading, PAGE_ERROR, errorText } from "@/components/k";
import { call } from "@/lib/api/call";
import { AuthFrame } from "./frame";
import { readTicket, saveTicket, type SignupTicket } from "./store";
import { waitText } from "./wait-text";

export const SIGNUP_TOKEN_HEADER = "x-signup-token";
type State = "loading" | "sent" | "unsent" | "expired" | "registered" | "none";

export function SignupWaiting() {
  const [ticket, setTicket] = useState<SignupTicket | null>(null);
  const [state, setState] = useState<State>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const look = useCallback(async (t: SignupTicket) => {
    const r = await call("getSignupStatus", { headers: { [SIGNUP_TOKEN_HEADER]: t.token }, keepOn401: true }).catch(
      () => null,
    );
    if (!r || !r.ok) return setState(t.sent ? "sent" : "unsent"); // 引けないときは、手元に残した送れたかで出す
    const s = r.data.state;
    if (s === "registered") return setState("registered");
    if (s === "expired") return setState("expired");
    if (s === "none") return setState("none");
    setState(t.sent ? "sent" : "unsent");
  }, []);

  useEffect(() => {
    const t = readTicket();
    setTicket(t);
    if (t) void look(t);
    else setState("none");
    // 戻る・進むで古い画面がそのまま戻ってきたら（bfcache）、読み込み直す。そのままにすると画面の道（Next.js）が
    // 別の画面の中身を描くことがある。読み込み直せば、印で今の状態を引き直す（申し込みは二重にならない）
    // 箱の頭の「← 戻る」（キャンバス AuthVerify）。書きかけ（パスワードのほか）は登録の画面に残っている
    const back = (
      <Link className="k-auth-back" href="/signup">
        ← 戻る
      </Link>
    );
    const again = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", again);
    return () => window.removeEventListener("pageshow", again);
  }, [look]);

  const resend = async () => {
    if (!ticket || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await call("resendSignupEmail", {
        body: {},
        headers: { [SIGNUP_TOKEN_HEADER]: ticket.token },
        keepOn401: true,
      });
      if (!r.ok) {
        setNotice(
          r.status === 429
            ? waitText(r.retryAfterSec)
            : errorText(r.status >= 500 ? PAGE_ERROR.down : PAGE_ERROR.loadFailed).entry.message,
        );
        return;
      }
      if (r.data.registered) return setState("registered");
      if (r.data.expired) return setState("expired");
      if (!r.data.pending) return setState("none");
      const next = { ...ticket, sent: r.data.sent === true, mailError: r.data.mail_error ?? null };
      saveTicket(next);
      setTicket(next);
      setState(next.sent ? "sent" : "unsent");
      setNotice(next.sent ? "もう一度送りました。届くまで 1〜2 分かかることがあります" : null);
    } finally {
      setBusy(false);
    }
  };

  // 箱の頭の「← 戻る」（キャンバス AuthVerify）。書きかけ（パスワードのほか）は登録の画面に残っている
  const back = (
    <Link className="k-auth-back" href="/signup">
      ← 戻る
    </Link>
  );
  const again = (
    <Link href="/signup" onClick={() => saveTicket(null)}>
      登録の画面へ
    </Link>
  );
  return (
    <AuthFrame>
      {state === "loading" ? (
        <>
          {/* 枠と見出しを先に出し、文は 3 秒たっても状態が引けないときだけ（D-144.8・キャンバス AuthVerifyLoading） */}
          <h1>確認メールを送りました</h1>
          <Loading label="読み込んでいます…" />
        </>
      ) : null}
      {state === "sent" ? (
        <>
          {back}
          <span className="k-auth-badge" aria-hidden="true">
            ✉
          </span>
          <h1>確認メールを送りました</h1>
          <p className="k-auth-lead" data-kind="body">
            <span className="k-auth-mail">{ticket?.email}</span> に確認のメールを送りました。
            <br />
            30 分以内にメールのリンクを押してください。押した時点で登録が終わります
          </p>
          {notice ? <Callout>{notice}</Callout> : null}
          <div className="k-auth-actions">
            <Button variant="outlined" size="lg" loading={busy} onClick={() => void resend()}>
              送り直す
            </Button>
          </div>
          <p className="k-auth-note">届かないときは、迷惑メールのフォルダと、アドレスの打ち間違いを確かめてください</p>
        </>
      ) : null}
      {state === "unsent" ? (
        <>
          {back}
          <h1>確認のメールを届けられませんでした</h1>
          <p className="k-auth-lead" data-kind="body">
            <span className="k-auth-mail">{ticket?.email}</span> への確認のメールは、まだ届いていません。
          </p>
          <Callout tone="warn">
            申し込みは残っています。「送り直す」を押してください。続くときは、少し待ってからもう一度押してください
          </Callout>
          {notice ? <Callout tone="danger">{notice}</Callout> : null}
          <div className="k-auth-actions">
            <Button size="lg" loading={busy} onClick={() => void resend()}>
              送り直す
            </Button>
          </div>
        </>
      ) : null}
      {state === "expired" ? (
        <>
          <h1>期限が切れました</h1>
          <Callout tone="warn">期限が切れました。もう一度登録してください</Callout>
          <p className="k-auth-alt">{again}</p>
        </>
      ) : null}
      {state === "registered" ? (
        <>
          <h1>登録は終わっています</h1>
          <Callout>登録は確認まで終わっています。ログインしてください</Callout>
          <p className="k-auth-alt">
            <Link href="/login">ログイン</Link>
          </p>
        </>
      ) : null}
      {state === "none" ? (
        <>
          <h1>申し込みが見つかりません</h1>
          <Callout tone="warn">この申し込みは使えなくなりました。もう一度登録してください</Callout>
          <p className="k-auth-alt">{again}</p>
        </>
      ) : null}
    </AuthFrame>
  );
}
