"use client";
// 承認して完了する（K-63）：チケットの詳細の題名のすぐ下の帯（<section aria-label="承認と実行">・どの状態でも同じ名前）。
//   帯は段で分ける（D-128.178）：作る段（phase make）の間は何も描かない（K-62 の帯だけ）。部品は置いたままで、読み直しは続ける。
//     ① 承認待ち・承認する人 … 「あなたの承認を待っています」＋成果物の中身・検査なしの印・取り消せない注意・承認して送る／差し戻す
//     ② 承認待ち・承認する人でない … 描かない（K-62 の帯「成果物ができました。承認待ちです」）。担当者がいなければその文
//     ③ 実行中 ④ 実行待ち・PC が閉じている ⑤ 実行が止まった（理由） ⑥ 実行が終わった（完了の案内と「完了にする」） ⑦ 完了
//   今の実行は K-62 の listTicketRuns・getActionRun（run）で読む。待っている間は 3 秒ごとにチケットを読み直す（動いていないときは止める）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Badge, Button, Callout } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { isActive, type RunView } from "@/features/F5/delegate/use-run";
import { CompleteDialog } from "./complete-dialog";
import { ReturnDialog } from "./return-dialog";
import { POLL_MS, jstStamp, messageOf, ticketKey, useTicket } from "./shared";

export const BAND_LABEL = "承認と実行";
const MSG = {
  waitingMe: "あなたの承認を待っています",
  noAssignee: "担当者がいないので、承認する人がいません。担当者を決めてください",
  noChecks: "検査なし（まだ流していません）",
  irreversible: "取り消せません",
  running: "実行中",
  pcClosed: "実行待ち・PC が閉じています。開いたらすぐ実行します。承認から 24 時間を過ぎたら、もう一度聞きます",
  stopped: "実行が止まりました",
} as const;
const COMPLETE_HINT = "完了の条件を確かめて完了にしてください";

/** getTicket の答えのうち帯が読むところ（K-60 の詳細・K-62 の can・K-63 の approval・completed） */
export interface BandDetail {
  sections: { key: string; label: string; body: { text?: string } | null; version: number }[];
  stage: { key?: string | null; name: string } | null;
  can?: { delegate?: boolean; complete?: boolean } | null;
  approval?: {
    id: string;
    can_decide: boolean;
    irreversible?: boolean;
    note?: string | null;
    approver_member_id?: string | null;
    approver_name?: string | null;
  } | null;
  completed?: { at: string; by: string | { display_name?: string | null } | null } | null;
}
interface Detail {
  artifact_version: { version: number; text: string };
  cautions: string[];
  check_summary: string;
}

export function ApproveBand({ ticketId, run }: { ticketId: string; run: RunView | null }) {
  const qc = useQueryClient();
  // 今の実行が走っている間は 3 秒ごとにチケットを読み直す（作る段が終わって承認待ちになったら帯に替わる・K63-UI-044）
  const t = useTicket<BandDetail>(ticketId, { interval: isActive(run) ? POLL_MS : false });
  const d = t.data;
  const approval = d?.approval ?? null;
  const decide = !!approval && approval.can_decide;
  const detail = useQuery({
    queryKey: ["k63", "approval", approval?.id ?? null],
    enabled: decide,
    retry: false,
    queryFn: async (): Promise<Detail | null> => {
      const r = await call("getApproval", { params: { id: approval!.id }, screenId: "tickets" });
      return r.ok ? (r.data as unknown as Detail) : null;
    },
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [completing, setCompleting] = useState(false);
  const sending = useRef(false);

  const reload = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ticketKey(ticketId) }),
      qc.invalidateQueries({ queryKey: ["k62"] }),
      qc.invalidateQueries({ queryKey: ["k63"] }),
    ]);
  };
  const failed = async (r: CallErr) => {
    if (r.status === 401) return; // 入り直しへ（共通の扱い・戻る先にこのチケット）
    setNotice(messageOf(r));
    await reload();
  };
  const approve = async () => {
    if (!approval || sending.current) return;
    sending.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const r = await call("approveApproval", { params: { id: approval.id }, body: {}, screenId: "tickets" });
      if (r.ok) await reload();
      else await failed(r);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (!d) return null;
  const stageKey = d.stage?.key ?? null;
  const todo = d.sections.find((s) => s.key === "todo");
  const conditions = d.sections.find((s) => s.key === "done")?.body?.text ?? "";
  const execute = run?.phase === "execute" ? run : null;
  const body = (() => {
    if (stageKey === "done") {
      const by = d.completed?.by;
      const name = typeof by === "string" ? by : (by?.display_name ?? "");
      return <p>{`完了しました（${name}・${jstStamp(d.completed?.at)}）`}</p>;
    }
    if (approval && decide) {
      const irreversible = approval.irreversible !== false;
      const text = detail.data?.artifact_version.text ?? "";
      const cautions = detail.data?.cautions ?? (irreversible ? [MSG.irreversible] : []);
      return (
        <>
          <p>{MSG.waitingMe}</p>
          {approval.note ? <Callout tone="warn">{approval.note}</Callout> : null}
          {text ? <pre className="k63-artifact">{text}</pre> : null}
          <p>
            <Badge>{detail.data?.check_summary ?? MSG.noChecks}</Badge>
          </p>
          {cautions.map((c, i) => (
            <p key={i} className="k-desc">
              {c}
            </p>
          ))}
          <div className="k63-acts">
            <Button onClick={() => void approve()} loading={busy}>
              {irreversible ? "承認して送る" : "承認する"}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setReturning(true)}>
              差し戻す
            </Button>
          </div>
        </>
      );
    }
    if (approval && approval.approver_member_id === null) return <p>{MSG.noAssignee}</p>;
    if (approval) return null; // 承認する人でない：K-62 の帯だけ（D-128.178）
    if (!execute) return null; // 作る段の間・まだ任せていない：K-62 の帯だけ
    if (isActive(execute))
      return <p>{execute.status === "queued" && execute.pc === "asleep" ? MSG.pcClosed : MSG.running}</p>;
    const canComplete = d.can?.complete === true;
    return (
      <>
        {execute.status === "stopped" || execute.status === "cancelled" ? (
          <p>{execute.stopped_reason ?? MSG.stopped}</p>
        ) : null}
        {canComplete ? (
          <>
            <p>{COMPLETE_HINT}</p>
            <div>
              <Button onClick={() => setCompleting(true)}>完了にする</Button>
            </div>
          </>
        ) : null}
      </>
    );
  })();

  if (!body && !notice && !returning && !completing) return null;
  return (
    <section aria-label={BAND_LABEL} className="k63-band k-section">
      {notice ? <Callout tone="danger">{notice}</Callout> : null}
      {body}
      {approval && returning ? (
        <ReturnDialog
          approvalId={approval.id}
          open
          onOpenChange={(o) => setReturning(o)}
          onDone={async () => {
            setNotice(null);
            await reload();
          }}
          onFailed={failed}
        />
      ) : null}
      {completing ? (
        <CompleteDialog
          ticketId={ticketId}
          todo={{ text: todo?.body?.text ?? "", version: todo?.version ?? 0 }}
          conditions={conditions}
          open
          onOpenChange={(o) => setCompleting(o)}
          onDone={async () => {
            setNotice(null);
            await reload();
          }}
          onFailed={failed}
        />
      ) : null}
    </section>
  );
}
