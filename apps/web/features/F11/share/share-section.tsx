"use client";
// チケットの詳細の右のパネルの「ゲストに見せる」の区画（K-905）。口を呼ぶのは use-guest-shares.ts だけ。
//   区画（見せている相手・社内だけ・押せるか）は詳細の答えの guest_share で出す（初めの読み込みで見せる相手の口を呼ばない）。
//   候補は小窓を開いたときに読む。読めなければ小窓に読めない旨と「もう一度読む」だけ（区画は詳細の答えのまま）。
//   答えに guest_share が無ければ区画を描かない（「社内だけ」と言わない）
import { useRef, useState, type ReactNode } from "react";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import {
  changeBody,
  shareStateOf,
  useShareChoices,
  useShareUpdate,
  type ShareFailure,
  type ShareState,
} from "./use-guest-shares";
import { SharePanel, ShareDialog, UnshareConfirm, type SharePhase } from "./views";

export interface GuestShareSectionProps {
  ticket: SlotTicket;
}

/** 小窓の頭の対象の行（番号と題）。getTicket の答えの ticket から引く */
function targetOf(slot: SlotTicket): string {
  const t = slot.detail["ticket"];
  if (typeof t !== "object" || t === null) return "";
  const r = t as Record<string, unknown>;
  return [r["number"], r["title"]].filter((v): v is string => typeof v === "string" && v !== "").join(" ");
}

export function GuestShareSection({ ticket }: GuestShareSectionProps): ReactNode {
  const state = shareStateOf(ticket.detail);
  const target = targetOf(ticket);
  const update = useShareUpdate(ticket);
  const [dialog, setDialog] = useState(false);
  const [unshare, setUnshare] = useState(false);
  if (!state) return null;
  return (
    <>
      <SharePanel
        shown={state.shared.map((s) => s.name)}
        canChange={state.canChange}
        onShare={() => setDialog(true)}
        onUnshare={() => setUnshare(true)}
      />
      {dialog ? (
        <PickDialog ticketId={ticket.id} target={target} update={update} onClose={() => setDialog(false)} />
      ) : null}
      {unshare ? <UnshareDialog state={state} update={update} onClose={() => setUnshare(false)} /> : null}
    </>
  );
}

type Update = (body: { add?: string[]; remove?: string[] }) => Promise<ShareFailure | null>;

/** 見せる相手を選ぶ小窓。開いたときに候補を読み、印は読めた見せている相手から始める。候補が読み直されたら無くなった物の印を外す */
function PickDialog({
  ticketId,
  target,
  update,
  onClose,
}: {
  ticketId: string;
  target: string;
  update: Update;
  onClose: () => void;
}): ReactNode {
  const c = useShareChoices(ticketId);
  const [mine, setMine] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ShareFailure | null>(null);
  const busy = useRef(false);
  const data = c.data;
  const before = data ? data.shared.map((s) => s.id) : [];
  const picked = mine ?? before;
  const groups = data ? [...data.shared, ...data.choices] : [];
  const ids = groups.map((x) => x.id);
  const live = picked.filter((id) => ids.includes(id));
  const body = changeBody(before, live);
  const changed = Boolean(body.add || body.remove);
  const decide = async () => {
    if (busy.current || !changed) return; // 二度押しでも口は 1 回
    busy.current = true;
    setSaving(true);
    const fail = await update(body);
    busy.current = false;
    setSaving(false);
    if (!fail) {
      onClose();
      return;
    }
    setError(fail);
  };
  const phase: SharePhase = !data
    ? c.failed
      ? "unread"
      : "loading"
    : groups.length === 0
      ? "none"
      : saving
        ? "saving"
        : error
          ? "failed"
          : "input";
  return (
    <ShareDialog
      phase={phase}
      groups={groups}
      picked={live}
      target={target}
      changed={changed}
      {...(error ? { error: { title: error.title, ...(error.body ? { body: error.body } : {}) } } : {})}
      onToggle={(id, on) =>
        setMine((p) => {
          const cur = p ?? before;
          return on ? [...cur.filter((x) => x !== id), id] : cur.filter((x) => x !== id);
        })
      }
      onDecide={() => void decide()}
      onRetry={c.retry}
      onCancel={() => {
        if (!busy.current) onClose();
      }}
    />
  );
}

/** 見せるのをやめる確かめ：今見せている全部を外す。「やめる」は口を呼ばない。名前と数は詳細の答えから（見せる相手の口を読まない） */
function UnshareDialog({
  state,
  update,
  onClose,
}: {
  state: ShareState;
  update: Update;
  onClose: () => void;
}): ReactNode {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const confirm = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    const fail = await update({ remove: state.shared.map((s) => s.id) });
    sending.current = false;
    setBusy(false);
    if (!fail) {
      onClose();
      return;
    }
    setError(fail.title);
  };
  return (
    <UnshareConfirm
      names={state.shared.map((s) => s.name)}
      busy={busy}
      {...(error ? { error } : {})}
      onConfirm={() => void confirm()}
      onCancel={() => {
        if (!sending.current) onClose();
      }}
    />
  );
}
