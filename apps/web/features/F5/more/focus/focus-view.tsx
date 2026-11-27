"use client";
// 続けて裁く（K-752・D-153.12・下絵 focus-card・focus-confirm・focus-done）：AI の成果物を 1 件ずつ全画面で見て、キーかボタンで決める。
//   承認は前からの確かめの小窓（ApproveConfirm）を通る。取り消せない物かは 1 件の詳細の答え（irreversible）で決める。
//   差し戻しは前からの小窓（ReturnDialog）・止めるは K-730 の差し込み口 StopApprovalActSlot（K-734 が中身）・自分で直すはチケットの詳細へ移る。
//   断り：409（先に決まっていた）・404 は正本の文を出して次へ（数に入れない）。503 ほかは同じ 1 件のまま文を出す（差し戻しは小窓を開いたまま、文も小窓の中）。401 は入り直し。
//   層を閉じると、読んだ並びと詳細を捨てる（直して開き直したとき、前の版の字を見て承認しない）
//   字と並びは下絵（features/F5/more/queue.tsx の FocusView・FocusDone）。見た目は more.css の k-more-focus*（生の値を書かない）
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Callout, Loading } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { ApproveConfirm } from "@/features/F5/approve-complete/approve-confirm";
import { ArtifactCard } from "@/features/F5/approve-complete/artifact-card";
import { jstDay } from "@/features/F5/approve-complete/due";
import { messageOf } from "@/features/F5/approve-complete/message";
import type { QueueRow } from "@/features/F5/approve-complete/queue";
import { ReturnDialog } from "@/features/F5/approve-complete/return-dialog";
import { useQueueQuery } from "../fills/queue-tools";
import { ChecksSlot, StopApprovalActSlot } from "../slots";
import { FOCUS_LAYER_ATTR, useFocusKeys } from "./focus-keys";
import { useFocusDetail, useFocusDrop, useFocusList, useFocusRun, type Decision, type FocusTally } from "./use-focus";
// 前は style 属性で書いていた並び・重なりのクラス（k-more-bulk-note・k-more-contents・k-more-focus-layer）。承認待ちの頁でも読む小さい CSS
import "@/features/F5/more/fills.css";

const TITLE = "続けて裁く";
const KEYS = "次 J ・ 前 K ・ 承認 A ・ 差し戻す R ・ 自分で直す E ・ 飛ばす S";
const LOAD_FAILED = "読み込めませんでした。もう一度お試しください";
const DECIDED: Readonly<Record<Decision, string>> = {
  approved: "承認しました",
  returned: "差し戻しました",
  stopped: "止めました",
};
const DAY_MS = 86_400_000;
// 全画面の層：画面いっぱいに重ね、小窓（k-backdrop・k-dialog）より下に置く（重なりの段は正本のトークン）
const isGone = (r: CallErr) => r.status === 409 || r.status === 404;

const Key = ({ k }: { k: string }) => <kbd className="k-more-key">{k}</kbd>;
const label = (r: QueueRow) => `${r.ticket_number} ${r.title}`;

/** 下の 1 行「高本のAI ・ 期限 11/01（1 日過ぎ） ・ 〈note〉」 */
function metaOf(r: QueueRow): string {
  const today = jstDay(0);
  const over = r.due_on ? Math.round((Date.parse(today) - Date.parse(r.due_on)) / DAY_MS) : 0;
  const due = r.due_on
    ? `期限 ${r.due_on.slice(5, 7)}/${r.due_on.slice(8, 10)}${over > 0 ? `（${over} 日過ぎ）` : ""}`
    : "";
  return [`${r.from_name ?? "自分"}のAI`, due, r.note ?? ""].filter(Boolean).join(" ・ ");
}

function ReadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="k-state" role="alert">
      <p className="k-state-body">{LOAD_FAILED}</p>
      <div className="k-state-actions">
        <Button onClick={onRetry}>もう一度</Button>
      </div>
    </div>
  );
}

