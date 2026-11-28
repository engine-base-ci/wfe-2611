"use client";
// メンバーの 1 人を一時的に止める・戻す入れ物（K-821）：suspendMember・resumeMember（POST /api/v1/members/:id/suspend・resume・K-814）。体はどちらも {}。
//   二度押しで 2 回送らない（useRef）。403 STEP_UP_REQUIRED → getMySecurity を 1 回読んで本人確認の取り直し（StepUp・D-154.3）→
//   通ったら同じ口を 1 回だけやり直す・やめたら何も送らない（K-363 と同じ形）。結果の出し分けは呼ぶ側（detail-dialogs.tsx）が onResult で決める
import { useRef, useState } from "react";
import { call, type CallErr } from "@/lib/api/call";
import { SCREEN } from "./use-member";

export type StateKind = "suspend" | "resume";
export type StateResult = { ok: true } | { ok: false; error: CallErr | null };

const OP = { suspend: "suspendMember", resume: "resumeMember" } as const;

export interface StepUpAsk {
  withCode: boolean;
  withPasskey: boolean;
}

export function useMemberState(id: string, kind: StateKind, onResult: (r: StateResult) => void) {
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<StepUpAsk | null>(null);
  // 口が取り直しを求めた後は、やめて押し直しても送らず取り直しの小窓から（前の送りを繰り返さない・K-820 の形に揃える PM の決め 2026-11-28）
  const needStepUp = useRef<StepUpAsk | null>(null);

  const askStepUp = async () => {
    const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
    const sec = s.ok ? s.data : {};
    const need = { withCode: sec.two_factor === true, withPasskey: sec.has_password === false };
    needStepUp.current = need;
    setStepUp(need);
  };

  const run = async (retried: boolean): Promise<void> => {
    if (sending.current) return;
    if (!retried && needStepUp.current) return setStepUp(needStepUp.current);
    sending.current = true;
    setBusy(true);
    try {
      const r = await call(OP[kind], { params: { id }, body: {}, screenId: SCREEN });
      if (r.ok || r.kind !== "step_up") needStepUp.current = null;
      if (r.ok) return onResult({ ok: true });
      if (r.kind === "step_up" && !retried) return await askStepUp();
      onResult({ ok: false, error: r });
    } catch {
      onResult({ ok: false, error: null }); // 網が切れた（口に届かない）
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return {
    busy,
    /** 「本人確認して〇〇」を押したとき */
    confirm: () => void run(false),
    stepUp,
    /** 取り直しが通った：同じ口を 1 回だけやり直す */
    stepUpDone: () => {
      setStepUp(null);
      void run(true);
    },
    /** 取り直しをやめた：何も送らず確かめの小窓に戻る */
    stepUpCancel: () => setStepUp(null),
  };
}
