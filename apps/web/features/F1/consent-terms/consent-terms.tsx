"use client";
// K-53 規約に同意し直す（/login?step=terms&next=…・行為 A96・ログインの画面の続き）。新しい道は作らない（flow.json で consentToTerms の画面は login）。
//   運営が利用規約かプライバシーポリシーの新しい版を出した後、次にログインしたとき（または確認のメールで確定した直後に版が変わっていたとき）、
//   口が 403・E-AUTH-010 を返し、どの画面からでもここへ移る（lib/terms-gate.ts）。同意するまで先に進めない（口が止める・D-125.162）。
//   出すもの：今の版の名前と文面のリンク（今の版の口 getCurrentTerms）・同意のチェック・「同意して続ける」・「ログアウト」・「困ったとき」。
//   同意の口 consentToTerms は利用規約とプライバシーポリシーの今の版の ID だけを送る（特商法の表示は見せるだけ・D-128.137）。
//   同意したら元の道（next）へ。next は Kaname の中の道だけ（外・// で始まる・javascript: はチケットの画面へ）。文言は正本（errors.json）
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useId, useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Button, Callout, Loading, PAGE_ERROR } from "@/components/k";
import { call } from "@/lib/api/call";
import { clearDraftCopies, getToken, setToken } from "@/lib/api/client";
import { pendingRoute } from "@/lib/pending-route";
import { clearTermsReason, markTermsAgreed, termsReason } from "@/lib/terms-gate";
import { AuthFrame } from "../sign-up/frame";
import { waitText } from "../sign-up/wait-text";
import { loadCurrentTerms, versionLabel, type TermsItem } from "./current-terms";
import "./consent-terms.css";

/** 戻る先が使えないときに入る画面（チケットの画面・K-60） */
const AFTER = pendingRoute("/tickets", "K-60");
const msg = (code: string): string => CATALOG[code]?.message ?? code;
const NEED = [
  { kind: "terms", name: "利用規約" },
  { kind: "privacy", name: "プライバシーポリシー" },
] as const;

/** 戻る先：Kaname の中の道だけ。URL の決まりで読み（タブ・改行・\ も URL と同じ扱い）、この画面と同じ出どころのときだけ
 *  道（pathname）・問い合わせ（search）・#（hash）を使う。外の出どころ・// で始まる道・javascript: などはチケットの画面へ */
export function safeNext(next: string | null): Route {
  if (!next || typeof window === "undefined") return AFTER;
  try {
    const u = new URL(next, window.location.origin);
    if (u.origin !== window.location.origin) return AFTER;
    // 符号にした制御文字（%09・%0A）や \ を道に残すと、移った先で読み直されて外へ向く形になりうる。符号を外して見て、怪しければ使わない
    const plain = decodeURIComponent(u.pathname);
    // eslint-disable-next-line no-control-regex -- 制御文字が混ざった道を外す（K53-UI-012）
    if (/[\u0000-\u001f\u007f\\]/.test(plain) || plain.startsWith("//")) return AFTER;
    return `${u.pathname}${u.search}${u.hash}` as Route;
  } catch {
    return AFTER;
  }
}

type Banner =
  | { kind: "stale" }
  | { kind: "expired"; text: string }
  | { kind: "wait"; sec: number | null }
  | { kind: "down" }
  | null;