function Head({ pos, onClose }: { pos: string | null; onClose?: () => void }) {
  return (
    <header className="k-more-focus-head">
      <h1>{TITLE}</h1>
      {pos ? <p className="k-more-focus-pos">{pos}</p> : null}
      {onClose ? (
        <Button className="k-more-focus-exit" variant="outlined" size="sm" onClick={onClose}>
          ‹ 一覧に戻る
        </Button>
      ) : null}
    </header>
  );
}

export interface FocusDoneProps {
  tally: FocusTally;
  total: number;
  onBack: () => void;
}
/** 終わりの面（下絵 focus-done） */
export function FocusDone({ tally, total, onBack }: FocusDoneProps): ReactNode {
  return (
    <>
      <Head pos={`${total} / ${total} 件`} />
      <main className="k-more-focus-done">
        <h2>決め終わりました</h2>
        <ul className="k-more-tally" aria-label="結果">
          <li>{`承認 ${tally.approved} 件`}</li>
          <li>{`差し戻し ${tally.returned} 件`}</li>
          <li>{`飛ばした ${tally.skipped} 件`}</li>
        </ul>
        {tally.skipped > 0 ? (
          <p className="k-more-focus-meta">{`飛ばした ${tally.skipped} 件は、承認待ちに残っています`}</p>
        ) : null}
        <Button onClick={onBack}>承認待ちに戻る</Button>
      </main>
      <footer className="k-more-focus-foot">
        <p className="k-more-focus-next">決めた物は、承認待ちの［決めた履歴］で見られます</p>
      </footer>
    </>
  );
}

export interface FocusViewProps {
  onClose: () => void;
}

/** 全画面の層（role=dialog・名前「続けて裁く」）。開くと焦点を層に移す */
export function FocusView({ onClose }: FocusViewProps): ReactNode {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => root.current?.focus(), []);
  useFocusDrop();
  const sort = useQueueQuery().query["sort"] ?? "due";
  const list = useFocusList(sort);
  return (
    <div
      ref={root}
      className="k-more-focus k-more-focus-layer"
      role="dialog"
      aria-modal="true"
      aria-label={TITLE}
      tabIndex={-1}
      {...{ [FOCUS_LAYER_ATTR]: "" }}
    >
      {list.isError ? (
        <>
          <Head pos={null} onClose={onClose} />
          <main className="k-more-focus-main">
            <ReadFailed onRetry={() => void list.refetch()} />
          </main>
          <CloseKey onClose={onClose} />
        </>
      ) : !list.data ? (
        <>
          <Head pos={null} onClose={onClose} />
          <main className="k-more-focus-main">
            <Loading />
          </main>
          <CloseKey onClose={onClose} />
        </>
      ) : (
        <FocusRun rows={list.data} onClose={onClose} />
      )}
    </div>
  );
}

/** 並びを読む前・読めないときの Esc */
function CloseKey({ onClose }: { onClose: () => void }) {
  const noop = () => undefined;
  useFocusKeys({ next: noop, prev: noop, approve: noop, ret: noop, edit: noop, skip: noop, close: onClose }, true);
  return null;
}

type Sub = "approve" | "return" | null;

