"use client";
// 小窓の下絵（段 6 core）：止める・取り下げ・承認の確かめ（チェックの無い確認項目）・差し戻し・試し打ち・決めた履歴の取り消し。
//   どれも open で開いた形を描くだけ（押す関数は渡さない）。足のボタンは小窓の部品（Confirm・Dialog）のまま。
import { Button, Confirm, Dialog } from "@/components/k";
import { Choice } from "./choice";
import "./more.css";

const NOOP = () => undefined;
/** スマホでは小窓を下から出す（印のある小窓だけ・more.css）。見えない 1 要素で、PC の見た目は変えない */
const SheetMark = () => <i className="k-more-sheetmark" hidden aria-hidden="true" />;
const TARGET = "EG-128 セイコー様へ 11 月分の請求書を送る";

export function StopRunConfirm({ busy = false }: { busy?: boolean }) {
  return (
    <Confirm
      open
      onOpenChange={NOOP}
      onConfirm={NOOP}
      busy={busy}
      title="AI を止めます"
      confirmLabel="止める"
      description={`${TARGET}。高本のAI の作業を止めます（止められるのは担当者だけです）。止めたあとに届いた結果は使いません。もう一度 AI に任せることもできます`}
    >
      <SheetMark />
    </Confirm>
  );
}

export function StopApprovalConfirm({ busy = false }: { busy?: boolean }) {
  return (
    <Confirm
      open
      onOpenChange={NOOP}
      onConfirm={NOOP}
      busy={busy}
      title="承認待ちの成果物を使わずに止めます"
      confirmLabel="止める"
      description={`${TARGET}。この成果物は送りません。チケットは作業中に戻ります（止められるのは承認する人だけです）`}
    >
      <SheetMark />
    </Confirm>
  );
}

export function WithdrawConfirm({ busy = false }: { busy?: boolean }) {
  return (
    <Confirm
      open
      onOpenChange={NOOP}
      onConfirm={NOOP}
      busy={busy}
      tone="primary"
      title="承認を取り下げます"
      confirmLabel="取り下げる"
      description={`${TARGET}。PC がまだ受け取っていないので、承認待ちに戻せます。戻したあと、もう一度決められます`}
    >
      <SheetMark />
    </Confirm>
  );
}

/** 承認の確かめ：チェックの無い確認項目をその場で付けられる（聞くこと 4）。承認は止めない */
export function ApproveConfirmMore({ pending, picked }: { pending: readonly string[]; picked: readonly boolean[] }) {
  return (
    <Confirm
      open
      onOpenChange={NOOP}
      onConfirm={NOOP}
      tone="primary"
      title="承認して送ります"
      confirmLabel="承認して送る"
      caution={["取り消せません"]}
    >
      <SheetMark />
      <fieldset className="k-more-pending">
        <p>{`チェックの無い確認項目が ${pending.length} 件あります`}</p>
        <p className="k-more-detail">見て確かめた物は、ここでチェックを付けられます。付けなくても承認できます</p>
        {pending.map((t, i) => (
          <Choice key={t} kind="checkbox" checked={picked[i] ?? false}>
            {t}
          </Choice>
        ))}
      </fieldset>
      <Choice kind="checkbox" checked>
        成果物を目で見た
      </Choice>
    </Confirm>
  );
}

interface ReturnProps {
  who: "ai" | "self";
  note: string;
  /** 理由が空で押した */
  error?: string;
}

/** 差し戻す小窓：次は誰が直すか（AI／自分）を選べる。「どこを直すか」「覚えさせる候補」は外した（聞くこと 7） */
export function ReturnMoreDialog({ who, note, error }: ReturnProps) {
  return (
    <Dialog
      open
      onOpenChange={NOOP}
      title="差し戻す"
      target={TARGET}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>差し戻す</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <SheetMark />
        <label className="k-field">
          <span className="k-label">
            理由 <span className="k-field-required">必須</span>
          </span>
          <textarea
            className="k-input"
            aria-label="差し戻す理由"
            rows={2}
            value={note}
            readOnly
            aria-invalid={error ? true : undefined}
          />
          {error ? <span className="k-err">{error}</span> : null}
        </label>
        <fieldset className="k-dialog-group">
          <legend>次は誰が直すか</legend>
          <Choice kind="radio" name="who" checked={who === "ai"}>
            AI に直させる（作り直しを任せます）
          </Choice>
          <Choice kind="radio" name="who" checked={who === "self"}>
            自分で直す（チケットは作業中に戻ります）
          </Choice>
        </fieldset>
      </div>
    </Dialog>
  );
}

/** 試し打ちの確かめ：宛先は自分に差し替える（宛先を差し替えられない操作は実行せずに止まる） */
export function DryConfirm({ busy = false }: { busy?: boolean }) {
  return (
    <Confirm
      open
      onOpenChange={NOOP}
      onConfirm={NOOP}
      busy={busy}
      tone="primary"
      title="試し打ちします"
      confirmLabel="試し打ちする"
      description="あなた（takamoto@engine-base.example）宛てに送ります。本来の宛先には送りません。承認待ちはそのままで、何回でも試せます。試し打ちは任意で、しなくても承認できます"
    >
      <SheetMark />
      <p className="k-more-detail">宛先を差し替えられない操作（応募フォームなど）は、実行せずに止まります</p>
    </Confirm>
  );
}

/** 決めた履歴の［取り消す］の確かめ（取り下げ） */
export function UndoConfirm() {
  return (
    <Confirm
      open
      onOpenChange={NOOP}
      onConfirm={NOOP}
      tone="primary"
      title="この承認を取り下げます"
      confirmLabel="取り下げる"
      description="KR-031 入金の照合（10 月分）。実行はまだ始まっていないので、承認待ちに戻せます"
    >
      <SheetMark />
    </Confirm>
  );
}

export type BulkScope = "all" | "selected";
const BULK: Record<BulkScope, { title: string; count: number; irreversible: number; pending: number }> = {
  all: { title: "AI の成果物 6 件をまとめて承認します", count: 6, irreversible: 3, pending: 4 },
  selected: { title: "選んだ 2 件をまとめて承認します", count: 2, irreversible: 2, pending: 2 },
};

/** まとめて承認の確かめ：件数・取り消せない物の件数・チェックの無い確認項目の件数を出してから承認（聞くこと 9） */
export function BulkConfirm({ scope, busy = false }: { scope: BulkScope; busy?: boolean }) {
  const b = BULK[scope];
  return (
    <Confirm
      open
      onOpenChange={NOOP}
      onConfirm={NOOP}
      busy={busy}
      tone="primary"
      title={b.title}
      confirmLabel={`${b.count} 件を承認する`}
      caution={[`取り消せない物が ${b.irreversible} 件含まれます`]}
    >
      <SheetMark />
      <fieldset className="k-more-pending">
        <p>{`チェックの無い確認項目が ${b.pending} 件あります`}</p>
        <p className="k-more-detail">1 件ずつ中身を見ていない承認も含まれます。付けなくても承認できます</p>
      </fieldset>
    </Confirm>
  );
}
