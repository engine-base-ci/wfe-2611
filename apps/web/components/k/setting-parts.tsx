// 自分の設定の画面のカードと行（段 2・枝 c/段2・キャンバス MeLogin）。「PC と使った量」（K-230）と同じ寸法なので、
//   見た目は正本の pc-*（カード・行・札・小さなボタン・段）と sec-summary だけを読む（setting-parts.css）。動きは持たない
import type { ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import "./setting-parts.css";

export type PillTone = "success" | "warning" | "neutral";

/** 札（2 つ・付けていない など） */
export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span className="k-set-pill" data-tone={tone}>
      {children}
    </span>
  );
}

/** 行の小さなボタン（高さ 30）。primary は紺の地 */
export function RowButton({ variant = "outlined", ...rest }: ButtonProps) {
  return <Button size="sm" variant={variant} className="k-set-btn" {...rest} />;
}

/** 白いカード（題・右の操作・行の並び） */
export function SettingCard({
  title,
  aside,
  children,
  labelledBy,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  labelledBy: string;
}) {
  return (
    <section className="k-set-card" aria-labelledby={labelledBy}>
      <div className="k-set-card-head">
        <h2 id={labelledBy}>{title}</h2>
        {aside ? <div className="k-set-card-aside">{aside}</div> : null}
      </div>
      <ul className="k-set-list">{children}</ul>
    </section>
  );
}

/** カードの 1 行（絵・名前・補足・札・ボタン）。disabled は出すが押せない形（D-145.9） */
export function SettingRow({
  icon,
  name,
  detail,
  pill,
  actions,
  disabled = false,
}: {
  icon?: ReactNode;
  name: ReactNode;
  detail?: ReactNode;
  pill?: ReactNode;
  actions?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <li className="k-set-row" data-off={disabled ? "" : undefined}>
      {icon ? (
        <span className="k-set-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="k-set-main">
        <span className="k-set-name">{name}</span>
        {detail ? <span className="k-set-detail">{detail}</span> : null}
      </span>
      {pill || actions ? (
        <span className="k-set-acts">
          {pill}
          {actions}
        </span>
      ) : null}
    </li>
  );
}

/** カードの下の注（11px・灰） */
export function SettingNote({ children }: { children: ReactNode }) {
  return <li className="k-set-note">{children}</li>;
}

/** 安全の状態のカード（安全＝緑・足りない＝橙） */
export function SecuritySummary({ tone, title, detail }: { tone: "ok" | "warn"; title: ReactNode; detail: ReactNode }) {
  return (
    <div className="k-sec-summary" data-tone={tone} role="status">
      <span className="k-sec-summary-icon" aria-hidden="true">
        {tone === "ok" ? "✓" : "!"}
      </span>
      <span className="k-set-main">
        <b>{title}</b>
        <span className="k-set-detail">{detail}</span>
      </span>
    </div>
  );
}

/** 番号つきの段（2 段階を付ける：済＝緑・今＝紺・まだ＝灰） */
export interface StepItem {
  title: ReactNode;
  desc?: ReactNode;
  state: "done" | "now" | "todo";
  body?: ReactNode;
}
export function Steps({ items }: { items: readonly StepItem[] }) {
  return (
    <ol className="k-set-steps">
      {items.map((s, i) => (
        <li key={i}>
          <span className="k-set-step-dot" data-state={s.state} aria-hidden="true">
            {s.state === "done" ? "✓" : i + 1}
          </span>
          <div className="k-set-main">
            <p className="k-set-step-title">{s.title}</p>
            {s.desc ? <p className="k-set-step-desc">{s.desc}</p> : null}
            {s.body}
          </div>
        </li>
      ))}
    </ol>
  );
}
