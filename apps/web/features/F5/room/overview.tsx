"use client";
// 分身の部屋「ようす」（K-755・キャンバス Room・OnRoom・MbAI）：いま・このあと・あなたを待っている・止まった・育ち具合の数 3 つ。
//   値を受け取って描くだけ（口は呼ばない）。育ち具合は数だけ（聞くこと 11：任せた件数・直さずに通った割合・AI が動いた時間。
//   「よく直すところ → ルールにする」と「覚えたいこと」は段 10 で物が無くなったので出さない）。
//   PC がまだ（PS0）は案内の箱だけ・PC が閉じている（PS3）は「いま」を休み中に。文は全部文字として出す
//   スマホ（767 以下・キャンバス MbAI）：同じ部品を 1 列に積む（カードは全幅・「あなたを待っている」は指で押しやすい 1 行・案内の箱のボタンは全幅）。
//   下の入口（TalkEntry）は話すへ 1 タップで行ける貼り付く行
import { ph } from "./phrase";
import { Badge, Button, ErrorState, Loading, PAGE_ERROR } from "@/components/k";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import "./room.css";

export interface NowView {
  ticket: string;
  title: string;
  /** 「3 分前から」など（日本語の経過） */
  since: string;
  /** 進み（0〜100）。分からなければ出さない */
  percent?: number;
}
export interface NextRow {
  ticket: string;
  title: string;
  state: string;
  /** 橙で出す状態（承認済みなど、人の手を離れた物） */
  warn?: boolean;
}
export interface GrowthView {
  assigned: number;
  /** 直さずに通った割合（%）と先週の割合 */
  passRate: number | null;
  lastWeek?: number;
  /** AI が動いた時間（「6.2h」など） */
  workTime: string;
}
export interface RoomNow {
  /** いまやっていること。無ければ「いまは何もしていません」 */
  now: NowView | null;
  next: readonly NextRow[];
  waiting: { approvals: number; stopped: number };
  growth: GrowthView;
  /** PC が閉じている（PS3）：「いま」は休み中・このあとは PC が開くのを待つ */
  asleep?: boolean;
}

function NowCard({ now, asleep }: { now: NowView | null; asleep: boolean }) {
  if (asleep)
    return (
      <div className="k-room-now" data-tone="asleep">
        <span className="k-room-now-title">お休み中です</span>
        <span className="k-room-now-meta">PC が閉じています。開くと、すぐ続きを始めます</span>
      </div>
    );
  if (!now)
    return (
      <div className="k-room-now" data-tone="idle">
        <span className="k-room-now-title">いまは何もしていません</span>
        <span className="k-room-now-meta">チケットを任せると、ここに出ます</span>
      </div>
    );
  return (
    <a className="k-room-now" href={`/tickets/${now.ticket}`}>
      <span className="k-room-now-meta">{`${now.ticket} ・ ${now.since}`}</span>
      <span className="k-room-now-title">{now.title}</span>
      {now.percent !== undefined ? (
        <progress className="k-room-bar" max={100} value={now.percent} aria-label="進み" />
      ) : null}
    </a>
  );
}

function Stat({
  label,
  value,
  unit,
  sub,
  up,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  up?: boolean;
}) {
  return (
    <div
      className="k-room-stat"
      {...(up ? { "data-tone": "up" } : {})}
      {...(value === "—" ? { "data-empty": "" } : {})}
    >
      <dt>{label}</dt>
      <dd>
        <b>{value}</b>
        {unit ? <small>{unit}</small> : null}
        {sub ? <small>{sub}</small> : null}
      </dd>
    </div>
  );
}

export function GrowthCard({ g }: { g: GrowthView }) {
  const up = g.passRate !== null && g.lastWeek !== undefined && g.passRate > g.lastWeek;
  return (
    <section aria-labelledby="room-growth" className="k-room-card">
      <h2 id="room-growth">育ち具合（今週）</h2>
      <dl className="k-room-stats">
        <Stat label="任せた" value={String(g.assigned)} unit="件" />
        <Stat
          label="直さずに通った"
          value={g.passRate === null ? "—" : `${g.passRate}%`}
          {...(g.lastWeek !== undefined ? { sub: `先週 ${g.lastWeek}%` } : {})}
          up={up}
        />
        <Stat label="AI が動いた時間" value={g.workTime} />
      </dl>
      <p className="k-room-note">
        数は今週（月曜から）の分です。直さずに通った割合は、承認までに人が直さなかった物の割合です
      </p>
    </section>
  );
}

