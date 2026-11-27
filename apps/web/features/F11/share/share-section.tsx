"use client";
// チケットの詳細の右のパネルの「ゲストに見せる」の区画（K-905）。口を呼ぶのは use-guest-shares.ts だけ。
//   ここは器の値を部品 views.tsx（SharePanel・ShareDialog・UnshareConfirm）に渡し、小窓と確かめの開け閉めを持つ入れ物。
//   読めないときは「社内だけ」と言わず、読めない旨と「もう一度読む」だけを出す
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/k";
import { changeBody, useGuestShares, type GuestShares, type ShareFailure } from "./use-guest-shares";
import { SharePanel, ShareDialog, UnshareConfirm } from "./views";

export interface GuestShareSectionProps {
  ticketId: string;
  /** 小窓の頭の対象の行（番号と題） */
  target: string;
}

export function GuestShareSection({ ticketId, target }: GuestShareSectionProps): ReactNode {
  const g = useGuestShares(ticketId);
  const [dialog, setDialog] = useState(false);
  const [unshare, setUnshare] = useState(false);
  if (g.failed) {
    return (
      <section aria-label="ゲストに見せる" className="k-detail-panel-sec">
        <h2>ゲストに見せる</h2>
        <p className="k-f11c-sub-text">ゲストに見せる設定を読めませんでした</p>
        <div className="k-f11v-shown-acts">
          <Button size="sm" variant="outlined" onClick={g.retry}>
            もう一度読む
          </Button>
        </div>
      </section>
    );
  }
  if (!g.data) {
    return (
      <section aria-label="ゲストに見せる" className="k-detail-panel-sec" aria-busy="true">
        <h2>ゲストに見せる</h2>
      </section>
    );
  }
  const data = g.data;
  return (
    <>
      <SharePanel
        shown={data.shared.map((s) => s.name)}
        canChange={data.canChange}
        onShare={() => setDialog(true)}
        onUnshare={() => setUnshare(true)}
      />
      {dialog ? <PickDialog data={data} target={target} update={g.update} onClose={() => setDialog(false)} /> : null}
      {unshare ? <UnshareDialog data={data} update={g.update} onClose={() => setUnshare(false)} /> : null}
    </>
  );
}

type Update = (body: { add?: string[]; remove?: string[] }) => Promise<ShareFailure | null>;

/** 見せる相手を選ぶ小窓。印は開いたときの見せている相手から始め、候補が読み直されたら無くなった物の印を外す */
function PickDialog({
  data,
  target,
  update,
  onClose,
}: {
  data: GuestShares;
  target: string;
  update: Update;
  onClose: () => void;
}): ReactNode {
  const [picked, setPicked] = useState<string[]>(() => data.shared.map((s) => s.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ShareFailure | null>(null);
  const busy = useRef(false);
  const groups = [...data.shared, ...data.choices];
  const ids = groups.map((x) => x.id);
  const live = picked.filter((id) => ids.includes(id));
  const before = data.shared.map((s) => s.id);
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
  const phase = groups.length === 0 ? "none" : saving ? "saving" : error ? "failed" : "input";
  return (
    <ShareDialog
      phase={phase}
      groups={groups}
      picked={live}
      target={target}
      changed={changed}
      {...(error ? { error: { title: error.title, ...(error.body ? { body: error.body } : {}) } } : {})}
      onToggle={(id, on) => setPicked((p) => (on ? [...p.filter((x) => x !== id), id] : p.filter((x) => x !== id)))}
      onDecide={() => void decide()}
      onCancel={() => {
        if (!busy.current) onClose();
      }}
    />
  );
}

/** 見せるのをやめる確かめ：今見せている全部を外す。「やめる」は口を呼ばない */
function UnshareDialog({
  data,
  update,
  onClose,
}: {
  data: GuestShares;
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
    const fail = await update({ remove: data.shared.map((s) => s.id) });
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
      names={data.shared.map((s) => s.name)}
      busy={busy}
      {...(error ? { error } : {})}
      onConfirm={() => void confirm()}
      onCancel={() => {
        if (!sending.current) onClose();
      }}
    />
  );
}
