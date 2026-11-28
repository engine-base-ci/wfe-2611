"use client";
// 確認項目を足す小窓（K-450・下絵 f4v2-spec-add・f4v2-spec-add-error）。字と並びは features/F4/doc/detail-views.tsx の SpecAddDialog と同じ。
//   書いた文は画面で先に確かめる（空・200 字超は欄の下）。口の 422 も欄の下、ほかの断りは小窓の上の赤い箱。断られても書いた中身と小窓は残る。
//   作る面は onAdd が画面の中に足すだけ、詳細は口を呼ぶ。送っている間は「足す」を押せない（口は 1 回）
import { useEffect, useRef, useState } from "react";
import { Button, Callout, Dialog, TextArea } from "@/components/k";
import type { AddResult } from "./use-test-specs";
import { titleProblem, trimTitle } from "./spec-text";

export interface SpecAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 前後の空白を落とした文を受け、足せたかを返す */
  onAdd: (title: string) => Promise<AddResult> | AddResult;
}

export function SpecAddDialog({ open, onOpenChange, onAdd }: SpecAddDialogProps) {
  const [text, setText] = useState("");
  const [field, setField] = useState<string | null>(null);
  const [box, setBox] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setText("");
    setField(null);
    setBox(null);
    setSending(false);
    sendingRef.current = false;
  }, [open]);

  const submit = async (): Promise<void> => {
    if (sendingRef.current) return;
    const problem = titleProblem(text);
    if (problem) {
      setField(problem);
      return;
    }
    setField(null);
    setBox(null);
    sendingRef.current = true;
    setSending(true);
    const r = await onAdd(trimTitle(text));
    sendingRef.current = false;
    setSending(false);
    if (r.ok) {
      onOpenChange(false);
      return;
    }
    if (r.field) setField(r.field);
    if (r.box) setBox(r.box);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && sendingRef.current) return;
        onOpenChange(o);
      }}
      title="確認項目を足す"
      actions={
        <>
          <Button variant="outlined" disabled={sending} onClick={() => onOpenChange(false)}>
            やめる
          </Button>
          <Button loading={sending} onClick={() => void submit()}>
            足す
          </Button>
        </>
      }
    >
      {box ? <Callout tone="danger">{box}</Callout> : null}
      <TextArea
        label="確かめること"
        name="spec_text"
        required
        rows={2}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (field) setField(null);
        }}
        error={field}
      />
    </Dialog>
  );
}
