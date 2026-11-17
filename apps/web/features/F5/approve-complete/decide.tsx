"use client";
// 承認の帯の ①（K-162・K-181）：承認待ち・決められる人。帯（band.tsx）から分けた（K-183）。
//   K-227 でキャンバス TicketDetail の帯にした：淡い橙の箱 1 つ（components/k の Band）に 題「あなたの承認を待っています」・
//   12px の要約「成果物は M/D HH:MM に作成 ・ 確認 〈check_summary〉」・取り消せない注意の赤い箱・24 時間の聞き直しの 1 行、
//   次の行に 承認して送る（主）・自分で直す（押せない）・差し戻す・止める（押せない）。成果物は箱の下のカード（artifact-card.tsx）。
//   「承認して送る」「承認する」は確かめの小窓（approve-confirm.tsx・K-229・D-143.4）を開くだけで、口は小窓の主ボタンで呼ぶ
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Band, BandCaution, BandLine, Button } from "@/components/k";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import { call, type CallErr } from "@/lib/api/call";
import { ApproveConfirm } from "./approve-confirm";
import { ArtifactCard } from "./artifact-card";
import { jstStamp } from "./complete-model";
import { ReturnDialog } from "./return-dialog";

const MSG = {
  waitingMe: "あなたの承認を待っています",
  noChecks: "検査なし（まだ流していません）",
  irreversible: "取り消せません",
} as const;

/** getTicket の答えの承認待ち（K-162 が足す approval）。can_decide＝見ている人が決められるか */
export interface BandApproval {
  id: string;
  can_decide: boolean;
  irreversible?: boolean;
  note?: string | null;
  approver_name?: string | null;
}
export interface ApprovalDetail {
  approval?: { created_at?: string | null } | null;
  artifact_version: { version: number; text: string } | null;
  cautions: string[];
  check_summary: string;
}

/** 承認の 1 件（getApproval）。決められない人の帯（K-62）も同じ鍵で読む（1 画面で 1 回） */
export function useApprovalDetail(id: string | null) {
  return useQuery({
    queryKey: ["k63", "approval", id],
    enabled: id !== null,
    retry: false,
    queryFn: async (): Promise<ApprovalDetail | null> => {
      const r = await call("getApproval", { params: { id: id ?? "" }, screenId: "tickets" });
      return r.ok ? (r.data as unknown as ApprovalDetail) : null;
    },
  });
}

/** 帯の要約「成果物は 11/01 09:12 に作成 ・ 確認 検査なし（まだ流していません）」。口が返した値だけで作る（時刻が無ければ確認だけ） */
export function approvalSummary(d: ApprovalDetail): string {
  const at = d.approval?.created_at ? jstStamp(d.approval.created_at) : "";
  const check = `確認 ${d.check_summary || MSG.noChecks}`;
  return at ? `成果物は ${at} に作成 ・ ${check}` : check;
}
interface Props {
  approval: BandApproval;
  /** 決めた：チケットと実行を読み直す */
  onChanged: () => Promise<void>;
  /** 口が断った（409・404 など）：呼んだ側が知らせて読み直す */
  onFailed: (r: CallErr) => Promise<void>;
  /** 押し直すときに前の知らせを消す */
  onStart: () => void;
  /** 小窓の頭の下の対象の行（「EG-133 11 月分の請求書を送る」） */
  target?: string;
}

/** 確かめの小窓の主ボタン：2 回押しでも口は 1 回。答えが来たら（どの答えでも）小窓を閉じてから読み直す */
function useApprove({ approval, onChanged, onFailed, onStart }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const sending = useRef(false);
  const approve = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    onStart();
    try {
      const r = await call("approveApproval", { params: { id: approval.id }, body: {}, screenId: "tickets" });
      setConfirming(false);
      if (r.ok) await onChanged();
      else await onFailed(r);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return { busy, approve, confirming, setConfirming };
}

export function DecideBody(props: Props) {
  const { approval, onChanged, onFailed, target } = props;
  const detail = useApprovalDetail(approval.id);
  const { busy, approve, confirming, setConfirming } = useApprove(props);
  const [returning, setReturning] = useState(false); // 差し戻しの小窓（K-181）
  const irreversible = approval.irreversible !== false;
  const artifact = detail.data?.artifact_version ?? null;
  const cautions = detail.data?.cautions ?? [];
  const cautionLines = irreversible ? (cautions.length ? cautions : [MSG.irreversible]) : []; // 取り消せないときだけ赤い箱
  const acts = (
    <>
      <Button onClick={() => setConfirming(true)} loading={busy} disabled={busy}>
        {irreversible ? "承認して送る" : "承認する"}
      </Button>
      <InertButton>自分で直す</InertButton>
      <Button variant="outlined" disabled={busy} onClick={() => setReturning(true)}>
        差し戻す
      </Button>
      <InertButton>止める</InertButton>
    </>
  );
  return (
    <div className="k63-decide">
      <Band
        tone="approval"
        title={MSG.waitingMe}
        {...(detail.data ? { sub: approvalSummary(detail.data) } : {})}
        acts={acts}
      >
        {approval.note ? <BandLine>{approval.note}</BandLine> : null}
        {cautionLines.map((c, i) => (
          <BandCaution key={i}>{c}</BandCaution>
        ))}
      </Band>
      {artifact?.text ? <ArtifactCard version={artifact.version} text={artifact.text} /> : null}
      <ApproveConfirm
        open={confirming}
        onOpenChange={(o) => {
          if (!busy) setConfirming(o);
        }}
        irreversible={irreversible}
        cautions={detail.data?.cautions ?? []}
        busy={busy}
        onConfirm={() => void approve()}
      />
      {returning ? (
        <ReturnDialog
          approvalId={approval.id}
          {...(target ? { target } : {})}
          screenId="tickets"
          open
          onOpenChange={setReturning}
          onDone={onChanged}
          onFailed={onFailed}
        />
      ) : null}
    </div>
  );
}
