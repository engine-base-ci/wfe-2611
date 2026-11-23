"use client";
// 概要（キャンバス Overview・D-128.10・D-151.10）の部品：最近の更新・状態の内訳・残りの量・節目・分類ごと。値を受け取って描くだけ（K-480）。
//   契約どおりに出すのは 状態の内訳・節目の進み・最近の更新。「残りの量」と「分類ごと」は契約にも決定にも無いので、空の枠をグレーで押せない形に置く（D-145.9）。
//   節目は開始日・終わりの日の列が無い間は 0 件（空の一言を出す）。同じチケットはまとめて 1 行（D-128.10）
import type { ReactNode } from "react";
import type { Tone } from "./head";

export interface UpdateItem {
  initial: string;
  avatarTone: Tone;
  who: string;
  /** 「チケットを」「チケットに」など、名前の次に続く言葉 */
  verb: string;
  tag: string;
  tagTone: Tone;
  when: string;
  number: string;
  title: string;
  /** 変更の 1 行（「成果物を作成 → 確認 ① 2 件確実 …」） */
  change: string;
  href?: string;
}
export interface UpdateDay {
  label: string;
  items: readonly UpdateItem[];
}
export interface UpdateFilter {
  label: string;
  current?: boolean;
}
export interface UpdateFeedProps {
  filters: readonly UpdateFilter[];
  days: readonly UpdateDay[];
}

function Box({
  id,
  title,
  aside,
  empty,
  tip,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  /** 空の枠（グレー・押せない形） */
  empty?: boolean;
  tip?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="k-f7-overview-box"
      aria-labelledby={id}
      data-empty={empty || undefined}
      aria-disabled={empty ? "true" : undefined}
      title={tip}
    >
      <h2 id={id} className="k-f7-overview-box-title">
        {title}
        {aside ? <span className="k-f7-overview-box-aside">{aside}</span> : null}
      </h2>
      {children}
    </section>
  );
}

/** 最近の更新：日ごとの見出しと、1 件 3 行（誰が・どのチケット・変更の 1 行） */
export function UpdateFeed({ filters, days }: UpdateFeedProps) {
  return (
    <section className="k-f7-overview-box" aria-labelledby="k-f7-overview-feed">
      <div className="k-f7-overview-box-title">
        <h2 id="k-f7-overview-feed" className="k-f7-overview-box-heading">
          最近の更新
        </h2>
        <span className="k-f7-overview-chips" role="group" aria-label="更新の種類">
          {filters.map((f) => (
            <button
              key={f.label}
              type="button"
              className="k-f7-overview-chip"
              data-current={f.current || undefined}
              aria-pressed={f.current ?? false}
            >
              {f.label}
            </button>
          ))}
        </span>
      </div>
      {days.map((d) => (
        <div key={d.label} className="k-f7-overview-day">
          <h3 className="k-f7-overview-day-label">{d.label}</h3>
          <ul className="k-f7-overview-events">
            {d.items.map((e) => (
              <li key={`${e.number}-${e.tag}`} className="k-f7-overview-event">
                <span className="k-f7-overview-avatar" data-f7-tone={e.avatarTone} aria-hidden="true">
                  {e.initial}
                </span>
                <div className="k-f7-overview-event-body">
                  <div className="k-f7-overview-event-head">
                    <b>{e.who}</b> が {e.verb}
                    <span className="k-f7-overview-tag" data-f7-tone={e.tagTone}>
                      {e.tag}
                    </span>
                    <span className="k-list-dim k-f7-overview-event-when">{e.when}</span>
                  </div>
                  <div>
                    <a className="k-list-link k-list-number" href={e.href ?? "#"}>
                      {e.number}
                    </a>{" "}
                    <span>{e.title}</span>
                  </div>
                  <div className="k-list-dim">{e.change}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export interface StatusCount {
  label: string;
  count: number;
  tone: Tone;
}
export interface StatusBarProps {
  /** 「62% 完了（72 件中 45）」 */
  summary: string;
  counts: readonly StatusCount[];
}

/** 状態の内訳：1 本の棒と、状態ごとの件数 */
export function StatusBar({ summary, counts }: StatusBarProps) {
  return (
    <Box id="k-f7-overview-status" title="状態" aside={summary}>
      <div className="k-f7-overview-bar" role="img" aria-label="状態の内訳">
        {counts.map((c) => (
          <span key={c.label} data-f7-tone={c.tone} style={{ flexGrow: c.count }} />
        ))}
      </div>
      <dl className="k-f7-overview-counts">
        {counts.map((c) => (
          <div key={c.label}>
            <dt>{c.label}</dt>
            <dd data-f7-tone={c.tone}>{c.count}</dd>
          </div>
        ))}
      </dl>
    </Box>
  );
}

/** 残りの量（折れ線）：契約にも決定にも無いので、空の枠をグレーで置く */
export function RemainingLine() {
  return (
    <Box id="k-f7-overview-remaining" title="残りの量" empty tip="残りの量（準備中）">
      <div className="k-f7-overview-frame" aria-hidden="true" />
      <div className="k-f7-overview-legend" aria-hidden="true">
        <span>━ 実績</span>
        <span>┅ 予定</span>
      </div>
    </Box>
  );
}

export interface MilestoneRow {
  name: string;
  percent: number;
  /** 「11/30 まで ・ 残り 13 件」「10/31 終了」 */
  end: string;
  done?: boolean;
  href?: string;
}

/** 節目の進み。0 件のときは一言（案）を出す */
export function MilestoneList({ items }: { items: readonly MilestoneRow[] }) {
  return (
    <Box id="k-f7-overview-milestones" title="節目">
      {items.length === 0 ? (
        <p className="k-f7-overview-none">節目はまだありません</p>
      ) : (
        <ul className="k-f7-overview-milestones">
          {items.map((m) => (
            <li key={m.name}>
              <div className="k-f7-overview-milestone-head">
                <a className="k-list-link" href={m.href ?? "#"}>
                  {m.name}
                </a>
                <span className="k-list-dim">{m.percent}% 完了</span>
              </div>
              <div
                className="k-f7-overview-meter"
                role="img"
                aria-label={`${m.percent}% 完了`}
                data-f7-tone={m.done ? "success" : "indigo"}
              >
                <span style={{ inlineSize: `${m.percent}%` }} />
              </div>
              <div className="k-list-dim">{m.end}</div>
            </li>
          ))}
        </ul>
      )}
    </Box>
  );
}

/** 分類ごと：契約にも決定にも無いので、空の枠をグレーで置く */
export function ClassCounts() {
  return (
    <Box id="k-f7-overview-classes" title="分類ごと" empty tip="分類ごと（準備中）">
      <div className="k-f7-overview-frame" data-short aria-hidden="true" />
    </Box>
  );
}

export interface OverviewPanelsProps {
  feed: UpdateFeedProps;
  status: StatusBarProps;
  milestones: readonly MilestoneRow[];
}

/** 概要の本文：左に最近の更新、右に 状態・残りの量・節目・分類ごと */
export function OverviewPanels({ feed, status, milestones }: OverviewPanelsProps) {
  return (
    <div className="k-list-body">
      <section className="k-list-main" aria-labelledby="tickets-title">
        <UpdateFeed {...feed} />
      </section>
      <aside className="k-list-side" aria-label="概要の右の列">
        <StatusBar {...status} />
        <RemainingLine />
        <MilestoneList items={milestones} />
        <ClassCounts />
      </aside>
    </div>
  );
}
