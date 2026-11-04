"use client";
// 4 つの状態（空・読み込み中・失敗・権限が無い）とエラーの 1 件（K-26・D-069）。どの画面でも同じ形で出す
//   失敗・権限が無いの文言は正本の 1 件（errorText）。画面は「どの 1 件か」と「一手を押したら何をするか」だけを渡す
//   読み込み中は 3 秒より長いときだけ出す（すぐ読めるときにちらつかせない・キャンバスの OnLoading）
//   書き方の決まり（キャンバスの OnError）：何が起きたか と 次に何をすればよいか を 1 文ずつ・番号は小さく末尾に
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "./button";
import { Callout } from "./notice";
import { PAGE_ERROR, errorText } from "./error-of";

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <section className="k-state" data-state="empty" aria-label={title}>
      <h2 className="k-state-title">{title}</h2>
      {children ? <div className="k-state-body">{children}</div> : null}
      {action ? <div className="k-state-actions">{action}</div> : null}
    </section>
  );
}

export function Loading({ label = "読み込んでいます…", delayMs = 3000 }: { label?: string; delayMs?: number }) {
  const [show, setShow] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) return;
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return (
    <div className="k-state" data-state="loading" role="status" aria-live="polite" aria-busy="true">
      {show ? (
        <>
          <span className="k-spin" aria-hidden="true" />
          <span>{label}</span>
        </>
      ) : null}
    </div>
  );
}

/** 一手：正本の action の順に、押したら何をするか（関数か行き先）。足りない一手は出さない */
export type ErrorAct = (() => void) | string;

export function ErrorState({ code, acts = [], heading = 2 }: { code: string; acts?: ErrorAct[]; heading?: 1 | 2 }) {
  const t = errorText(code);
  const H = heading === 1 ? "h1" : "h2";
  const danger = t.entry.severity === "critical" || t.entry.cls === "permission";
  return (
    <section
      className="k-state"
      data-state="error"
      data-code={code}
      role={danger ? "alert" : undefined}
      aria-labelledby={`k-err-${code}`}
    >
      <H id={`k-err-${code}`} className="k-state-title">
        {t.title}
      </H>
      {t.body ? <p className="k-state-body">{t.body}</p> : null}
      <div className="k-state-actions">
        {t.actions.map((label, i) => {
          const act = acts[i];
          if (act === undefined) return null;
          const variant = i === 0 ? "primary" : "outlined";
          return typeof act === "string" ? (
            <a key={label} className="k-btn" data-variant={variant} data-size="md" href={act}>
              {label}
            </a>
          ) : (
            <Button key={label} variant={variant} onClick={act}>
              {label}
            </Button>
          );
        })}
      </div>
      <p className="k-state-code">番号：{t.entry.support_code}</p>
    </section>
  );
}

export function NoAccess({ acts }: { acts?: ErrorAct[] }) {
  return <ErrorState code={PAGE_ERROR.forbidden} {...(acts ? { acts } : {})} />;
}

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
/** 端末がネットにつながっているか（サーバーで描くときは「つながっている」とみなす） */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** オフラインの帯（正本 E-PAGE-008）。つながっているときは何も出さない */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  const t = errorText(PAGE_ERROR.offline);
  return (
    <Callout tone="warn" title={t.title}>
      {t.body}
    </Callout>
  );
}

/** 画面いっぱいのエラー（404・権限が無い・調子が悪い・メンテナンス・ログインが切れた・リンクの期限切れ） */
export function ErrorPage({ code, acts }: { code: string; acts?: ErrorAct[] }) {
  return (
    <main className="k-root k-error-page">
      <div className="k-error-card">
        <span className="k-ws-mark" aria-hidden="true">
          K
        </span>
        <ErrorState code={code} heading={1} {...(acts ? { acts } : {})} />
      </div>
    </main>
  );
}
