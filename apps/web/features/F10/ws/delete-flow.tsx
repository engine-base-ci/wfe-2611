"use client";
// ワークスペースを消す動き（K-832・行為 A75・画面 company-settings）。見た目は K-801 の部品（delete-dialog.tsx の DeleteWsDialog・settings.tsx の帯）と段 2 の StepUp。
//   始める：名前を打って確かめ（完全一致）→ requestWorkspaceDeletion を 1 回（答えを待つ間は処理中・二度押しでも 1 回）。
//     200 → 小窓を閉じて設定を 1 回読み直す（帯の始めた人と日時は読みにしか無い）。403 STEP_UP_REQUIRED → 取り直し → 通れば同じ体で 1 回だけやり直す・やめたら名前の小窓に戻る（打った字は残す）。
//     409 E-WS-030 → 欄の下に口の文。409 E-WS-031 → 閉じて読み直す。403 → 権限なしの画面。503・網の切れ → 小窓の中に赤い箱（E-PAGE-003）。
//   取り消す：cancelWorkspaceDeletion を 1 回。200・E-WS-033 → 読み直す（帯が消える）。E-WS-032 → 帯の下に口の文・読み直す。取り直しは始めると同じ形。
//   先に書き出せるは作らない（D-154.4）。手続き中も何も止めない（D-154.5）
import { useRef, useState, type ReactElement } from "react";
import { StepUp } from "@/features/F1/security/step-up";
import { DeleteWsDialog } from "./delete-dialog";
import type { SettingsDialogProps } from "./settings-dialogs";
import {
  ALREADY_DELETING,
  CANCEL_STEP_UP_REASON,
  PAST_DEADLINE,
  START_STEP_UP_REASON,
  cancelDeletion,
  startDeletion,
  stepUpKind,
} from "./use-deletion";
import { SCREEN } from "./use-settings";

type StepUpKind = { withCode: boolean; withPasskey: boolean };
const noReload = (): Promise<unknown> => Promise.resolve();

function StepUpFor({
  kind,
  reason,
  onDone,
  onCancel,
}: {
  kind: StepUpKind | null;
  reason: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <StepUp
      open={kind !== null}
      reason={reason}
      withCode={kind?.withCode ?? false}
      withPasskey={kind?.withPasskey ?? false}
      screenId={SCREEN}
      onDone={onDone}
      onCancel={onCancel}
    />
  );
}

/** 「消す手続き」の小窓（設定の小窓の登録口 SETTINGS_DIALOGS の delete） */
export function DeleteFlow({ onClose, settings, reload = noReload, onDenied }: SettingsDialogProps) {
  const name = settings.workspace.name;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [stepUp, setStepUp] = useState<StepUpKind | null>(null);
  const sending = useRef(false);
  // 口が取り直しを求めた後は、やめて押し直しても送らず取り直しの小窓から（前の送りを繰り返さない・K-820 の形に揃える PM の決め 2026-11-28）
  const needStepUp = useRef<StepUpKind | null>(null);

  const send = async (retried: boolean): Promise<void> => {
    if (sending.current || typed !== name) return;
    if (!retried && needStepUp.current) return setStepUp(needStepUp.current);
    sending.current = true;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const r = await startDeletion(typed);
      if (r.kind !== "step_up") needStepUp.current = null;
      if (r.kind === "ok" || (r.kind === "conflict" && r.code === ALREADY_DELETING)) {
        setStepUp(null);
        onClose();
        await reload();
      } else if (r.kind === "step_up" && !retried) {
        needStepUp.current = await stepUpKind();
        setStepUp(needStepUp.current);
      } else if (r.kind === "forbidden") {
        onClose();
        onDenied?.();
      } else if (r.kind === "conflict" || r.kind === "invalid") setError(r.text);
      else if (r.kind === "down") setNotice(r.text);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <DeleteWsDialog
        name={name}
        typed={typed}
        open={stepUp === null}
        onTyped={(text) => {
          setTyped(text);
          setError(undefined);
        }}
        onConfirm={() => void send(false)}
        onCancel={onClose}
        busy={busy}
        {...(error ? { error } : {})}
        {...(notice ? { notice } : {})}
        counts={settings.deletion.preview}
      />
      <StepUpFor
        kind={stepUp}
        reason={START_STEP_UP_REASON}
        onDone={() => {
          setStepUp(null);
          void send(true);
        }}
        onCancel={() => setStepUp(null)}
      />
    </>
  );
}

/** 帯の「本人確認して取り消す」の動き（入れ物が帯に渡す値と、取り直しの小窓） */
export function useCancelDeletion({ reload, onDenied }: { reload: () => Promise<unknown>; onDenied: () => void }): {
  cancel: () => void;
  busy: boolean;
  notice: string | undefined;
  stepUp: ReactElement;
} {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [kind, setKind] = useState<StepUpKind | null>(null);
  const sending = useRef(false);
  // 口が取り直しを求めた後は、やめて押し直しても送らず取り直しの小窓から（前の送りを繰り返さない・K-820 の形に揃える PM の決め 2026-11-28）
  const needStepUp = useRef<StepUpKind | null>(null);

  const send = async (retried: boolean): Promise<void> => {
    if (sending.current) return;
    if (!retried && needStepUp.current) return setKind(needStepUp.current);
    sending.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      const r = await cancelDeletion();
      if (r.kind !== "step_up") needStepUp.current = null;
      if (r.kind === "ok") await reload();
      else if (r.kind === "step_up" && !retried) {
        needStepUp.current = await stepUpKind();
        setKind(needStepUp.current);
      } else if (r.kind === "forbidden") onDenied();
      else if (r.kind === "conflict") {
        if (r.code === PAST_DEADLINE) setNotice(r.text);
        await reload(); // 14 日を過ぎた・すでに取り消された：今の手続きの形を読み直す
      } else if (r.kind === "down" || r.kind === "invalid") setNotice(r.text);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return {
    cancel: () => void send(false),
    busy,
    notice,
    stepUp: (
      <StepUpFor
        kind={kind}
        reason={CANCEL_STEP_UP_REASON}
        onDone={() => {
          setKind(null);
          void send(true);
        }}
        onCancel={() => setKind(null)}
      />
    ),
  };
}
