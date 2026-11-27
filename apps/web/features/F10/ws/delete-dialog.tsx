"use client";
// ワークスペースを消す小窓（キャンバス EdDeleteWs）。消えるものを出す・名前を打って確かめる（書き出しは作らない・D-154.4）・本人確認・14 日は取り消せる。
//   値を受け取って描くだけ（口は呼ばない）。名前が合うまで足の主ボタンは押せない
//   K-832：口につなぐための任意の props（打った字・送る・やめる・処理中・誤り・消えるものの数・開くか）を足した。渡さない呼び方（下絵）は前の見た目のまま
import type { ReactNode } from "react";
import { Button, Callout, Dialog } from "@/components/k";
import "@/features/F10/invite/invite.css";
import "./ws.css";

const MOCK_COUNTS = { tickets: 69, members: 5 } as const;

export interface DeleteWsDialogProps {
  name: string;
  typed: string;
  /** 開くか（既定は開く。本人確認の取り直しの間は閉じておく） */
  open?: boolean;
  /** 名前の欄に打った（打った字のまま） */
  onTyped?: (text: string) => void;
  /** 主ボタンを押した（名前が合っているときだけ呼ぶ） */
  onConfirm?: () => void;
  /** 「やめる」・×・Esc で閉じた */
  onCancel?: () => void;
  /** 答えを待つ間（主ボタンは処理中・閉じない） */
  busy?: boolean;
  /** 名前の欄の下の誤り（口の断り） */
  error?: string;
  /** 小窓の中の赤い箱（口が落ちた・網が切れた） */
  notice?: ReactNode;
  /** 消えるものの数（無ければ下絵の数） */
  counts?: { tickets: number; members: number };
}

export function DeleteWsDialog({
  name,
  typed,
  open = true,
  onTyped,
  onConfirm,
  onCancel,
  busy = false,
  error,
  notice,
  counts = MOCK_COUNTS,
}: DeleteWsDialogProps) {
  const matched = typed === name;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel?.();
      }}
      title="ワークスペースを消す"
      subtitle={`${name} を消す ・ 消すと戻せません`}
      actions={
        <>
          <Button variant="outlined" disabled={busy} {...(onCancel ? { onClick: onCancel } : {})}>
            やめる
          </Button>
          <Button
            variant="danger"
            disabled={!matched}
            loading={busy}
            {...(onConfirm ? { onClick: () => matched && !busy && onConfirm() } : {})}
          >
            本人確認して消す手続きをする
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <div className="k-dialog-caution">
          <p>消えるもの</p>
          <p>{`チケット ${counts.tickets} 件・記録・預けたログイン情報・メンバー ${counts.members} 人の分身の記憶（このワークスペースの分）`}</p>
        </div>
        <ul className="k-f10w-bullets">
          <li>メンバーのアカウントは消えない（ほかのワークスペースはそのまま）</li>
          <li>消す手続きから 14 日は取り消せる。そのあと完全に消える</li>
        </ul>
        {notice ? <Callout tone="danger">{notice}</Callout> : null}
        <label className="k-field">
          <span className="k-label">確かめのため、ワークスペースの名前を打ってください</span>
          <input
            className="k-input"
            value={typed}
            placeholder={name}
            {...(onTyped ? { onChange: (e) => onTyped(e.target.value) } : { readOnly: true })}
            aria-invalid={error || (typed !== "" && !matched) ? true : undefined}
          />
          <span className="k-inv-sub">{matched ? "名前が合いました" : "名前が合うと押せる"}</span>
          {error ? (
            <span className="k-err" role="alert">
              {error}
            </span>
          ) : null}
        </label>
      </div>
    </Dialog>
  );
}
