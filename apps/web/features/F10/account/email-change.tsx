"use client";
// メールを変える小窓の動き（K-840・行為 A74）。見た目は K-801 の部品 EmailDialog、取り直しは段 2 の StepUp。
//   打つと形を見る（そろえた字で・合わなければ送らない）。送る → requestEmailChange を 1 回（処理中は二度押しでも 1 回）。
//   201 → 自分を 1 回読み直して閉じる（行が確かめ待ちになる）。403 STEP_UP_REQUIRED → 取り直し → 同じ体で 1 回だけやり直す・やめたら小窓に戻る（字は残る）。
//   409 E-ME-021・E-ME-026 は欄の下、429・502・503・網の切れは小窓の中の赤い箱（行は確かめ待ちにしない）
//   useEmailResend：確かめ待ちの［送り直す］（待っている宛てで同じ口を 1 回・結果の字は行に出す）
import { useRef, useState, type ReactNode } from "react";
import { StepUp } from "@/features/F1/security/step-up";
import { EmailDialog } from "./dialogs";
import type { MeAnswer } from "./me-shape";
import type { ProfileDialogProps } from "./profile-dialogs";
import {
  RESENT,
  SAME,
  SEND_FAILED,
  STEP_UP_REASON,
  TAKEN,
  TOO_MANY,
  cleanEmail,
  downText,
  emailProblem,
  readStepUpNeeds,
  requestChange,
  type ChangeResult,
  type StepUpNeeds,
} from "./use-email-change";
import { ME_SCREEN } from "./use-me";

/** 欄の下に出す誤り・小窓（行）に出す字 */
interface Shown {
  field?: string;
  notice?: string;
}
const shownOf = (r: ChangeResult): Shown => {
  switch (r.kind) {
    case "taken":
      return { field: TAKEN };
    case "same":
      return { field: SAME };
    case "invalid":
      return { field: r.message };
    case "rate":
      return { notice: TOO_MANY };
    case "send_failed":
      return { notice: SEND_FAILED };
    case "refused":
      return { notice: r.message };
    case "down":
      return { notice: downText() };
    default:
      return {};
  }
};

/** 口を 1 回呼び、取り直しが要れば小窓を開く（通ったら同じ体で 1 回だけやり直す） */
function useSendOnce(onOk: (r: Extract<ChangeResult, { kind: "ok" }>) => Promise<void>, onShown: (s: Shown) => void) {
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<StepUpNeeds | null>(null);
  // 口が取り直しを求めた後は、やめて押し直しても送らず取り直しの小窓から（前の送りを繰り返さない・K-820 の形に揃える PM の決め 2026-11-28）
  const needStepUp = useRef<StepUpNeeds | null>(null);
  const send = async (email: string, retried: boolean): Promise<void> => {
    if (sending.current) return;
    if (!retried && needStepUp.current) return setStepUp(needStepUp.current);
    sending.current = true;
    setBusy(true);
    try {
      const r = await requestChange(email);
      if (r.kind !== "step_up") needStepUp.current = null;
      if (r.kind === "ok") {
        await onOk(r);
        return;
      }
      if (r.kind === "auth") return; // call が入り直しへ送る
      if (r.kind === "step_up") {
        if (retried) onShown({ notice: downText() });
        else {
          needStepUp.current = await readStepUpNeeds();
          setStepUp(needStepUp.current);
        }
        return;
      }
      onShown(shownOf(r));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return { busy, stepUp, setStepUp, send };
}

/** 取り直しの小窓（通ったら retry・やめたら閉じるだけ） */
function StepUpFor({
  needs,
  onDone,
  onCancel,
}: {
  needs: StepUpNeeds | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <StepUp
      open={needs !== null}
      reason={STEP_UP_REASON}
      withCode={needs?.withCode ?? false}
      withPasskey={needs?.withPasskey ?? false}
      screenId={ME_SCREEN}
      onDone={onDone}
      onCancel={onCancel}
    />
  );
}

/** メールを変える小窓（K-839 の登録口 PROFILE_DIALOGS の email） */
export function EmailChange({ me, onClose, reload }: ProfileDialogProps) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState<Shown>({});
  const clean = cleanEmail(text);
  const formErr = emailProblem(clean);
  const fieldErr = formErr ?? shown.field;
  const s = useSendOnce(async () => {
    await reload();
    onClose();
  }, setShown);
  const go = (retried: boolean) => {
    if (clean === "" || formErr) return; // 空・形の誤りは送らない（取り直しも出さない）
    setShown({});
    void s.send(clean, retried);
  };
  return (
    <>
      {s.stepUp ? null : (
        <EmailDialog
          current={me.member.email}
          value={text}
          onChange={(t) => {
            setText(t);
            setShown({});
          }}
          {...(fieldErr ? { error: fieldErr } : {})}
          {...(shown.notice ? { notice: shown.notice } : {})}
          busy={s.busy}
          onSend={() => go(false)}
          onCancel={onClose}
        />
      )}
      <StepUpFor
        needs={s.stepUp}
        onDone={() => {
          s.setStepUp(null);
          go(true);
        }}
        onCancel={() => s.setStepUp(null)}
      />
    </>
  );
}

/** 確かめ待ちの［送り直す］。notice はメールの行に出す字、node は取り直しの小窓 */
export function useEmailResend(me: MeAnswer | undefined): {
  onResend: () => void;
  notice: ReactNode;
  node: ReactNode;
} {
  const [notice, setNotice] = useState<ReactNode>(null);
  const s = useSendOnce(
    async () => {
      setNotice(
        <span className="k-f10a-ok" role="status">
          {RESENT}
        </span>,
      );
    },
    (shown) => {
      const t = shown.notice ?? shown.field;
      setNotice(t ? <span className="k-err">{t}</span> : null);
    },
  );
  const pending = me?.member.email_pending ?? null;
  const go = (retried: boolean) => {
    if (!pending) return;
    setNotice(null);
    void s.send(pending, retried);
  };
  return {
    onResend: () => go(false),
    notice,
    node: (
      <StepUpFor
        needs={s.stepUp}
        onDone={() => {
          s.setStepUp(null);
          go(true);
        }}
        onCancel={() => s.setStepUp(null)}
      />
    ),
  };
}
