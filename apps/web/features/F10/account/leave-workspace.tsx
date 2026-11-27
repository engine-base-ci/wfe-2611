"use client";
// ワークスペースから抜ける小窓（K-841・行為 A74・下絵 me-leave・me-leave-ready・me-leave-last-admin）。
//   形は自分の読み（getMe の workspaces[i]）から決める：最後の管理者が先 → 担当が残っている → 抜けられる。開くだけでは口を呼ばない。
//   抜ける：leaveWorkspace 1 回（処理中は押せない）。403 取り直し → StepUp → 1 回だけやり直す。409 は読み直して形を替える。
//   今いる会社を抜けたら入り直しへ。渡しにいく・決めにいく：今の会社はそのまま移る・別の会社は switchWorkspace の後に開き直す
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StepUp } from "@/features/F1/security/step-up";
import { signOut } from "@/lib/auth";
import { LeaveDialog, type LeaveKind } from "./dialogs";
import { roleLabel, type MeWorkspace } from "./me-shape";
import type { ProfileDialogProps } from "./profile-dialogs";
import {
  SWITCH_GONE,
  goneText,
  leaveWorkspace,
  leftText,
  setLeaveNote,
  stepUpNeeds,
  stepUpReason,
  switchWorkspace,
} from "./use-leave";
import { ME_SCREEN } from "./use-me";

const TICKETS_PATH = "/tickets";
const ADMIN_PATH = "/members";
const LOGIN_PATH = "/login";

/** 小窓の形（口の順と同じ＝最後の管理者が先） */
export function leaveKindOf(w: Pick<MeWorkspace, "last_admin" | "assigned_total">): LeaveKind {
  if (w.last_admin) return "last-admin";
  return w.assigned_total > 0 ? "assigned" : "ready";
}

export function LeaveWorkspace({ me, workspace, onClose, reload }: ProfileDialogProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [goBusy, setGoBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [stepUp, setStepUp] = useState<{ withCode: boolean; withPasskey: boolean } | null>(null);
  const sending = useRef(false);
  if (!workspace) return null;
  // 読み直した後は新しい行で形を決める（開いている間に変わった・409）
  const w = me.workspaces.find((x) => x.tenant_id === workspace.tenant_id) ?? workspace;

  const gone = async (text: string) => {
    onClose();
    await reload();
    setLeaveNote({ tone: "danger", text });
  };

  const run = async (retried: boolean): Promise<void> => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(undefined);
    setLeaveNote(null);
    try {
      const r = await leaveWorkspace(w.tenant_id);
      if (r.kind === "ok") {
        if (w.current) {
          await signOut(); // 口がセッションを切っている（失敗しても手元の印を消して移る）
          window.location.assign(LOGIN_PATH);
          return;
        }
        onClose();
        await reload();
        setLeaveNote({ tone: "info", text: leftText(w.name) });
        return;
      }
      if (r.kind === "step_up" && !retried) {
        setStepUp(await stepUpNeeds());
        return;
      }
      if (r.kind === "assigned" || r.kind === "last_admin") return await reload(); // 形が替わる・抜けない
      if (r.kind === "gone") return await gone(goneText());
      if (r.kind === "down") setError(r.message);
      // signed_out は call が入り直しへ送る
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const goTo = async (path: string): Promise<void> => {
    if (sending.current) return;
    if (w.current) {
      router.push(path);
      return;
    }
    sending.current = true;
    setGoBusy(true);
    setError(undefined);
    setLeaveNote(null);
    let moving = false;
    try {
      const r = await switchWorkspace(w.tenant_id);
      if (r.kind === "ok") {
        moving = true;
        window.location.assign(path); // 開き直して読みの鍵を全部捨てる（K-844 と同じ）
        return;
      }
      if (r.kind === "gone") return await gone(SWITCH_GONE);
      if (r.kind === "down") setError(r.message);
    } finally {
      if (!moving) {
        sending.current = false;
        setGoBusy(false);
      }
    }
  };

  const cancel = () => {
    if (sending.current) return;
    onClose();
  };

  if (stepUp)
    return (
      <StepUp
        open
        reason={stepUpReason(w.name)}
        withCode={stepUp.withCode}
        withPasskey={stepUp.withPasskey}
        screenId={ME_SCREEN}
        onDone={() => {
          setStepUp(null);
          void run(true);
        }}
        onCancel={() => setStepUp(null)}
      />
    );

  return (
    <LeaveDialog
      kind={leaveKindOf(w)}
      name={w.name}
      role={roleLabel(w.role)}
      tickets={w.assigned.map((t) => ({ number: t.number, title: t.title }))}
      more={Math.max(0, w.assigned_total - w.assigned.length)}
      onLeave={() => void run(false)}
      onCancel={cancel}
      busy={busy}
      goBusy={goBusy}
      {...(error ? { error } : {})}
      onGoTickets={() => void goTo(TICKETS_PATH)}
      onGoAdmin={() => void goTo(ADMIN_PATH)}
    />
  );
}
