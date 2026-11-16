"use client";
// PC をつなぐの小窓（K-230・キャンバス EdPC）。幅 580・頭に題（h1）と補足と ×・本文に 3 段と共用の PC の注意・足に「あとで」と待っている印。
//   形は共通の小窓（components/k/dialog.tsx・StModal）と同じ組み（.k-dialog・頭・本文・足）で、Base UI の Dialog を直に使う。
//   題を h1 にするのは、小窓が開くと後ろが読み上げの木から外れ、読み上げの h1 を小窓の題 1 つにするため（前からの試験の約束）。
//   開いたときのフォーカスは足の最初のボタン（「あとで」）。× には置かない。閉じると開いた所に戻る（Base UI が持つ）
//   接続コードの 1 字ずつの箱は inline の箱で並べる（innerText を改行の無い 6 字にする・staging と m2 が読む）
import { Dialog as D } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useCallback, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/k";

const FIRST_ACTION = ".k-dialog-actions button:not(:disabled)";

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
  /** 受け取りを始めた（1 段目を済にする） */
  received: boolean;
  onTake: (os: Os) => void;
  onNewCode: () => void;
  /** 小窓の中に出す知らせ（受け取りの結果・待って・失敗） */
  notice?: ReactNode;
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
}: ConnectDialogProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const firstFocus = useCallback(
    (): HTMLElement | null => popupRef.current?.querySelector<HTMLElement>(FIRST_ACTION) ?? popupRef.current,
    [],
  );
  return (
    <D.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <D.Portal>
        <D.Backdrop className="k-backdrop" />
        <D.Popup ref={popupRef} className="k-dialog k-pc-dialog" initialFocus={firstFocus}>
          <div className="k-dialog-head">
            <div className="k-pc-dialog-titles">
              <D.Title className="k-dialog-title" render={<h1 />}>
                PC をつなぐ
              </D.Title>
              <D.Description className="k-pc-dialog-sub" render={<div />}>
                分身はこの PC で動く。3 分ほど
              </D.Description>
            </div>
            <D.Close className="k-dialog-close" aria-label="閉じる">
              <X aria-hidden="true" size={16} />
            </D.Close>
          </div>
          <div className="k-dialog-body">
            <ol className="k-steps">
              <Step n={1} state={received ? "done" : "now"} title="常駐アプリを入れる">
                Mac・Windows に入れる小さなアプリ。ブラウザを動かし、預けたログイン情報を入れる役目 ・{" "}
                <Take os="mac" label="Mac 用" onTake={onTake} /> ／ <Take os="win" label="Windows 用" onTake={onTake} />
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
              </Step>
              <Step n={3} state="todo" title="試しに動かす">
                分身が「ナレッジのページを開いて閉じる」を試す。終わればつながった
              </Step>
            </ol>
            <div className="k-pc-shared-note">
              <b aria-hidden="true">!</b>
              <span>
                つなぐ PC は、あなたしか使わないものにする。共用の PC だと、ほかの人があなたの分身の作業を見られる
              </span>
            </div>
            {notice}
          </div>
          <div className="k-dialog-actions">
            <D.Close
              render={
                <Button variant="outlined" className="k-pc-btn">
                  あとで
                </Button>
              }
            />
            <span className="k-pc-wait">
              <span className="k-wait-dot" aria-hidden="true" />
              アプリからの返事を待っています…
            </span>
          </div>
        </D.Popup>
      </D.Portal>
    </D.Root>
  );
}
