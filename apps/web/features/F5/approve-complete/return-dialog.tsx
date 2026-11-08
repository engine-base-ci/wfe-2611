"use client";
// 差し戻しの小窓（K-63）。欄「差し戻す理由」（必須・2000 文字まで・ブラウザ標準の検証は使わない）。
//   書きかけはその端末に残す（localStorage の kaname.k63.return.<承認の id>・送ったら消す）。理由は文字のまま送る（HTML を作らない）
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, TextArea } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { catalogMessage } from "./shared";

/** 差し戻す理由の上限（E-VAL-021） */
export const REASON_MAX = 2000;
const draftKey = (approvalId: string) => `kaname.k63.return.${approvalId}`;
const readDraft = (approvalId: string): string => {
  try {
    return window.localStorage.getItem(draftKey(approvalId)) ?? "";
  } catch {
    return "";
  }
};
const writeDraft = (approvalId: string, v: string) => {
  try {
    if (v) window.localStorage.setItem(draftKey(approvalId), v);
    else window.localStorage.removeItem(draftKey(approvalId));
  } catch {
    /* 残せなくても差し戻せる */
  }
};

interface Props {
  approvalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 差し戻せた */
  onDone: () => void | Promise<void>;
  /** 口が断った（422 の欄の理由は小窓の中に出す。それ以外は呼んだ側が知らせる） */
  onFailed: (r: CallErr) => void | Promise<void>;
}

export function ReturnDialog({ approvalId, open, onOpenChange, onDone, onFailed }: Props) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  useEffect(() => {
    if (open) {
      setNote(readDraft(approvalId));
      setError(null);
    }
  }, [open, approvalId]);

  const send = async () => {
    if (sending.current) return;
    const v = note.normalize("NFKC").trim();
    if (!v) return setError(catalogMessage("E-VAL-020"));
    if ([...v].length > REASON_MAX) return setError(catalogMessage("E-VAL-021"));
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("returnApproval", { params: { id: approvalId }, body: { note }, screenId: "approvals" });
      if (r.ok) {
        writeDraft(approvalId, "");
        setNote("");
        onOpenChange(false);
        await onDone();
        return;
      }
      if (r.status === 422 && r.fields["note"]) return setError(r.fields["note"]);
      onOpenChange(false);
      await onFailed(r);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="差し戻す"
      description="理由を書くと、同じ AI がその理由に合わせて作り直します"
      open={open}
      onOpenChange={onOpenChange}
      actions={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            やめる
          </Button>
          <Button onClick={() => void send()} loading={busy}>
            差し戻して作り直させる
          </Button>
        </>
      }
    >
      <TextArea
        label="差し戻す理由"
        name="note"
        rows={5}
        value={note}
        error={error}
        onChange={(e) => {
          setNote(e.target.value);
          writeDraft(approvalId, e.target.value);
          if (error) setError(null);
        }}
      />
    </Dialog>
  );
}
