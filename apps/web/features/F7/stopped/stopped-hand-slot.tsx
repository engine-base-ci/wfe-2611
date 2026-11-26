"use client";
// 止まった箱ぜんたいの差し込み口（K-599 が置き・K-486 が理由ごとの帯にする・A57・D-151.17）。
//   出すのは作る段（phase make）の止まった・やめた実行で、まだ引き取っていない（taken_over_at が無い）ときだけ。
//   それ以外は前からの箱（children）をそのまま返す（承認の後の実行・動いている・待っている・引き取った後は前からの帯）。
//   理由の種類は口の答えの reason_kind だけで決める（kind-of.ts）。確認で落ちた帯には前からの確認の結果の表が下に付く。
//   押せる人：AI に任せる＝getTicket の can.delegate／自分で直す＝担当者本人（getTicket の assignee.id と /me の member_id）
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { me } from "@/lib/auth/ext";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { CheckTable } from "@/features/F5/approve-complete/check-table";
import type { RunView } from "@/features/F5/delegate/use-run";
import { stopKindOf } from "./kind-of";
import { useStoppedHand } from "./use-stopped-hand";
import { StopHand, StopReason, TakeoverConfirm } from "./views";

/** 本物にする葉（K-486）が true にする */
export const READY = true;

export interface StoppedHandSlotProps {
  ticket: SlotTicket;
  /** 今の実行ぜんたい（reason_kind・taken_over_at を含む） */
  run: RunView;
  /** 前からの「AI に任せる」 */
  delegate: { run: () => void; busy: boolean; disabled: boolean };
  /** 実行の一覧・今の実行と詳細を順に読み直す（K-486 が書き込みの後に呼ぶ） */
  onChanged: () => Promise<void>;
  children: ReactNode;
}

/** 見ている人の id（詳細の画面と同じ鍵で 1 回だけ読む） */
const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

/** この葉の帯を出す実行か：作る段の止まった・やめた実行で、まだ引き取っていない */
export function showsStopBand(run: RunView): boolean {
  return run.phase !== "execute" && (run.status === "stopped" || run.status === "cancelled") && !run.taken_over_at;
}

interface Assignee {
  id: string | null;
  name: string;
}
function assigneeOf(detail: SlotTicket["detail"]): Assignee {
  const a = detail["assignee"];
  if (!a || typeof a !== "object") return { id: null, name: "" };
  const o = a as { id?: unknown; display_name?: unknown };
  return {
    id: typeof o.id === "string" ? o.id : null,
    name: typeof o.display_name === "string" ? o.display_name : "",
  };
}
function canDelegateOf(detail: SlotTicket["detail"]): boolean {
  const can = detail["can"];
  return !!can && typeof can === "object" && (can as { delegate?: unknown }).delegate === true;
}

export function StoppedHandSlot({ ticket, run, delegate, onChanged, children }: StoppedHandSlotProps): ReactNode {
  const shown = showsStopBand(run);
  const who = useQuery({ queryKey: ["me"], queryFn: me, enabled: shown, ...ONCE });
  const hand = useStoppedHand(run.id, onChanged);
  if (!shown) return children;

  const assignee = assigneeOf(ticket.detail);
  const canTakeover = !!assignee.id && who.isSuccess && who.data.member_id === assignee.id;
  const s = stopKindOf(run);
  const name = `${run.by?.display_name ?? "自分"}のAI`;
  return (
    <>
      <StopReason
        who={name}
        kind={s.kind}
        cause={s.cause}
        detail={s.detail}
        hand={
          <StopHand
            kind={s.kind}
            canAct={false}
            canDelegate={canDelegateOf(ticket.detail)}
            canTakeover={canTakeover}
            delegateBusy={delegate.busy}
            delegateDisabled={delegate.disabled}
            assignee={assignee.name}
            onDelegate={delegate.run}
            onTakeover={hand.start}
          />
        }
      >
        {s.kind === "check-failed" ? <CheckTable /> : null}
      </StopReason>
      <TakeoverConfirm
        open={hand.open}
        who={name}
        assigneeName={assignee.name}
        notice={hand.notice}
        busy={hand.busy}
        onOpenChange={hand.onOpenChange}
        onConfirm={hand.confirm}
      />
    </>
  );
}