export function RoomOverview({ now, next, waiting, growth, asleep = false }: RoomNow) {
  const nothingWaiting = waiting.approvals === 0 && waiting.stopped === 0;
  return (
    <div className="k-room-grid">
      <section aria-labelledby="room-now" className="k-room-card">
        <h2 id="room-now">いま</h2>
        <NowCard now={now} asleep={asleep} />
        <p className="k-room-sublabel">{asleep ? "PC が開くのを待っている" : "このあと"}</p>
        {next.length === 0 ? (
          <p className="k-room-note">このあとの予定はありません</p>
        ) : (
          <ol className="k-room-next">
            {next.map((r, i) => (
              <li key={r.ticket}>
                <span className="k-room-next-no">{i + 1}</span>
                <span>{`${r.ticket} ${r.title}`}</span>
                <span className="k-room-next-end" {...(r.warn ? { "data-tone": "warn" } : {})}>
                  {r.state}
                </span>
              </li>
            ))}
          </ol>
        )}
        {nothingWaiting ? (
          <p className="k-room-wait">
            <b>あなたを待っている物はありません</b>
          </p>
        ) : (
          <a className="k-room-wait" href="/approvals">
            <b>あなたを待っています</b>
            {waiting.approvals > 0 ? <Badge tone="warning">{`承認 ${waiting.approvals}`}</Badge> : null}
            {waiting.stopped > 0 ? <Badge tone="danger">{`止まった ${waiting.stopped}`}</Badge> : null}
          </a>
        )}
      </section>
      <GrowthCard g={growth} />
    </div>
  );
}

/** PC がまだ（PS0・キャンバス OnRoom）：PC をつなぐ案内。話すだけはできるが、実行は PC が要る */
export function PcNone() {
  return (
    <div className="k-room-pc" data-tone="wait" role="status">
      <div className="k-room-pc-text">
        <b>PC がまだつながっていません</b>
        <p>分身はあなたの PC で動きます。PC をつなぐまで、チケットを進める（実行する）ことはできません</p>
      </div>
      <Button variant="primary">PC をつなぐ（3 分）</Button>
    </div>
  );
}

/** PC が閉じている（PS3）：開けば続きから進む */
export function PcClosed() {
  return (
    <div className="k-room-pc" data-tone="wait" role="status">
      <div className="k-room-pc-text">
        <b>PC が閉じています</b>
        <p>
          高本の MacBook を開くと、待っている仕事をすぐ始めます。承認から 24
          時間を過ぎた物は、実行の前にもう一度聞きます
        </p>
      </div>
      <Button variant="outlined">PC の様子を見る</Button>
    </div>
  );
}

/** はじめて（PS0・何もしていない）：話すだけはできる */
export function RoomFirst() {
  return (
    <section className="k-room-empty" aria-labelledby="room-first">
      <h2 id="room-first">{ph("高本のAI は", "まだ", "何も", "していません")}</h2>
      <p>
        PC をつなぐと、チケットを任せたり話しかけたりできます。いまやっていることや、あなたを待っている物がここに出ます
      </p>
      <div className="k-room-empty-acts">
        <InertButton>チケットを作る</InertButton>
      </div>
    </section>
  );
}

export function RoomLoading() {
  return <Loading delayMs={0} />;
}
export function RoomFailed() {
  return <ErrorState code={PAGE_ERROR.loadFailed} />;
}

/** スマホの下の入口（キャンバス MbAI の「〈名〉のAI と話す」）：下のタブの上に貼り付く 1 行。PC の幅では出さない（話すはタブから） */
export function TalkEntry({ name }: { name: string }) {
  return (
    <div className="k-room-entry" role="group" aria-label="話す">
      <span className="k-room-entry-text">{`${name} と話す`}</span>
      <Button variant="primary" size="sm">
        話す
      </Button>
    </div>
  );
}
