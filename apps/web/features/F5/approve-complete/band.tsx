"use client";
// 承認する（K-162・K-63 の孫）：チケットの詳細の題名のすぐ下の帯（<section aria-label="承認と実行">・どの状態でも同じ名前）。
//   帯は段で分ける（D-128.178）：作る段（phase make）の間は何も描かない（K-62 の帯だけ）。部品は置いたままで、
//   今の実行が走っている間は 3 秒ごとにチケットを読み直す（作る段が終わって承認待ちになったら帯に替わる・K63-UI-044）。
//     ① 承認待ち・決められる人 … 「あなたの承認を待っています」＋成果物の中身・検査なしの印・取り消せない注意・「承認して送る」
//     ② 承認待ち・決められない人 … 描かない（K-62 の帯「成果物ができました。承認待ちです」）。担当者がいなければその文（K63-UI-049）
//     ③ 承認の後の実行が走っている（pc live）… 「実行中」
//   差し戻す（K-163）・実行の結末と PC が閉じている文（K-164）・完了（K-165）は後の孫がここに足す。
//   文は全部文字として出す（HTML を作らない）。エラーの文は正本（errors.json）から引く。本人確認は取り直さない（D-128.177）
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Callout } from "@/components/k";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { isActive, type RunView } from "@/features/F5/delegate/use-run";

export const BAND_LABEL = "承認と実行";
const POLL_MS = 3_000;
const MSG = {
  waitingMe: "あなたの承認を待っています",
  noAssignee: "担当者がいないので、承認する人がいません。担当者を決めてください",
  noChecks: "検査なし（まだ流していません）",
  irreversible: "取り消せません",
  running: "実行中",
} as const;

/** getTicket の答えの承認待ち（K-162 が足す approval）。can_decide＝見ている人が決められるか */
export interface BandApproval {
  id: string;
  can_decide: boolean;
  irreversible?: boolean;
  note?: string | null;
  approver_name?: string | null;
}
/** 帯が読む getTicket の答えのところ */
export interface BandTicket {
  stage: { key?: string | null } | null;
  assignee: unknown;
  approval?: BandApproval | null;
}
interface ApprovalDetail {
  artifact_version: { version: number; text: string } | null;
  cautions: string[];
  check_summary: string;
}
interface Props<T extends BandTicket> {
  ticketId: string;
  ticket: T;
  run: RunView | null;
  /** 読み直したチケット（詳細の全体を差し替える） */
  onTicket: (t: T) => void;
  /** 決めた・断られた：チケットと実行を読み直す */
  onChanged: () => Promise<void>;
}

/** 知らせの文（正本の文）。正本に無い言葉は「読み込めなかった」の文 */
function messageOf(r: Pick<CallErr, "kind" | "code" | "status">): string {
  const code = errorCodeOf(r);
  try {
    return errorText(code).entry.message;
  } catch {
    return errorText(PAGE_ERROR.loadFailed).entry.message;
  }
}

export function ApproveBand<T extends BandTicket>({ ticketId, ticket, run, onTicket, onChanged }: Props<T>) {
  // 今の実行が走っている間だけ読み直す（動いていないときは止める）
  const polled = useQuery({
    queryKey: ["k63", "ticket", ticketId],
    enabled: isActive(run),
    retry: false,
    refetchInterval: isActive(run) ? POLL_MS : false,
    queryFn: async (): Promise<T | null> => {
      const r = await call("getTicket", { params: { id: ticketId }, screenId: "tickets" });
      return r.ok ? (r.data as unknown as T) : null;
    },
  });
  const onTicketRef = useRef(onTicket);
  onTicketRef.current = onTicket;
  useEffect(() => {
    if (polled.data) onTicketRef.current(polled.data);
  }, [polled.data]);

  const approval = ticket.approval ?? null;
  const decide = !!approval && approval.can_decide;
  const detail = useQuery({
    queryKey: ["k63", "approval", approval?.id ?? null],
    enabled: decide,
    retry: false,
    queryFn: async (): Promise<ApprovalDetail | null> => {
      const r = await call("getApproval", { params: { id: approval!.id }, screenId: "tickets" });
      return r.ok ? (r.data as unknown as ApprovalDetail) : null;
    },
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const approve = async () => {
    if (!approval || sending.current) return; // 2 回押しでも口は 1 回
    sending.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const r = await call("approveApproval", { params: { id: approval.id }, body: {}, screenId: "tickets" });
      if (!r.ok) {
        if (r.status === 401) return; // 入り直しへ（共通の扱い・戻る先にこのチケット）
        setNotice(messageOf(r)); // 409（E-CONF-003）・404 など：知らせを出して読み直す
      }
      await onChanged();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const execute = run?.phase === "execute" ? run : null;
  const body = (() => {
    if (approval && decide) {
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
            <Button onClick={() => void approve()} loading={busy} disabled={busy}>
              {irreversible ? "承認して送る" : "承認する"}
            </Button>
          </div>
        </>
      );
    }
    if (approval && ticket.assignee === null) return <p>{MSG.noAssignee}</p>;
    if (approval) return null; // 決められない人：K-62 の帯だけ（D-128.178）
    if (execute && isActive(execute) && execute.status !== "asking" && execute.pc !== "asleep")
      return <p>{MSG.running}</p>;
    return null; // 作る段の間・まだ任せていない：K-62 の帯だけ。実行の結末の文は K-164
  })();

  if (!body && !notice) return null;
  return (
    <section aria-label={BAND_LABEL} className="k62-band k-section">
      {notice ? <Callout tone="danger">{notice}</Callout> : null}
      {body}
    </section>
  );
}
