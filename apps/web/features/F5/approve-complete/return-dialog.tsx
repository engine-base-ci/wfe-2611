"use client";
// 差し戻しの小窓（K-181・口は K-163 の returnApproval）。欄「差し戻す理由」（複数行・必須だが文字数の上限は置かない・D-131.1）。
//   ブラウザ標準の検証は使わない（required を付けず、空は小窓の中に正本の文 E-VAL-020）。
//   書きかけはその端末に残す（localStorage の kaname.k63.return.<承認の id>・送って 201 なら消す）。理由は文字のまま送る（HTML を作らない）
//   中身は段 6 の下絵 return-*（K-745）：対象の行・理由（必須）・次は誰が直すか（AI／自分・D-153.8・D-153.29）。
//   「どこを直すか」「覚えさせる候補」は外した（D-153.8・D-153.15）。開くたびに AI に印（前に選んだ物を持ち越さない）。
//   送る体は AI なら { note }（口の既定は clone・K-744）、自分なら { note, next_actor: "self" }。
//   自分で直す（答えの run_id が null）をチケットの詳細から送ったときだけ、作業中に戻した後の箱と帯の下の 1 行を積む（trail.ts・K-730）
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Dialog } from "@/components/k";
import { pushBand, pushTrail } from "@/features/F5/more/trail";
import { timelineKey } from "@/features/F6/thread/use-timeline";
import { call, type CallErr } from "@/lib/api/call";
import { me } from "@/lib/auth/ext";
import { catalogMessage } from "./message";
import "@/features/F5/more/more.css";

type Who = "clone" | "self";
const WHO: readonly { value: Who; label: string }[] = [
  { value: "clone", label: "AI に直させる（作り直しを任せます）" },
  { value: "self", label: "自分で直す（チケットは作業中に戻ります）" },
];

const draftKey = (approvalId: string) => `kaname.k63.return.${approvalId}`;
const readDraft = (approvalId: string): string => {
  try {
    return window.localStorage.getItem(draftKey(approvalId)) ?? "";
  } catch {
    return "";
  }
};
const writeDraft = (approvalId: string, v: string) => {
  try {
    if (v) window.localStorage.setItem(draftKey(approvalId), v);
    else window.localStorage.removeItem(draftKey(approvalId));
  } catch {
    /* 残せなくても差し戻せる */
  }
};

interface Props {
  approvalId: string;
  screenId: "approvals" | "tickets";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 差し戻せた（201） */
  onDone: () => void | Promise<void>;
  /** 口が断った（422 の欄 note は小窓の中に出す。それ以外は小窓を閉じ、呼んだ側が知らせて読み直す） */
  onFailed: (r: CallErr) => void | Promise<void>;
  /** 頭の下の対象の行（「EG-133 11 月分の請求書を送る」） */
  target?: string;
  /** チケットの詳細の帯から開いたときのチケットの id（自分で直すの後の箱と 1 行を積む先） */
  ticketId?: string;
}

/** 名は見ている人の display_name・読めなければ「自分」 */
async function viewerName(qc: ReturnType<typeof useQueryClient>): Promise<string> {
  try {
    const m = await qc.fetchQuery({ queryKey: ["me"], queryFn: me });
    return m.display_name || "自分";
  } catch {
    return "自分";
  }
}

export function ReturnDialog({ approvalId, screenId, open, onOpenChange, onDone, onFailed, target, ticketId }: Props) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [who, setWho] = useState<Who>("clone");
  const whoName = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();
  const sending = useRef(false); // 答えが来るまで 2 本目を送らない（押せない間の click も含む）
  useEffect(() => {
    if (open) {
      setNote(readDraft(approvalId));
      setWho("clone");
      setError(null);
    }
  }, [open, approvalId]);

  const send = async () => {
    if (sending.current) return;
    if (!note.normalize("NFKC").trim()) return setError(catalogMessage("E-VAL-020"));
    sending.current = true;
    setBusy(true);
    try {
      const body = who === "self" ? { note, next_actor: "self" } : { note };
      const r = await call("returnApproval", { params: { id: approvalId }, body, screenId });
      if (r.ok) {
        writeDraft(approvalId, "");
        setNote("");
        onOpenChange(false);
        const runId = (r.data as { run_id?: string | null } | null)?.run_id;
        if (ticketId && who === "self" && runId == null) {
          const name = await viewerName(qc);
          pushBand(ticketId, { title: `差し戻しました。次は ${name} が直します`, sub: `理由：${note}` });
          pushTrail(ticketId, `${name}が差し戻しました（直すのは自分）`);
          void qc.invalidateQueries({ queryKey: timelineKey(ticketId) });
        }
        await onDone();
        return;
      }
      if (r.status === 422 && r.fields["note"]) return setError(r.fields["note"]);
      if (r.status === 401) return; // 入り直し（共通の扱い）
      onOpenChange(false);
      await onFailed(r);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="差し戻す"
      open={open}
      onOpenChange={onOpenChange}
      actions={
        <>
          <Button variant="outlined" onClick={() => onOpenChange(false)}>
            やめる
          </Button>
          <Button onClick={() => void send()} loading={busy} disabled={busy}>
            差し戻す
          </Button>
        </>
      }
    >
      {/* 段の間は 12px（StReturnModal）。対象の行も同じ段に置く */}
      <div className="k-dialog-stack">
        {target ? <p className="k-dialog-target">{target}</p> : null}
        {/* スマホでは下から出す（more.css の印・見えない 1 要素で PC の見た目は変えない） */}
        <i className="k-more-sheetmark" hidden aria-hidden="true" />
        {/* 見える項目名は「理由」と必須の印・欄の名前は「差し戻す理由」（見える字が名前に含まれる）。理由は aria-describedby でつなぐ */}
        <label className="k-field">
          <span className="k-label">
            理由 <span className="k-field-required">必須</span>
          </span>
          <textarea
            className="k-input"
            aria-label="差し戻す理由"
            name="note"
            rows={2}
            value={note}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setNote(e.target.value);
              writeDraft(approvalId, e.target.value);
              if (error) setError(null);
            }}
          />
          {error ? (
            <span id={errorId} className="k-err">
              {error}
            </span>
          ) : null}
        </label>
        <fieldset className="k-dialog-group">
          <legend>次は誰が直すか</legend>
          {WHO.map((o) => (
            <label key={o.value} className="k-dialog-check k-more-choice">
              <input
                type="radio"
                name={whoName}
                value={o.value}
                checked={who === o.value}
                onChange={() => setWho(o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </Dialog>
  );
}
