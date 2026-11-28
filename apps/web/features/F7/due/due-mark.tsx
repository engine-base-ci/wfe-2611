// 期限・詰まりの印と、手で「詰まっています」と上げるボタン（F7・段 8 片付ける・D-151.1）。値を受け取って描くだけ（口は呼ばない）。
//   late＝期限切れの炎：一覧（list-table.tsx）と同じ線・同じ読み上げ「期限切れ」。詳細の頭・カレンダー・ガントにも同じ印を足す（案）。
//   soon＝期限間近・stuck＝詰まり：何日前から・何日続いたらかは会社が決める（F9・まだ無い）。段 8 は固定の既定（仮：期限間近 3 日前・保留 7 日・返事 3 日）で
//   印だけ出し、グレーで押せない形（pending・title に「準備中」・D-145.9）。字と色は状態の色の「待ち」（期限間近）と「止まった・失敗」（詰まり）（案）
import { Clock, Flame, OctagonAlert } from "lucide-react";
import { Button } from "@/components/k";

/** 期限切れ（炎）：label があれば炎の横に「1 日過ぎ」などの字 */
export function LateMark({ label }: { label?: string | undefined }) {
  return (
    <span className="k-f7-due-mark" data-kind="late">
      <span className="k-f7-due-late" role="img" aria-label="期限切れ">
        <Flame aria-hidden="true" />
      </span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}

/** 期限間近（案）：「あと 2 日」。押せない形（機能がまだ） */
function SoonMark({ label }: { label: string }) {
  return (
    <span className="k-f7-due-mark" data-kind="soon" data-pending aria-disabled="true" title="期限間近（準備中）">
      <Clock aria-hidden="true" />
      {label}
    </span>
  );
}

export type DueMarkProps = { kind: "late"; label?: string | undefined } | { kind: "soon"; label: string };

export function DueMark(p: DueMarkProps) {
  return p.kind === "late" ? <LateMark label={p.label} /> : <SoonMark label={p.label} />;
}

/** 詰まりの印（案）：「詰まっています」と、その理由の 1 行（保留が 7 日続いています など）。押せない形 */
export function StuckMark({ reason }: { reason?: string | undefined }) {
  return (
    <span className="k-f7-due-stuck">
      <span
        className="k-f7-due-mark"
        data-kind="stuck"
        data-pending
        aria-disabled="true"
        title="詰まっています（準備中）"
      >
        <OctagonAlert aria-hidden="true" />
        詰まっています
      </span>
      {reason ? <span className="k-f7-due-reason">{reason}</span> : null}
    </span>
  );
}

/** 手で「詰まっています」と上げるボタン（案）。上へ上げる仕組みは後なので押せない形（D-151.1・D-125.97） */
export function StuckUpButton() {
  return (
    <Button
      variant="outlined"
      size="sm"
      aria-disabled="true"
      tabIndex={-1}
      title="「詰まっています」と上げる（準備中）"
    >
      「詰まっています」と上げる
    </Button>
  );
}
