"use client";
// K-52 メールを確かめる（/verify-email?token=…・キャンバスの AuthVerify）。リンクを開いた時点で登録を確定する（D-088・押し直させない）。
//   画面は開いたら契約の口 POST /api/v1/auth/sign-up/verify を 1 回だけ呼ぶ（lib/auth/ext.ts の verifySignup）。
//   状態：確認しています／登録できました／別のアカウントでログイン中に確定した／期限切れ／前のリンク／確認まで終わっている／
//        別のアカウントの登録のリンク／無い／待ってください（429）／調子が悪い（500）。文言は正本（errors.json）の 1 件。
//   確認が済むまで中（初めの設定・チケットの画面）へ行く抜け道を出さない（D-088.4）。行き先は「続ける」（確定した後だけ）・ログイン・登録し直し・困ったとき
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Callout, Loading, PAGE_ERROR, errorText } from "@/components/k";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { verifySignup } from "@/lib/auth/ext";
import { pendingRoute } from "@/lib/pending-route";
import { AuthFrame } from "../sign-up/frame";
import { waitText } from "../sign-up/wait-text";
import { saveLinkToken } from "./store";
import { termsStepHref } from "@/lib/terms-gate";

/** 確定した後に入る画面（チケットの画面・K-60） */
const AFTER = pendingRoute("/tickets", "K-60");
/** 別のアカウントでログイン中に確定したときの案内（D-128.137） */
export const OTHER_ACCOUNT_NOW =
  "登録は確定しました。いまは別のアカウントでログイン中です。新しいアカウントで使うには、ログアウトしてからログインしてください";

type View =
  | { kind: "checking" }
  | { kind: "ok"; termsPending: boolean }
  | { kind: "other_now" }
  | { kind: "error"; code: string }
  | { kind: "wait"; sec: number | null };

/** 正本の 1 件の文言 */
const message = (code: string) => errorText(code).entry.message;

/** 口を呼んで、出す画面（か、入る画面へ移ること）を決める。同じ手がかりでは 1 回だけ（下の VerifyLink の ref が持つ） */
async function decide(token: string): Promise<View | "enter"> {
  const r = await verifySignup(token).catch(() => null);
  if (!r) return { kind: "error", code: PAGE_ERROR.down };
  // 確定の直後に同意し直しの印が立っていれば（登録と確定の間に規約の新しい版が出た・K-53）、「続ける」で同意し直しの画面へ
  if (r.ok)
    return r.data.signed_in ? { kind: "ok", termsPending: r.data.terms_pending === true } : { kind: "other_now" };
  if (r.status === 429) return { kind: "wait", sec: r.retryAfterSec };
  // 確定済み：同じ人でログイン中なら、二重に作らずそのまま中へ（再読み込み・戻る）
  if (r.code === "E-CONF-011" && getToken()) {
    const me = await call("getMe", { keepOn401: true, screenId: "verify-email" }).catch(() => null);
    if (me?.ok) return "enter";
  }
  const known = ["E-AUTH-003", "E-AUTH-008", "E-AUTH-009", "E-CONF-011", "E-CONF-001", "E-PAGE-006"];
  return { kind: "error", code: known.includes(r.code) ? r.code : PAGE_ERROR.down };
}

