"use client";
// 差し戻しの小窓（K-181・口は K-163 の returnApproval）。欄「差し戻す理由」（複数行・必須だが文字数の上限は置かない・D-131.1）。
//   ブラウザ標準の検証は使わない（required を付けず、空は小窓の中に正本の文 E-VAL-020）。
//   書きかけはその端末に残す（localStorage の kaname.k63.return.<承認の id>・送って 201 なら消す）。理由は文字のまま送る（HTML を作らない）
//   中身はキャンバス StReturnModal（K-229）：対象の行・どこを直すか・理由（必須）・次は誰が直すか・覚えさせる候補。
//   どこを直すか・次は誰が直すか・覚えさせる候補は仕組みがまだ無いので、出したまま押せない（D-145.9・input そのものを薄く）。
//   覚えさせる候補はキャンバスでは印ありだが、仕組みが無いのに印を付けると「覚えさせる」と読めるので印なし。送る体は { note } だけ
import { useEffect, useId, useRef, useState } from "react";
import { Button, Checkbox, Dialog, Radio, RadioGroup } from "@/components/k";
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
  /** 頭の下の対象の行（「EG-133 11 月分の請求書を送る」） */
  target?: string;
}

export function ReturnDialog({ approvalId, screenId, open, onOpenChange, onDone, onFailed, target }: Props) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();
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
      open={open}
      onOpenChange={onOpenChange}
      actions={
        <>
          <Button variant="outlined" onClick={() => onOpenChange(false)}>
            やめる
          </Button>
          <Button onClick={() => void send()} loading={busy} disabled={busy}>
            差し戻す
          </Button>
        </>
      }
    >
      {/* 段の間は 12px（StReturnModal）。対象の行も同じ段に置く */}
      <div className="k-dialog-stack">
        {target ? <p className="k-dialog-target">{target}</p> : null}
        <label className="k-field">
          <span className="k-label">どこを直すか</span>
          <select className="k-input" disabled aria-disabled="true" value="" onChange={() => undefined}>
            <option value="" hidden />
          </select>
        </label>
        {/* 見える項目名は「理由」と必須の印・欄の名前は「差し戻す理由」（見える字が名前に含まれる）。理由は aria-describedby でつなぐ */}
        <label className="k-field">
          <span className="k-label">
            理由 <span className="k-field-required">必須</span>
          </span>
          <textarea
            className="k-input"
            aria-label="差し戻す理由"
            name="note"
            rows={2}
            value={note}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setNote(e.target.value);
              writeDraft(approvalId, e.target.value);
              if (error) setError(null);
            }}
          />
          {error ? (
            <span id={errorId} className="k-err">
              {error}
            </span>
          ) : null}
        </label>
        <RadioGroup className="k-dialog-group" legend="次は誰が直すか" name="k229-who" value="ai" disabled size="sm">
          <Radio value="ai" aria-disabled="true" readOnly>
            AI に直させて、確認からやり直す
          </Radio>
          <Radio value="self" aria-disabled="true" readOnly>
            自分で直す
          </Radio>
        </RadioGroup>
        <Checkbox size="sm" disabled aria-disabled="true" readOnly>
          この理由を AI に覚えさせる候補にする（ナレッジ更新の候補）
        </Checkbox>
      </div>
    </Dialog>
  );
}
