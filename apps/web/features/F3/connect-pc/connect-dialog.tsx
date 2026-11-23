"use client";
// PC をつなぐの小窓（K-230・キャンバス EdPC）。小窓の型（components/k/dialog.tsx）を使う：置き場（上から 60px）・影・余白は型のまま、
//   幅は size="connect"（580）・題は h1（小窓が開くと後ろが読み上げの木から外れ、読み上げの h1 を小窓の題 1 つにする）・頭の補足は subtitle。
//   本文は 3 段（丸・題・説明）と共用の PC の注意、足は「あとで」だけ。開いたときのフォーカスは足の最初のボタン（「あとで」）。
//   待っている印（橙の点と「アプリからの返事を待っています…」）は 2 段目（コードの段）の「10 分で切れる…新しいコード」の下に状態の 1 行で出す
//   （代表の答え answer=8d3ada64dcbd・2026-11-20：足の帯ではない。待っているのはアプリがこのコードを受け取ること・K-374）
//   接続コードの 1 字ずつの箱は inline の箱で並べる（innerText を改行の無い 6 字にする・staging と m2 が読む）
//   takeHelp：受け取る段（1 段目）の中、受け取るの字のリンクの下に差す物（K-374 が受け取った後に OS の警告の越え方 OsWarning を渡す）。渡さなければ今の絵のまま
import type { KeyboardEvent, ReactNode } from "react";
import { Button, Dialog } from "@/components/k";

export type Os = "mac" | "win";

interface StepProps {
  n: number;
  /** done＝済（緑の ✓）・now＝今の段（紺の番号）・todo＝まだ（灰） */
  state: "done" | "now" | "todo";
  title: string;
  children: ReactNode;
}
function Step({ n, state, title, children }: StepProps) {
  return (
    <li>
      <span className="k-step-dot" data-state={state} aria-hidden="true">
        {state === "done" ? "✓" : n}
      </span>
      <div className="k-step-main">
        <h2 className="k-step-title">{title}</h2>
        <div className="k-step-desc">{children}</div>
      </div>
    </li>
  );
}

/** 字のリンクの形の受け取る（role=button・Enter と Space でも押せる） */
function Take({ os, label, onTake }: { os: Os; label: string; onTake: (os: Os) => void }) {
  const onKey = (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTake(os);
    }
  };
  return (
    <a
      role="button"
      tabIndex={0}
      className="k-pc-take"
      aria-label={`${label}を受け取る`}
      onClick={() => onTake(os)}
      onKeyDown={onKey}
    >
      {label}
    </a>
  );
}

export interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 今の接続コード（まだ無ければ null） */
  code: string | null;
  /** 新しいコードの答えを待っている間 */
  busy: boolean;
  /** 受け取りに成功した（1 段目を済にする） */
  received: boolean;
  onTake: (os: Os) => void;
  onNewCode: () => void;
  /** 小窓の中に出す知らせ（受け取りの結果・待って・失敗） */
  notice?: ReactNode;
  /** 受け取る段の中に差す物（受け取った後の OS の警告の越え方・K-374） */
  takeHelp?: ReactNode;
}

/** 橙の点つきの「アプリからの返事を待っています…」 */
function Wait() {
  return (
    <span className="k-pc-wait">
      <span className="k-wait-dot" aria-hidden="true" />
      アプリからの返事を待っています…
    </span>
  );
}

export function ConnectDialog({
  open,
  onOpenChange,
  code,
  busy,
  received,
  onTake,
  onNewCode,
  notice,
  takeHelp,
}: ConnectDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="connect"
      titleLevel={1}
      title="PC をつなぐ"
      subtitle="分身はこの PC で動く。3 分ほど"
      actions={
        <>
          <Button variant="outlined" className="k-pc-btn" onClick={() => onOpenChange(false)}>
            あとで
          </Button>
        </>
      }
    >
      <ol className="k-steps">
        <Step n={1} state={received ? "done" : "now"} title="常駐アプリを入れる">
          Mac・Windows に入れる小さなアプリ。ブラウザを動かし、預けたログイン情報を入れる役目 ・{" "}
          <Take os="mac" label="Mac 用" onTake={onTake} /> ／ <Take os="win" label="Windows 用" onTake={onTake} />
          {takeHelp}
        </Step>
        <Step n={2} state="now" title="アプリにこのコードを入れる">
          {code ? (
            <span className="k-code" data-testid="pairing-code" aria-label="接続コード">
              {[...code].map((c, i) => (
                <span key={i} className="k-code-cell">
                  {c}
                </span>
              ))}
            </span>
          ) : null}
          <span className="k-code-foot">
            <span>10 分で切れる ・ この PC 専用の鍵が作られ、ほかの PC からは使えない</span>
            <button
              type="button"
              className="k-pc-text-btn"
              data-act="new-code"
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={onNewCode}
            >
              新しいコード
            </button>
          </span>
          <span className="k-pc-wait-line">
            <Wait />
          </span>
        </Step>
        <Step n={3} state="todo" title="試しに動かす">
          分身が「ナレッジのページを開いて閉じる」を試す。終わればつながった
        </Step>
      </ol>
      <div className="k-pc-shared-note">
        <b aria-hidden="true">!</b>
        <span>つなぐ PC は、あなたしか使わないものにする。共用の PC だと、ほかの人があなたの分身の作業を見られる</span>
      </div>
      {notice}
    </Dialog>
  );
}