export function VerifyLink({ token }: { token: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "checking" });
  // 口を呼ぶのは 1 回だけ。開発のサーバー（StrictMode）は効果を 2 回走らせるが、2 回目は同じ答えを待って画面を変える
  //   （2 回目に口を呼ぶと E-CONF-011 になり「確認まで終わっています」で止まる・M2）
  const asked = useRef<{ token: string; answer: Promise<View | "enter"> } | null>(null);

  useEffect(() => {
    // 手がかりを URL から消す（アドレスバー・履歴・Referer に残さない・L3）。読み終えた後なので、画面の中身は変わらない
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has("token")) {
        u.searchParams.delete("token");
        window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`);
      }
    } catch {
      /* URL を直せなくても確定は続ける */
    }
    if (!asked.current || asked.current.token !== token) asked.current = { token, answer: decide(token) };
    let alive = true;
    void asked.current.answer.then((v) => {
      if (!alive) return;
      // 手がかりをこのタブに覚えるのは確定できた（201）ときだけ（再読み込み・戻るで同じ答えに戻るため）。
      // ほかの答えでは消す（期限切れから登録し直した同じタブで、古い手がかりで確定の口を呼び直さない・HIGH-3）
      const confirmed = v !== "enter" && (v.kind === "ok" || v.kind === "other_now");
      saveLinkToken(confirmed ? token : null);
      if (v === "enter") router.replace(AFTER);
      else setView(v);
    });
    return () => {
      alive = false;
    };
  }, [token, router]);

  const next = () => {
    saveLinkToken(null);
    // 同意し直しの印が立っていれば、同意し直しの画面へ（戻る先は今の行き先）。立っていなければ今の行き先へ
    router.push(view.kind === "ok" && view.termsPending ? (termsStepHref(AFTER) as Route) : AFTER);
  };
  // 期限切れだけ足元を「いまの様子 ・ 困ったとき」に（キャンバス AuthVerifyExpired）。ほかは利用規約・プライバシー・困ったとき
  const foot = view.kind === "error" && view.code === "E-AUTH-003" ? "status" : "all";
  return <AuthFrame foot={foot}>{body(view, next)}</AuthFrame>;
}

const toSignup = (
  <Link href="/signup" prefetch={false}>
    もう一度登録する
  </Link>
);
/** 箱の中の主の行き先（主ボタンの形・高さ 44。キャンバス AuthVerifyExpired・AuthVerifyUsed） */
const primaryLink = (href: "/signup" | "/login", label: string) => (
  <Link href={href} prefetch={false} className="k-btn" data-variant="primary" data-size="lg">
    {label}
  </Link>
);
/** 見出しの上の札（44・橙「期」／緑「✓」） */
const badge = (tone: "warn" | "ok", mark: string) => (
  <span className="k-auth-badge" data-tone={tone} aria-hidden="true">
    {mark}
  </span>
);
const toLogin = (
  <Link href="/login" prefetch={false}>
    ログイン
  </Link>
);

function body(v: View, next: () => void) {
  if (v.kind === "checking")
    return (
      <>
        <h1>確認しています</h1>
        {/* 枠と見出しを先に出し、文は 3 秒たっても終わらないときだけ（D-144.8・キャンバス AuthVerifying） */}
        <Loading label="登録を確定しています…" />
      </>
    );
  if (v.kind === "ok")
    return (
      <>
        <h1>登録できました</h1>
        <p className="k-auth-lead">ここで登録が終わりました。「続ける」を押すと、Kaname を使いはじめられます</p>
        <div className="k-auth-actions">
          <Button onClick={next}>続ける</Button>
        </div>
      </>
    );
  if (v.kind === "other_now")
    return (
      <>
        <h1>登録は確定しました</h1>
        <Callout>{OTHER_ACCOUNT_NOW}</Callout>
      </>
    );
  if (v.kind === "wait")
    return (
      <>
        <h1>少し待ってください</h1>
        <Callout tone="warn">{waitText(v.sec)}</Callout>
      </>
    );
  switch (v.code) {
    case "E-AUTH-003": // 期限切れ：申し込みからやり直す
      return (
        <>
          {badge("warn", "期")}
          <h1>リンクの期限が切れました</h1>
          <Callout tone="warn">{message(v.code)}</Callout>
          {primaryLink("/signup", "もう一度登録する")}
        </>
      );
    case "E-AUTH-008": // 前のリンク：新しいリンクはそのまま使えるので、登録し直しへは誘わない
      return (
        <>
          <h1>このリンクは使えません</h1>
          <Callout tone="warn">{message(v.code)}</Callout>
        </>
      );
    case "E-CONF-011": // 確認まで終わっている（D-088.9）
    case "E-CONF-001":
      return (
        <>
          {badge("ok", "✓")}
          <h1>登録は終わっています</h1>
          <Callout>{message(v.code)}</Callout>
          {primaryLink("/login", "ログイン")}
        </>
      );
    case "E-AUTH-009": // 別のアカウントの登録のリンク：勝手に切り替えない
      return (
        <>
          <h1>いまのアカウントのままです</h1>
          <Callout>{message(v.code)}</Callout>
        </>
      );
    case "E-PAGE-006": // 無い（掃除された・でたらめ・古いブックマーク）
      return (
        <>
          <h1>このリンクは使えなくなりました</h1>
          <Callout tone="warn">{message(v.code)}</Callout>
          <p className="k-auth-alt">
            {toLogin} ／ {toSignup}
          </p>
        </>
      );
    default:
      return (
        <>
          <h1>確定できませんでした</h1>
          <Callout tone="danger">{message(PAGE_ERROR.down)}</Callout>
        </>
      );
  }
}