export function ConsentTerms({ next }: { next: string | null }) {
  const router = useRouter();
  const boxId = useId();
  const errId = `${boxId}-err`;
  /** ログイン中かを確かめるまでは中を出さない（ログアウトした後に戻るで開いても、チェックとボタンを見せない） */
  const [signedIn, setSignedIn] = useState(false);
  const [items, setItems] = useState<TermsItem[] | null>(null);
  const [checked, setChecked] = useState(false);
  const [noAgree, setNoAgree] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  useEffect(() => {
    setReason(termsReason());
    if (!getToken()) {
      router.replace("/login" as Route);
      return;
    }
    let alive = true;
    void call("getMe", { keepOn401: true, screenId: "login" })
      .then((me) => {
        if (!alive) return;
        if (me.status === 401) {
          setToken(null);
          router.replace("/login" as Route);
          return;
        }
        setSignedIn(true);
      })
      .catch(() => alive && setSignedIn(true));
    void loadCurrentTerms().then((t) => {
      if (!alive) return;
      if (t.kind === "ok") setItems(t.items);
      else setBanner({ kind: "down" });
    });
    return () => {
      alive = false;
    };
  }, [router]);

  const reload = async () => {
    const t = await loadCurrentTerms(true);
    if (t.kind === "ok") setItems(t.items);
  };

  const agree = async () => {
    if (sending.current) return; // 2 回押しても口は 1 回
    if (!checked) {
      setNoAgree(true);
      return;
    }
    const ids = Object.fromEntries(NEED.map((n) => [n.kind, items?.find((x) => x.kind === n.kind)?.id]));
    if (!ids["terms"] || !ids["privacy"]) {
      setBanner({ kind: "down" });
      return;
    }
    sending.current = true;
    setBusy(true);
    setBanner(null);
    try {
      const r = await call("consentToTerms", {
        body: { agree: true, terms_version_id: ids["terms"], privacy_version_id: ids["privacy"] },
        screenId: "login",
      });
      if (r.ok) {
        markTermsAgreed();
        router.replace(safeNext(next));
        return;
      }
      if (r.status === 401) setBanner({ kind: "expired", text: r.message ?? msg(PAGE_ERROR.sessionExpired) });
      else if (r.status === 409) {
        setChecked(false);
        setBanner({ kind: "stale" });
        await reload();
      } else if (r.status === 422 && r.code === "E-VAL-019") setNoAgree(true);
      else if (r.status === 429) setBanner({ kind: "wait", sec: r.retryAfterSec });
      else setBanner({ kind: "down" });
    } catch {
      setBanner({ kind: "down" });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const signOut = async () => {
    await call("signOut", { keepOn401: true, screenId: "login" }).catch(() => null);
    setToken(null);
    clearDraftCopies(); // ログアウトはどこからでも、この PC の書きかけの写しを消す（lib/auth の signOut と同じ・K-60 H1）
    clearTermsReason();
    // 戻るで同意し直しの画面を開いても中は出さない（ログインの印が無いのでログインへ移す）。履歴は残す（push）
    router.push("/login" as Route);
  };

  return (
    <AuthFrame foot="help">
      <h1>利用規約とプライバシーポリシーが新しくなりました</h1>
      {reason ? <Callout>{reason}</Callout> : null}
      {banner?.kind === "down" ? <Callout tone="danger">{msg(PAGE_ERROR.down)}</Callout> : null}
      {banner?.kind === "stale" ? <Callout tone="warn">{msg("E-CONF-012")}</Callout> : null}
      {banner?.kind === "expired" ? <Callout tone="danger">{banner.text}</Callout> : null}
      {banner?.kind === "wait" ? <Callout tone="warn">{waitText(banner.sec)}</Callout> : null}
      {!signedIn ? (
        <Loading label="確かめています…" delayMs={600} />
      ) : items ? (
        <>
          <p className="k-auth-lead">新しい版を読んで同意してから、続けてください</p>
          <ul className="k-terms-list">
            {NEED.map((n) => {
              const it = items.find((x) => x.kind === n.kind);
              return it ? (
                <li key={n.kind}>
                  <a href={it.url} target="_blank" rel="noopener">
                    {n.name}
                  </a>
                  <span className="k-terms-version">{versionLabel(it.version)}</span>
                </li>
              ) : null;
            })}
          </ul>
          <div className="k-terms-check" data-invalid={noAgree ? "" : undefined}>
            <input
              id={boxId}
              type="checkbox"
              checked={checked}
              aria-invalid={noAgree || undefined}
              aria-describedby={noAgree ? errId : undefined}
              onChange={(e) => {
                setChecked(e.target.checked);
                if (e.target.checked) setNoAgree(false);
              }}
            />
            <label htmlFor={boxId}>利用規約とプライバシーポリシーに同意します</label>
          </div>
          {noAgree ? (
            <p id={errId} className="k-err k-terms-err">
              {msg("E-VAL-019")}
            </p>
          ) : null}
          <div className="k-auth-actions">
            <Button onClick={() => void agree()} loading={busy}>
              同意して続ける
            </Button>
            <Button variant="ghost" onClick={() => void signOut()} disabled={busy}>
              ログアウト
            </Button>
          </div>
        </>
      ) : banner?.kind === "down" ? (
        <div className="k-auth-actions">
          <Button variant="ghost" onClick={() => void signOut()}>
            ログアウト
          </Button>
        </div>
      ) : (
        <Loading label="今の版を読んでいます…" delayMs={600} />
      )}
    </AuthFrame>
  );
}
