"use client";
// 完了の小窓（K-63）。実施事項の項目ごとのチェック（todo の本文の「- 」の行。既に「- [x]」の行は入った状態）と、
//   「完了の条件を満たしたことを確かめました」（完了の条件の本文を上に出す）。ブラウザ標準の検証は使わず、足りないときは小窓の中に理由を出す。
//   残っている項目・終わっていない子（その子へのリンク）は口の答え（422）でも出す
import { useEffect, useRef, useState } from "react";
import { Button, Dialog } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { catalogMessage, messageOf } from "./shared";

export interface TodoItem {
  text: string;
  done: boolean;
}
/** 実施事項の本文 → 項目（0 から数える） */
export function todoItems(text: string): TodoItem[] {
  return text
    .split("\n")
    .filter((l) => /^\s*- /.test(l))
    .map((l) => ({
      done: /^\s*- \[[xX]\](\s|$)/.test(l),
      text: l.replace(/^\s*- (\[[ xX]?\]\s*)?/, ""),
    }));
}

interface Props {
  ticketId: string;
  todo: { text: string; version: number };
  conditions: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void | Promise<void>;
  /** 422 でない断り（409 など）。呼んだ側が知らせて読み直す */
  onFailed: (r: CallErr) => void | Promise<void>;
}
type Problem = { message: string; items: { text: string; href?: string }[] };

export function CompleteDialog({ ticketId, todo, conditions, open, onOpenChange, onDone, onFailed }: Props) {
  const items = todoItems(todo.text);
  const [checked, setChecked] = useState<boolean[]>(() => items.map((x) => x.done));
  const [confirmed, setConfirmed] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  useEffect(() => {
    if (open) {
      setChecked(todoItems(todo.text).map((x) => x.done));
      setConfirmed(false);
      setProblems([]);
    }
  }, [open, todo.text]);

  const send = async () => {
    if (sending.current) return;
    // 残り＝チェックが無く、本文でも済みになっていない項目
    const left = items.filter((x, i) => !checked[i] && !x.done);
    const local: Problem[] = [];
    if (left.length) local.push({ message: catalogMessage("E-VAL-022"), items: left.map((x) => ({ text: x.text })) });
    if (!confirmed) local.push({ message: catalogMessage("E-VAL-023"), items: [] });
    setProblems(local);
    if (local.length) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("completeTicket", {
        params: { id: ticketId },
        body: {
          // 契約の型の生成は並びを string[] にする（中身の型を持たない）。口は 0 からの整数の並びを受ける（TicketCompleteInput）
          todo_checked: items.flatMap((_, i) => (checked[i] ? [i] : [])) as unknown as string[],
          todo_version: todo.version,
          conditions_confirmed: true,
        },
        screenId: "tickets",
      });
      if (r.ok) {
        onOpenChange(false);
        await onDone();
        return;
      }
      if (r.status === 422) {
        const details = Array.isArray(r.body["details"])
          ? (r.body["details"] as { field?: string; message?: string; id?: string }[])
          : [];
        setProblems([
          {
            message: messageOf(r),
            items: details
              .filter((d) => d.field === "todo_checked" || d.field === "children")
              .map((d) => ({
                text: String(d.message ?? ""),
                ...(d.field === "children" && typeof d.id === "string" && /^[0-9a-f-]{36}$/i.test(d.id)
                  ? { href: `/tickets/${d.id}` }
                  : {}),
              })),
          },
        ]);
        return;
      }
      onOpenChange(false);
      await onFailed(r);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="完了にする"
      description="実施事項と完了の条件を確かめてから完了にします"
      open={open}
      onOpenChange={onOpenChange}
      actions={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            やめる
          </Button>
          <Button onClick={() => void send()} loading={busy}>
            確かめて完了にする
          </Button>
        </>
      }
    >
      <div className="k63-band">
        {items.length ? (
          <fieldset className="k63-checks">
            <legend>実施事項</legend>
            {items.map((x, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={checked[i] ?? false}
                  onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                <span>{x.text}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <div>
          <p className="k-label">完了の条件</p>
          <p className="k-pre">{conditions || "—"}</p>
        </div>
        <label className="k63-checks">
          <span>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{" "}
            完了の条件を満たしたことを確かめました
          </span>
        </label>
        {problems.map((p, i) => (
          <div key={i} className="k-err" data-k63-problem>
            <p>{p.message}</p>
            {p.items.length ? (
              <ul className="k63-list">
                {p.items.map((x, j) => (
                  <li key={j}>
                    {x.href ? (
                      <a className="k-link" href={x.href}>
                        {x.text}
                      </a>
                    ) : (
                      x.text
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
