"use client";
// 試し打ち（K-747・D-153.6）：承認する前に、宛先を自分に差し替えて 1 回だけ実行し、届いた物を見る。任意で、何回でも。
//   正の絵は下絵 /dev/mock/f5/dry-*（features/F5/more の DryBand・DryConfirm）。字・並び・ボタンは下絵のまま。
//   - DryRunAct：成果物のカードの［試し打ち（自分宛）］（ghost）。承認待ちのカード（approvalId と ticketId がある）だけ押せる
//   - DryRunBand：承認の帯の箱の直後の試し打ちの帯と、確かめの小窓「試し打ちします」（カードと［もう一度試し打ち］が同じ小窓を開く）
//   - useDryRun：小窓を開いているかを頁の中で持つ（カードと帯は別の差し込み口なので、頁の中の store で分け合う）
//   口は dryRunTicket（K-746）。実行の様子は実行の一覧の頭（useRuns）を読み、走っている間だけ 3 秒ごとに読み直す（K-62 と同じ）。
//   メールアドレスは小窓の本文にだけ出す（帯・知らせには出さない）。理由の字は文字として出す（HTML を動かさない）
import "@/features/F5/more/more.css";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useSyncExternalStore } from "react";
import { Band, BandLine, Button, Confirm } from "@/components/k";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import { readTicket, ticketKey } from "@/features/F5/approve-complete/band";
import { messageOf } from "@/features/F5/approve-complete/message";
import { isActive, runsKey, useRuns, type RunView } from "@/features/F5/delegate/use-run";
import { pushNotice } from "@/features/F5/more/trail";
import { timelineKey } from "@/features/F6/thread/use-timeline";
import { call, type CallErr } from "@/lib/api/call";
import { useSession } from "@/lib/auth/session";

const BTN = "試し打ち（自分宛）";
const AGAIN = "もう一度試し打ち";
/** K-746 が決めた見出しだけで理由が空のときの既定の字。この字のときだけ下絵の字に替える（ほかの理由は全文そのまま・D-131.2） */
const NO_SWAP_REASON = "宛先を差し替えられない操作があったので、実行せずに止まりました";
const NO_SWAP_LINE =
  "宛先を差し替えられない操作（応募フォームなど）があったので、実行せずに止まりました。本来の宛先には何も送っていません";

// ---- 頁の中の store（小窓を開いているか・チケットごと） ----
const opened = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const setOpen = (ticketId: string, open: boolean) => {
  if (opened.has(ticketId) === open) return;
  if (open) opened.add(ticketId);
  else opened.delete(ticketId);
  emit();
};

export function useDryRun(ticketId: string) {
  const open = useSyncExternalStore(
    subscribe,
    () => opened.has(ticketId),
    () => false,
  );
  return { open, setOpen: (o: boolean) => setOpen(ticketId, o) };
}

/** 日本時間の「HH:MM」 */
const HM = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const hm = (iso: string | null): string | null => (iso ? HM.format(new Date(iso)) : null);

/** 成果物のカードの［試し打ち（自分宛）］ */
export function DryRunAct({ approvalId, ticketId }: { approvalId?: string; ticketId?: string }) {
  const dry = useDryRun(ticketId ?? "");
  if (!approvalId || !ticketId) return <InertButton className="k-artifact-btn">{BTN}</InertButton>;
  return (
    <Button variant="ghost" className="k-artifact-btn" onClick={() => dry.setOpen(true)}>
      {BTN}
    </Button>
  );
}

/** 口が断ったときの知らせの文（正本の文。E-RUN-004 は理由を括弧で足す） */
function refusedText(r: CallErr): string {
  const text = messageOf(r);
  if (r.code !== "E-RUN-004") return text;
  const reason = (r.body.detail as { reason?: unknown } | undefined)?.reason;
  return typeof reason === "string" && reason ? `${text}（${reason}）` : text;
}

