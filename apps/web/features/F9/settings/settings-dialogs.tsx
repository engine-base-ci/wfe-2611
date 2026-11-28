"use client";
// チケットの設定の小窓（K-707・種別／状態 K-708／項目 K-709 で 1 組を使う・同じ組み立てを 3 か所に書かない）：
//   名前と色を入れて足す小窓（NameColorDialog）・消す確かめ（DeleteConfirm）・保存していない変更の小窓（DiscardConfirm）。
//   字のうち下絵に無い物は仮（代表に確認中）
import { Button, Confirm, Dialog, NoticeBox, TextField } from "@/components/k";
import { ColorPick, type Tone } from "./views";

// ---------------------------------------------------------------- 名前と色で足す
export interface NameColorDialogProps {
  open: boolean;
  /** 見出し（「種別を足す」など） */
  title: string;
  name: string;
  tone: Tone;
  /** 色のラジオの名前（画面の中で一意） */
  toneName: string;
  /** 名前の欄の下の赤字 */
  nameError?: string | undefined;
  /** 小窓の上の赤い箱 */
  notice?: string | undefined;
  busy: boolean;
  onName: (v: string) => void;
  onTone: (t: Tone) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function NameColorDialog(p: NameColorDialogProps) {
  const close = () => {
    if (!p.busy) p.onClose();
  };
  return (
    <Dialog
      open={p.open}
      onOpenChange={(o) => (o ? undefined : close())}
      title={p.title}
      actions={
        <>
          <Button variant="outlined" onClick={close} disabled={p.busy}>
            やめる
          </Button>
          <Button onClick={() => (p.busy ? undefined : p.onSubmit())} loading={p.busy}>
            足す
          </Button>
        </>
      }
    >
      <form
        className="k-dialog-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!p.busy) p.onSubmit();
        }}
      >
        {p.notice ? <NoticeBox>{p.notice}</NoticeBox> : null}
        <TextField
          label="名前"
          name={`${p.toneName}_name`}
          value={p.name}
          required
          error={p.nameError}
          onChange={(e) => p.onName(e.target.value)}
        />
        <ColorPick value={p.tone} name={p.toneName} onChange={p.onTone} />
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------- 消す確かめ
export interface DeleteConfirmProps {
  open: boolean;
  /** 何を消すか（「種別」「状態」「項目」） */
  what: string;
  name: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirm(p: DeleteConfirmProps) {
  return (
    <Confirm
      open={p.open}
      onOpenChange={(o) => (o ? undefined : p.onClose())}
      title={`${p.what}「${p.name}」を消しますか`}
      description="消すと元に戻せません"
      confirmLabel="消す"
      busy={p.busy}
      onConfirm={p.onConfirm}
    />
  );
}

// ---------------------------------------------------------------- 保存していない変更
export interface DiscardConfirmProps {
  open: boolean;
  onDiscard: () => void;
  onStay: () => void;
}

export function DiscardConfirm(p: DiscardConfirmProps) {
  return (
    <Dialog
      open={p.open}
      onOpenChange={(o) => (o ? undefined : p.onStay())}
      title="保存していない変更があります"
      size="confirm"
      description="このまま移ると、直した所は消えます"
      actions={
        <>
          <Button variant="outlined" onClick={p.onStay}>
            戻る
          </Button>
          <Button variant="danger" onClick={p.onDiscard}>
            捨てて移る
          </Button>
        </>
      }
    />
  );
}
