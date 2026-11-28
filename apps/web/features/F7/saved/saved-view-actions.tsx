"use client";
// 保存した検索条件の 名前を直す・消す（K-479・絵に無い物はこの葉の md で決めた字）。
//   名前を直す：口 updateSavedView に { name } だけ（見せる相手は替えない）。同じ名前（E-VWS-005）などは欄の下、それ以外は小窓の上の赤い箱。
//   消す：確かめ（Confirm）のあと口 deleteSavedView。404（もう無い）は並びから外して正本 E-PAGE-001 の文。
//   成功したら外枠の問い合わせを読み直し、小さなお知らせを出す
import { useId, useRef, useState, type FormEvent } from "react";
import { Button, Confirm, Dialog, NoticeBox, TextField, errorText, notify } from "@/components/k";
import type { ViewRow } from "./open-view";
import { VIEW_NAME_MAX, failText, isBlankName } from "./save-view-dialog";
import { useSavedViewWrites } from "./use-saved-views";

const NOT_FOUND = "E-PAGE-001";
const NO_NAME = "E-VWS-001";

export interface ViewActionProps {
  view: ViewRow;
  onClose: () => void;
  /** もう無い（404）とき、並びから外す */
  onGone: (id: string) => void;
}

const goneText = (): string => errorText(NOT_FOUND).entry.message;

export function RenameViewDialog({ view, onClose, onGone }: ViewActionProps) {
  const { renameView } = useSavedViewWrites();
  const formId = useId();
  const [name, setName] = useState(view.name);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending.current) return;
    if (isBlankName(name)) {
      setNameError(errorText(NO_NAME).entry.message);
      return;
    }
    sending.current = true;
    setBusy(true);
    setNameError(undefined);
    setNotice(undefined);
    const r = await renameView(view.id, name);
    sending.current = false;
    setBusy(false);
    if (r.ok) {
      notify("名前を直しました");
      onClose();
      return;
    }
    if (r.err?.status === 404) {
      onGone(view.id);
      notify(goneText(), { type: "error" });
      onClose();
      return;
    }
    const t = failText(r.err);
    setNameError(t.field);
    setNotice(t.box);
  };
  return (
    <Dialog
      title="名前を直す"
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
      actions={
        <>
          <Button variant="outlined" disabled={busy} onClick={onClose}>
            やめる
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            直す
          </Button>
        </>
      }
    >
      <form id={formId} className="k-dialog-stack" noValidate onSubmit={(e) => void submit(e)}>
        {notice ? <NoticeBox>{notice}</NoticeBox> : null}
        <TextField
          label="名前"
          name="view-rename"
          value={name}
          required
          maxLength={VIEW_NAME_MAX}
          error={nameError}
          aria-invalid={nameError ? true : undefined}
          onChange={(e) => setName([...e.target.value].slice(0, VIEW_NAME_MAX).join(""))}
        />
      </form>
    </Dialog>
  );
}

export function DeleteViewConfirm({ view, onClose, onGone }: ViewActionProps) {
  const { deleteView } = useSavedViewWrites();
  const [busy, setBusy] = useState(false);
  const [caution, setCaution] = useState<string | undefined>(undefined);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    setCaution(undefined);
    const r = await deleteView(view.id);
    setBusy(false);
    if (r.ok) {
      onGone(view.id);
      notify(`「${view.name}」を消しました`);
      onClose();
      return;
    }
    if (r.err?.status === 404) {
      onGone(view.id);
      notify(goneText(), { type: "error" });
      onClose();
      return;
    }
    setCaution(failText(r.err).box ?? failText(r.err).field);
  };
  const lines = ["消すと元に戻せません。", ...(view.share === "group" ? ["グループの全員から見えなくなります。"] : [])];
  return (
    <Confirm
      title={`「${view.name}」を消す`}
      description={lines.join("")}
      confirmLabel="消す"
      open
      busy={busy}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      onConfirm={() => void run()}
      {...(caution ? { caution: [caution] } : {})}
    />
  );
}
