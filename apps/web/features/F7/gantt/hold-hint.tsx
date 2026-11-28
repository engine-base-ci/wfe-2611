"use client";
// 保留中のチケットを指したときの出し方（案・D-125.33）：理由と再開の条件。保留の小窓と帯は段 7 の物なので、ここは「見る」だけ。
//   詰まりの印は日数を決める F9 の後でないと出せないので、グレーで押せない形で置く（D-145.9）
import "../overview/tones.css";
import "./gantt.css";

export interface HoldHintProps {
  number: string;
  title: string;
  reason: string;
  resume: string;
  /** 「保留から 12 日」 */
  since: string;
}

export function HoldHint({ number, title, reason, resume, since }: HoldHintProps) {
  return (
    <div className="k-f7-gantt-hold" role="note" aria-label={`${number} の保留`}>
      <div className="k-f7-gantt-hold-head">
        <span className="k-f7-gantt-stage" data-f7-tone="hold">
          保留
        </span>
        <b>
          {number} {title}
        </b>
        <span className="k-list-dim">{since}</span>
        <span className="k-f7-gantt-stuck" aria-disabled="true" title="詰まりの印（準備中）">
          詰まり
        </span>
      </div>
      <dl className="k-f7-gantt-hold-body">
        <div>
          <dt>理由</dt>
          <dd>{reason}</dd>
        </div>
        <div>
          <dt>再開の条件</dt>
          <dd>{resume}</dd>
        </div>
      </dl>
    </div>
  );
}
