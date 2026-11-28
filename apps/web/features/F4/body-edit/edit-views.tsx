"use client";
// 本文を直す見た目（K-447）。値と関数を受けて描くだけで、口は呼ばない。class と字は下絵 v2 の部品（features/F4/doc/detail-extra.tsx の
//   EnterButton・EditBandMark・ConflictBand・SessionLostBand・FailBox・DiscardDialog）と同じ。字は文字として描く
import { Band, Button, Dialog, NoticeBox } from "@/components/k";
import { clockLabel } from "./body-edit-copy";

const COPY_NOTE = "この PC のブラウザの中に残しています。ほかの端末では続きを書けません";
const SAVE_FAILED = "自動で保存できませんでした。書き終えるまで、この画面を閉じないでください";

export function EnterButton({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="k-f4d-enter">
      <Button variant="ghost" size="sm" aria-label="本文を直す" onClick={onEnter}>
        本文を直す
      </Button>
    </div>
  );
}

/** 上の帯：自動保存の印（role=status の入れ物は印が空でも在る）・やめる・書き終える */
export function BodyEditBand({
  savedAt,
  saveFailed,
  busy,
  onCancel,
  onFinish,
}: {
  savedAt: string | null;
  saveFailed: boolean;
  busy: boolean;
  onCancel: () => void;
  onFinish: () => void;
}) {
  const mark = saveFailed ? SAVE_FAILED : savedAt ? `自動で保存しました（${clockLabel(savedAt)}）` : "";
  return (
    <div className="k-f4d-editband">
      <span
        role="status"
        data-kind={saveFailed ? "failed" : savedAt ? "saved" : "none"}
        className={saveFailed ? "k-f4d-savefail" : undefined}
        title={COPY_NOTE}
      >
        {mark}
      </span>
      <span className="k-f4d-editband-acts">
        <Button variant="outlined" size="sm" onClick={onCancel} disabled={busy}>
          やめる
        </Button>
        <Button size="sm" onClick={onFinish} loading={busy}>
          書き終える
        </Button>
      </span>
    </div>
  );
}

/** 先に直された帯（字は固定・D-150.13）。「比べる」は新しいタブで版と差分の頁（書いている画面は変えない） */
export function ConflictBand({ compareHref, onReread }: { compareHref: string; onReread: () => void }) {
  return (
    <div className="k-f4d-notice">
      <Band
        tone="wait"
        role="alert"
        title="ほかの人が先に直しました"
        sub="読み直してから、もう一度直してください。"
        acts={
          <>
            <Button variant="outlined" size="sm" onClick={() => window.open(compareHref, "_blank", "noopener")}>
              比べる
            </Button>
            <Button variant="outlined" size="sm" onClick={onReread}>
              読み直す
            </Button>
          </>
        }
      />
    </div>
  );
}

export function SessionLostBand({ onRelogin }: { onRelogin: () => void }) {
  return (
    <div className="k-f4d-notice">
      <Band
        tone="danger"
        role="alert"
        title="ログインが切れました"
        sub="入り直すと、いま書いている内容は消えます。必要なら、先に別の場所へ写してください。"
        acts={
          <Button variant="outlined" size="sm" onClick={onRelogin}>
            ログインし直す
          </Button>
        }
      />
    </div>
  );
}

export function EditFailBox({ text }: { text: string }) {
  return (
    <div className="k-f4d-notice">
      <NoticeBox>{text}</NoticeBox>
    </div>
  );
}

/** やめるの確かめ：直した後に「やめる」を押したときだけ出る */
export function DiscardDialog({
  target,
  onKeep,
  onDiscard,
}: {
  target: string;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? undefined : onKeep())}
      title="書いた内容を捨てますか"
      target={target}
      actions={
        <>
          <Button variant="outlined" onClick={onKeep}>
            書き続ける
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            捨てる
          </Button>
        </>
      }
    >
      <p>やめると、いま書いている内容は消えます。</p>
    </Dialog>
  );
}
