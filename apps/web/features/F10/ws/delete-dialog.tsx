"use client";
// ワークスペースを消す小窓（キャンバス EdDeleteWs）。消えるものを出す・名前を打って確かめる（書き出しは作らない・D-154.4）・本人確認・14 日は取り消せる。
//   値を受け取って描くだけ（口は呼ばない）。名前が合うまで足の主ボタンは押せない
import { Button, Dialog } from "@/components/k";
import "@/features/F10/invite/invite.css";
import "./ws.css";

export function DeleteWsDialog({ name, typed }: { name: string; typed: string }) {
  const matched = typed === name;
  return (
    <Dialog
      open
      title="ワークスペースを消す"
      subtitle={`${name} を消す ・ 消すと戻せません`}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button variant="danger" disabled={!matched}>
            本人確認して消す手続きをする
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <div className="k-dialog-caution">
          <p>消えるもの</p>
          <p>チケット 69 件・記録・預けたログイン情報・メンバー 5 人の分身の記憶（このワークスペースの分）</p>
        </div>
        <ul className="k-f10w-bullets">
          <li>メンバーのアカウントは消えない（ほかのワークスペースはそのまま）</li>
          <li>消す手続きから 14 日は取り消せる。そのあと完全に消える</li>
        </ul>
        <label className="k-field">
          <span className="k-label">確かめのため、ワークスペースの名前を打ってください</span>
          <input
            className="k-input"
            value={typed}
            placeholder={name}
            readOnly
            aria-invalid={typed !== "" && !matched ? true : undefined}
          />
          <span className="k-inv-sub">{matched ? "名前が合いました" : "名前が合うと押せる"}</span>
        </label>
      </div>
    </Dialog>
  );
}
