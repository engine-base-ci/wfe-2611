"use client";
// メンバーの画面（K-818）で役割を変える入れ物：updateMemberRole（PATCH /api/v1/members/:id/role・K-811）。
//   体＝{ role_key, scope_id }。管理者（会社全体）のときは scope_id を送らない（D-154.9）。ほかは押した行のグループ（兼務・D-154.15）。
//   いまと同じ役割を選んだら口を呼ばない。答えを待つ間は二度押しで 2 回送らない（useRef）。
//   403 STEP_UP_REQUIRED → getMySecurity を 1 回読んで本人確認の取り直し（StepUp・D-154.3）→ 通ったら同じ体で 1 回だけやり直す・やめたら何も送らない（K-363 と同じ形）。
//   結果の出し分け（知らせ・上の赤い箱・並びの読み直し）は呼ぶ側（members-page.tsx）が onResult で決める
import { useRef, useState } from "react";
import type { Ops } from "@kaname/contracts";
import { call, type CallErr } from "@/lib/api/call";
import { ROLE_KEY } from "./members-shape";
import type { RoleName } from "./person-row";

const SCREEN = "members";

/** 変える相手（押した行のグループ） */
export interface RoleTarget {
  /** 行の key（「グループの鍵:人の id」・鍵は views の groupKey・答えを待つ間に押せなくする行） */
  key: string;
  id: string;
  name: string;
  groupId: string;
  from: RoleName;
  to: RoleName;
}

export type RoleResult = { ok: true; target: RoleTarget } | { ok: false; target: RoleTarget; error: CallErr | null };

export interface StepUpState {
  open: boolean;
  reason: string;
  withCode: boolean;
  withPasskey: boolean;
  onDone: () => void;
  onCancel: () => void;
}

type Body = { role_key: "admin" | "manager" | "member" | "viewer"; scope_id?: string };

export const bodyOf = (t: RoleTarget): Body =>
  ROLE_KEY[t.to] === "admin" ? { role_key: "admin" } : { role_key: ROLE_KEY[t.to], scope_id: t.groupId };

const reasonOf = (t: RoleTarget): string => `${t.name}の役割を「${t.from}」から「${t.to}」に変えます`;

export function useRoleChange({ onResult }: { onResult: (r: RoleResult) => void }) {
  const sending = useRef(false);
  const pending = useRef<RoleTarget | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState<{ withCode: boolean; withPasskey: boolean; reason: string } | null>(null);

  const askStepUp = async (t: RoleTarget) => {
    const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
    const sec = s.ok ? s.data : {};
    pending.current = t;
    setStep({ withCode: sec.two_factor === true, withPasskey: sec.has_password === false, reason: reasonOf(t) });
  };

  const run = async (t: RoleTarget, retried: boolean): Promise<void> => {
    if (sending.current) return;
    sending.current = true;
    setBusy(t.key);
    try {
      const r = await call("updateMemberRole", {
        params: { id: t.id },
        body: bodyOf(t) as unknown as Ops["updateMemberRole"]["body"],
        screenId: SCREEN,
      });
      if (r.ok) return onResult({ ok: true, target: t });
      if (r.kind === "step_up" && !retried) return await askStepUp(t);
      onResult({ ok: false, target: t, error: r });
    } catch {
      onResult({ ok: false, target: t, error: null }); // 網が切れた（口に届かない）
    } finally {
      sending.current = false;
      setBusy(null);
    }
  };

  /** 役割を変える（いまと同じなら何もしない） */
  const change = (t: RoleTarget) => {
    if (t.from === t.to || sending.current) return;
    void run(t, false);
  };

  const stepUp: StepUpState = {
    open: step !== null,
    reason: step?.reason ?? "",
    withCode: step?.withCode ?? false,
    withPasskey: step?.withPasskey ?? false,
    onDone: () => {
      setStep(null);
      const t = pending.current;
      pending.current = null;
      if (t) void run(t, true);
    },
    onCancel: () => {
      setStep(null);
      pending.current = null;
    },
  };

  return { busy, change, stepUp };
}