/** 試し打ちの帯の 1 つ（今の実行が dry_run のときだけ） */
function DryState({ run, onAgain }: { run: RunView; onAgain: () => void }) {
  const again = (
    <Button variant="outlined" onClick={onAgain}>
      {AGAIN}
    </Button>
  );
  if (isActive(run)) {
    const at = hm(run.started_at);
    return (
      <Band
        tone="info"
        title="試し打ちを実行しています"
        sub={at ? `宛先をあなたに差し替えています ・ 開始 ${at}` : "宛先をあなたに差し替えています"}
      >
        <BandLine>本来の宛先には送りません。承認待ちはそのままです</BandLine>
      </Band>
    );
  }
  const at = hm(run.finished_at);
  if (run.status === "done")
    return (
      <Band
        tone="ok"
        title="試し打ちをあなた宛てに送りました"
        sub={at ? `届いた物を確かめてください ・ ${at}` : "届いた物を確かめてください"}
        acts={again}
      >
        <BandLine>本来の宛先には送っていません。承認待ちはそのままです</BandLine>
      </Band>
    );
  if (run.status !== "stopped" && run.status !== "cancelled") return null;
  const line = run.stopped_reason === NO_SWAP_REASON ? NO_SWAP_LINE : run.stopped_reason;
  return (
    <Band tone="danger" role="alert" title="試し打ちは止まりました" sub={at ?? undefined} acts={again}>
      {line ? <BandLine>{line}</BandLine> : null}
    </Band>
  );
}

/** 承認の帯の箱の直後の試し打ちの帯と、確かめの小窓 */
export function DryRunBand({
  approvalId,
  ticketId,
  onChanged,
}: {
  approvalId: string;
  ticketId?: string;
  onChanged?: () => Promise<void>;
}) {
  const id = ticketId ?? "";
  const qc = useQueryClient();
  const dry = useDryRun(id);
  const runs = useRuns(id, Boolean(ticketId));
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  if (!ticketId || !approvalId) return null;

  const mail = session?.user?.email || null;
  const description = `${mail ? `あなた（${mail}）宛てに送ります` : "あなた宛てに送ります"}。本来の宛先には送りません。承認待ちはそのままで、何回でも試せます。試し打ちは任意で、しなくても承認できます`;

  const send = async () => {
    if (sending.current) return; // 二度押しでも口は 1 回
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("dryRunTicket", { params: { id: ticketId }, body: {}, screenId: "tickets" });
      if (r.ok) {
        dry.setOpen(false);
        const runId = String((r.data as unknown as { run_id?: string }).run_id ?? "");
        await Promise.all([
          runId ? runs.follow(runId) : qc.invalidateQueries({ queryKey: runsKey(ticketId) }),
          qc.invalidateQueries({ queryKey: timelineKey(ticketId) }),
        ]);
        return;
      }
      dry.setOpen(false);
      if (r.status === 401) return; // 入り直しへ（共通の扱い）
      pushNotice(ticketId, refusedText(r));
      if (r.code === "E-RUN-003") {
        // 承認待ちの成果物が無くなった：チケットを読み直す
        if (onChanged) await onChanged();
        else
          await qc
            .fetchQuery({
              queryKey: ticketKey(ticketId),
              queryFn: () => readTicket(ticketId),
              staleTime: 0,
              retry: false,
            })
            .catch(() => null);
        await qc.invalidateQueries({ queryKey: runsKey(ticketId) });
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const run = runs.current;
  return (
    <>
      {run && run.phase === "dry_run" ? <DryState run={run} onAgain={() => dry.setOpen(true)} /> : null}
      <Confirm
        open={dry.open}
        onOpenChange={dry.setOpen}
        onConfirm={() => void send()}
        busy={busy}
        tone="primary"
        title="試し打ちします"
        confirmLabel="試し打ちする"
        description={description}
      >
        {/* スマホで下から出す印（more.css の決まり） */}
        <i className="k-more-sheetmark" hidden aria-hidden="true" />
        <p className="k-more-detail">宛先を差し替えられない操作（応募フォームなど）は、実行せずに止まります</p>
      </Confirm>
    </>
  );
}
