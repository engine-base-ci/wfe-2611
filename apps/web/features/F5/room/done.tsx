"use client";
// 分身の部屋「やったこと」（K-756・キャンバス RoomDone）：札（すべて・実行した・作った・止まった）・期間・日ごとの行・行からチケットへ。
//   「やり方・守ること・覚えていること」の行は段 10 で物が無くなったので出さない（行は 何をしたか・どのチケットか・どうなったか の 3 つ）。
//   書き出し（持ち出し）は作らない（代表の決め 2026-11-22）。空・読めない・読み込み中も在る。値を受け取って描くだけ
//   動き（K-756）：札の onFilter・期間の onPeriod と periods（選ぶ箱）・more（続き）・DoneFailed の onRetry は任意。渡さなければ今の見た目のまま（下絵を壊さない）
//   スマホ（767 以下）：表にせず、1 行を 1 枚のカードに（上に時刻・左に印・右に結果の札・本文は 2 行目から）。札は横に流せる 1 段・期間は次の段
import { ph } from "./phrase";
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Loading,
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
  PAGE_ERROR,
  TextLink,
  type BadgeTone,
} from "@/components/k";
import "./room.css";

export type DoneKind = "ran" | "made" | "stopped";
export interface DoneRow {
  id: string;
  time: string;
  kind: DoneKind;
  title: string;
  ticket: string;
  /** リンクの先のチケットの id（無ければ ticket を道に使う） */
  ticketId?: string;
  /** 1 行の詳しい様子（直された・止まった理由など） */
  detail?: string;
  result: string;
  tone: BadgeTone;
}
export interface DoneDay {
  label: string;
  rows: readonly DoneRow[];
}
export type DoneFilter = "all" | DoneKind;
const NOOP = (): void => undefined;
const MARK: Record<DoneKind, string> = { ran: "実", made: "作", stopped: "止" };
const FILTERS: readonly (readonly [DoneFilter, string])[] = [
  ["all", "すべて"],
  ["ran", "実行した"],
  ["made", "作った"],
  ["stopped", "止まった"],
];

export interface DoneSummary {
  total: number;
  passed: number;
  fixed: number;
  stopped: number;
}

/** 期間の選択肢（値と名） */
export interface DonePeriodOption {
  key: string;
  label: string;
}
/** 札・期間の動き（どれも任意） */
export interface DoneToolsActs {
  onFilter?: (kind: DoneFilter) => void;
  onPeriod?: (period: string) => void;
  periods?: readonly DonePeriodOption[];
}
/** 続きを読む：undefined は見本の押せないボタン・null は出さない・物を渡せば押せる */
export type DoneMore = { busy: boolean; onMore: () => void } | null | undefined;

function PeriodButton({ period, onPeriod, periods }: { period: string } & DoneToolsActs) {
  const text = `期間：${period} ▾`;
  if (!onPeriod || !periods?.length)
    return (
      <Button variant="outlined" size="sm" aria-haspopup="listbox">
        {text}
      </Button>
    );
  return (
    <Menu>
      <MenuTrigger className="k-btn" variant="outlined" size="sm">
        {text}
      </MenuTrigger>
      <MenuPopup>
        {periods.map((p) => (
          <MenuItem key={p.key} onSelect={() => onPeriod(p.key)}>
            {p.label}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

function Tools({ filter, period, onFilter, ...acts }: { filter: DoneFilter; period: string } & DoneToolsActs) {
  return (
    <div className="k-room-tools">
      <div className="k-room-chips" role="group" aria-label="やったことの絞り込み">
        {FILTERS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className="k-room-chip"
            aria-pressed={filter === key}
            {...(onFilter ? { onClick: () => onFilter(key) } : {})}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="k-room-tools-end">
        <PeriodButton period={period} {...acts} />
      </div>
    </div>
  );
}

function More({ more }: { more: DoneMore }) {
  if (more === null) return null;
  return (
    <div className="k-room-act k-room-more" role="group" aria-label="続きを読む">
      <Button
        variant="outlined"
        size="sm"
        {...(more ? { disabled: more.busy, onClick: () => (more.busy ? undefined : more.onMore()) } : {})}
      >
        もっと見る
      </Button>
    </div>
  );
}

function Row({ r }: { r: DoneRow }) {
  return (
    <li className="k-room-act">
      <span className="k-room-act-time">{r.time}</span>
      <span className="k-room-act-mark" data-kind={r.kind} aria-hidden="true">
        {MARK[r.kind]}
      </span>
      <div className="k-room-act-main">
        <div>
          <span className="k-room-act-title">{r.title}</span>
          <span className="k-room-act-ticket">
            <TextLink href={`/tickets/${r.ticketId ?? r.ticket}`}>{r.ticket}</TextLink>
          </span>
        </div>
        {r.detail ? <p className="k-room-act-detail">{r.detail}</p> : null}
      </div>
      <span className="k-room-act-end">
        <Badge tone={r.tone}>{r.result}</Badge>
      </span>
    </li>
  );
}

/** 札・期間と行。summary はこの期間の数（「この 1 週間 23 ・ そのまま通った 19 …」） */
export function RoomDone({
  days,
  filter = "all",
  period = "この 1 週間",
  summary,
  more,
  ...acts
}: {
  days: readonly DoneDay[];
  filter?: DoneFilter;
  period?: string;
  summary?: DoneSummary;
  more?: DoneMore;
} & DoneToolsActs) {
  return (
    <section className="k-room-card k-room-flush" aria-label="分身がやったことの記録">
      <Tools filter={filter} period={period} {...acts} />
      <ol className="k-room-log">
        {days.map((d) => (
          <li key={d.label}>
            <div className="k-room-day">{d.label}</div>
            <ol className="k-room-log">
              {d.rows.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <More more={more} />
      {summary ? (
        <p className="k-room-sum">
          <span>{period}</span>
          <span>
            やったこと <b>{summary.total}</b>
          </span>
          <span>
            そのまま通った <b>{summary.passed}</b>
          </span>
          <span>
            直された・差し戻し <b>{summary.fixed}</b>
          </span>
          <span>
            止まった <b>{summary.stopped}</b>
          </span>
        </p>
      ) : null}
    </section>
  );
}

/** 何も無い（札で絞ったら 0 件・まだ何もしていない） */
export function DoneEmpty({
  filter = "all",
  period = "この 1 週間",
  ...acts
}: { filter?: DoneFilter; period?: string } & DoneToolsActs) {
  return (
    <section className="k-room-card k-room-flush" aria-label="分身がやったことの記録">
      <Tools filter={filter} period={period} {...acts} />
      <Empty title={ph("この期間に", "やったことは", "ありません")}>
        {filter === "all"
          ? "チケットを任せると、やったことがここに時間の順で並びます"
          : "札を「すべて」に戻すか、期間を広げてみてください"}
      </Empty>
    </section>
  );
}

/** 読めない（正本 E-PAGE-007）。［もう一度］はいつも出す（onRetry が無ければ押せない形） */
export function DoneFailed({ onRetry }: { onRetry?: () => void } = {}) {
  return <ErrorState code={PAGE_ERROR.loadFailed} acts={[onRetry ?? NOOP]} />;
}
export function DoneLoading() {
  return <Loading delayMs={0} label="やったことを読んでいます…" />;
}
