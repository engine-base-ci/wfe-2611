"use client";
// 承認を取り下げる（K-735・D-153.21・D-125.105）：承認の後の実行が実行待ち（queued・PC がまだ受け取っていない）で、見ている人がその実行を積んだ人
//   （承認した本人・0096 の created_by）のときだけ、実行待ちの箱に［承認を取り下げる］を出す。ほかの人・ほかの状態は受けた箱をそのまま返す（口の 403・409 が最後の砦）。
//   PC が開いている：下絵 withdraw-band の箱（淡い橙「実行待ち ・ PC が受け取るのを待っています」）に替える。
//   PC が閉じている：受けた箱（「実行待ち ・ PC が閉じています」・「PC をつなぐ」）の acts に［承認を取り下げる］を足す（題と文は替えない）。
//   取り下げる承認の id は決めた履歴の口 listApprovalHistory（K-750）から引く（実行の答えは承認の id を持たない）。
//   押すと確かめの小窓（Confirm・役 alertdialog・× は無い・閉じ方は「やめる」と Esc）。「取り下げる」で口 withdrawApproval（K-733）を 1 回。
//   201：帯の下の 1 行と読み直し。409 E-APR-010 ほかの断り：帯の上の知らせ（正本の文）と読み直し。文は全部文字として出す
import "@/features/F5/more/more.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cloneElement, isValidElement, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Band, Button, Confirm } from "@/components/k";
import { call } from "@/lib/api/call";
import { me } from "@/lib/auth/ext";
import { messageOf } from "@/features/F5/approve-complete/message";
import { runsKey, type RunView } from "@/features/F5/delegate/use-run";
import { timelineKey } from "@/features/F6/thread/use-timeline";
import { clearNotice, pushNotice, pushTrail } from "@/features/F5/more/trail";
import type { ExecuteQueuedProps } from "@/features/F5/more/slots";

const SCREEN = "tickets";
const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
const JST_MS = 9 * 3600_000;

/** 下絵 withdraw-*（代表 OK：2026-11-23）の字 */
export const WITHDRAW_MSG = {
  title: "実行待ち ・ PC が受け取るのを待っています",
  sub: "PC が受け取るまでは承認を取り下げられます",
  act: "承認を取り下げる",
  dlgTitle: "承認を取り下げます",
  confirm: "取り下げる",
  dlgBody: "PC がまだ受け取っていないので、承認待ちに戻せます。戻したあと、もう一度決められます",
} as const;

/** 「承認 MM/DD HH:MM ・ PC が受け取るまでは…」（時刻は実行の started_at・日本時間。無ければ頭を付けない） */
export function queuedSub(startedAt: string | null): string {
  const t = startedAt ? Date.parse(startedAt) : NaN;
  if (Number.isNaN(t)) return WITHDRAW_MSG.sub;
  const iso = new Date(t + JST_MS).toISOString();
  return `承認 ${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 16)} ・ ${WITHDRAW_MSG.sub}`;
}
/** 小窓の本文「〈番号 題名〉。PC がまだ…」（対象の行が無ければ頭を付けない） */
export const withdrawBody = (target?: string): string =>
  target ? `${target}。${WITHDRAW_MSG.dlgBody}` : WITHDRAW_MSG.dlgBody;
/** 帯の下の 1 行 */
export const withdrawnLine = (name: string): string => `${name}が承認を取り下げました（承認待ちに戻りました）`;

interface HistoryRow {
  id: string;
  ticket_id: string;
  can_withdraw: boolean;
  decided_at: string | null;
}

/** 取り下げられる承認の id（このチケットで can_withdraw のいちばん新しい行）。出す条件のときだけ 1 回読む */
function useWithdrawable(ticketId: string, enabled: boolean): string | null {
  const q = useQuery({
    queryKey: ["k735", "withdrawable", ticketId],
    enabled,
    retry: false,
    queryFn: async (): Promise<string | null> => {
      const r = await call("listApprovalHistory", {
        query: { decision: "approve", limit: "20" },
        screenId: SCREEN,
      });
      if (!r.ok) return null;
      const rows = (r.data ?? []) as unknown as HistoryRow[];
      const hit = rows
        .filter((h) => h.ticket_id === ticketId && h.can_withdraw)
        .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""))[0];
      return hit?.id ?? null;
    },
  });
  return enabled ? (q.data ?? null) : null;
}

/** 取り下げの口を呼ぶ（送っている間の 2 本目は送らない）。答えが来たら小窓を閉じてから読み直す */
export function useWithdraw(ticketId: string, onChanged: () => Promise<void>) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const reread = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: runsKey(ticketId) }),
      qc.invalidateQueries({ queryKey: ["k62", "run"] }),
      qc.invalidateQueries({ queryKey: timelineKey(ticketId) }),
      qc.invalidateQueries({ queryKey: ["k735", "withdrawable", ticketId] }),
    ]);
    await onChanged();
  };
  const withdraw = async (approvalId: string, name: string) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("withdrawApproval", { params: { id: approvalId }, body: {}, screenId: SCREEN });
      setBusy(false);
      setOpen(false);
      if (r.ok) {
        clearNotice(ticketId);
        pushTrail(ticketId, withdrawnLine(name));
        await reread();
        return;
      }
      if (r.status === 401) return; // 入り直し（共通の扱い）
      pushNotice(ticketId, messageOf(r)); // 409 E-APR-010〜012・403・404・503 は正本の文
      await reread();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return { open, setOpen, busy, withdraw };
}

export function WithdrawBox({ run, ticketId, target, box, onChanged }: ExecuteQueuedProps): ReactNode {
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const mine = isQueuedExecute(run) && !!who.data && run.by?.member_id === who.data.member_id;
  const approvalId = useWithdrawable(ticketId, mine);
  const { open, setOpen, busy, withdraw } = useWithdraw(ticketId, onChanged);
  if (!mine || !approvalId) return <>{box}</>;
  const name = who.data?.display_name || run.by?.display_name || "自分";
  const act = (
    <Button variant="outlined" onClick={() => setOpen(true)}>
      {WITHDRAW_MSG.act}
    </Button>
  );
  const shown =
    run.pc === "asleep" ? (
      withActs(box, act)
    ) : (
      <Band tone="wait" title={WITHDRAW_MSG.title} sub={queuedSub(run.started_at)} acts={act} />
    );
  return (
    <>
      {shown}
      <Confirm
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
        onConfirm={() => void withdraw(approvalId, name)}
        busy={busy}
        tone="primary"
        title={WITHDRAW_MSG.dlgTitle}
        confirmLabel={WITHDRAW_MSG.confirm}
        description={withdrawBody(target)}
      >
        <i className="k-more-sheetmark" hidden aria-hidden="true" />
      </Confirm>
    </>
  );
}

const isQueuedExecute = (run: RunView): boolean => run.phase === "execute" && run.status === "queued";

/** 受けた箱（Band）の acts の後ろに足す（題と文は替えない）。箱が Band でなければ足さずに返す */
function withActs(box: ReactNode, act: ReactNode): ReactNode {
  if (!isValidElement(box)) return box;
  const el = box as ReactElement<{ acts?: ReactNode }>;
  return cloneElement(el, {
    acts: (
      <>
        {el.props.acts}
        {act}
      </>
    ),
  });
}