function FocusRun({ rows, onClose }: { rows: readonly QueueRow[]; onClose: () => void }) {
  const router = useRouter();
  const run = useFocusRun(rows);
  const cur = run.current;
  const detail = useFocusDetail(cur?.id ?? null, run.nextRows[0]?.id ?? null);
  const [sub, setSub] = useState<Sub>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sending = useRef(false); // 答えが来るまで 2 本目を送らない
  const decision = cur ? run.decisionOf(cur.id) : null;
  const canDecide = cur !== null && decision === null && detail.data !== undefined;
  const irreversible = detail.data?.irreversible ?? cur?.irreversible ?? true;

  const refused = (r: CallErr) => {
    if (r.status === 401) return; // 入り直し（共通の扱い）
    setNotice(messageOf(r));
    if (isGone(r)) run.advance();
  };
  const approve = async () => {
    if (!cur || sending.current) return;
    sending.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const r = await call("approveApproval", { params: { id: cur.id }, body: {}, screenId: "approvals" });
      setSub(null);
      if (r.ok) run.decide(cur.id, "approved");
      else refused(r);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const move = (f: () => void) => {
    setNotice(null);
    f();
  };
  useFocusKeys(
    {
      next: () => move(run.next),
      prev: () => move(run.prev),
      skip: () => {
        if (cur) move(() => run.skip(cur.id));
      },
      approve: () => {
        if (canDecide) setSub("approve");
      },
      ret: () => {
        if (canDecide) setSub("return");
      },
      edit: () => {
        if (!cur || decision !== null) return;
        onClose();
        router.push(`/tickets/${cur.ticket_id}`);
      },
      close: onClose,
    },
    sub === null && !busy,
  );

  if (run.done || !cur) return <FocusDone tally={run.tally} total={rows.length} onBack={onClose} />;
  const off = canDecide ? {} : ({ "aria-disabled": true } as const);
  return (
    <>
      <Head pos={`${run.index + 1} / ${rows.length} 件`} onClose={onClose} />
      <main className="k-more-focus-main">
        {notice ? <Callout tone="danger">{notice}</Callout> : null}
        <section className="k-more-focus-card" aria-label="いま決めるもの">
          <h2>{label(cur)}</h2>
          <p className="k-more-focus-meta">{metaOf(cur)}</p>
          {decision ? <p className="k-more-focus-meta">{DECIDED[decision]}</p> : null}
          <ChecksSlot where="approval" ticketId={cur.ticket_id} approvalId={cur.id} />
          {detail.isError ? (
            <ReadFailed onRetry={() => void detail.refetch()} />
          ) : !detail.data ? (
            <Loading />
          ) : detail.data.artifact_version ? (
            <ArtifactCard
              version={detail.data.artifact_version.version}
              text={detail.data.artifact_version.text}
              approvalId={cur.id}
              ticketId={cur.ticket_id}
            />
          ) : null}
        </section>
        <p className="k-more-focus-keys">{`キー：${KEYS}`}</p>
      </main>
      <footer className="k-more-focus-foot">
        <Button variant="outlined" className="k-more-f-skip" onClick={() => move(() => run.skip(cur.id))}>
          飛ばす
          <Key k="S" />
        </Button>
        {decision === null ? (
          <StopApprovalActSlot
            approval={{ id: cur.id, can_decide: true, irreversible }}
            ticketId={cur.ticket_id}
            target={label(cur)}
            onChanged={async () => run.decide(cur.id, "stopped")}
            onFailed={async (r) => refused(r)}
          />
        ) : null}
        <Button variant="outlined" className="k-more-f-return" {...off} onClick={() => canDecide && setSub("return")}>
          差し戻す
          <Key k="R" />
        </Button>
        <Button
          variant="outlined"
          className="k-more-f-edit"
          {...(decision === null ? {} : ({ "aria-disabled": true } as const))}
          onClick={() => {
            if (decision !== null) return;
            onClose();
            router.push(`/tickets/${cur.ticket_id}`);
          }}
        >
          自分で直す
          <Key k="E" />
        </Button>
        <Button className="k-more-focus-main-act" {...off} onClick={() => canDecide && setSub("approve")}>
          {`${irreversible ? "承認して送る" : "承認する"} → 次へ`}
          <Key k="A" />
        </Button>
        {run.nextRows.length > 0 ? (
          <p className="k-more-focus-next">{`次：${run.nextRows.map(label).join(" ・ ")}`}</p>
        ) : null}
      </footer>
      <ApproveConfirm
        open={sub === "approve"}
        onOpenChange={(o) => {
          if (!o && !busy) setSub(null);
        }}
        irreversible={irreversible}
        cautions={detail.data?.cautions ?? []}
        busy={busy}
        onConfirm={() => void approve()}
        approvalId={cur.id}
      />
      {sub === "return" ? (
        <ReturnDialog
          approvalId={cur.id}
          target={label(cur)}
          screenId="approvals"
          open
          onOpenChange={(o) => {
            if (!o) setSub(null);
          }}
          onDone={() => {
            setNotice(null);
            run.decide(cur.id, "returned");
          }}
          // 409・404 は小窓が閉じ、層に文を出して次へ。503 ほかは文を返し、小窓を開いたまま小窓の中に出す
          onFailed={(r) => (isGone(r) ? refused(r) : messageOf(r))}
        />
      ) : null}
    </>
  );
}
