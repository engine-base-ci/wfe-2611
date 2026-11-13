"use client";
// 差し戻しの小窓（K-181・口は K-163 の returnApproval）。欄「差し戻す理由」（複数行・必須だが文字数の上限は置かない・D-131.1）。
//   ブラウザ標準の検証は使わない（required を付けず、空は小窓の中に正本の文 E-VAL-020）。
//   書きかけはその端末に残す（localStorage の kaname.k63.return.<承認の id>・送って 201 なら消す）。理由は文字のまま送る（HTML を作らない）
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, TextArea } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { catalogMessage } from "./message";

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
  screenId: "approvals" | "tickets";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 差し戻せた（201） */
  onDone: () => void | Promise<void>;
  /** 口が断った（422 の欄 note は小窓の中に出す。それ以外は小窓を閉じ、呼んだ側が知らせて読み直す） */
  onFailed: (r: CallErr) => void | Promise<void>;
}

export function ReturnDialog({ approvalId, screenId, open, onOpenChange, onDone, onFailed }: Props) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false); // 答えが来るまで 2 本目を送らない（押せない間の click も含む）
  useEffect(() => {
    if (open) {
      setNote(readDraft(approvalId));
      setError(null);
    }
  }, [open, approvalId]);

  const send = async () => {
    if (sending.current) return;
    if (!note.normalize("NFKC").trim()) return setError(catalogMessage("E-VAL-020"));
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("returnApproval", { params: { id: approvalId }, body: { note }, screenId });
      if (r.ok) {
        writeDraft(approvalId, "");
        setNote("");
        onOpenChange(false);
        await onDone();
        return;
      }
      if (r.status === 422 && r.fields["note"]) return setError(r.fields["note"]);
      if (r.status === 401) return; // 入り直し（共通の扱い）
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
          <Button onClick={() => void send()} loading={busy} disabled={busy}>
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
