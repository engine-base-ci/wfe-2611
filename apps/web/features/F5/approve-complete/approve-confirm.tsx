"use client";
// 承認の確かめの小窓（K-229・D-143.4・キャンバス StApproveModal）。帯の「承認して送る」「承認する」と承認待ちの行の「承認する」は、
//   押してすぐ口を呼ばず、この小窓の主ボタンで口を呼ぶ。
//   取り消せない承認：題「承認して送ります」・赤い箱に注意（無ければ「取り消せません」）・「成果物を目で見た」に印を付けるまで送れない。
//   取り消せる承認：題「承認します」・注意とチェックなし・主ボタン「承認する」。
//   本人確認は取り直さない（D-128.177：キャンバスの「本人確認」の文と口は使わない）。
//   答えを待つ間は主ボタン・「やめる」が押せず、Esc でも閉じない（Confirm の busy）。開き直すと目で見たの印は外れている
//   「成果物を目で見た」の前は段 6 の差し込み口 ApproveChecksSlot（K-730・K-740 が確認項目を足す・最初は何も出さない）
import { useEffect, useState } from "react";
import { Confirm } from "@/components/k";
import { ApproveChecksSlot } from "@/features/F5/more/slots";

const IRREVERSIBLE = "取り消せません";
const SEEN = "成果物を目で見た";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 取り消せない承認か（既定は取り消せない） */
  irreversible: boolean;
  /** 取り消せない注意（承認の中身の cautions）。空なら「取り消せません」 */
  cautions: readonly string[];
  busy: boolean;
  onConfirm: () => void;
  /** 承認の id（段 6 の差し込み口に渡す・K-730）。無くても今のまま */
  approvalId?: string;
}

export function ApproveConfirm({ open, onOpenChange, irreversible, cautions, busy, onConfirm, approvalId }: Props) {
  const [seen, setSeen] = useState(false);
  // 見たことを持ち越さない：開くたびに印を外す
  useEffect(() => {
    if (open) setSeen(false);
  }, [open]);
  const mustSee = irreversible && !seen;
  return (
    <Confirm
      open={open}
      onOpenChange={onOpenChange}
      title={irreversible ? "承認して送ります" : "承認します"}
      confirmLabel={irreversible ? "承認して送る" : "承認する"}
      tone="primary"
      busy={busy}
      confirmDisabled={mustSee}
      {...(irreversible ? { caution: cautions.length ? cautions : [IRREVERSIBLE] } : {})}
      onConfirm={() => {
        if (!mustSee) onConfirm();
      }}
    >
      <ApproveChecksSlot {...(approvalId ? { approvalId } : {})} />
      {irreversible ? (
        <label className="k-dialog-check">
          <input type="checkbox" checked={seen} disabled={busy} onChange={(e) => setSeen(e.target.checked)} />
          <span>{SEEN}</span>
        </label>
      ) : null}
    </Confirm>
  );
}
