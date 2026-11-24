"use client";
// 期限が無いチケットに期限を決める小窓（K-482・絵に無い物・字は md の勧め）。題「期限を決めますか」・期限の日・理由（必須）・親の期限の確かめ。
//   手元で確かめる（口と 2 層）：理由（checkReason）・今日より前の日（E-VAL-012 と同じ字）。送るのは updateTicket の { due_on, due_reason, expected_due_on: null }（開始日は送らない）。
//   断りの置き場：理由の誤り＝理由の欄の下／日付の断り（手元の過去日・口の E-VAL-012）＝期限の欄の下／ほか＝小窓の上の赤い箱。どれも書いた中身は消さない。
//   見た目は確かめの小窓（MoveImpactDialog）の class を使い回す（新しい値は足さない）
import { useState } from "react";
import { Button, Dialog, TextArea, TextField, useNotify } from "@/components/k";
import { call } from "@/lib/api/call";
import { checkReason, exceedsParent, isPast, jstToday, label } from "../due/due-dates";
import { refusalOf, textOf } from "./use-move-bars";
import "./gantt.css";

export interface SetDueTarget {
  id: string;
  number: string;
  title: string;
}

export interface SetDueDialogProps {
  ticket: SetDueTarget;
  /** 親の期限（親が無い・期限が無ければ null） */
  parent: { number: string; due: string } | null;
  onClose: () => void;
  /** 決まった（行を外し、棒の口を読み直す）。day は決めた期限（チケットが消えていたら null） */
  onDone: (id: string, day: string | null) => void;
}

export function SetDueDialog({ ticket, parent, onClose, onDone }: SetDueDialogProps) {
  const notify = useNotify();
  const today = jstToday(new Date());
  const [day, setDay] = useState(today);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blocked = parent !== null && day !== "" && exceedsParent(day, parent.due);

  const submit = async () => {
    if (busy || blocked) return;
    const r = checkReason(reason);
    const past = day === "" || isPast(day, today);
    setReasonError(r.code ? textOf(r.code) : null);
    setDateError(past ? textOf("E-VAL-012") : null);
    if (r.code || past) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await call("updateTicket", {
        params: { id: ticket.id },
        body: { due_on: day, due_reason: r.value, expected_due_on: null },
        screenId: "tickets",
      });
      if (res.ok) {
        notify(`期限を ${label(day)} に変えました`);
        onDone(ticket.id, day);
        return;
      }
      const f = refusalOf(res);
      if (f.reason) setReasonError(f.reason);
      else if (f.date) setDateError(f.date);
      else setNotice(f.notice ?? null);
      if (f.gone) onDone(ticket.id, null);
    } catch {
      setNotice(textOf("E-PAGE-007", true));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
      title="期限を決めますか"
      target={`${ticket.number} ${ticket.title}`}
      actions={
        <>
          <Button variant="outlined" disabled={busy} onClick={onClose}>
            やめる
          </Button>
          <Button disabled={busy || blocked} onClick={() => void submit()}>
            {day ? label(day) : "この日"} にする
          </Button>
        </>
      }
    >
      {notice ? (
        <p className="k-err" role="alert">
          {notice}
        </p>
      ) : null}
      <TextField
        name="due_on"
        label="期限"
        type="date"
        required
        value={day}
        error={dateError}
        onChange={(e) => {
          setDay(e.target.value);
          setDateError(null);
        }}
      />
      {parent ? (
        <p className="k-f7-gantt-move-parent" data-fits={!blocked}>
          {blocked
            ? `親 ${parent.number} の期限 ${label(parent.due)} を過ぎるので、決められません`
            : `親 ${parent.number} の期限 ${label(parent.due)} には収まる`}
        </p>
      ) : null}
      <TextArea
        name="reason"
        label="理由"
        required
        hint="やり取りに残り、担当者に知らせる"
        value={reason}
        error={reasonError}
        rows={2}
        onChange={(e) => {
          setReason(e.target.value);
          setReasonError(null);
        }}
      />
    </Dialog>
  );
}
