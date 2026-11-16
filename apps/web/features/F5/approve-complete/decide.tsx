"use client";
// 承認の帯の ①（K-162・K-181）：承認待ち・決められる人。「あなたの承認を待っています」＋成果物の中身・検査なしの印・
//   取り消せない注意・「承認して送る」「差し戻す」。24 時間の聞き直しは approval.note の文を足す。帯（band.tsx）から分けた（K-183）
//   「承認して送る」「承認する」は確かめの小窓（approve-confirm.tsx・K-229・D-143.4）を開くだけで、口は小窓の主ボタンで呼ぶ
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Badge, Button, Callout } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { ApproveConfirm } from "./approve-confirm";
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
interface ApprovalDetail {
  artifact_version: { version: number; text: string } | null;
  cautions: string[];
  check_summary: string;
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
  const detail = useQuery({
    queryKey: ["k63", "approval", approval.id],
    retry: false,
    queryFn: async (): Promise<ApprovalDetail | null> => {
      const r = await call("getApproval", { params: { id: approval.id }, screenId: "tickets" });
      return r.ok ? (r.data as unknown as ApprovalDetail) : null;
    },
  });
  const { busy, approve, confirming, setConfirming } = useApprove(props);
  const [returning, setReturning] = useState(false); // 差し戻しの小窓（K-181）
  const irreversible = approval.irreversible !== false;
  const text = detail.data?.artifact_version?.text ?? "";
  const cautions = detail.data?.cautions ?? (irreversible ? [MSG.irreversible] : []);
  return (
    <>
      <p>{MSG.waitingMe}</p>
      {approval.note ? <Callout tone="warn">{approval.note}</Callout> : null}
      {text ? <pre className="k-pre">{text}</pre> : null}
      <p>
        <Badge>{detail.data?.check_summary ?? MSG.noChecks}</Badge>
      </p>
      {cautions.map((c, i) => (
        <p key={i} className="k-desc">
          {c}
        </p>
      ))}
      <div>
        <Button onClick={() => setConfirming(true)} loading={busy} disabled={busy}>
          {irreversible ? "承認して送る" : "承認する"}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setReturning(true)}>
          差し戻す
        </Button>
      </div>
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
    </>
  );
}
