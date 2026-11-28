"use client";
// 消す前の確認の中身（F7・段 8・A116・キャンバス TdDelete）：「一緒に起きること」の赤い箱・30 日戻せる注意・理由（任意）。
//   小窓 2 つ（子・孫が無い DeletePreview／ある DeleteChildrenDialog）が同じ中身を使う。値は props（口の下見の答え）で受けて描くだけ。
//   文はキャンバスの字のまま。承認待ち・走っている実行の件数は絵に無いので案（D-151.14・D-151.15）
import { TextField } from "@/components/k";
import "./delete.css";

/** 子・孫の扱い（D-125.62）：別の親へ移す・一緒に消す・親を外して単体にする */
export type ChildChoice = "move" | "cascade" | "detach";

/** 理由の上限（消す口 K-488 の上限と同じ 400 字） */
export const REASON_MAX = 400;

/** 消す前の下見（previewTicketDelete の答え＋P6 で足す 承認待ち・つながり・走っている実行の件数） */
export interface DeletePreviewData {
  number: string;
  title: string;
  /** 取り下げられる承認待ちの件数と宛先（「高本」。宛先の名前が分からないときは無しでよい） */
  approvals: number;
  approvalTo?: string | undefined;
  children: number;
  grandchildren?: number | undefined;
  /** つながりの数（外れるだけで残る。下見の答えは数だけで、番号は無い） */
  links: number;
  attachments: number;
  artifacts: number;
  /** 走っている AI の実行（止める・案） */
  runs: number;
  /** 戻せる日数（30） */
  restorableDays: number;
}

/** 子・孫の行。選んだ扱いで言い方が変わる（子・孫が無ければ選びは出さず、つながりの行だけ） */
function childLine(d: DeletePreviewData, choice: ChildChoice | undefined, parent: string | undefined): string {
  const links = `つながり ${d.links} 件は外れるだけで残る`;
  const kids = `子チケット ${d.children} 件${d.grandchildren ? `・孫 ${d.grandchildren} 件` : ""}`;
  if (choice === "move") return `${kids}は${parent ?? "選んだ親"}の下へ移る。${links}`;
  if (choice === "cascade") return `${kids}も一緒に消える。${links}`;
  if (choice === "detach") return `子チケット ${d.children} 件は親なしの単体で残る（孫は子の下のまま）。${links}`;
  return `子チケット ${d.children} 件、${links}`;
}

/** 「一緒に起きること」の行（件数が 0 のものは出さない。子・つながりの行は絵のとおりいつも出す） */
export function togetherLines(d: DeletePreviewData, choice?: ChildChoice, parent?: string): string[] {
  const lines: string[] = [];
  if (d.approvals > 0) {
    const to = d.approvalTo ? `${d.approvalTo} 宛 ` : "";
    lines.push(`承認待ちから取り下げられる（${to}${d.approvals} 件）`);
  }
  if (d.runs > 0) lines.push(`走っている AI の実行 ${d.runs} 件は止まる`);
  lines.push(childLine(d, choice, parent));
  if (d.attachments + d.artifacts > 0) lines.push(`添付 ${d.attachments} 件・成果物 ${d.artifacts} 件も消える`);
  return lines;
}

export interface DeleteBodyProps {
  data: DeletePreviewData;
  choice?: ChildChoice | undefined;
  parent?: string | undefined;
  reason: string;
  onReasonChange?: ((v: string) => void) | undefined;
}

export function DeleteBody({ data, choice, parent, reason, onReasonChange }: DeleteBodyProps) {
  return (
    <>
      <div className="k-dialog-caution k-f7-del-caution">
        <p>
          <b>一緒に起きること</b>
        </p>
        {togetherLines(data, choice, parent).map((t) => (
          <p key={t}>{`・ ${t}`}</p>
        ))}
      </div>
      <p className="k-f7-del-note">{`消したチケットは ${data.restorableDays} 日以内なら戻せます`}</p>
      <TextField
        name="reason"
        label="理由"
        hint="任意・記録に残る"
        value={reason}
        maxLength={REASON_MAX}
        onChange={(e) => onReasonChange?.(e.target.value)}
      />
    </>
  );
}
